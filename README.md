# Turbo Wash

Aplicación web para registrar y consultar los servicios de Turbo Wash Auto Spa.

## Funciones incluidas

- Inicio de sesión con roles de administrador y encargado.
- Registro de lavado normal, lavado de interiores y servicio especial.
- Tipos de vehículo configurables.
- Precios por combinación de paquete y vehículo.
- Precio y descripción libres para vehículos o servicios especiales.
- Placa, observaciones y participantes adicionales.
- Hasta 6 fotografías privadas por lavado, optimizadas y almacenadas en Cloudflare R2.
- Historial por día, semana, mes o rango de fechas.
- Historial global filtrable por usuario dentro de Administración.
- Comisiones por usuario, paquete y vehículo, configurables como porcentaje o
  cantidad fija, con cálculo de ganancia neta.
- Comisiones históricas conservadas por lavado aunque cambien las reglas.
- Catálogo, precios y usuarios administrables.
- Historial restringido a los registros propios para los encargados.
- Rol administrativo de consulta para revisar historial y comisiones sin
  editar precios ni configuración.

## Desarrollo local

Requisitos: Node.js 22+, Docker y Docker Compose.

```bash
docker compose up -d mysql adminer
npm install
npx prisma migrate dev
npm run db:seed
npm run dev
```

Aplicación: http://localhost:3000  
Adminer: http://localhost:8080

### Entornos

`.env` pertenece exclusivamente al desarrollo local:

```text
APP_ENV=local
NEXT_PUBLIC_APP_ENV=local
DATABASE_URL=mysql://turbo:turbo@localhost:3306/turbo_wash
```

La conexión de producción se conserva en `.env.production`, que está ignorado
por Git.
Los comandos normales de Prisma siempre usan `.env`:

```bash
npm run db:migrate
npm run db:seed
```

Para consultar o desplegar migraciones en la base de producción se requieren
comandos explícitos:

```bash
npm run db:status:production
npm run db:migrate:production
```

No copies `.env.production` sobre `.env`; así `npm run dev` nunca usa
accidentalmente la base remota.

## Instalación en celular

La aplicación se puede instalar como PWA desde una dirección HTTPS:

- Android/Chrome: usa el botón **Instalar app**.
- iPhone/Safari: toca **Compartir** y después **Agregar a inicio**.

Los registros, el historial y las fotografías requieren conexión. El service
worker solo almacena recursos públicos de la interfaz y nunca respuestas de la
API ni páginas con datos de usuarios.

Para Adminer:

```text
Sistema: MySQL
Servidor: mysql
Usuario: turbo
Contraseña: turbo
Base de datos: turbo_wash
```

## Acceso inicial

Antes de ejecutar el seed en una base nueva, define en `.env`:

```text
INITIAL_ADMIN_NAME
INITIAL_ADMIN_EMAIL
INITIAL_ADMIN_PASSWORD
```

La contraseña debe tener al menos 10 caracteres. El primer administrador
deberá reemplazarla al iniciar sesión. Los encargados posteriores pueden ser
creados desde la administración.

La aplicación utiliza `TZ=America/Mexico_City` para calcular días, semanas e
historiales.

## Fotografías con Cloudflare R2

Crea un bucket privado y un token de API con permisos de lectura y escritura
sobre ese bucket. Después configura:

```text
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET_NAME
```

Las credenciales pertenecen exclusivamente al servidor. Cada imagen se valida,
se orienta correctamente, se limita a 1920 × 1920 px y se guarda en WebP con
calidad 82. El historial utiliza enlaces privados con una vigencia de 15
minutos.

## Verificación

```bash
npm run lint
npm run build
npm audit --omit=dev
```
