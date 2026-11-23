---
name: yami-video
description: Producir los videos de Yami (voz Kokoro en La3, fondos anime locales, subtítulos .srt/.ass, render 1080x1920) con el pipeline de produccion/. Úsala cuando pidan "haz los videos", renderizar, regenerar voz, fondos o subtítulos, o preparar archivos para CapCut/Meta.
---

# Producción de videos de Yami

Todo corre en el contenedor (CPU, sin GPU, sin créditos). Los modelos se guardan en `~/.cache/proyecto-meta`.

## 1. Preparar el entorno (cada sesión nueva, ~5-10 min)
```bash
bash produccion/setup.sh
```
Crea el venv, instala dependencias y descarga Kokoro, Real-ESRGAN, Whisper small y el modelo anime (verifica sha256 donde aplica).

## 2. Fondos de la semana (solo los que falten; ~5 min c/u en CPU)
```bash
cd produccion && ~/.cache/proyecto-meta/venv/bin/python fondos.py ../guiones/semana-NN-tema
```
Córrelo en segundo plano. Revisa las imágenes (sin texto raro, sin sangre/armas) antes de usarlas; rehace con
`--solo id --rehacer` cambiando `semilla` o prompt en `fondos.yaml`. Los fondos se guardan en `assets/fondos/` y se suben al repo.

## 3. Recortes de Yami (solo si cambian las referencias)
`python recortes.py` → `personajes/yami/recortes/*.png` (Real-ESRGAN x4).

## 3b. Caras de Yami anime (solo si cambian)
`python expresiones.py` → `personajes/yami/anime/listas/` (pega boca/ojos sobre la base y escala x4 con el modelo anime).

## 3c. Voz con ElevenLabs (la elegida)
1. `python -c "import yaml,voz;print(voz.prompt_eleven(yaml.safe_load(open(G))['escenas']))"` (G = ruta del guion).
2. Conector ElevenLabs: `creative_generate_speech` con `model_id=eleven_v4`, `voice_id=wg3kHEV2ptlzBG8TbOem`
   (estimar primero con `estimate_only`; nunca reintentar una generación: cobra otra vez). Sondear con
   `creative_get_flow_run_status` y descargar las tomas a `assets/voces/<id>-tomaN.mp3`.
3. Elegir la toma que Whisper transcribe mejor y renderizar con `--audio`.

## 4. Render
```bash
cd produccion && ~/.cache/proyecto-meta/venv/bin/python render.py ../guiones/semana-NN-tema/r1-....yaml --audio ../assets/voces/<id>-toma1.mp3
```
Sin `--audio` usa Kokoro (respaldo gratis).
~4-6 min por Reel. Salida en `salida/<id>/` (no se sube al repo):
- `<id>_subtitulado.mp4` → para subir directo (subtítulos quemados, palabra clave en cobre).
- `<id>.mp4` → limpio, para editar en CapCut del teléfono.
- `<id>.es_LA.srt` → subtítulos aparte (CapCut Web/Escritorio o Facebook; CapCut móvil NO importa .srt).
- `publicar.txt` → descripción, hashtags, comentario fijado, checklist de Meta.

## 5. Verificar antes de entregar
- `reporte.json`: duración ≤ 60 s; con ElevenLabs revisa `palabras_reconocidas` (≥ 90 %); con Kokoro `f0_final` ≈ 196 Hz.
- Extrae 3-4 cuadros (`ffmpeg -ss T -i video -frames:v 1 x.png`) y míralos: texto legible, nada cortado.
- Transcribe la voz con Whisper y compárala con el guion.

## 6. Entregar
Manda los MP4, el .srt y `publicar.txt` con la herramienta de envío de archivos (el usuario trabaja desde el teléfono).

## Voz
`personajes/yami/voz.yaml`: mezcla ef_dora 0.75 + af_heart 0.25, velocidad 0.85, tono a 220 Hz con formantes
preservados. Tsuki (Re4 = 293.66 Hz) está en `personajes/tsuki/voz.yaml` como propuesta.
