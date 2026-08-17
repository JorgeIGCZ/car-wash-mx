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

- 2026-08-17: Se actualizaron dependencias vulnerables sin cambiar de major.
  - Next y `eslint-config-next` quedaron en 15.5.x, manteniendo Next 15 y
    evitando migrar a Next 16.
  - Se actualizaron/parcharon `postcss`, `nanoid`, `sharp`, `js-yaml`,
    `brace-expansion` y `deepmerge-ts` mediante rangos y overrides acotados.
  - `sharp` quedo deduplicado en 0.35.3 para evitar la copia vulnerable
    transitiva de Next.
  - Validacion: `npm run lint`, `npx tsc --noEmit`, `npx prisma validate` y
    `npm run build` pasaron. Smoke del standalone: `/login`, `/register`,
    CSS, icono e imagen optimizada respondieron correctamente. El POST local
    de login en standalone intento usar `.env.production`, riesgo ya
    documentado en `AGENT_MEMORY`.

- 2026-08-17: Se homologo el resumen de historial admin con los cards de egresos.
  - Los stats de historial admin ahora usan iconos dentro de badges de color
    para servicios, ingresos, comisiones, egresos y ganancia neta.
  - `StatCard` usa una estructura visual consistente con `ExpenseSummaryCard`
    para mantener homogeneidad en codigo y UI.
  - Validacion: `npm run lint`, `npx tsc --noEmit` y `npm run build`
    pasaron.

- 2026-08-17: Se hizo visible la accion del resumen de ganancia neta.
  - El card clickeable "Ganancia neta" ahora muestra "Ver detalle" con
    flecha, cursor y estados hover/focus para que se perciba como boton.
  - Validacion: `npm run lint`, `npx tsc --noEmit` y `npm run build`
    pasaron.

- 2026-08-17: Se corrigio la UI de edicion de comisiones en historial.
  - El lapiz de edicion del monto cobrado quedo en la misma linea que el
    costo; la etiqueta "Cobrado" queda centrada sobre el conjunto.
  - El desglose de comisiones dejo de usar chips y ahora muestra filas con
    persona, tipo visible ("Porcentaje" o "Monto fijo"), valor, monto
    calculado y boton de edicion alineado.
  - Se corrigio overflow de las tarjetas internas de historial haciendo que
    el grid principal, tarjetas financieras y filas de comision respeten el
    ancho disponible.
  - La edicion ya no depende de un selector angosto con simbolos `%`/`$`;
    usa etiquetas completas para evitar que el tipo no se vea.
  - Administracion ahora permite agregar una nueva persona que comisione un
    servicio desde el historial, creando `WashCommission` aunque no haya sido
    participante original.
  - El historial personal/global ahora considera `WashCommission.userId` en
    los filtros, para que esas comisiones agregadas aparezcan al filtrar por
    usuario.
  - Validacion: `npm run lint`, `npx tsc --noEmit` y `npm run build`
    pasaron. El dev server recompilo sin errores.

- 2026-08-17: Se agrego tipo de pago al registro de servicios.
  - `Wash` ahora guarda `paymentType` (`CASH`, `CARD`, `TRANSFER`) con
    default `CASH`; se agrego la migracion
    `20260817120000_add_wash_payment_type`.
  - `/register` muestra un selector de tipo de pago en Detalles, con
    Efectivo preseleccionado, y envia el valor a `POST /api/washes`.
  - Historial y mensaje de WhatsApp muestran el tipo de pago registrado.
  - Como `prisma migrate deploy` sigue fallando localmente por `Schema engine
    error`, se aplico manualmente la migracion en MySQL local y se registro
    su checksum en `_prisma_migrations`.
  - El submit de `/register` ahora maneja respuestas no JSON del servidor sin
    mostrar overlay de runtime en el navegador.
  - Validacion: `npm run prisma:generate`, `npm run lint`,
    `npx tsc --noEmit` y `npx prisma validate` pasaron. `npm run build` no
    pudo completarse porque `prisma migrate deploy` falla contra la base local
    con `Schema engine error`, bloqueo ya documentado en `ai/AGENT_MEMORY.md`.

- 2026-08-17: Se agrego edicion administrativa de la cantidad cobrada en historial.
  - En el historial de todo el equipo dentro de Administracion, ADMIN puede
    editar inline el monto "Cobrado" de cada servicio.
  - `PATCH /api/washes/[id]` ahora acepta `chargedPrice` para ADMIN y, al
    cambiarlo, recalcula los importes de comisiones porcentuales historicas
    contra el nuevo monto; las comisiones fijas se conservan.
  - Validacion: `npm run lint`, `npx tsc --noEmit` y `npx prisma validate`
    pasaron. `npm run build` no pudo completarse porque `prisma migrate
    deploy` falla contra la base local con `Schema engine error`, bloqueo ya
    documentado en `ai/AGENT_MEMORY.md`.

