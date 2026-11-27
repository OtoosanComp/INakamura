# Video largo 02 — "La semana de las yandere" · PREPARACIÓN (antes del storyboard)
Estado: inventario listo; falta el guion completo y las imágenes que se piden abajo. **No se ha generado voz.**
Datos: `docs/investigacion-yandere-largo.md` + investigaciones de los Reels 1–5.
Duración objetivo: 9–10 min (YouTube, 16:9). Formato igual que el largo 01 (`produccion/largo.py`).

## 1. Estructura (≈ tiempos)
| # | Sección | Audio | ≈ s |
|---|---|---|---|
| 0 | Gancho: "Te dicen: haría cualquier cosa por ti. ¿Romántico… o aterrador?" | **r5** 0.0–5.7 | 6 |
| 1 | Presentación + qué es una yandere (yanderu + deredere; amor → obsesión) | nuevo | 30 |
| 2 | Kotonoha: "no nació así" (School Days 2007 → vínculo traumático) | **r1** 8.0–52.6 | 45 |
| 3 | De paso: Nice boat (final cancelado por un hecho real, sin detalles; reactancia) | nuevo | 35 |
| 4 | **Ranking mundial** (MAL): Yuno, Kurumi, Lucy, Esdeath, Albedo, Toga… + Japón: Satou + "¿Mikasa cuenta?" | **r4** 0–5.4, 9.9–47.2 + nuevo | 75 |
| 5 | Lucy / Elfen Lied, por encima (por qué la ponen en las listas, sin escenas) | nuevo | 25 |
| 6 | **Yandere en los videojuegos**: Yandere Simulator → Doki Doki (Monika te habla a ti) → MiSide (Mita) | **r5** 15.2–21.9 + nuevo | 70 |
| 7 | Por qué nos atraen: meme de Yuno 2011, TikTok, masoquismo benigno, miedo justo | **r5** 8.8–14.8, 22.4–41.5 | 30 |
| 8 | Psicología de fondo: apego ansioso, limerencia, erotomanía, conductas de control | nuevo | 80 |
| 9 | Cuando sale de la pantalla: Japón 1999 → ley de 2000 · Hinckley 1981 (obsesión parasocial) | nuevo | 70 |
| 10 | Cierre: "romantizar el control… buena ficción, un amor que controla, no" + pregunta + suscríbete + "¿Tú qué hubieras hecho?" | **r5** 42.3–50.2 + nuevo | 35 |
**Total ≈ 9:20** · reutilizado ≈ 2:45 (0 créditos) · voz nueva ≈ 6:35 ≈ **6,000–6,500 créditos** (quedan 24,410).

## 2. Audios que se reutilizan (ElevenLabs, voz Ingrid; tiempos de Whisper en `assets/voces/transcripciones.json`)
- `r1-ingrid-toma1.mp3` 8.04–52.56: de "School Days, 2007" a "¿…o la volvieron una?" (sin "No tengas miedo" ni el cierre).
- `r4-ingrid-toma2.mp3` 0.00–5.40 ("La yandere más popular del mundo… otros Toga") y 9.88–47.18 (MAL, Japón/Satou,
  "¿por qué Yuno?", Juno, "Mikasa no cuenta… ¿o sí?"). Se omite "¿no tengas miedo?" (salió con entonación rara).
- `r5-ingrid-toma2.mp3`: 0.00–5.68 gancho; 8.84–14.76 meme 2011; 15.18–21.88 Yandere Simulator; 22.38–41.54 TikTok,
  masoquismo benigno, miedo justo; 42.26–48.12 "romantizar el control… buena ficción".
  `r5-ingrid-toma1.mp3` 46.28–53.60 para "Un amor que controla, no." (en la toma 2 sonó como pregunta).
- NO sirven: `r1-toma*`, `p0-toma*` (voz anterior "Kevin", grave). r2 y r3 nunca tuvieron voz Ingrid → su texto va en la voz nueva.
- Corte: en silencios entre frases (Whisper) + 30 ms de fundido; la voz nueva se genera en 3 partes (< 3,000 caracteres).

## 3. Reels que salen DEL largo (sin voz extra)
- **r6 "El ranking mundial de las yandere"** (≈ 50 s): gancho nuevo corto (1 frase) + ranking + Lucy + "¿Mikasa cuenta?" +
  "¿Tú a cuál le das la corona?". Se corta del audio del largo (secciones 4–5).
- **r7 "Yandere en los videojuegos"** (≈ 50 s): Yandere Simulator → Monika → Mita + "en el juego te mira a ti" + pregunta.
  Del audio de la sección 6. Si hace falta una frase de gancho/cierre propia, se agrega al generar la voz del largo
  (≈ 150 caracteres) para no hacer otra llamada.

