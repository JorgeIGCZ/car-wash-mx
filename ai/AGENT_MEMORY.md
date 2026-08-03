## Lecciones aprendidas

### Arquitectura

- La logica de servidor (sesiones, prisma, R2, calculo de semana laboral)
  vive en `src/lib/`, no dentro de componentes ni route handlers.
- Las comisiones se calculan con las reglas vigentes al momento del lavado
  y se guardan en `WashCommission` para conservar el historico aunque las
  reglas cambien despues. No recalcular comisiones historicas al editar
  reglas.
- Los lavados eliminados usan soft delete en `Wash.deletedAt` y
  `Wash.deletedById`; las consultas operativas deben filtrar
  `deletedAt: null` para no contar ingresos/comisiones ni permitir nuevas
  fotos sobre servicios eliminados.
- Los egresos operativos viven en `Expense`, se aplican por `expenseDate` y
  siempre reducen la ganancia neta del periodo en la vista global. Solo
  generan reembolso a socio cuando `reimbursable=true`, `takenFromCash=false`
  y tienen `partnerId`; los egresos tomados de caja no se reembolsan.
- En el detalle de ganancia, distinguir utilidad contable de flujo de caja:
  los egresos tomados de caja reducen la caja disponible directamente; los
  reembolsables fuera de caja reducen la ganancia neta y luego se suman al
  socio que los pago al calcular el total a entregar.
- Cuando un usuario `ADMIN` que tambien es socio captura un egreso
  reembolsable, el reembolso debe asignarse automaticamente a ese mismo
  socio. Un `ADMIN` no socio o un `ADMINISTRATIVE` puede capturar egresos
  reembolsables a nombre de un socio activo.
- Los socios se modelan sobre usuarios `ADMIN` activos con `isPartner` y
  `partnerSharePercentage`; el detalle de reparto requiere que sus
  porcentajes sumen 100%.
- `UserRole` tiene tres niveles: `ADMIN` (control total), `ADMINISTRATIVE`
  (consulta historial/comisiones y puede capturar lavados a nombre de un
  `ADMIN` o `EMPLOYEE`, sin editar precios ni configuracion),
  `EMPLOYEE`/encargado (solo su propio historial).
- La autorizacion de subida de fotos para lavados vive en
  `src/app/api/washes/[id]/photos/route.ts`; si un rol puede crear lavados a
  nombre de otro usuario, tambien hay que revisar esa ruta porque filtra por
  `createdById` para roles sin acceso administrativo.

### Entornos y datos

- `.env` es exclusivamente para desarrollo local; `.env.production` esta
  ignorado por Git y solo se usa con los scripts `*:production` explicitos.
  Nunca copiar `.env.production` sobre `.env`.
- Al importar un dump de produccion en la base local, `prisma migrate dev`
  puede pedir reset por drift/checksum de migraciones historicas aunque falte
  solo una migracion nueva. Para preservar los datos importados, verificar con
  `npx prisma migrate status` y aplicar pendientes con
  `npx prisma migrate deploy` usando `.env` local.
- En la base local importada, `npx prisma migrate status` y
  `npx prisma migrate deploy` pueden fallar sin detalle con
  `Schema engine error` aunque MySQL este healthy. Si el codigo ya tiene una
  migracion pendiente y Prisma no puede ejecutarla, verificar columnas con
  MySQL directo antes de diagnosticar bugs de app; el caso visto fue
  `20260802093000_add_wash_soft_delete`, donde faltaban `Wash.deletedAt` y
  `Wash.deletedById`.
- RIESGO CONFIRMADO (2026-07-07): Next.js carga automaticamente
  `.env.production` cuando `NODE_ENV=production`, y sus valores tienen
  prioridad sobre `.env`. Por eso `npm run start` local se conecta a la
  base de PRODUCCION, no a la local (verificado en runtime: Prisma intento
  autenticar contra el usuario remoto). El aislamiento que describe el
  README solo aplica a `npm run dev`. Pendiente de corregir (por ejemplo
  renombrando el archivo a un nombre fuera de la convencion de Next).
- `npm run start` ademas emite warning: no es compatible con
  `output: "standalone"`; el camino soportado es
  `node .next/standalone/server.js` (Docker ya lo hace bien).
- La app usa `TZ=America/Mexico_City` (fijado en los scripts de `package.json`)
  para calcular dias, semanas e historiales — no asumir UTC al depurar
  fechas.
- Las fotografias en R2 se sirven via enlaces privados con vigencia de 15
  minutos; no se debe intentar servirlas como URLs publicas permanentes.

### Testing / verificacion

- No hay suite de tests automatizados todavia; la verificacion estandar es
  `npm run lint` + `npm run build` (ver `ai/RUNBOOK.md`).

### UX

- El flujo de `/register` es el camino principal de uso diario para los
  encargados: mantenerlo corto y evitar pasos o explicaciones adicionales
  antes de completar el registro.
- En `/register`, los roles con acceso administrativo (`ADMIN` y
  `ADMINISTRATIVE`) deben elegir explicitamente el responsable del servicio;
  el endpoint `/api/washes` exige `createdById` para ambos roles y solo acepta
  usuarios activos `ADMIN` o `EMPLOYEE`.
- Sin integracion formal de WhatsApp no se pueden listar ni seleccionar
  grupos desde la app web. La alternativa viable es abrir `wa.me/?text=...`
  para que WhatsApp muestre su selector de chats/grupos; fotos solo pueden
  compartirse como archivos locales con Web Share API cuando el dispositivo y
  WhatsApp lo soportan. Las fotos guardadas en R2 son privadas y sus enlaces
  firmados expiran, asi que no deben tratarse como links permanentes para
  compartir.
