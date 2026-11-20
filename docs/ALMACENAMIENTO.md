# Almacenamiento

## Resumen

| Dato | Dónde vive | ¿Sale del teléfono? |
|---|---|---|
| Productos (incluye fotos) | IndexedDB del teléfono | No |
| Cuentas bancarias | IndexedDB del teléfono | Solo los datos de la cuenta elegida, dentro del QR o enlace de cada venta |
| Ventas e historial | IndexedDB del teléfono | El ticket de cada venta va en su QR o enlace |
| Ajustes y perfiles | IndexedDB del teléfono | Nombre visible, mensaje y redes van en el ticket |

No hay servidor ni base de datos en la nube. No se usa `localStorage` como base de datos: solo guarda **la venta en curso** (el carrito antes de cobrar) para que no se pierda si Android cierra la app al cambiar a la cámara o al banco. Al cobrar o vaciar la venta, se borra.

## Base de datos local (IndexedDB `otoo-qr-pos`, versión 1)

| Almacén | Clave | Contenido |
|---|---|---|
| `settings` | `"main"` | Modos activos, prefijo y siguiente número de folio, perfil por modo |
| `products` | `id` (UUID) | Producto; índice por modo |
| `accounts` | `id` (UUID) | Cuenta bancaria |
| `sales` | `id` (UUID) | Venta con **copia histórica** de artículos, precios y cuenta; historial de estados; enlace del ticket |

Toda la lectura y escritura pasa por `src/lib/db.ts`. Para agregar sincronización en la nube (v0.2) solo hay que cambiar esa capa.

### Integridad

- **Crear venta** es una sola transacción: verifica existencias con datos frescos, asigna folio, descuenta existencias, guarda la venta y aumenta el consecutivo. Si algo falla, no se guarda nada.
- **Sin duplicados:** cada cobro abierto tiene un `id`. Tocar "Generar QR" dos veces devuelve la misma venta.
- **Copia histórica:** editar o borrar un producto o cuenta no cambia las ventas anteriores.
- **Cancelar** regresa las existencias. Una venta cancelada no puede volver a pagada.
- La app pide al navegador **almacenamiento persistente** (`navigator.storage.persist()`) para que Android no borre los datos si falta espacio.

## El ticket dentro del enlace

```
https://<donde esté publicada>/t.html#z<datos>
```

- `<datos>` = JSON compacto → comprimido (deflate) → base64url.
- Va después de `#`: **el navegador no lo envía al servidor** que aloja la página, así que GitHub o Netlify nunca ven los datos de la venta.
- Contiene: modo, folio, fecha, nombre visible, color, mensaje, total, artículos (u ocultos), banco, beneficiario, CLABE, tarjeta, cuenta o DiMo (si se configuraron), concepto, referencia, WhatsApp, redes y marca de demo.
- La página del cliente valida todo: CLABE con dígito verificador, que la suma de artículos coincida con el total, tamaños máximos y redes permitidas. Si algo no cuadra, muestra "El enlace está incompleto o dañado".

## Respaldo

Ajustes → **Respaldo**:
- **Descargar:** un archivo `.json` con todo (las fotos van en base64).
- **Cargar:** **reemplaza** todos los datos del teléfono con los del archivo.

Recomendación: descargar un respaldo al terminar cada evento y guardarlo en un lugar privado, porque contiene datos bancarios.
