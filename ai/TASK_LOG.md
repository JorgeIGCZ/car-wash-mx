## Pendiente

- Corregir la carga automatica de `.env.production` en build/start local
  (Next.js lo carga por convencion cuando NODE_ENV=production y pisa a
  `.env`; ver AGENT_MEMORY).
- Agregar headers de seguridad (frame-ancestors/X-Frame-Options,
  X-Content-Type-Options, Referrer-Policy) en `next.config.ts`.
- Considerar rate limiting en `/api/auth/login`.

## En progreso

- Ninguna

## Hecho

- 2026-07-14: Se convirtió `/register` en un wizard ligero de 4 pasos
  (servicio, vehículo, paquete, detalles) manteniendo el mismo endpoint de
  registro y sin cambios de base de datos.
  - Validacion: `npm run lint`, `npm run build` y verificacion manual en
    `http://localhost:3000/register` navegando hasta el paso de detalles sin
    enviar el formulario.

- 2026-07-07: Auditoria general (lint, build, revision de codigo, smoke
  test en runtime). Resultado: app funcional; se detecto que
  `.env.production` se auto-carga en `npm run start` local (ver Pendiente).

- 2026-07-07: Se agrego el patron de memoria para agentes de IA
  (`CLAUDE.md`, `AGENTS.md`, `ai/PROJECT_CONTEXT.md`, `ai/AGENT_MEMORY.md`,
  `ai/TASK_LOG.md`, `ai/IMPROVEMENTS.md`, `ai/DECISIONS.md`,
  `ai/RUNBOOK.md`).
  - Validacion: revision manual de contenido contra el codigo actual.
