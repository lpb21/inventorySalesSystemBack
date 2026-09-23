# 🚀 Guía de Despliegue a Producción — invLeo Backend (AWS EC2)
 
> Guía única y definitiva para desplegar el backend en AWS EC2 con Nginx, PM2 y SSL.
> Reemplaza las guías anteriores (Railway, Quick, etc.), archivadas en `_legacy/`.
 
---
 
## 📋 Índice
 
1. [Antes de empezar (checklist)](#1-antes-de-empezar-checklist)
2. [Crear instancia EC2](#2-crear-instancia-ec2)
3. [Configurar el servidor](#3-configurar-el-servidor)
4. [Desplegar la aplicación](#4-desplegar-la-aplicación)
5. [⭐ Correr las migraciones (CRÍTICO)](#5--correr-las-migraciones-crítico)
6. [Arrancar con PM2](#6-arrancar-con-pm2)
7. [Configurar Nginx](#7-configurar-nginx)
8. [Configurar SSL](#8-configurar-ssl)
9. [Verificación post-despliegue](#9-verificación-post-despliegue)
10. [Actualizaciones futuras](#10-actualizaciones-futuras)
11. [Comandos de administración](#11-comandos-de-administración)
---
 
## 1. Antes de empezar (checklist)
 
Antes de tocar el servidor, ten listo:
 
- [ ] Cuenta de AWS con acceso a EC2
- [ ] Base de datos PostgreSQL en producción (Supabase o RDS) con su cadena de conexión
- [ ] Un `JWT_SECRET` fuerte y aleatorio (NO el de desarrollo)
- [ ] La lista de orígenes del frontend para `ALLOWED_ORIGINS`
- [ ] (Opcional) Un dominio apuntando a la IP de EC2, si vas a usar SSL
- [ ] Los tests pasando en local: `npm test` → 44 verdes
> **Regla de oro:** nunca subas tu `.env` real al repo. Usa `.env.example` como plantilla y crea el `.env` directamente en el servidor.
 
---
 
## 2. Crear instancia EC2
 
En AWS Console → EC2 → Launch Instance:
 
- **AMI:** Ubuntu Server 22.04 LTS (o 24.04 LTS)
- **Tipo:** `t3.micro` (free tier primer año) o `t3.small` (más holgado)
- **Key pair:** crea una nueva y guarda el archivo `.pem` en lugar seguro
- **Security Group:** permite estos puertos entrantes:
  - `22` (SSH) — idealmente solo desde tu IP
  - `80` (HTTP)
  - `443` (HTTPS)
- **Storage:** 20 GB gp3
---
 
## 3. Configurar el servidor
 
Conéctate por SSH:
 
```bash
ssh -i "tu-key.pem" ubuntu@TU-IP-PUBLICA
```
 
Instala las dependencias del sistema. **Nota: usamos Node 24** (la versión con la que se desarrolló el proyecto):
 
```bash
# Actualizar sistema
sudo apt update && sudo apt upgrade -y
 
# Instalar Node.js 24.x
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt-get install -y nodejs
 
# Verificar
node --version   # debe mostrar v24.x.x
npm --version
 
# Instalar PM2 (gestor de procesos) y Nginx (reverse proxy)
sudo npm install -g pm2
sudo apt install nginx -y
sudo systemctl enable nginx
```
 
---
 
## 4. Desplegar la aplicación
 
```bash
# Clonar el repositorio
git clone https://github.com/lpb21/inventorySalesSystemBack.git
cd inventorySalesSystemBack
 
# Instalar dependencias (solo las de producción)
npm ci --omit=dev
 
# Crear directorio de logs (PM2 escribe ahí)
mkdir -p logs
 
# Crear el archivo .env de producción a partir de la plantilla
cp .env.example .env
nano .env   # editar con los valores REALES de producción
```
 
**Variables críticas a configurar en `.env` (producción):**
 
```bash
NODE_ENV=production
PORT=3000                      # PM2/Nginx lo mapean; ver nota abajo
 
# Base de datos (Supabase/RDS) — SSL OBLIGATORIO en producción
DB_HOST=tu-host-de-produccion
DB_PORT=5432
DB_NAME=tu_db
DB_USER=tu_usuario
DB_PASSWORD=tu_password_seguro
DB_SSL=true                    # ⚠️ NUNCA false en producción
 
# JWT — secreto fuerte y único, expiración de 2 días
JWT_SECRET=un-secreto-largo-aleatorio-de-al-menos-256-bits
JWT_EXPIRES_IN=2d
 
# CORS — sin esto, el frontend queda bloqueado
ALLOWED_ORIGINS=https://tu-frontend.com
 
# Redis (opcional — si no lo usas, déjalo desactivado)
REDIS_ENABLED=false

# Imágenes de productos (ver sección 7.1)
S3_BUCKET=puntofresco-product-images
S3_REGION=us-east-1
CDN_BASE_URL=https://dxxxxxxxxxxxx.cloudfront.net
OFF_USER_AGENT=PuntoFresco/1.0 (tu-email@dominio.com)
```

> **sharp (procesamiento de imágenes) usa binarios nativos por plataforma.** Ejecuta siempre `npm ci` **en el propio EC2** (o dentro del contenedor). **Nunca** copies `node_modules` desde WSL/Windows/Mac con scp/rsync: `npm` no falla, pero la app revienta en runtime con un error tipo *invalid ELF header* al cargar sharp.
 
> **Nota sobre el puerto:** tu `ecosystem.config.js` fuerza `PORT: 80` en el entorno de PM2. Si usas Nginx como reverse proxy (recomendado, y necesario para SSL), es mejor que la app corra en el `3000` y Nginx escuche en el `80/443`. Ajusta el `PORT` del `ecosystem.config.js` a `3000` para que no choque con Nginx. Ver sección 7.
 
---
 
## 5. ⭐ Correr las migraciones (CRÍTICO)
 
> **Este es el paso que faltaba en las guías anteriores.** Sin él, la base de datos de producción NO tendrá las tablas de tickets, recetas, ni los constraints correctos, y la app fallará en runtime aunque arranque.
 
El proyecto usa un sistema de migraciones versionadas (Umzug). Con el `.env` de producción ya configurado:
 
```bash
# Ver qué migraciones están pendientes
npm run migrate:status
 
# Aplicar TODAS las migraciones pendientes
npm run migrate
```
 
Deberías ver aplicarse las 4 migraciones en orden:
- `001-inventory-movements-type-check` — constraint de tipos de movimiento
- `002-create-ticket-counters` — tabla de numeración de tickets
- `003-add-transformation-movement-type` — soporte de despiece
- `004-create-recipes` — tablas de recetas de despiece
> **Importante:** corre las migraciones cada vez que despliegues una versión que incluya migraciones nuevas (ver sección 10).
 
---
 
## 6. Arrancar con PM2
 
```bash
# Arrancar la app usando el ecosystem.config.js del proyecto
pm2 start ecosystem.config.js
 
# Configurar arranque automático al reiniciar el servidor
pm2 startup     # ejecuta el comando que imprime
pm2 save        # guarda la lista de procesos actual
```
 
> **Nota sobre el modo cluster:** tu `ecosystem.config.js` usa `exec_mode: 'cluster'` con `instances: 'max'` (una instancia por CPU). El graceful shutdown que implementamos funciona bien con esto — PM2 envía `SIGINT`/`SIGTERM` a cada instancia y cada una cierra sus conexiones ordenadamente antes de salir.
 
---
 
## 7. Configurar Nginx
 
Nginx actúa como reverse proxy: recibe el tráfico en el puerto 80/443 y lo pasa a tu app en el 3000.
 
```bash
sudo nano /etc/nginx/sites-available/invleo-api
```
 
Contenido:
 
```nginx
server {
    listen 80;
    server_name tu-dominio.com;   # o tu IP pública

    # Por defecto Nginx rechaza cuerpos > 1MB con 413: las fotos de producto (máx. 5MB)
    # y los CSV de importación (máx. 10MB) necesitan este límite
    client_max_body_size 10m;
 
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
 
Habilitar y recargar:
 
```bash
sudo ln -s /etc/nginx/sites-available/invleo-api /etc/nginx/sites-enabled/
sudo nginx -t                    # verificar que la config es válida
sudo systemctl reload nginx
```
 
---

## 7.1 Imágenes de productos: S3 + CloudFront + IAM

Cada producto tiene **una sola** imagen WebP de 512×512 (~20–40 KB) en
`tenants/{tenantId}/products/{productId}.webp`, que se sobrescribe al cambiarla.

1. **Bucket S3** (privado, "Block all public access" activado), p. ej. `puntofresco-product-images`, misma región que el EC2.
2. **CloudFront** con el bucket como origen usando **Origin Access Control (OAC)**; aplicar la bucket policy que CloudFront propone. Crea una **cache policy personalizada** (copia de `CachingOptimized`) con *Query strings → Include specified: `v`*. Es obligatorio: `CachingOptimized` ignora el query string, y el backend invalida la foto cambiando `?v=` en la URL (envía `Cache-Control: max-age=31536000, immutable`). Sin esto, CloudFront seguiría sirviendo la foto vieja tras un cambio.
3. **Rol IAM de la instancia EC2** con permisos mínimos:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [{
       "Effect": "Allow",
       "Action": ["s3:PutObject", "s3:DeleteObject"],
       "Resource": "arn:aws:s3:::puntofresco-product-images/tenants/*"
     }]
   }
   ```
   El SDK toma las credenciales del rol automáticamente: **no** pongas `AWS_ACCESS_KEY_ID` en el `.env`.
4. Variables `S3_BUCKET`, `S3_REGION`, `CDN_BASE_URL`, `OFF_USER_AGENT` en el `.env`.
5. Tras la migración (`npm run migrate`), llenar las imágenes de los productos existentes desde Open Food Facts (se puede repetir sin riesgo):
   ```bash
   npm run images:backfill -- --dry-run          # ver cuántos candidatos hay
   npm run images:backfill                        # todos los tenants (~85 productos/min)
   npm run images:backfill -- --tenant=<uuid> --limit=200
   ```

Costos de referencia: almacenamiento ~USD 0.023/GB-mes (10.000 productos ≈ 400 MB ≈ USD 0.01/mes); PUT ~USD 0.005 por 1.000; las lecturas salen mayormente de la caché de CloudFront (1 TB/mes en la capa gratuita), no de S3.

---
 
## 8. Configurar SSL
 
Solo si tienes un dominio apuntando a la IP de EC2:
 
```bash
sudo snap install --classic certbot
sudo ln -s /snap/bin/certbot /usr/bin/certbot
 
# Obtener e instalar el certificado (Certbot ajusta Nginx automáticamente)
sudo certbot --nginx -d tu-dominio.com
 
# Certbot configura la renovación automática; verifícala con:
sudo certbot renew --dry-run
```
 
---
 
## 9. Verificación post-despliegue
 
Confirma que todo quedó funcionando:
 
```bash
# 1. El proceso está vivo
pm2 status                       # invleo-api en verde (online)
 
# 2. El health check responde y verifica la BD
curl http://localhost:3000/health
# Espera: {"status":"ok", ..., "checks":{"database":"ok", ...}}
 
# 3. Desde fuera (con dominio/SSL)
curl https://tu-dominio.com/health
```
 
Si el health check devuelve `"database":"ok"` y status `200`, el despliegue fue exitoso. Si devuelve `503` con `"database":"error"`, revisa las credenciales de BD en el `.env`.
 
---
 
## 10. Actualizaciones futuras
 
Cuando despliegues una versión nueva:
 
```bash
cd inventorySalesSystemBack
git pull origin invSalesBackend       # traer los cambios
 
npm ci --omit=dev                     # actualizar dependencias
 
npm run migrate:status                # ¿hay migraciones nuevas?
npm run migrate                       # aplicarlas si las hay
 
pm2 reload invleo-api                 # reload SIN downtime (aprovecha el cluster)
```
 
> `pm2 reload` (no `restart`) recarga las instancias una por una sin cortar el servicio, gracias al modo cluster + graceful shutdown.
 
---
 
## 11. Comandos de administración
 
```bash
# PM2
pm2 status                     # estado de la app
pm2 logs invleo-api            # ver logs en vivo
pm2 reload invleo-api          # recargar sin downtime
pm2 restart invleo-api         # reiniciar (con downtime breve)
pm2 monit                      # monitor de recursos
 
# Nginx
sudo nginx -t                  # validar configuración
sudo systemctl reload nginx    # recargar config
sudo systemctl status nginx    # estado
 
# Sistema
htop                           # CPU/RAM
df -h                          # espacio en disco
free -h                        # memoria
```
 
---
 
## 💸 Costos aproximados (referencia)
 
| Concepto | Costo |
|----------|-------|
| t3.micro | ~$8.5/mes (gratis primer año con free tier) |
| t3.small | ~$16.7/mes |
| Elastic IP | ~$3.6/mes (solo si no está asociada) |
| Dominio (Route 53) | ~$12/año |
| Tráfico | Gratis hasta 1 TB/mes |
 
---
 
## 🔒 Recordatorios de seguridad
 
- `DB_SSL=true` siempre en producción
- `JWT_SECRET` fuerte y único (nunca el de desarrollo)
- `ALLOWED_ORIGINS` con los dominios reales del frontend
- `EPAYCO_SKIP_WEBHOOK_SIGNATURE_VALIDATION` nunca en `true`
- Nunca subir el `.env` real al repositorio
- Restringir el puerto 22 (SSH) a tu IP en el Security Group