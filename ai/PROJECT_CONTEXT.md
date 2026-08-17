## Proyecto

Turbo Wash: aplicacion web para registrar y consultar los servicios de un
auto spa (Turbo Wash Auto Spa). Instalable como PWA en celulares.

## Objetivo actual

Mantener y evolucionar el registro de lavados, comisiones y administracion
del catalogo, con foco en un flujo de registro rapido para los encargados.

## Alcance actual

- Login con roles: administrador, administrativo, encargado.
- Registro de lavado normal, interiores y servicio especial, con tipo de pago.
- El personal administrativo puede registrar lavados a nombre de un
  administrador o encargado activo.
- Tipos de vehiculo y precios por combinacion de paquete y vehiculo,
  configurables.
- Fotografias privadas por lavado (hasta 6), almacenadas en Cloudflare R2.
- Historial por dia, semana, mes o rango de fechas; historial global
  filtrable por usuario en Administracion.
- Comisiones por usuario, paquete y vehiculo (porcentaje o monto fijo), con
  calculo de ganancia neta e historico conservado aunque cambien las reglas.
- Egresos operativos administrables, con impacto en ganancia neta y detalle
  de reparto/reembolsos para socios.
- Catalogo, precios y usuarios administrables desde el panel de Admin.

## Stack

- Next.js 15 (App Router) + React 19, TypeScript.
- Prisma 6 + MySQL.
- Cloudflare R2 (via `@aws-sdk/client-s3`) para fotografias.
- `sharp` para procesar/optimizar imagenes (WebP, max 1920x1920, calidad 82).
- `zod` para validacion, `bcryptjs` para contrasenas.
- Docker Compose para MySQL + Adminer en desarrollo local.
- PWA con service worker (solo cachea recursos publicos, nunca datos de API).

## Arquitectura

- `src/app/`: rutas App Router.
  - `(protected)/`: paginas que requieren sesion (admin, history, personnel,
    register).
  - `api/`: route handlers (auth, washes, admin/*, bootstrap).
  - `login/`, `change-password/`: paginas publicas o de transicion.
- `src/components/`: componentes de UI de las pantallas principales
  (AdminPanel, AppShell, RegisterWash, WashHistory, etc).
- `src/lib/`: logica de servidor compartida — `auth.ts` (sesiones),
  `prisma.ts` (cliente), `r2.ts` (subida/lectura de fotos), `format.ts`,
  `work-week.ts` (calculo de semana laboral para historial).
- `src/types/domain.ts`: tipos de dominio compartidos.
- `prisma/`: `schema.prisma`, migraciones, `seed.ts`.

## Rutas o modulos importantes

- `/login`: autenticacion.
- `/register`: registro de lavados (flujo principal para encargados).
- `/history`: historial de lavados propio o global segun rol.
- `/personnel`: gestion de personal.
- `/admin`: catalogo, precios, comisiones, usuarios (solo ADMIN puede editar;
  ADMINISTRATIVE tiene acceso de solo consulta al historial/comisiones).
- `/change-password`: cambio obligatorio de contrasena en primer acceso.

## Comandos principales

Ver `ai/RUNBOOK.md`.