- 2026-08-03: Se simplifico el modal de envio por WhatsApp.
  - En `/register`, el modal posterior al registro ya no muestra el bloque
    "Elegir grupo en WhatsApp" ni la explicacion sobre grupos del navegador.
  - El boton principal cambio de "Elegir grupo" a "Enviar".
  - Validacion: `npm run lint` y `npm run build` pasaron. Verificacion
    visual autenticada no se ejecuto porque el cambio es solo de copy en el
    modal posterior al registro.

- 2026-08-03: Se recupero `/login` en desarrollo local.
  - Causa inmediata: un proceso `node` viejo seguia escuchando en
    `localhost:3000` pero no respondia headers; tenia conexiones antiguas a
    MySQL en `CLOSE_WAIT` despues de reiniciar Docker/MySQL.
  - Se termino el proceso colgado, se reinicio `npm run dev` y Next volvio a
    escuchar en `http://localhost:3000`.
  - Validacion: `docker compose ps` mostro `mysql` healthy; `curl /login`
    respondio 200 y `POST /api/auth/login` con credenciales falsas respondio
    401 JSON sin quedarse cargando. No hubo cambios de codigo.

- 2026-08-03: Se agrego pull-to-refresh en resultados de historial.
  - `WashHistory` ahora detecta el gesto movil de jalar hacia abajo cuando
    la pantalla esta al inicio y vuelve a consultar `/api/washes` conservando
    filtros de periodo, rango y usuario.
  - El indicador muestra "Jala para actualizar", "Suelta para actualizar" y
    "Actualizando..." sin recargar toda la pagina.
  - `load()` quedo protegido con `try/finally` para no dejar la UI atorada en
    estado de carga si falla una peticion.
  - Validacion: `npm run lint` y `npm run build` pasaron. Verificacion visual
    movil autenticada no se completo porque la base local actual no tiene una
    contrasena valida conocida para entrar.

- 2026-08-03: Se obligo a administradores a elegir responsable al registrar servicios.
  - `/register` muestra el selector de responsable al inicio del formulario
    para `ADMIN` y `ADMINISTRATIVE`, bloqueando el avance hasta elegir un
    administrador o encargado activo.
  - `POST /api/washes` ahora exige `createdById` para ambos roles con acceso
    administrativo y valida que el responsable seleccionado siga activo y sea
    `ADMIN` o `EMPLOYEE`.
  - Validacion: `npm run lint` y `npm run build` pasaron. Smoke test local
    con sesion temporal de `ADMIN`: alta sin `createdById` respondio 400
    "Selecciona a nombre de quién se registra."; alta con responsable
    inexistente respondio 400 "El responsable seleccionado no está
    disponible.". La sesion temporal fue eliminada. Verificacion visual
    autenticada no se completo porque no habia una contrasena local valida
    para la base actual; el servidor de prueba en `localhost:3001` se uso
    solo para los smoke tests y fue detenido.

- 2026-08-02: Se corrigio el error local de chunk faltante en `/admin`.
  - Causa inmediata: el dev server en `localhost:3000` servia
    `.next-dev/app-build-manifest.json` apuntando a
    `static/chunks/app/(protected)/admin/page.js`, pero el archivo no existia.
  - Se reinicio `npm run dev` y se forzo la compilacion de `/admin`; el chunk
    ahora responde 200.
  - Se detecto ademas que la base local no tenia aplicada
    `20260802093000_add_wash_soft_delete`, por lo que faltaban
    `Wash.deletedAt` y `Wash.deletedById`. Como `prisma migrate deploy`
    falla en esta base con `Schema engine error`, se aplico el SQL de esa
    migracion localmente y se registro su checksum en `_prisma_migrations`.
  - Validacion: `npm run lint`, `npm run build`, `npx prisma validate`,
    `curl -I /_next/static/chunks/app/%28protected%29/admin/page.js` respondio
    200, `/admin` sin sesion respondio 307 a `/login`, y `/api/washes` sin
    sesion respondio 401. `npx prisma migrate status` sigue bloqueado por
    `Schema engine error` en la base local.

