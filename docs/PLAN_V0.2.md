# Plan v0.2: QR cobrable, tarjeta y cobro de la función

**Modelo de negocio:** el dinero va **directo a la cuenta de la cosplayer**. Otoo le cobra por usar la app (pago por adelantado), **nunca comisión por venta** y nunca toca el dinero. Así Otoo no tiene que operar como agregador de pagos.

---

## 1. QR cobrable con el estándar oficial de Banxico (decisión principal)

### Qué dice Banxico (fuente oficial)
*"Guías para la homologación de la experiencia de usuario en transferencias electrónicas de fondos a través de dispositivos móviles"*, versión 1.1, publicada el 28 de agosto de 2026, **vigente desde el 14 de diciembre de 2026** (Circular 9/2026):

- Las apps de bancos y fintechs deben permitir **generar un QR para recibir** con la CLABE (o tarjeta, o celular DiMo) y, si el usuario quiere, **monto, concepto y referencia numérica**. También deben poder descargarlo como imagen.
- Las apps deben permitir **"transferencia electrónica por lectura o carga de QR"** (sección C): leer con la cámara **o cargar desde una imagen** un QR CoDi o un QR con identificador de cuenta. Los datos del QR (beneficiario, monto, concepto, referencia) se muestran **solo para revisión, sin poder editarse**.
- El formato técnico está en el **Apéndice AS del Manual de Operación del SPEI**, que **no es público**. CoDi usa otro apéndice, el AD.

**Para Otoo:** si genera un QR con ese formato (CLABE de la cosplayer + total + concepto + referencia), el comprador lo escanea **con la app de su banco** y la transferencia sale ya llena. Sin comisión y sin copiar nada.

### Cómo conseguir el formato
1. **Laboratorio QR** (ya hecho en esta rama, en Ajustes): se carga la imagen del QR "para recibir" que genera una app bancaria y Otoo muestra su contenido y estructura (EMVCo/TLV, JSON, URL, CRC, CLABE).
   - Pedir a 3 o 4 personas con bancos distintos (BBVA, Nu, Banorte, Santander, Mercado Pago, Spin) que generen un QR **con monto y concepto** y manden el contenido copiado.
   - Algunas apps podrían tenerlo antes del 14 de diciembre; todas deberían tenerlo después.
2. En paralelo: pedir el Apéndice AS a Banxico o a un participante del SPEI.

### Qué cambia en Otoo cuando tengamos el formato
- `src/lib/bankQr.ts`: generador del QR oficial (con pruebas que comparen contra los QR reales capturados).
- Pantalla del QR: dos pestañas, **"Ticket"** (el actual, para la cámara) y **"App del banco"** (QR oficial).
- Página del comprador: botón **"Guardar QR para mi banco"**. Las apps deben poder *cargar* el QR desde una imagen.
- Validar con 3 o más apps bancarias reales que el monto y el concepto se llenen solos.

### Riesgo a vigilar
Que el formato incluya una **firma o cifrado** que solo puedan generar los bancos. El laboratorio lo mostraría: campos que no se entienden o que cambian cada vez. Si pasa, la alternativa es CoDi a través de un intermediario registrado (sección 3).

---

## 2. Cobro con tarjeta (NFC) — **hecho en esta rama**

- Otoo no procesa tarjetas: eso exige certificación EMV/PCI y un banco adquirente.
- La cosplayer cobra con **Clip, Mercado Pago (Point Tap) u otra app con Tap to Pay** en su celular con NFC y luego registra la venta en Otoo con el botón **"Tarjeta"**.
- Resultado: el ticket dice "Pagado con tarjeta" y el resumen del día separa transferencia, efectivo y tarjeta.
- La comisión la cobra el proveedor de la tarjeta (≈2.5 %–4 % + IVA), no Otoo.
- Más adelante, si se pide, se puede integrar el kit de desarrollo de Stripe Terminal (Tap to Pay) dentro de Otoo. Requiere servidor y cuenta Stripe de cada cosplayer.

---

## 3. Confirmación automática del pago (opcional, después)

| Opción | Costo | Requisitos |
|---|---|---|
| **CoDi** a través de un intermediario registrado (p. ej. Pey; verificar condiciones) | $0 según Banxico | Servidor que reciba el aviso; la cosplayer con CoDi activado en su banco |
| **CEP de Banxico** (comprobante electrónico de pago) | $0 | Revisar si su consulta se puede automatizar y si los términos de uso lo permiten |
| **CLABE única por venta** (STP, Openpay, Conekta, Stripe) | Fijo por pago | Contrato de cada cosplayer con el proveedor; el dinero pasa por el proveedor (no encaja bien con el modelo) |

---

## 4. Cobrar la función a las cosplayers

**Opción A, sin servidor (rápida):** código de activación firmado.
- Otoo genera un código con nombre de la cosplayer y fecha de vencimiento, firmado con una llave privada que solo tiene el equipo.
- La app lo valida **sin internet** con la llave pública. Al vencer, se bloquea "Generar QR" (el historial sigue visible).
- Limitación: alguien con conocimientos podría modificar el APK. Es aceptable para empezar.

**Opción B, con servidor (completa):** cuentas con usuario y contraseña.
- 3 o 4 teléfonos por cuenta (staff), sincronización de catálogo, existencias y ventas, respaldo en la nube y control de suscripción.
- Es la base de la versión 0.3. Candidatos: Supabase o Firebase (plan gratuito para empezar).

---

## 5. Firma del APK
Antes de distribuir a otras cosplayers, cambiar la llave de prueba por una privada (ver `docs/SEGURIDAD.md`). Implica reinstalar una vez: hacer respaldo antes.

---

## Orden sugerido
1. Feedback de Persefone → ajustes de uso.
2. **Ya:** capturar QR "para recibir" reales con el laboratorio.
3. QR oficial dentro de Otoo y prueba con varias apps bancarias.
4. Código de activación (cobro de la función).
5. Servidor: cuentas multi-teléfono y sincronización.
