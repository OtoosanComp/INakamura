# Proyecto Meta — memoria para Claude

Rama `proyecto-meta` del repo OtoosanComp/INakamura (rama huérfana, separada del POS). El usuario trabaja **solo desde el
teléfono** con Claude Code en la nube: no tiene PC. Todo se produce en el contenedor y se le entrega con la herramienta de
envío de archivos. Escribe en español de México.

## Qué es
Contenido para **Yami Nakamura**, avatar IA (psicología oscura + anime + true crime) para monetizar en Facebook/Instagram.
Lee `biblia/biblia-yami.md` antes de escribir nada. Skills del proyecto: `yami-guion`, `yami-video`, `meta-publicar`.

## Decisiones tomadas (no re-discutir)
- Reels de **60 s o menos**, gancho en el segundo 1, idealmente uno al día **sin horario fijo** (no mencionar horarios en los videos).
  Meta de largos: **1 por semana (8–10 min) en YouTube**, día libre; de cada largo salen 3–4 Reels/Shorts (`docs/videos-largos.md`).
- **Nada de "uwu" ni expresiones así.** Cierre: "¿Tú qué hubieras hecho?". No abrir susurrando.
- **Voz: ElevenLabs v4, voz "Ingrid - natural & soft" (KVJNlB9xei0FCE8ekWnI), SIN indicaciones de tono y SIN cambio de tono.**
  (Antes "Kevin": con [whispering]/[serious] bajaba a 120–140 Hz y sonaba masculina; Ingrid queda en ~220 Hz, nunca < 195.)
  Revisar cada toma con `scratchpad`/evaluar: mediana ≥ 190 Hz y ninguna ventana de 4 s < 170 Hz. Flujo: `voz.prompt_eleven(escenas)` arma el texto con `[tono]` por escena → generar con el conector
  de ElevenLabs (1 llamada por Reel, 2 tomas) → descargar a `assets/voces/` → `render.py guion.yaml --audio toma.mp3`.
  Elegir la toma con mejor coincidencia de Whisper. ~1 crédito por carácter (Reel ≈ 800 × 2 tomas). Plan gratis: 10k/mes y
  NO permite uso comercial → para monetizar hace falta un plan de pago (pendiente, el usuario lo resolverá).
  Respaldo gratis: Kokoro (`personajes/yami/voz.yaml`, Sol3 196 Hz) si no hay créditos.
- **Yami = anime "Mystery & Mind"** (cabello rojo cobrizo con moño negro, ojos verdes, pecas, chamarra negra/morada, choker).
  `personajes/yami/anime/`: originales de ChatGPT + `listas/` escaladas x4. `yami/seria` habla (boca) y parpadea;
  `yami/susurrando|pensativa|sorprendida|leyendo|tierna` son fijas (se mueven con la voz). Fotos realistas: `yamireal/<recorte>`.
- Yami entra desde abajo (rebote + barrido + campanita) en sus escenas. Portada = cuadro 0.6 s (`portada.jpg`).
- Kotonoha: ilustración ORIGINAL inspirada (`assets/fondos/kotonoha-retrato.jpg`), no arte oficial (derechos/monetización).
- Imágenes: Yami = recortes de rostro de sus referencias (sin tomas sugerentes); fondos = anime generado localmente
  (MeinaMix V11 + LCM, OpenRAIL-M). Nunca clips/capturas de anime.
- Subtítulos: se entregan quemados (`_subtitulado.mp4`) + `.es_LA.srt` aparte (CapCut móvil no importa .srt).
- ECC está vendorizado en `herramientas/ecc` (commit fijado); solo 15 skills activas. `herramientas/ecc-activar.sh` para más.
- Claude-Mem, Free-LLM/OmniRoute y MoneyPrinterV2 no sirven en la nube (ver `docs/pendientes-skills.md`).

## Estado (actualizar al terminar cada sesión)
- Semana 1: Reel de hoy r1 (Kotonoha) y Reel de presentación p0 (`guiones/presentacion/`) renderizados con voz ElevenLabs y
  Yami anime. r2 (Nice boat) y r3 (Kotonoha vs Yuno) tienen guion y fondos; el usuario pidió la presentación en su lugar.
- Pendiente: plan de ElevenLabs con uso comercial; idea de APK "Yami Media Studio" (panel en el teléfono + render en GitHub
  Actions) analizada, NO iniciada; Yami realista como prueba A/B; primer video largo (esquema en `guiones/semana-01-kotonoha/largo-domingo-ESQUEMA.md`).
- Tsuki: voz propuesta en `personajes/tsuki/voz.yaml` (Re4), sin probar.

## Al empezar una sesión
1. `bash produccion/setup.sh` (los modelos no persisten entre contenedores).
2. Revisa `CLAUDE.md` → Estado, y `docs/pendientes-skills.md`.
3. Los videos van a `salida/` (ignorado por git). Fondos y recortes sí se suben.
