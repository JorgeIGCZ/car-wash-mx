# Evidencia de recepción

Implementada detrás de `EVIDENCE_ENABLED=true` (apagada por defecto). Solo los
servicios INTERIOR creados mientras está habilitada requieren evidencia. Los
anteriores y las fotos existentes conservan su comportamiento. Apagar la bandera
impide nuevas cargas; la consulta, cola y limpieza de videos existentes siguen
funcionando.

## Operación

Al registrar un servicio se puede adjuntar Interior y Exterior, con audio, hasta
45 segundos y 25 MiB cada uno. Se permite cámara o galería, vista previa y una
observación pública independiente de los comentarios internos. Una carga fallida
no borra el servicio. Desde Historial se puede completar o reintentar la evidencia.
Las dos zonas deben estar listas para preparar el enlace de WhatsApp. Compartir
abre el selector del usuario; no se envían mensajes automáticamente.

Encargado y Colaborador suben para su propio servicio. Administrador y
Administrativo suben para cualquiera. Consulta sigue la visibilidad del historial.
Solo ADMIN sustituye evidencia aceptada o revoca/rota enlaces. La sustitución
invalida el archivo anterior y conserva auditoría; la nueva carga debe validarse.
Una carga en curso ocupa su zona hasta concluir o vencer. Máximo 20 intentos por
servicio cada 24 horas. Al vencer una autorización, preparar otro intento desde el
panel; si se cerró la página es necesario volver a seleccionar el archivo.

Las grabaciones del navegador no se guardan automáticamente en la galería. El
botón para guardar una copia permite conservar el archivo antes de salir. No hay
subidas en segundo plano ni recuperación automática al cerrar la PWA. Los videos
se envían secuencialmente; reintentar vuelve a enviar el archivo completo.

## Almacenamiento, procesamiento y vencimiento

- `evidence/originals/`: archivo temporal privado, URL PUT válida 5 minutos y
  tamaño firmado. HEAD confirma tamaño y ETag; GET condicional evita procesar un
  original cambiado. La validación de FFprobe exige audio, video y duración/tamaño
  permitidos. No se confía solo en extensión o metadatos del navegador.
- `evidence/videos/`: MP4 H.264/AAC, hasta 720p, orientación conservada, faststart,
  un video por trabajo y sin caché persistente. La conversión no reduce los datos
  móviles que ya se gastaron en subir el original.
- Cola en `EvidenceVideo`, lease de un único procesador en `EvidenceWorkerState`;
  heartbeat cada 30 s, recuperación de PROCESSING tras reinicio y hasta tres
  intentos ante fallos transitorios. Los errores de validación son terminales.
- Vencimiento absoluto: Last-Modified del original confirmado + 10 días. No cambia
  al editar la fecha del servicio ni al convertir el archivo.
- El enlace público valida servicio, token y vigencia en cada solicitud de acceso.
  Los GET firmados duran como máximo 60 segundos, limitados además por expiresAt.
  Revocar detiene nuevos accesos; una URL ya emitida puede funcionar hasta 60 s.
  Las copias ya descargadas no pueden revocarse.
- Limpieza cada 15 minutos: vencidos, sustituidos, fallidos, servicios eliminados y
  subidas abandonadas. Los originales se eliminan al convertir y se comprueba de
  nuevo después de vencer el PUT para evitar recreaciones con una URL aún válida.
  No se marca borrado como completo si R2 falla. Se conserva metadata/auditoría.
- Respaldo R2: originales 1 día, procesados 10 días; el ciclo de vida cuenta la edad
  del objeto en R2, no expiresAt de MySQL. Cloudflare puede tardar aproximadamente
  24 horas adicionales en eliminar. La app no depende de ello para negar acceso.

Los enlaces de evidencia son credenciales de acceso. El proxy/CDN/APM debe omitir
los segmentos token de `/evidencia/*` y `/api/evidence/*` de sus access logs; no se
agregan analytics ni recursos externos a esa página. No registrar URLs firmadas.
La página muestra solo folio, vehículo, paquete, zona, observación y vencimiento.
El service worker existente no cachea estas rutas. La pagina publica no registra
la PWA ni ofrece instalar la app interna; excluye manifest y metadata Apple PWA.

## Despliegue

Requiere MySQL y un proceso persistente con Node 22, FFmpeg/FFprobe y acceso al
bucket privado. El Dockerfile principal ya no ejecuta migraciones durante build;
la migración se ejecuta explícitamente antes de arrancar la aplicación nueva.
`.dockerignore` excluye archivos de entorno y credenciales del contexto de Docker.

