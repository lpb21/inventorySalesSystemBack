# Imágenes de productos — estado del desarrollo (EN PAUSA)

> **Estado:** desarrollo completo pero **NO integrado ni desplegado**. Queda aparcado en la rama
> `feat/product-images` (backend y front) hasta que el volumen de usuarios justifique el costo de
> infraestructura (S3 + CloudFront). **No hacer merge a `invSalesBackend` / `invSalesFrontEnd` todavía.**
>
> **Motivo de la pausa (2026-09-23):** la cuenta de AWS no permite crear más distribuciones gratuitas
> de CloudFront, y por ahora el gasto no se justifica. Se retomará cuando los tenants puedan cubrirlo
> (p. ej. como parte de un plan pago).

## Ramas y commits

| Repo | Rama | Commits |
|---|---|---|
| `inventorySalesSystemBack` | `feat/product-images` | `2ac41d8` feature principal · `ca955e2` flag `skip_image_lookup` · este documento |
| `inventorySalesSystemFront` | `feat/product-images` | `5a64007` UI de imágenes · puntero a este documento |

Ambas ramas salen de los commits que estaban en `invSalesBackend` (`731b72a`) e `invSalesFrontEnd`
(`fcff2f0`) el 2026-09-23. Al retomar, **rebasar o mergear primero** la rama principal en cada una
(ver "Cómo retomar").

## Qué hace la funcionalidad

- Cada producto tiene **una sola imagen**: WebP 512×512, fondo blanco, `fit: contain` (sin recortar),
  sin EXIF, ~20–40 KB, en S3 bajo `tenants/{tenantId}/products/{productId}.webp`. Se sobrescribe al
  cambiarla, así el almacenamiento no crece con los cambios.
- Prioridad: **foto propia** del tenant → **Open Food Facts** (por código de barras) → ícono de categoría.
- Open Food Facts **nunca** se consulta en la venta: solo al crear/editar/importar (cola en segundo
  plano), en la vista previa del formulario, con el botón "Buscar imagen" o con el script de backfill.
- Atribución CC BY-SA de las imágenes de OFF (`image_source = 'off'`, `image_source_ref` = URL del producto en OFF).
- El soft-delete de un producto **no** borra su imagen (puede reactivarse).
- Aislamiento multi-tenant: todo busca `{ id, tenant_id }` (tenant del JWT) antes de tocar S3.

Detalle funcional y contrato de API: [`PRODUCT_IMAGES.md`](./PRODUCT_IMAGES.md).
Despliegue AWS paso a paso: [`DEPLOY.md` §7.1](./DEPLOY.md).

## Qué incluye

### Backend
| Archivo | Qué es |
|---|---|
| `src/services/imageService.js` | Procesamiento con sharp (acotado para t3.micro: concurrency 1, sin caché, límite de píxeles, semáforo) |
| `src/services/storageService.js` | Wrapper S3 (`@aws-sdk/client-s3`), credenciales por rol IAM |
| `src/services/openFoodFactsService.js` | Cliente OFF: caché global, ritmo ~85 req/min, timeout, allowlist de hosts (SSRF) |
| `src/services/productImageService.js` | Orquestación: subir, quitar, autocompletar, cola en memoria |
| `src/services/productService.js` | Hooks en crear/editar/importar; descarta hotlinks de OFF; `skip_image_lookup` |
| `src/controllers/productController.js`, `src/routes/v1/productRoutes.js` | 4 endpoints nuevos (ver abajo) |
| `src/middlewares/rateLimitMiddleware.js` | `imageUploadLimiter` (30/5min) y `barcodeLookupLimiter` (30/min) por usuario |
| `src/migrations/scripts/010-add-image-source-to-products.js` | Columnas `image_source`, `image_source_ref` + CHECK (idempotente) |
| `src/models/Product.js`, `src/utils/validators.js`, `src/config/env.js` | Modelo, validación y configuración |
| `scripts/backfill-product-images.js` | `npm run images:backfill` para productos existentes |
| `tests/imageService.test.js`, `tests/openFoodFactsService.test.js`, `tests/productImage.test.js` | Tests (S3 y OFF simulados) |
| `package.json` / `package-lock.json` | `sharp@^0.35.4`, `@aws-sdk/client-s3@^3.1138.0`; lockfile resincronizado |
| `Dockerfile` | `node:18-alpine` → `node:24-alpine` (sharp 0.35 y el SDK exigen Node ≥ 20) |
| `.env.example`, `.env.production.example`, `DEPLOY.md`, `PRODUCT_IMAGES.md` | Documentación |

Endpoints:

| Método | Ruta | Permiso |
|---|---|---|
| `GET` | `/v1/products/lookup/:barcode` | `products:read` |
| `PUT` | `/v1/products/:id/image` (multipart, campo `image`, máx. 5 MB) | `products:update` |
| `DELETE` | `/v1/products/:id/image` | `products:update` |
| `POST` | `/v1/products/:id/image/lookup` | `products:update` |

### Front
| Archivo | Qué es |
|---|---|
| `src/components/inventory/ProductModal.jsx` | Subir/quitar foto, vista previa y nombre desde OFF al escanear, "Buscar imagen" |
| `src/components/inventory/ProductImageField.jsx` | UI del campo de imagen + atribución |
| `src/components/shared/ProductImage.jsx` | Imagen en tarjetas del POS e inventario (contain, lazy, fallback al ícono) |
| `src/components/inventory/InventoryView.jsx`, `src/components/sales/ProductGrid.jsx` | Integración |
| `src/api/config.js`, `src/hooks/queries/useProducts.js` | API y mutaciones de React Query |
| `src/utils/productImage.js` | Validación, compresión en navegador, mensajes, atribución |
| `src/utils/productImage.test.js`, `src/components/shared/ProductImage.test.jsx`, `src/components/inventory/ProductModal.test.jsx` | Tests |

