# Otoo QR POS · v0.1

Punto de venta para cosplayers y vendedores de convenciones. Armas la venta tocando tus productos, aparece un **QR único** y tu cliente lo escanea con su cámara: ve su **ticket** (qué compró, cuánto costó cada cosa y el total) y **copia tu CLABE y el importe con un toque** para pagar desde la app de su banco.

> **Sin comisiones.** El dinero va directo de la cuenta del cliente a la tuya. Otoo QR POS no procesa pagos, no toca el dinero y no es una pasarela.

---

## ¿Cómo funciona?

```
 Vendedora (app)                         Cliente (su celular, sin instalar nada)
 ───────────────                         ───────────────────────────────────────
 1. Toca productos  → total              4. Escanea el QR con la cámara
 2. "Generar QR"                         5. Ve su ticket + botones "Copiar CLABE",
 3. Muestra el QR en grande                 "Copiar importe", "Copiar concepto"
                                          6. Paga en su app del banco
 8. Ve el depósito en su banco           7. (Opcional) "Ya pagué · Enviar comprobante
    → toca "Ya pagó"                         por WhatsApp"
```

### Funciona aunque la vendedora NO tenga internet

El QR contiene **todos los datos del ticket** dentro del enlace (comprimidos). La app de la vendedora no necesita señal para crear ventas ni generar QR. El cliente sí necesita datos en su celular, pero eso ya lo necesita para transferir.

Si la página no le carga al cliente, la pantalla del QR tiene **"Mostrar QR solo con CLABE"**: un QR de texto que la cámara lee sin abrir ninguna página.

### Dos modos

| | ✨ Convención | 🖤 Modo oscuro +18 |
|---|---|---|
| Catálogo | Propio | Propio, separado |
| Tema | Claro | Oscuro |
| Concepto de transferencia | `Compra A-0012` | `Gracias por tu compra A-0012` (editable, máx. 30 caracteres) |
| Artículos en el ticket | Visibles | Visibles u **ocultos** (solo "3 artículos" y el total) |
| Redes | Instagram, TikTok… | Telegram, OnlyFans, Fansly… |

Cada modo tiene su propio nombre visible (puede ser un alias), color, mensaje, WhatsApp, cuenta y redes. Puedes activar uno o los dos.

---

## Usarlo en tu teléfono (Android)

Hay dos formas. Las dos hacen lo mismo; elige una (sus datos son independientes).

### Opción A: APK (app instalable)

1. Descarga `otoo-qr-pos.apk` desde `https://otoosancomp.github.io/INakamura/otoo-qr-pos.apk` (o el archivo que te mandaron).
2. Ábrelo. Android pedirá permiso para **instalar apps de origen desconocido**: permítelo solo para Chrome o Archivos.
3. Si Play Protect avisa "app no reconocida", toca **Más detalles → Instalar de todas formas** (pasa con toda app que no venga de Play Store).

Los QR del APK apuntan a la página pública (`VITE_PUBLIC_URL` en `.env`), así que **la página debe estar publicada** para que el cliente abra el ticket.

### Opción B: desde Chrome (PWA)

1. Abre en Chrome la dirección publicada (ver abajo), por ejemplo `https://otoosancomp.github.io/INakamura/`.
2. Menú ⋮ → **Instalar app** (o "Agregar a pantalla principal").
3. Ábrela desde el ícono. A partir de ahí **funciona sin internet**.

La primera vez te pide nombre, modos y CLABE. Para solo probar, toca **"Solo quiero probar (datos de demostración)"**: todo lo demo queda marcado y sus tickets dicen **NO TRANSFERIR**.

---

## Publicar la app (gratis con GitHub Pages)

El QR apunta a la dirección donde esté publicada la app, así que **para que funcione en otro teléfono debe estar publicada en internet (https)**.

**Una sola vez:**

1. En GitHub: **Settings → Pages → Build and deployment → Source: `GitHub Actions`**.
2. Une esta rama a `main` (pull request). La acción **"Publicar en GitHub Pages"** corre las pruebas, compila y publica.
3. La app queda en `https://otoosancomp.github.io/INakamura/`.

Cada cambio que llegue a `main` se publica solo. Los teléfonos con la app instalada se actualizan al abrirla con internet.

