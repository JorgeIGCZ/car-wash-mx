## Desarrollo local

Requisitos: Node.js 22+, Docker y Docker Compose.

```bash
docker compose up -d mysql adminer
npm install
npx prisma migrate dev
npm run db:seed
npm run dev
```

Aplicacion: http://localhost:3000
Adminer: http://localhost:8080 (sistema MySQL, servidor `mysql`, usuario
`turbo`, contrasena `turbo`, base `turbo_wash`)

## Build

```bash
npm run build
npm run start
```

## Base de datos (siempre contra `.env` / desarrollo local)

```bash
npm run db:migrate
npm run db:seed
npm run prisma:generate
```

## Base de datos en produccion (requiere comandos explicitos, usan `.env.production`)

```bash
npm run db:status:production
npm run db:migrate:production
```

No copiar `.env.production` sobre `.env`.

## Verificacion antes de cerrar una tarea

```bash
npm run lint
npm run build
npm audit --omit=dev
```

## Docker

```bash
docker compose build
docker compose up -d
docker compose logs -f
```

## Variables de entorno relevantes

Acceso inicial (solo necesarias antes del primer seed):

```text
INITIAL_ADMIN_NAME
INITIAL_ADMIN_EMAIL
INITIAL_ADMIN_PASSWORD
```

Cloudflare R2 (fotografias de lavados):

```text
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET_NAME
```
