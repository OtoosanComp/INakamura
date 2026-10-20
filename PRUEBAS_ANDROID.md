# Checklist de prueba — Nakamura Twins Studio 0.4

## Compilación (GitHub Actions)
- [ ] El workflow termina en verde.
- [ ] Se descargan `app-debug.apk` y `diagnostics/*`.
- [ ] `apk-size.txt` informa un tamaño mayor que cero.
- [ ] `apk-sha256.txt` contiene un hash SHA-256.
- [ ] `apk-signature.txt` informa verificación satisfactoria o explica que `apksigner` no estaba disponible.

## Instalación (Moto G82 5G / Android 13)
- [ ] El APK se instala sin desactivar Play Protect.
- [ ] Aparece “Nakamura Twins Studio” en el launcher con el nuevo icono.
- [ ] La app abre sin cerrarse.
- [ ] Importar una imagen desde el teléfono.
- [ ] Cambiar entre perfil Tsuki y perfil Yami.
- [ ] Probar brillo, contraste y saturación.
- [ ] Guardar/exportar el resultado.
- [ ] Probar cámara y conceder permiso solo cuando Android lo solicite.
- [ ] Cerrar y abrir la app; comprobar si los proyectos siguen presentes.

## Si falla la instalación
No repetir intentos indefinidamente. Guarda la captura del mensaje y adjunta los cuatro archivos de diagnóstico. Un APK debug no es una versión final ni una publicación de Play Store.