## 4. Yami en pantalla (como el largo 01, más IRL)
- **Yami anime habla** (lipsync listo): `personajes/yami/anime/listas/seria*` + expresiones fijas (pensativa,
  sorprendida, leyendo, tierna, susurrando). En 6–8 frases clave, entra por un lado.
- **Yami IRL "habla"**: hoy NO hay imágenes IRL alineadas (boca cerrada/abierta en la misma foto). → pedir (§6-A).
- **Stickers IRL** (`personajes/yami/irl/stickers-expresiones.jpg`): el de "School Days" va en la sección 2; selfie guiño
  para la despedida. El del **cuchillo con sangre NO se usa** (regla 1 de la biblia: sin sangre ni armas; desmonetiza).
- **Tsuki**: solo aparece en fotos (cosplays), no habla.
- Tarjetas de capítulo con retratos HD de Yami (5 en `guiones/largos/01-gta6-jason-lucia/entrada/fotos/yami-hd-*`).

## 5. Inventario de imágenes que YA tenemos
- Fondos anime (sin personajes): corona, podio, azucar, diosa-juno, corazon-cadena, diario-rosa, dos-siluetas,
  estacion-lluvia, fiordo-barco, mar-noche, paraguas, pasillo-rumores, salon-vacio, tele-antigua, telefono-noche,
  azotea, yandere-sim (escena del juego con logo).
- Retratos ORIGINALES inspirados: kotonoha, yuno, toga, satou, mikasa.
- Cosplays de las gemelas: yami-yuno, yami-toga, tsuki-mikasa, tsuki-satou, gemelas-selfie.
- Portadas oficiales (caché, no repo): Mirai Nikki, My Hero Academia, Happy Sugar Life, Attack on Titan.
  Faltan y se bajan igual (AniList/Steam): School Days, Elfen Lied, Date A Live, Akame ga Kill!, Overlord, Higurashi,
  Doki Doki Literature Club, MiSide.
- Yami: anime (9 expresiones + 5 HD + hoja de modelo), IRL (12 stickers, selfie guiño, hoja de uniforme con 7 expresiones).

## 5b. Recibido el 27-nov (recortes de busto/cara en `personajes/gemelas/cosplay/`)
- yami-monika (IRL), yami-yuno-anime, tsuki-albedo, tsuki-kurumi, tsuki-kurumi2, tsuki-mita.
- Gag cómico: `tsuki-kurumi-censura.jpg` (Yami enojada tapando el escote + "¡TSUKI, TÁPATE!"). Si llega la Yami chibi con
  toalla, se rehace desde el original (`salida/originales/`, no se sube: escote/ligueros).
- Las tomas originales con escote, ligueros o de espaldas (Albedo derecha) NO se usan completas ni se suben.

## 6. LO QUE FALTA (pedir a ChatGPT) — por prioridad
**A. Yami IRL que "habla" (indispensable para lo que pediste)**
- 1 foto realista de Yami de **busto, de frente a cámara**, fondo de su cuarto oscuro con luz morada (figuras anime
  detrás), ropa de su estilo (chamarra negra/morada, choker), **sin escote**.
- De ESA MISMA foto, 2 ediciones donde **solo cambie la cara**: (1) boca entreabierta como hablando, (2) ojos cerrados.
  Pedirle a GPT: "edita esta imagen: cambia solo la boca a entreabierta, como hablando; no muevas nada más".
- Ideal: un 2.º juego igual pero sonriendo (para el cierre).
**B. Cosplays de las gemelas para el ranking y los juegos** (busto, sin escote; anime o IRL, como prefieras)
- Yami como **Lucy** (Elfen Lied: cabello rosa, cuernitos) · Tsuki como **Kurumi** (Date A Live: un ojo dorado, gótica).
- Tsuki como **Albedo** (Overlord: vestido blanco, cuernos, alas negras) · Yami como **Esdeath** (opcional).
- Yami como **Monika** (DDLC: uniforme café, moño blanco) · Tsuki como **Mita** (MiSide: cabello azul, gorra roja).
**C. Fondos sin personajes** (estilo anime; o los hago yo local en calidad media si prefieres no pedirlos)
- Calle residencial de Japón de noche con un poste de luz (caso 1999) · edificio de gobierno / libro de leyes (ley 2000).
- Sala de cine vacía con la pantalla encendida (Hinckley, sin nombrar la película en imagen).
- Pantalla de computadora con un archivo "monika.chr" y un cursor (DDLC) · celular con mapa y un punto de ubicación (control).

## 7. Reglas que aplican (biblia)
- Sin sangre, cuerpos, armas ni fotos reales de crímenes. Casos reales: sin nombres de víctimas, sin detalles.
- Personajes: "se parece a…", no diagnósticos. Yami explica; no da terapia.
- Portadas oficiales chicas y breves, "Portadas © de sus respectivos autores" en la descripción.
- Sin tomas sugerentes de Yami/Tsuki.