1. Respaldar MySQL y aplicar migraciones en el ambiente destino con
   `npx prisma migrate deploy`. La migración nueva agrega tablas y columnas con
   `evidenceRequired=false` para filas existentes.
2. Desplegar la aplicación con `EVIDENCE_ENABLED=false`.
3. Construir el procesador:
   `docker build -f Dockerfile.evidence -t turbo-evidence-worker .`.
4. Pasarle la misma DATABASE_URL y configuración R2 privada de la aplicación.
   Arrancar un solo proceso `node worker-dist/scripts/evidence-worker.js`.
   `compose.evidence.yml` ofrece un contenedor con reinicio, usuario sin privilegios,
   filesystem de solo lectura y /tmp limitado; requiere `EVIDENCE_ENV_FILE` explícito.
   La URL de MySQL debe ser accesible desde el contenedor (localhost del host no
   equivale a localhost del contenedor).
5. Configurar `EVIDENCE_ALLOWED_ORIGINS` con los orígenes HTTPS exactos, separados
   por comas. En la imagen del procesador ejecutar primero
   `node worker-dist/scripts/configure-evidence-r2.js` para revisar la propuesta;
   añadir `--apply` para aplicar. Lee y conserva las reglas ajenas de lifecycle y
   CORS. Requiere permisos de configuración del bucket; si las credenciales de
   subida carecen de ellos, usar credenciales administrativas solo para este paso.
6. Verificar bucket privado, CORS y reglas por prefijo en Cloudflare. Confirmar
   que no haya otra regla previa que borre los videos antes del plazo previsto.
7. Verificar heartbeat y limpieza con `npm run evidence:health` (compilar primero
   con `npm run evidence:build` fuera de Docker). En la aplicación ADMIN tiene
   `/api/admin/evidence-status` y resumen de monitoreo en Historial administrativo.
8. Activar `EVIDENCE_ENABLED=true` para el piloto tras las verificaciones anteriores.

Variables nuevas:

### CORS manual en el panel de Cloudflare

Las reglas de eliminacion no habilitan las subidas desde el navegador. En R2,
seleccionar el bucket, Settings → CORS Policy y agregar esta regla para el
dominio actual de produccion. Conservar otras reglas existentes si las hay:

```json
[
  {
    "AllowedOrigins": ["https://seashell-coyote-471453.hostingersite.com"],
    "AllowedMethods": ["GET", "HEAD", "PUT"],
    "AllowedHeaders": ["content-type", "range", "x-amz-*"],
    "ExposeHeaders": ["ETag", "Content-Length", "Content-Range"],
    "MaxAgeSeconds": 300
  }
]
```

No agregar `/admin` al origen ni habilitar acceso publico al bucket. Si cambia
el dominio, actualizar AllowedOrigins. Documentacion oficial:
https://developers.cloudflare.com/r2/buckets/cors/

Reintentos: conservar requestKey para el mismo archivo; antes de confirmar,
se puede corregir la observacion de una carga UPLOADING sin duplicar registros.
No se modifican notas de videos ya enviados a procesamiento. Prueba focalizada:
`node --env-file=.env --import tsx tests/evidence-retry-integration.ts`, solo con
MySQL desechable `turbo_evidence_test` y almacenamiento simulado local.

Variables de entorno:

```
EVIDENCE_ENABLED=false
EVIDENCE_ALLOWED_ORIGINS=https://dominio-real-de-la-app
```

Se reutilizan R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY y R2_BUCKET_NAME.
`FFMPEG_PATH` y `FFPROBE_PATH` son opcionales. `R2_TEST_ENDPOINT` se acepta solo con
APP_ENV=local, para el simulador de pruebas; nunca configurarlo en producción.

El destino real de despliegue y el piloto físico deben confirmarse con el
operador. La entrega de código no implica que las reglas de R2 o el worker estén
instalados en producción.

## Verificación y piloto

`npm run test:evidence`, `npm run lint`, `npx tsc --noEmit`,
`npm run evidence:build` y `npm run build`.
Ejecutar build en copia aislada sin .env.production. Nunca usar ese archivo en
desarrollo local ni copiarlo sobre .env.

