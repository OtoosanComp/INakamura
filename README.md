# Proyecto Meta 🌙

Fábrica de Reels para **Yami Nakamura** (avatar IA · psicología oscura + anime + true crime · 🇲🇽).
Todo se produce desde Claude Code en la nube: guion → voz → fondos → subtítulos → video. Sin PC y sin créditos.

## Estructura
| Carpeta | Qué hay |
|---|---|
| `biblia/` | Biblia de Yami (personaje, reglas de Meta, formato, pilares) |
| `guiones/semana-NN-tema/` | Un YAML por Reel + `fondos.yaml` + esquema del largo |
| `personajes/yami/` | Referencias, recortes de rostro (x4) y `voz.yaml` (La3 = 220 Hz) |
| `personajes/tsuki/` | Referencia y propuesta de voz (Re4 = 293.66 Hz) |
| `assets/fondos/` | Fondos anime generados (MeinaMix V11, uso comercial permitido) |
| `assets/fuentes/` | Inter Display (OFL) |
| `produccion/` | Pipeline: `setup.sh`, `fondos.py`, `recortes.py`, `render.py`, `voz.py`, `subtitulos.py`, `audio.py` |
| `.claude/skills/` | Skills activas: `yami-guion`, `yami-video`, `meta-publicar` + 15 de ECC |
| `herramientas/ecc/` | ECC completo (328 skills) fijado a un commit; `herramientas/ecc-activar.sh` activa más |
| `docs/` | Investigación con fuentes, reporte de ECC, estado de herramientas |
| `salida/` | Videos renderizados (no se suben al repo) |

## Uso (lo hace Claude; aquí por si acaso)
```bash
bash produccion/setup.sh
cd produccion
~/.cache/proyecto-meta/venv/bin/python fondos.py ../guiones/semana-01-kotonoha      # fondos que falten
~/.cache/proyecto-meta/venv/bin/python render.py ../guiones/semana-01-kotonoha/r1-no-nacio-yandere.yaml
```

## Licencias de lo que usamos
Kokoro v1.0 (Apache-2.0) · MeinaMix V11 (CreativeML OpenRAIL-M) · LCM-LoRA (OpenRAIL++) · Real-ESRGAN (BSD-3) ·
faster-whisper (MIT) · Inter (OFL-1.1) · ECC (MIT). La música y los efectos se generan por código.