- 2026-08-02: Se agrego edicion administrativa de comisiones por servicio.
  - `PATCH /api/washes/[id]` permite a `ADMIN` ajustar la comision historica
    de un trabajador que participo en el servicio, por porcentaje o monto
    fijo, recalculando `WashCommission.amount` contra el precio cobrado.
  - El historial global de Administracion muestra un boton de edicion en el
    desglose de comisiones y permite capturar la comision faltante en
    servicios especiales sin regla definida.
  - La lista considera al responsable y participantes aunque un registro
    antiguo no tenga filas previas en `WashCommission`.
  - Validacion: `npm run lint`, `npm run build` y `npx prisma validate`
    pasaron. Verificacion manual autenticada bloqueada porque la base local
    actual no tiene aplicada la columna `Wash.deletedAt` esperada por el
    codigo vigente.

- 2026-08-02: Se agrego eliminacion administrativa de servicios con soft delete.
  - `Wash` ahora guarda `deletedAt` y `deletedById` para auditar quien
    elimino el servicio sin borrar fotos, comisiones ni participantes.
  - `DELETE /api/washes/[id]` queda restringido a `ADMIN`; el historial de
    Administracion muestra un boton para eliminar y refresca totales/listado.
  - Historial, comisiones agregadas, ingresos del dia y subida de fotos
    excluyen lavados eliminados.
  - Validacion: `npx prisma validate`, `npm run prisma:generate`,
    `npm run lint` y `npm run build` pasaron. `npm run db:migrate
    -- --skip-generate` no pudo aplicarse porque Prisma falla contra la base
    local por una migracion historica duplicada/no terminada en
    `_prisma_migrations` (`20260704023200_simplify_commission_rules`).
    Smoke test sin sesion: `DELETE /api/washes/1` respondio 401.

- 2026-08-02: Se agrego modal posterior al registro para compartir por
  WhatsApp sin integracion.
  - Al guardar un lavado, `/register` muestra un modal con el resumen del
    servicio y un boton que abre WhatsApp con texto prellenado para elegir
    contacto o grupo dentro de WhatsApp.
  - Si habia fotos seleccionadas, el modal ofrece compartirlas con Web Share
    API cuando el dispositivo lo soporte; tambien permite copiar el mensaje.
  - No se agregaron credenciales, APIs externas ni cambios de base de datos.
  - Validacion: `npm run lint` paso. `npm run prisma:generate` se ejecuto
    porque el cliente Prisma local estaba desactualizado frente al schema.
    `npm run build` paso compilacion y typecheck, pero fallo en el empaquetado
    final de Next con ENOENT de artefactos `.next/server/...` (`pages-manifest`
    o `.nft.json`), aun con `.next` limpia; queda pendiente diagnosticar esa
    salida de build.

- 2026-08-02: Se aclaro el calculo de ganancia neta con egresos y reembolsos.
  - `/api/washes` ahora devuelve desglose de egresos tomados de caja,
    egresos fuera de caja, reembolsos pendientes, caja antes de socios y
    total a entregar.
  - El modal de Ganancia neta separa utilidad contable de flujo de caja y
    etiqueta por socio utilidad, reembolso y total para evitar confusion.
  - Validacion: `npm run lint` y `npm run build` pasaron.

- 2026-08-02: Se compacto el resumen de Egresos en movil.
  - Las tarjetas de total, caja, reembolsos y movimientos ahora usan una
    cuadricula de 2 columnas en pantallas chicas, con menor padding, iconos y
    tipografia para reducir el espacio vertical antes del formulario.
  - Validacion: `npm run lint` y `npm run build` pasaron.

- 2026-08-02: Se ajusto la captura de reembolsos por socio logueado.
  - Si el usuario logueado es socio, los egresos reembolsables quedan
    asociados automaticamente a ese socio y la UI no permite seleccionar otro.
  - ADMIN no socio y ADMINISTRATIVE pueden capturar egresos reembolsables a
    nombre de un socio activo; editar/eliminar egresos sigue limitado a ADMIN.
  - La API `/api/admin/expenses` refuerza la regla del socio fijo en servidor.
  - Validacion: `npm run lint` y `npm run build` pasaron.

- 2026-08-02: Se reorganizo la UI de la seccion Egresos en Administracion.
  - Se agregaron tarjetas de resumen para total de egresos, tomado de caja,
    reembolsos y cantidad de movimientos.
  - La captura quedo separada de los movimientos del periodo, con filtros
    mas compactos y filas con fecha, estado, monto y acciones mas legibles.
  - Validacion: `npm run lint` y `npm run build` pasaron.

