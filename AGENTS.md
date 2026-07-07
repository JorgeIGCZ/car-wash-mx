# Instrucciones para agentes

Siempre leer este archivo completo antes de realizar cambios.

## Flujo de trabajo

Antes de empezar:

1. Leer /ai/PROJECT_CONTEXT.md
2. Leer /ai/AGENT_MEMORY.md
3. Leer /ai/TASK_LOG.md
4. Revisar /ai/IMPROVEMENTS.md si aplica

## Reglas

- Hacer cambios pequenos y trazables.
- No hacer refactors masivos sin justificacion.
- Mantener consistencia con la arquitectura existente (App Router, Prisma, componentes en `src/components`).
- No relajar TypeScript, lint, tests o build de forma global para resolver un problema local.
- Nunca usar `.env.production` en desarrollo local ni copiarlo sobre `.env`.
- No exponer credenciales de R2 ni cadenas de conexion en logs, comentarios o commits.
- Los cambios en `prisma/schema.prisma` requieren una migracion nueva (`npm run db:migrate`), nunca editar migraciones ya aplicadas.

## Verificacion

Antes de cerrar una tarea:

1. Ejecutar `npm run lint` y `npm run build`.
2. Verificar manualmente las rutas o pantallas tocadas.
3. Actualizar `ai/TASK_LOG.md`.
4. Actualizar `ai/AGENT_MEMORY.md` si hubo un aprendizaje nuevo no obvio.
