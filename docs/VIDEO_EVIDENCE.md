# Evidencia de recepción sin conversión

Desde 2026-10-08 se conservan los videos originales, sin FFmpeg, servidor externo
ni proceso persistente. La aplicación Node.js verifica la subida y deja el video
READY en la misma confirmación. La bandera EVIDENCE_ENABLED controla nuevas
capturas; la consulta, confirmación de pendientes y limpieza siguen disponibles.
Solo los nuevos servicios INTERIOR requieren evidencia; no se alteran históricos.

## Operación y permisos

Dos videos con audio, interior y exterior, hasta 45 segundos y 25 MiB cada uno.
Se permite cámara o galería, reproducción previa y observación pública de hasta
1000 caracteres. Las grabaciones intentan 720p/30fps; los archivos de galería
conservan su resolución, orientación y calidad. No se recortan ni recomprimen.
MP4/MOV y WebM con codecs de navegador se verifican; la reproducción depende de
los codecs que admita el dispositivo del cliente. Probar Android/iPhone reales.

Administrador y Administrativo adjuntan a cualquier servicio. Encargado y
Colaborador adjuntan a servicios propios; consulta conserva permisos del historial.
Solo ADMIN sustituye videos aceptados o revoca/rota enlaces. Servicio, metadatos,
auditoría y fotos no se eliminan al vencer archivos. Compartir por WhatsApp es
manual y se habilita cuando ambas zonas están listas.

Los videos se suben uno por uno directamente a R2. No hay subida en segundo plano
ni recuperación al cerrar la PWA. La app conserva el borrador durante un fallo;
se puede editar la nota y reintentar con el mismo requestKey sin duplicar intentos.
Después de cerrar, seleccionar el archivo nuevamente. Máximo 20 intentos por
servicio/día. Un video ya aceptado no puede modificarse por repetir confirmación.

## Validación y almacenamiento privado

- evidence/originals/: temporal con PUT firmado por tamaño y autorización de
  cinco minutos. HEAD y GET condicional verifican tamaño/ETag; MediaInfo en
  WebAssembly examina contenedor, pistas, codecs, dimensiones y duración real.
  WebM de MediaRecorder sin Duration usa timestamps de bloques sin lacing.
  Archivos sin audio, inválidos, demasiado largos/grandes o no verificables
  se rechazan. No se confía solo en la extensión ni la duración del navegador.
- evidence/videos/: copia idéntica del original mediante CopyObject condicional
  dentro de R2, sin conversión ni descarga adicional al teléfono. Este destino
  privado nunca recibe una URL PUT del navegador y usa private,no-store.
  Así un PUT temporal aún vigente no puede sobrescribir el video aceptado.
- expiresAt: fecha de subida original + 10 días, nunca fecha de copia ni fecha
  editable del servicio. Copias/reintentos no amplían el plazo. Las confirmaciones
  concurrentes son idempotentes y registran una sola aceptación.
- Reproducción con tipo MIME original y GET temporal de máximo 60 segundos,
  limitado por expiresAt. Los MP4 convertidos de versiones anteriores conservan
  reproducción MP4. Página pública sin datos internos, índices, caché ni PWA.
- R2 lifecycle: turbo-evidence-originals / evidence/originals/ un día;
  turbo-evidence-videos / evidence/videos/ diez días. Solo temporales desaparecen
  al día; los originales aceptados ya están copiados al prefijo definitivo.
  Mantener ambas reglas y preservar las fotografías. R2 puede tardar hasta
  aproximadamente 24 horas extra en borrar; la app bloquea el acceso al instante.

Los enlaces son credenciales: no registrar tokens ni URLs firmadas, y omitirlos
al configurar access logs de proxy/APM. Revocar bloquea nuevas lecturas, pero no
elimina copias descargadas; URLs emitidas pueden durar hasta 60 segundos.

## Despliegue en hosting compartido

1. Aplicar las migraciones existentes con prisma migrate deploy. Esta adaptación
   no agrega columnas ni modifica migraciones aplicadas.
2. Desplegar la aplicación Node con mediainfo.js y su archivo WebAssembly.
   Next externaliza el paquete y el standalone incluye el WASM mediante tracing.
   No arrancar npm run evidence:worker: el conversor anterior está retirado.
3. Mantener R2 privado y configurar CORS para el dominio exacto.
4. Conservar las dos reglas lifecycle por prefijo indicadas arriba; no cambiar
   evidence/originals/ a diez días porque sigue siendo temporal.
5. Configurar EVIDENCE_CLEANUP_SECRET con un valor aleatorio de al menos 32
   caracteres en el entorno del servidor. Programar una tarea cada 15 minutos
   en hPanel que haga POST a /api/admin/evidence-cleanup con la cabecera
   Authorization: Bearer <secreto>. No incluir el secreto en la URL ni commits.
   Ejemplo de comando (sustituir el marcador en hPanel, conservarlo privado):

   curl --fail --silent --show-error --max-time 240 -X POST -H 'Authorization: Bearer <secreto>' https://seashell-coyote-471453.hostingersite.com/api/admin/evidence-cleanup

   La tarea elimina temporales abandonados, vencidos, fallidos, sustituidos y
   servicios borrados, sin modificar fotos. Tiene candado para evitar ejecuciones
   simultáneas y conserva errores para reintentar. No marca borrado si R2 falla.
   Administrador también puede ejecutar limpieza desde el panel.
6. Revisar el monitoreo: última limpieza, pendientes por verificar y fallos.
   npm run evidence:health consulta la limpieza; no necesita heartbeat de FFmpeg.
7. Para videos QUEUED/PROCESSING anteriores, abrir su evidencia y pulsar
   Verificar videos subidos. Reutiliza el original y conserva su vencimiento.
   Si R2 ya borró el temporal, seleccionar el archivo de nuevo; no se finge
   que un archivo ausente está disponible.
8. Probar cámara/galería, notas, reproducción cruzada y WhatsApp en teléfonos
   físicos antes de ampliar el piloto. Si falla, deshabilitar nuevas capturas
   manteniendo consultas y limpieza.

Variables de entorno nuevas: EVIDENCE_ENABLED, EVIDENCE_ALLOWED_ORIGINS y
EVIDENCE_CLEANUP_SECRET. Se reutilizan las credenciales R2 privadas existentes.
R2_TEST_ENDPOINT solo se acepta con APP_ENV=local, nunca en producción.

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

## Verificación

npm run lint, npm run build (en copia aislada sin .env.production),
npm run test:evidence y npm run evidence:build. La integración actual es
 tests/evidence-original-integration.ts, con MySQL desechable turbo_evidence_test,
APP_ENV=local y R2_TEST_ENDPOINT local. Usa los fixtures landscape.mp4,
browser.webm sin Duration, long.mp4 y silent.mp4 generados con FFmpeg en pruebas
(ver generación al inicio de tests/evidence-integration.ts). FFmpeg solo genera
fixtures de prueba: no se instala ni ejecuta en la aplicación desplegada.

Ejecutar node --env-file=.env --import tsx tests/evidence-original-integration.ts.
EVIDENCE_TEST_ORIGIN y EVIDENCE_TEST_FIXTURE_DIR permiten separar entornos.
La suite anterior evidence-integration.ts y processor/worker.ts documentan la
versión con conversión; no representan el flujo actual ni deben ejecutarse en
producción. Nunca ejecutar pruebas con datos o R2 reales.

## Referencias

- https://developers.cloudflare.com/r2/buckets/cors/
- https://developers.cloudflare.com/r2/buckets/object-lifecycles/
- https://mediainfo.js.org/docs/getting-started/usage/

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
