# Estado del proyecto — v0.1

Leyenda: ✅ terminado y probado · 🟡 terminado con limitación documentada · ⏳ pendiente

## Criterios de aceptación de la biblia

| Criterio | Estado | Notas |
|---|---|---|
| Crear y administrar productos | ✅ | Nombre, precio, categoría, foto opcional, existencias opcionales, visible/oculto, modo |
| Ventas con varios artículos | ✅ | Más "artículo libre" (precio escrito a mano) |
| Cálculo correcto de importes | ✅ | En centavos enteros; pruebas automáticas |
| Folios únicos | ✅ | `PREFIJO-0001`, consecutivo por teléfono; no se duplica al tocar dos veces |
| Cuentas bancarias | ✅ | Varias cuentas; CLABE con dígito verificador; banco detectado; tarjeta (Luhn); DiMo |
| QR individual por venta | ✅ | Probado: generar → leer con lector QR → ticket idéntico |
| Consultar la venta desde otro teléfono | 🟡 | Funciona **sin servidor** (datos dentro del enlace). Requiere que la app esté publicada en https |
| Copiar datos bancarios | ✅ | CLABE, importe, beneficiario, concepto, referencia, tarjeta, cuenta, DiMo, "copiar todo" |
| Tickets descargables | ✅ | Imagen PNG (compartir a WhatsApp), enlace y vista para imprimir |
| Historial persistente | ✅ | IndexedDB; sobrevive a cerrar la app y reiniciar el teléfono |
| Actualizar estados de pago | ✅ | Pendiente → Pagado (transferencia/efectivo) → Cancelado, con fecha y hora |
| Funciona en Android | 🟡 | Probado en navegador móvil emulado (412×915). **Falta probar en el Redmi Note real** |
| Demo no se presenta como real | ✅ | Todo lo demo queda marcado; los tickets demo dicen "NO TRANSFERIR" |

## Extras pedidos en la conversación

| Función | Estado |
|---|---|
| Modo convención y modo oscuro +18 | ✅ |
| Activar solo uno de los dos modos | ✅ |
| Concepto anónimo editable (máx. 30 caracteres, sin acentos para el banco) | ✅ |
| Ocultar artículos en el ticket (anonimato del cliente) | ✅ |
| Botón "Ya pagué · Enviar comprobante por WhatsApp" | ✅ |
| Redes sociales en el ticket (Telegram, OnlyFans, etc.) | ✅ máx. 3 por modo |
| Funciona sin internet (vendedora) | ✅ PWA con service worker |
| Existencias que se descuentan solas y regresan al cancelar | ✅ |
| Cobro en efectivo | ✅ |
| Resumen del día (vendido, cobrado, por confirmar, efectivo/transferencia) | ✅ |
| Respaldo y cambio de teléfono (exportar/importar archivo) | ✅ |
| La venta en curso no se pierde si Android cierra la app | ✅ |
| Actualizaciones sin recarga sorpresa (aviso "Toca para actualizar") | ✅ |
| APK para Android (Capacitor), descargable desde la página publicada | 🟡 compilado; falta probarlo en el Redmi real |

## Limitaciones conocidas (honestas)

1. **Sin servidor = el ticket es una "foto" del momento.** Si la vendedora cancela o marca pagada una venta después, el cliente sigue viendo el ticket como se generó. La app de la vendedora sí tiene el estado real.
2. **Varios teléfonos no se sincronizan.** Cada teléfono tiene su inventario y sus ventas. Usa prefijos de folio distintos (A, B, C) y el respaldo para pasar datos. La sincronización llega con cuentas en la nube (v0.2).
3. **No hay confirmación automática de pagos.** La vendedora verifica el depósito en su banco. El folio en el concepto ayuda a identificarlo en segundos. Una captura de "transferencia exitosa" puede ser falsa.
4. **Los datos viven en el teléfono.** Si se borran los datos del navegador o se pierde el teléfono sin respaldo, se pierden. La app pide al navegador almacenamiento persistente.
5. **QR más denso con muchos artículos.** 5 artículos = QR versión 16; 12 artículos = versión 17. Se leen bien desde pantalla con brillo alto.

## Pendiente (siguientes versiones)

### v0.2: cuentas en la nube (necesario para vender la app a cada cosplayer)
- ⏳ Inicio de sesión: misma cuenta en 3-4 teléfonos (staff) con usuario y contraseña.
- ⏳ Sincronizar catálogo, existencias y ventas entre teléfonos (sigue funcionando sin internet y sincroniza al volver la señal).
- ⏳ Respaldo automático en la nube.
- ⏳ Control de suscripción o licencia por cosplayer.
- ⏳ Estado en vivo en el ticket del cliente (pagado/cancelado).

### Mejoras de uso
- ⏳ Descuentos y paquetes ("2 prints por $200").
- ⏳ Reporte por evento (exportar ventas a Excel/CSV).
- ⏳ Dominio propio para dar más confianza al cliente.
- ⏳ Rediseño visual (segunda etapa).
- ⏳ Firmar el APK con llave privada antes de distribuirlo (hoy usa llave de prueba).
- ⏳ Mantener la pantalla encendida en el APK mientras se muestra el QR (en la versión web ya funciona).

### Fuera de alcance (según la biblia)
Pasarelas de pago, Mercado Pago, CoDi, confirmación automática de transferencias, facturación, contabilidad, IA, comisiones.