- 2026-08-02: Se mejoro la experiencia de los controles de egresos.
  - En el formulario de Egresos, "Tomado de caja" y "Genera reembolso" se
    reemplazaron por tarjetas tipo toggle con icono, descripcion, estado
    activo y estado deshabilitado cuando el egreso salio de caja.
  - La edicion inline de egresos usa los mismos toggles en formato compacto.
  - Validacion: `npm run lint` y `npm run build` pasaron.

- 2026-08-02: Se importo el dump de produccion localmente y se aplico la
  migracion pendiente de egresos/socios.
  - Origen: `/Users/jorgeivangomez/Downloads/turbo wash db.sql`.
  - Se respaldo la base local previa en
    `/private/tmp/car-wash-mx-db-backups/turbo_wash_before_prod_import_20260802.sql`.
  - Se recreo la base local `turbo_wash`, se importaron las tablas/datos del
    dump y se aplico `20260801090000_add_expenses_and_partners` con
    `npx prisma migrate deploy` para evitar el reset destructivo que pedia
    `prisma migrate dev` por drift/checksum historico.
  - Validacion: `npx prisma migrate status`, verificacion SQL de tabla
    `Expense` y columnas de socio en `User`, `npm run prisma:generate`,
    `npm run lint` y `npm run build` pasaron.

- 2026-08-02: Se diagnostico bloqueo visual de login en desarrollo local.
  - Causa: `/api/auth/login` fallaba con 500 porque Prisma no podia conectar
    a MySQL en `localhost:3306`; el formulario no capturaba errores no-JSON
    y quedaba en "Ingresando...".
  - Se agrego manejo de error controlado en el endpoint y en el formulario
    para mostrar un mensaje y liberar el estado de carga.
  - Validacion: `npm run lint` y `npm run build` pasaron.

- 2026-08-02: Se cerraron dobles envios en formularios restantes con riesgo
  de duplicados.
  - `/register` ahora usa un candado inmediato con `useRef` ademas del estado
    visual `saving`, para ignorar submits repetidos antes del re-render.
  - En `/admin`, el formulario de nuevo usuario bloquea reenvios mientras
    crea la cuenta, muestra estado "Creando..." y reporta fallo de conexion.
  - Validacion: `npm run lint` y `npm run build` pasaron.

- 2026-08-02: Se agrego administracion de egresos y reparto de socios.
  - Nuevo modelo `Expense`, campos de socio en `User`, migracion
    `20260801090000_add_expenses_and_partners`, API `/api/admin/expenses`,
    y extension de `/api/washes` para descontar egresos de ganancia neta
    global y mostrar detalle de reparto/reembolsos.
  - En `/admin` se agrego pestaña Egresos; ADMIN crea/edita/elimina y
    ADMINISTRATIVE consulta. En Personal se pueden marcar administradores
    como socios y guardar su porcentaje.
  - Validacion: `npm run lint`, `npm run build` y `npx prisma validate`
    pasaron; `curl -I http://localhost:3000/admin` respondio 307 a `/login`
    sin sesion. `npm run db:migrate` no pudo verificarse porque Docker/MySQL
    local no estaba disponible (`Cannot connect to the Docker daemon`).

- 2026-08-02: Se corrigio el guardado del catalogo de administracion para
  evitar paquetes y tipos de vehiculo duplicados por clics repetidos.
  - Los formularios de alta y las acciones de cada fila ahora muestran estado
    de guardado, deshabilitan botones mientras la peticion esta en curso y
    muestran errores del API.
  - Los endpoints de paquetes y vehiculos rechazan nombres duplicados o sin
    letras/numeros, en lugar de generar slugs con timestamp.
  - Validacion: `npm run lint` y `npm run build` pasaron con warnings ajenos
    en `src/app/api/admin/users/route.ts`; verificacion manual de `/admin`
    bloqueada por falta de sesion autenticada en el navegador integrado
    (redirige a `/login`).

- 2026-07-24: Se habilito al personal administrativo para registrar lavados a
  nombre de un administrador o encargado activo desde `/register`.
  - El formulario muestra un selector de responsable solo para
    `ADMINISTRATIVE`; el endpoint valida el responsable y calcula comisiones
    sobre el responsable elegido y participantes validos.
  - Validacion: `npm run lint` y `npm run build` pasaron; pendiente
    verificacion manual autenticada con una cuenta administrativa.

- 2026-07-07: Se agrego `PhotoLightbox` (visor a pantalla completa con
  navegacion por flechas, swipe y teclado) y se conecto a las miniaturas
  de fotos en `WashHistory`; las miniaturas dejaron de abrir pestañas
  nuevas.
  - Validacion: `npm run lint` y `npm run build` pasaron; pendiente
    verificacion visual en navegador.

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