Cambio de comportamiento a tener en cuenta: en el campo "Código de Barras", **Enter ya no envía el
formulario** (los lectores envían Enter al final); ahora dispara la búsqueda en OFF.

## Estado de verificación

- Sintaxis revisada (`node --check` en backend, compilación con esbuild en el front).
- **Los tests NO se han ejecutado** (se corren manualmente). Pendiente al retomar.
- No probado en un entorno real con S3/CloudFront.

## Costos estimados (para decidir cuándo retomar)

| Concepto | Estimado |
|---|---|
| S3 almacenamiento | ~USD 0.023/GB-mes → 10.000 productos ≈ 400 MB ≈ **USD 0.01/mes** |
| S3 PUT | ~USD 0.005 por 1.000 (solo al subir/cambiar fotos) |
| S3 GET | ~USD 0.0004 por 1.000 (mayormente absorbidos por CloudFront) |
| CloudFront | Capa gratuita: 1 TB/mes de salida y 10 M de peticiones; luego ~USD 0.085–0.11/GB según región |
| Open Food Facts | Gratis (requiere `User-Agent` propio y atribución) |

El costo real crece con el **uso del POS** (peticiones de imágenes), no con el tamaño del catálogo.

## Alternativas sin una nueva distribución de CloudFront

Por si se quiere activar antes, sin crear otra distribución:

1. **Reusar la distribución existente** (la del front, si existe): agregar el bucket de imágenes como
   **segundo origen** con un *behavior* para la ruta `/tenants/*` (OAC + cache policy con `v` en la
   clave). No crea otra distribución. `CDN_BASE_URL` = dominio de esa distribución.
2. **S3 directo sin CDN**: dejar `CDN_BASE_URL` vacío (el backend usa
   `https://<bucket>.s3.<region>.amazonaws.com/...`) y permitir lectura pública **solo** del prefijo
   `tenants/*` con una bucket policy (`s3:GetObject`). Más simple, pero cada vista de imagen es un
   GET facturado a S3 y la salida a internet se cobra desde S3 (~USD 0.09/GB después de 100 GB/mes gratis).
3. **Servir desde el propio EC2/Nginx** (sin S3): requeriría cambiar `storageService` para escribir en disco.
   No recomendado: se pierde al reemplazar la instancia y compite por disco/ancho de banda con la API.

## Cómo retomar

1. Actualizar las ramas con lo último de las ramas principales:
   ```bash
   # backend
   git checkout feat/product-images && git fetch origin && git merge origin/invSalesBackend
   # front
   git checkout feat/product-images && git fetch origin && git merge origin/invSalesFrontEnd
   ```
   Posibles conflictos: `productService.js`, `productRoutes.js`, `validators.js`, `env.js`,
   `package-lock.json` (regenerar con `npm install`), y en el front `ProductModal.jsx` / `InventoryView.jsx`.
   Si ya existe otra migración `010-*`, **renombrar** la de este desarrollo al siguiente número libre.
2. Instalar y correr los tests:
   ```bash
   # backend (necesita .env.test)
   npm ci && npm test
   # front
   npm ci && npm run test:run
   ```
3. Infraestructura AWS (detalle en `DEPLOY.md` §7.1):
   - Bucket S3 privado, en la misma región del EC2.
   - CloudFront con OAC y cache policy que incluya el query string `v` (o una de las alternativas de arriba).
   - Rol IAM del EC2 con solo `s3:PutObject` y `s3:DeleteObject` sobre `arn:aws:s3:::<bucket>/tenants/*`.
4. Servidor:
   - `.env`: `S3_BUCKET`, `S3_REGION`, `CDN_BASE_URL`, `OFF_USER_AGENT`.
   - `npm ci --omit=dev` **en el propio EC2** (sharp usa binarios nativos; no copiar `node_modules`).
   - `npm run migrate`.
   - Nginx: `client_max_body_size 10m;` y `sudo nginx -t && sudo systemctl reload nginx`
     (sin esto, fotos > 1 MB fallan con 413; también afecta hoy a CSV grandes).
   - `pm2 restart all`.
5. Productos existentes: `npm run images:backfill -- --dry-run` y luego `npm run images:backfill`.
6. Probar: subir una foto, verificar el objeto en S3 y que la URL abra; escanear un código EAN conocido
   en el formulario y confirmar la vista previa de OFF.
7. Opcional: alerta en AWS Budgets (~USD 5/mes).

### Si se quiere cobrar como función de plan

Hoy los endpoints solo exigen `products:update`. Para limitarlo a planes pagos, agregar un
middleware de plan en las rutas de imagen (`src/routes/v1/productRoutes.js`) usando el mismo patrón
de `planMiddleware.js`, y ocultar los botones en el front según el plan.

## Hallazgos colaterales (independientes de esta funcionalidad)

- **Nginx sin `client_max_body_size`**: hoy ya rechaza importaciones CSV > 1 MB con 413.
- **`Tenant` no tiene `max_products`**: la validación de límite en `productService.createProduct`
  compara contra `undefined` y nunca se aplica.
- **`package-lock.json` desincronizado** en la rama principal respecto a `package.json`
  (`cross-env`, `libphonenumber-js`); en esta rama quedó resincronizado.
- **`Dockerfile` en `node:18-alpine`** mientras el EC2 usa Node 24.

Estos puntos pueden corregirse en la rama principal sin esperar a esta funcionalidad.
