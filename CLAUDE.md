# Proyecto Meta — memoria para Claude

Rama `proyecto-meta` del repo OtoosanComp/INakamura (rama huérfana, separada del POS). El usuario trabaja **solo desde el
teléfono** con Claude Code en la nube: no tiene PC. Todo se produce en el contenedor y se le entrega con la herramienta de
envío de archivos. Escribe en español de México.

## Qué es
Contenido para **Yami Nakamura**, avatar IA (psicología oscura + anime + true crime) para monetizar en Facebook/Instagram.
Lee `biblia/biblia-yami.md` antes de escribir nada. Skills del proyecto: `yami-guion`, `yami-video`, `meta-publicar`.

## Decisiones tomadas (no re-discutir)
- Reels de **60 s o menos**, gancho en el segundo 1, 3 por semana (Lun/Mié/Vie 8 pm CDMX). Largo de domingo después.
- Voz: Kokoro (gratis, Apache-2.0) mezcla ef_dora+af_heart, afinada a **La3 = 220 Hz** (Tsuki irá en Re). Sin ElevenLabs (créditos).
- Imágenes: Yami = recortes de rostro de sus referencias (sin tomas sugerentes); fondos = anime generado localmente
  (MeinaMix V11 + LCM, OpenRAIL-M). Nunca clips/capturas de anime.
- Subtítulos: se entregan quemados (`_subtitulado.mp4`) + `.es_LA.srt` aparte (CapCut móvil no importa .srt).
- ECC está vendorizado en `herramientas/ecc` (commit fijado); solo 15 skills activas. `herramientas/ecc-activar.sh` para más.
- Claude-Mem, Free-LLM/OmniRoute y MoneyPrinterV2 no sirven en la nube (ver `docs/pendientes-skills.md`).

## Estado (actualizar al terminar cada sesión)
- Semana 1 (Kotonoha / School Days): 3 guiones listos en `guiones/semana-01-kotonoha/`. Piloto r1 renderizado y
  entregado para aprobación de voz y estilo. **Siguiente paso: con el OK del usuario, renderizar r2 y r3.**
- Largo del domingo: solo esquema (`largo-domingo-ESQUEMA.md`).
- Tsuki: voz propuesta en `personajes/tsuki/voz.yaml`, sin probar.

## Al empezar una sesión
1. `bash produccion/setup.sh` (los modelos no persisten entre contenedores).
2. Revisa `CLAUDE.md` → Estado, y `docs/pendientes-skills.md`.
3. Los videos van a `salida/` (ignorado por git). Fondos y recortes sí se suben.
