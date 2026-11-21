# Seguridad

## Lo que la app NUNCA hace
- No pide, guarda ni muestra contraseñas, NIP, tokens ni códigos bancarios.
- No se conecta a ningún banco ni procesa pagos.
- No tiene credenciales ni datos bancarios reales en el código fuente. La cuenta demo usa la CLABE de ejemplo publicada por Banxico (`002010077777777771`, que no es una cuenta real) y el beneficiario "DEMO NO TRANSFERIR".

## Datos bancarios
- Solo se guardan en el teléfono de la vendedora (IndexedDB).
- Solo se comparten **en el QR o enlace de una venta que la vendedora generó**. La CLABE es un dato que la vendedora quiere que el cliente vea: es la misma que antes iba impresa en la cartulina.
- Validación antes de guardar: CLABE de 18 dígitos **con dígito verificador** (no basta con tener 18 dígitos), tarjeta con algoritmo de Luhn y celular de 10 dígitos.

## La página del cliente
- Todo el texto se inserta con `textContent`, nunca como HTML, para que nadie pueda inyectar código con un nombre de producto.
- Las redes sociales solo aceptan tipos conocidos y usuarios con `[A-Za-z0-9._-]`. No se pueden meter enlaces arbitrarios ni `javascript:`.
- El cliente **no puede modificar la venta**. Si edita el enlace, solo cambia lo que él mismo ve; la venta real está en el teléfono de la vendedora. Además se valida que el total coincida con los artículos.
- `noindex` y `no-referrer`: los buscadores no indexan tickets y el enlace no se filtra a los sitios de redes.
- Aviso visible: *"Realiza la transferencia desde tu aplicación bancaria y verifica que el beneficiario y el importe sean correctos. Nunca compartas contraseñas, NIP ni códigos de tu banco."*

## Riesgos conocidos y cómo se mitigan

| Riesgo | Mitigación |
|---|---|
| **QR falso**: alguien genera un enlace con su propia CLABE usando la página pública | El cliente escanea directo de la pantalla de la vendedora. La app bancaria muestra el nombre real del titular y la página pide verificarlo. En v0.2, con servidor, los tickets podrán firmarse. |
| **Comprobante falso**: el cliente muestra una captura editada de "transferencia exitosa" | Solo cuenta el depósito visto en el banco de la vendedora. El folio en el concepto permite encontrarlo rápido. El estado se cambia a mano, nunca de forma automática. |
| **Venta cancelada presentada como pagada** | No se permite pasar de CANCELADO a PAGADO. Cada cambio queda en el historial con fecha y hora. |
| **Pérdida del teléfono** | Los datos están en el almacenamiento del navegador. Recomendación: bloqueo de pantalla del teléfono y respaldo después de cada evento. |
| **Archivo de respaldo filtrado** | Contiene datos bancarios y ventas. La app lo advierte; guárdalo en un lugar privado. |
| **Anonimato del cliente (+18)** | El concepto que sale en el estado de cuenta es un texto genérico editable más el folio (no revela qué compró). Se pueden ocultar los artículos del ticket. Los datos van después de `#` y no llegan a ningún servidor. |

## APK de prueba
- Se firma con una **llave de prueba pública** (`android/keystore/otoo-test.keystore`) para que las actualizaciones se instalen encima sin perder datos.
- Riesgo: cualquiera con el repositorio podría firmar un APK falso que se instale encima. Mitigación: instalar solo desde la página oficial o desde los archivos que manda el equipo.
- **Antes de vender la app a otras cosplayers**: firmar con una llave privada guardada en GitHub Secrets (`OTOO_KEYSTORE_*`).

## Comisiones y pagos
Otoo QR POS no procesa pagos, no retiene dinero y no cobra comisiones por transacción. El ticket no es un CFDI.
