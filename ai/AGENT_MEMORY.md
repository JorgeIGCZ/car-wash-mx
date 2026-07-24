## Lecciones aprendidas

### Arquitectura

- La logica de servidor (sesiones, prisma, R2, calculo de semana laboral)
  vive en `src/lib/`, no dentro de componentes ni route handlers.
- Las comisiones se calculan con las reglas vigentes al momento del lavado
  y se guardan en `WashCommission` para conservar el historico aunque las
  reglas cambien despues. No recalcular comisiones historicas al editar
  reglas.
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
