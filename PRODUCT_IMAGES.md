# Imágenes de productos

Cada producto tiene **una sola imagen**: WebP 512×512, fondo blanco, sin recortar (`fit: contain`),
~20–40 KB, en S3 bajo `tenants/{tenantId}/products/{productId}.webp`. Venga de donde venga
(foto del tenant u Open Food Facts), pasa por el mismo procesamiento con `sharp` y se
sobrescribe al cambiarla, así el almacenamiento no crece con los cambios.

## Prioridad de la imagen

1. **Foto propia** (`image_source = 'user'`): siempre gana; el autocompletado nunca la toca.
2. **Open Food Facts** (`image_source = 'off'`): solo para productos con código de barras, consultado **una vez** al crear/importar (en segundo plano) o a pedido.
3. **Banco genérico** (`image_source = 'generic'`): reservado para una siguiente fase (frutas/verduras sin código de barras).
4. **Ícono** del front cuando `image_url` es `null`.

`image_source = 'none'` significa que el usuario quitó la imagen a propósito: no se vuelve a autocompletar.
`null` significa sin gestionar (sin imagen o un enlace externo antiguo, p. ej. desde CSV).

**La venta (POS) nunca consulta Open Food Facts**: solo lee `image_url` de la base de datos.

## Endpoints (todos con JWT + tenant)

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| `GET` | `/v1/products/lookup/:barcode` | `products:read` | Vista previa desde OFF para el formulario. **No guarda nada.** |
| `PUT` | `/v1/products/:id/image` | `products:update` | Sube la foto propia (`multipart/form-data`, campo **`image`**, máx. 5 MB). |
| `DELETE` | `/v1/products/:id/image` | `products:update` | Quita la imagen (borra el archivo de S3, `image_source = 'none'`). |
| `POST` | `/v1/products/:id/image/lookup` | `products:update` | Botón "Buscar imagen": consulta OFF y **reemplaza** la actual si la encuentra. |

Límites: subida 30 imágenes / 5 min por usuario; búsquedas 30 / min por usuario.

### `GET /v1/products/lookup/:barcode`

```json
{
  "success": true,
  "data": {
    "found": true,
    "barcode": "7702004003508",
    "name": "Gaseosa sabor cola",
    "brand": "Marca",
    "imageUrl": "https://images.openfoodfacts.org/…/front_es.3.400.jpg",
    "sourceUrl": "https://world.openfoodfacts.org/product/7702004003508",
    "attribution": { "text": "Imagen: Open Food Facts contributors", "license": "CC BY-SA 3.0", "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0/" }
  }
}
```

Si no se encuentra: `{ "found": false, "barcode": "…", "reason": "not_found" | "invalid_barcode" | "unavailable" | "disabled" }`.
`unavailable` = OFF caído o lento (timeout 3 s): el formulario sigue normal.

**Uso en el front:** mostrar `imageUrl` solo como vista previa y rellenar el nombre si está vacío.
**No enviar `imageUrl` como `image_url`** al crear el producto: el backend descarta los enlaces de OFF
y, tras crear el producto, descarga, procesa y sube la imagen en segundo plano. Al recargar el listado ya aparece con su URL propia.

### Crear/editar con foto propia: `skip_image_lookup`

Si el usuario eligió una foto, enviar `skip_image_lookup: true` en el `POST`/`PUT` del producto y
luego subir la foto con `PUT /:id/image`. Así el backend no encola la búsqueda en OFF, que podría
competir con esa subida sobre la misma clave de S3. El campo no se guarda en la base de datos.

### `PUT /v1/products/:id/image`

```js
const form = new FormData();
form.append('image', file); // JPG, PNG o WebP
await api.put(`/products/${id}/image`, form);
```

Responde el producto actualizado (`image_url` con `?v=<timestamp>`, `image_source: 'user'`).
Errores: `400 FILE_UPLOAD_ERROR` (tamaño/tipo), `400 VALIDATION_ERROR` (no es una imagen válida),
`404` (producto de otro tenant o inexistente), `503 STORAGE_NOT_CONFIGURED`.

Recomendado: reducir la foto en el navegador a ~1024 px antes de subirla (p. ej. `browser-image-compression`)
para que suba rápido desde el celular. El servidor igual la normaliza; no se confía en el cliente.

> iPhone: Safari convierte las fotos HEIC a JPEG al elegirlas con `<input type="file" accept="image/*">`.
> Si llega un HEIC real, el servidor responde `400` (los binarios de sharp no decodifican HEIC).

### `POST /v1/products/:id/image/lookup`

```json
{ "success": true, "data": { "status": "updated" | "not_found" | "skipped" | "unavailable", "reason": "…", "product": { … } } }
```

`skipped` con `reason: "no_barcode"` si el producto no tiene un código EAN/UPC válido (8–14 dígitos).

## Atribución (CC BY-SA)

Las imágenes de Open Food Facts siguen siendo CC BY-SA aunque se conviertan a WebP.
Cuando `image_source === 'off'`, el front debe mostrar cerca de la imagen (o en el detalle del producto):

> Imagen: [Open Food Facts contributors](image_source_ref) · CC BY-SA 3.0

`image_source_ref` guarda la URL del producto en OFF. Para un listado global:
`SELECT id, name, image_source_ref FROM products WHERE image_source = 'off';`

## Cuándo se consulta Open Food Facts

| Momento | Cómo |
|---|---|
| Formulario de creación | `GET /lookup/:barcode` al escanear (vista previa) |
| Crear / editar producto | Si queda con código de barras y sin imagen → cola en segundo plano |
| Importación CSV | Cada producto creado entra a la cola; el import no espera a OFF |
| Productos existentes | `npm run images:backfill` (ver `DEPLOY.md` §7.1) |
| Venta | **Nunca** |

La cola vive en memoria (se pierde si se reinicia la API; el backfill la recupera) y respeta
~85 consultas/min a OFF. La caché de resultados de OFF es **global** entre tenants (un código de barras
es el mismo en todas las tiendas) e incluye los "no encontrado", 30 días.

## Configuración

Ver `.env.example` (`S3_BUCKET`, `S3_REGION`, `CDN_BASE_URL`, `OFF_USER_AGENT`) y `DEPLOY.md` §7.1
(bucket privado + CloudFront con OAC, cache policy que incluya `v` en la clave, rol IAM mínimo,
`client_max_body_size` de Nginx). En tests, OFF está apagado y S3 se simula.