Las pruebas de integración usan `tests/fake-r2.ts` en 127.0.0.1:3013 y Next en
127.0.0.1:3012 con EVIDENCE_ENABLED=true. La base debe llamarse
`turbo_evidence_test` en 127.0.0.1 y contener las migraciones; la suite rechaza otro
entorno. Requiere FFmpeg/FFprobe locales (o wrappers Docker) y un .env de pruebas
con R2 ficticio y R2_TEST_ENDPOINT=http://127.0.0.1:3013. Ejecutar
`node --env-file=/ruta/absoluta/al/env-de-pruebas --import tsx tests/evidence-integration.ts`.
El simulador no valida firmas AWS: la prueba de CORS/firmas contra R2 real es parte
del piloto. La suite crea datos ficticios y adelanta el reloj de limpieza: usar exclusivamente
una base desechable diferente de la utilizada para pruebas interactivas.
`EVIDENCE_TEST_ORIGIN`, `EVIDENCE_FAKE_STORAGE_PORT` y
`EVIDENCE_TEST_FIXTURE_DIR` permiten separar servidor, almacenamiento y archivos
de otros entornos locales. R2_TEST_ENDPOINT debe apuntar a 127.0.0.1.

Piloto pendiente en Android Chrome, iPhone Safari y ambas PWA:

- Cámara y galería, audio, video horizontal/vertical y reproducción cruzada.
- Detalle visible de manchas/daños a 720p y que 45 s alcance para cada recorrido.
- Tamaño y tiempo por video con los datos del autolavado, hasta 1–5 servicios/día.
- Denegar permisos de cámara, interrumpir datos, cerrar/reabrir y reintentar.
- Confirmar que WhatsApp comparta solo evidencia pública; no marcar "conforme".
- Verificar expiración, limpieza real en R2 y errores/heartbeat de procesamiento.

Si el piloto falla, apagar EVIDENCE_ENABLED y mantener worker/limpieza funcionando
hasta agotar las evidencias existentes. No borrar tablas ni revertir destructivamente
la migración. Supervisar trabajos con error y videos vencidos pendientes de eliminar.

## Referencias

- [Carga a R2](https://developers.cloudflare.com/r2/objects/upload-objects/).
- [Ciclo de vida y demora del borrado](https://developers.cloudflare.com/r2/buckets/object-lifecycles/).
- [Compatibilidad de la API S3](https://developers.cloudflare.com/r2/api/s3/api/).
- [Formatos y faststart de FFmpeg](https://www.ffmpeg.org/ffmpeg-formats.html).

## Fotos seleccionadas para el cliente

Las mismas fotos del servicio (hasta seis) pueden marcarse en Evidencia de
recepcion como **Visible para el cliente**, con una observacion publica opcional
(maximo 1000 caracteres). Hay que guardar los cambios. Todas quedan privadas por
defecto, incluidas las anteriores a la migracion. Los permisos para publicar son
los mismos que para adjuntar evidencia: administracion en cualquier servicio y
encargado/colaborador solo en servicios propios. Participantes pueden consultar
sin publicar. Los controles existen en servicios que requieren evidencia.

El enlace ya usado para los videos muestra solo fotos marcadas y vigentes. La
habilitacion de compartir sigue requiriendo ambos videos listos. Cada foto vence
para el cliente exactamente 10 dias despues de `WashPhoto.createdAt` (subida
original), sin reiniciarse al marcarla o editar la fecha del servicio. Desmarcar,
revocar/rotar el enlace o eliminar el servicio bloquea nuevas lecturas publicas.
Una foto vencida permanece disponible internamente: no se borra ni se copia su
objeto de R2 ni se cambia su politica de almacenamiento. La bandera de captura
no impide administrar la visibilidad de fotos ya existentes.

Las fotos publicas se sirven mediante un endpoint de la app que comprueba token,
visibilidad y vencimiento en cada solicitud y transmite el objeto privado de R2
con `private, no-store`. No hereda la cache anual del original ni expone su clave.
Como con cualquier evidencia, retirar el acceso no elimina copias ya guardadas
por el destinatario. Las observaciones de foto no usan comentarios internos.

La migracion `20261008041916_add_client_photo_visibility` debe aplicarse antes de
publicar esta version. La prueba `tests/evidence-photos-integration.ts` requiere
MySQL desechable `turbo_evidence_test`, `APP_ENV=local`, `R2_TEST_ENDPOINT` local y
el S3 ficticio; ejecutar `node --env-file=.env --import tsx
tests/evidence-photos-integration.ts` en el entorno aislado. Incluye privacidad,
los cuatro roles, notas, idempotencia/auditoria, caducidad, revocacion y servicio
eliminado sin borrar fotos originales.