**Alternativa sin GitHub:** `npm run build` y arrastra la carpeta `dist/` a [Netlify Drop](https://app.netlify.com/drop) o Cloudflare Pages.

**Dominio propio (recomendado más adelante):** da más confianza al cliente (`pagos.tumarca.mx`). Se configura en Settings → Pages → Custom domain.

> ⚠ Si la app se abre desde `localhost` o una IP local (`192.168…`), la pantalla del QR muestra un aviso: esos QR solo funcionan en la misma red.

---

## Para desarrolladores

Requisitos: Node 20+ y npm.

```bash
npm install        # instala dependencias
npm run dev        # servidor de desarrollo (http://localhost:5173)
npm test           # pruebas: cálculos, CLABE, ticket, QR, almacenamiento
npm run build      # compila a dist/ (incluye PWA y service worker)
npm run preview    # sirve dist/ para probar la versión compilada
npm run android:apk  # compila el APK (requiere JDK 21 y Android SDK; ANDROID_HOME)
```

El APK se genera en `android/app/build/outputs/apk/release/app-release.apk`. La acción de publicación también lo compila y lo deja en `https://…/INakamura/otoo-qr-pos.apk`.

**Firma del APK:** las versiones de prueba se firman con una llave de **prueba** incluida en el repositorio (`android/keystore/otoo-test.keystore`), para poder actualizar sin desinstalar. Antes de distribuir la app a otras cosplayers, hay que cambiar a una llave privada (variables `OTOO_KEYSTORE_FILE`, `OTOO_KEYSTORE_PASSWORD`, `OTOO_KEY_ALIAS`, `OTOO_KEY_PASSWORD` desde GitHub Secrets). Ese cambio obliga a reinstalar una vez, así que conviene descargar un respaldo antes.

Para probar desde el celular en la misma red: `npm run dev` y abre `http://IP-DE-TU-PC:5173`. Ojo: sin https, el portapapeles y la instalación pueden fallar, así que la prueba real es con la versión publicada.

### Estructura

```
index.html            App de la vendedora (React)
android/              Proyecto Android (Capacitor) para el APK
t.html                Página pública del ticket (sin React, ~13 KB)
src/
  App.tsx, state.tsx  Navegación y estado
  screens/            Vender, QR, Ventas, Detalle, Productos, Ajustes, Bienvenida
  components/ui.tsx   Hojas, avisos, interruptores, miniaturas
  ticket/             Página del cliente (main.ts + ticket.css)
  lib/
    money.ts          Dinero en centavos (sin errores de redondeo)
    cart.ts           Carrito y validaciones
    bankdata.ts       CLABE (dígito verificador), bancos, tarjeta (Luhn)
    concept.ts        Folio, concepto SPEI (≤40) y referencia (7 dígitos)
    payload.ts        Ticket dentro del enlace (comprimido, validado)
    sale.ts           Crear venta, estados, resumen del día
    db.ts             IndexedDB (única capa de datos)
    qr.ts             Generación de QR
    ticketImage.ts    Ticket como imagen PNG
tests/                Pruebas (Vitest)
docs/                 Almacenamiento, seguridad, estado y prueba en convención
```

### Dependencias (todas pequeñas y justificadas)

| Paquete | Para qué |
|---|---|
| react, react-dom | Interfaz de la vendedora |
| idb | IndexedDB con promesas (~1 KB) |
| qrcode | Generar QR |
| fflate | Comprimir el ticket para que el QR sea menos denso |
| lucide-react | Íconos |
| vite-plugin-pwa (dev) | Service worker para funcionar sin internet |
| @capacitor/* | Empaquetar como APK; compartir archivos y enlaces en Android |
| vitest, jsqr, fake-indexeddb (dev) | Pruebas, incluida la lectura real del QR |

### Documentación

- [docs/ESTADO.md](docs/ESTADO.md): qué está terminado y qué falta.
- [docs/ALMACENAMIENTO.md](docs/ALMACENAMIENTO.md): dónde y cómo se guardan los datos.
- [docs/SEGURIDAD.md](docs/SEGURIDAD.md): riesgos y protecciones.
- [docs/PRUEBA_CONVENCION.md](docs/PRUEBA_CONVENCION.md): lista para la primera prueba real.

---

*El ticket de Otoo QR POS es un comprobante de venta, no un comprobante fiscal (CFDI).*
