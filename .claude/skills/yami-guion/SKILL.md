---
name: yami-guion
description: Escribir guiones de Reels (≤60 s) para Yami Nakamura, avatar IA de psicología oscura + anime + true crime en español de México. Úsala cuando pidan guiones, temas de la semana, ganchos, descripciones o hashtags para Yami/Tsuki o "Proyecto Meta".
---

# Guiones de Yami

Lee primero `biblia/biblia-yami.md` (personaje, reglas de Meta, pilares) y el `CLAUDE.md` de la raíz.

## Formato de archivo
Un YAML por Reel en `guiones/semana-NN-tema/rN-slug.yaml`. Copia la forma de
`guiones/semana-01-kotonoha/r1-no-nacio-yandere.yaml`: `id`, `titulo`, `publicar`, `pilar`,
`gancho_pantalla`, `cierre_pantalla`, `resaltar`, `escenas` (cada una con `visual`, `texto` y `etiqueta` opcional),
`descripcion`, `hashtags`, `comentario_fijado`, `fuentes`.

- `visual`: `yami/<recorte>` (seria, seria2, ojo, sonrisa; ver `personajes/yami/recortes.yaml`) o `fondo/<id>`
  (definido en `guiones/<semana>/fondos.yaml`; prompt en inglés, solo escenarios/siluetas).
- `tras: fondo/<id>` (opcional): imagen detrás de Yami, p. ej. el retrato de la personaje de la que se habla.
- `portada: <id>` (opcional): portada oficial chica de la obra (`assets/portadas.yaml`); úsala SIEMPRE que se
  mencione un anime, porque mucha gente no lo ubica por nombre. Las portadas no se suben al repo (es público).
- `texto`: lo que dice la voz. Para que se lea distinto de cómo suena: `[pantalla|pronunciación]`.

## Pronunciación (Kokoro en español)
| Pantalla | Escribir |
|---|---|
| Kotonoha | `[Kotonoha\|Kotonoja]` |
| School Days | `[School Days\|Escul Deis]` |
| Nice boat | `[Nice boat\|nais bout]` |
| Mirai Nikki | `[Mirai Nikki\|Mirai Niki]` |
| team | `[team\|tim]` |
| 2007 | `[2007\|dos mil siete]` |
Ante cualquier palabra extranjera nueva, prueba: `python produccion/voz.py --prueba "..."` y transcribe con Whisper.

## Estructura (≤ 60 s, ~120-135 palabras con voz lenta)
1. **0–3 s gancho**: la primera palabra ya es gancho (no "hola", no silencio). Va también en `gancho_pantalla`.
2. **Frase de Yami**: "No tengas miedo... yo te explico por qué pasó."
3. **Contexto** (año, lugar, sin nombres reales de víctimas).
4. **3 datos raros**, con `etiqueta: "DATO 1/2/3"`.
5. **Plus Yami**: un concepto de psicología con fuente reputable, dicho como "se parece a", nunca diagnóstico.
6. **Cierre**: pregunta + "¿Tú qué hubieras hecho?" (no "sígueme", no "mira hasta el final": Meta lo castiga).

**Prohibido**: "uwu" y muletillas de ese estilo; abrir susurrando; anunciar días u horarios de publicación.

Mide con `python produccion/render.py <guion> --solo-voz`; si la voz pasa de 58 s, recorta.

## Reglas que no se rompen
- Cada dato con fuente en `fuentes:`. Si no se puede verificar, no va (o va como "dicen los fans").
- Nada de sangre, armas, cuerpos, detalles gráficos de crímenes, fotos reales. Finales violentos: "un final violento", sin describir.
- Casos reales: solo cerrados, de hace 5+ años; sin nombres completos de víctimas; "según la investigación"; no acusar a vivos.
- Sin fan service ni tomas sugerentes de Yami (Meta no monetiza contenido sugerente).
- Sin clips ni capturas de anime (contenido no original + derechos de autor). Solo fondos generados y siluetas.
- 3 hashtags: 1 genérico + 2 de nicho. Descripción siempre con "Contenido educativo y de divulgación, sin material gráfico." y "Avatar virtual con IA."
