"""Voz de un video largo armada con PEDAZOS de audios que ya existen + voz NUEVA (ElevenLabs, en partes).

Guion (Markdown) con bloques en orden:
  🔁 <clave> <ini>–<fin> · texto     → audio existente (clave → archivo en ALIAS), recortado en los silencios vecinos
  línea normal                        → voz nueva (se agrupa en partes por sección: PARTES)
  > notas, #, - … se ignoran (salvo `## N.` que marca sección)

Uso:
  python montaje.py <guion.md> textos         → escribe partes-voz/parte{1,2,3}.txt (para generar en ElevenLabs)
  python montaje.py <guion.md> armar          → con assets/voces/<id>-parte{N}.mp3 ya descargadas: arma la voz completa
                                                 y un guion limpio (guion-voz.md) para largo.py
"""
import difflib
import json
import re
import subprocess
import sys
from pathlib import Path

import numpy as np

from comun import RAIZ, ffmpeg

VOCES = RAIZ / "assets" / "voces"
ALIAS = {"r1-1": "r1-ingrid-toma1.mp3", "r4-1": "r4-ingrid-toma1.mp3", "r4-2": "r4-ingrid-toma2.mp3",
         "r5-1": "r5-ingrid-toma1.mp3", "r5-2": "r5-ingrid-toma2.mp3"}
PARTES = {0: 1, 1: 1, 2: 1, 3: 1, 4: 2, 5: 2, 6: 2, 7: 3, 8: 3, 9: 3}   # sección → parte de voz nueva
PAUSA = 0.30
REUSO = re.compile(r"^🔁\s+(\S+)\s+([\d.]+)[–-]([\d.]+)\s+·\s+(.*)$")
MARCA = re.compile(r"\[([^\]|]+)\|([^\]]+)\]")


def bloques(md):
    out, sec = [], None
    for l in Path(md).read_text(encoding="utf-8").split("## Reels que salen")[0].splitlines():
        m = re.match(r"^## (\d+)\.", l)
        if m:
            sec = int(m.group(1))
            out.append({"tipo": "seccion", "n": sec, "titulo": l[3:].strip()})
            continue
        if sec is None or not l.strip() or l.startswith((">", "#", "-", "`", "Cómo")):
            continue
        r = REUSO.match(l.strip())
        if r:
            out.append({"tipo": "reuso", "clave": r.group(1), "ini": float(r.group(2)), "fin": float(r.group(3)),
                        "texto": r.group(4).strip(), "sec": sec})
        else:
            out.append({"tipo": "nuevo", "texto": l.strip(), "sec": sec, "parte": PARTES[sec]})
    return out


def textos(md):
    d = Path(md).parent / "partes-voz"
    d.mkdir(exist_ok=True)
    for p in sorted(set(PARTES.values())):
        t = "\n".join(MARCA.sub(lambda m: m.group(2), b["texto"]) for b in bloques(md)
                      if b["tipo"] == "nuevo" and b["parte"] == p)
        (d / f"parte{p}.txt").write_text(t, encoding="utf-8")
        print(f"parte{p}: {len(t)} caracteres")


# ---------- alineación ----------

def _norm(p):
    import unicodedata
    p = unicodedata.normalize("NFKD", p.lower())
    return re.sub(r"[^a-z0-9ñ]", "", "".join(c for c in p if not unicodedata.combining(c)))


_asr = None


def palabras(ruta):
    global _asr
    if _asr is None:
        from faster_whisper import WhisperModel
        from comun import MODELOS
        _asr = WhisperModel("small", device="cpu", compute_type="int8", download_root=str(MODELOS / "whisper"))
    a = np.frombuffer(subprocess.run(["ffmpeg", "-v", "error", "-i", str(ruta), "-ac", "1", "-ar", "16000", "-f", "f32le",
                                      "-"], capture_output=True, check=True).stdout, np.float32)
    segs, _ = _asr.transcribe(a, language="es", word_timestamps=True)
    return [(w.word.strip(), w.start, w.end) for s in segs for w in (s.words or [])]


def cortes_parte(ruta, parrafos):
    """Tiempos (ini, fin) de cada párrafo dentro de una parte de voz nueva, cortando a la mitad de los silencios."""
    oidas = palabras(ruta)
    guion = [(_norm(w), i) for i, p in enumerate(parrafos) for w in MARCA.sub(lambda m: m.group(2), p).split()]
    guion = [g for g in guion if g[0]]
    sm = difflib.SequenceMatcher(a=[g[0] for g in guion], b=[_norm(o[0]) for o in oidas], autojunk=False)
    t = {}
    for b in sm.get_matching_blocks():
        for j in range(b.size):
            i = guion[b.a + j][1]
            ini, fin = oidas[b.b + j][1], oidas[b.b + j][2]
            t.setdefault(i, [ini, fin])
            t[i][0], t[i][1] = min(t[i][0], ini), max(t[i][1], fin)
    total = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0",
                                  str(ruta)], capture_output=True, text=True).stdout)
    lim = [0.0]
    for i in range(len(parrafos) - 1):
        a, b = t.get(i, [None, None])[1], t.get(i + 1, [None, None])[0]
        if a is None or b is None:
            raise SystemExit(f"No pude ubicar el párrafo {i} o {i + 1} de {ruta.name}")
        lim.append((a + b) / 2)
    lim.append(total)
    return list(zip(lim, lim[1:]))


def ajustar_reuso(b):
    """Extiende ini/fin a la mitad del silencio con la palabra vecina (para no cortar respiraciones)."""
    d = json.loads((VOCES / "transcripciones.json").read_text())[ALIAS[b["clave"]]]
    ws = [(w[1], w[2]) for s in d for w in s["palabras"]]
    antes = [e for s_, e in ws if e <= b["ini"] + 0.02]
    despues = [s_ for s_, e in ws if s_ >= b["fin"] - 0.02]
    ini = (max(antes) + b["ini"]) / 2 if antes else 0.0
    fin = (min(despues) + b["fin"]) / 2 if despues else b["fin"] + 0.4
    return ini, fin


def armar(md, ident):
    bl = bloques(md)
    tmp = RAIZ / "salida" / ident / "montaje"
    tmp.mkdir(parents=True, exist_ok=True)
    # cortes de la voz nueva
    cortes = {}
    for p in sorted(set(PARTES.values())):
        nuevos = [b for b in bl if b["tipo"] == "nuevo" and b["parte"] == p]
        for b, c in zip(nuevos, cortes_parte(VOCES / f"{ident}-parte{p}.mp3", [b["texto"] for b in nuevos])):
            cortes[id(b)] = (VOCES / f"{ident}-parte{p}.mp3", *c)
    piezas, k = [], 0
    sil = tmp / "pausa.wav"
    ffmpeg("-f", "lavfi", "-i", "anullsrc=r=48000:cl=mono", "-t", PAUSA, sil)
    for b in bl:
        if b["tipo"] == "seccion":
            continue
        if b["tipo"] == "reuso":
            src, (ini, fin) = VOCES / ALIAS[b["clave"]], ajustar_reuso(b)
        else:
            src, ini, fin = cortes[id(b)]
        out = tmp / f"{k:03d}.wav"
        ffmpeg("-ss", f"{ini:.3f}", "-to", f"{fin:.3f}", "-i", src, "-af",
               "loudnorm=I=-18:TP=-2:LRA=11,afade=t=in:d=0.03,areverse,afade=t=in:d=0.05,areverse",
               "-ar", 48000, "-ac", 1, out)
        piezas += [out, sil]
        k += 1
    lista = tmp / "lista.txt"
    lista.write_text("".join(f"file '{p}'\n" for p in piezas))
    destino = VOCES / f"{ident}-montaje.mp3"
    ffmpeg("-f", "concat", "-safe", 0, "-i", lista, "-c:a", "libmp3lame", "-q:a", 2, destino)
    # guion limpio para largo.py (secciones "## N. Título" + texto con marcas [pantalla|voz])
    limpio = []
    for b in bl:
        if b["tipo"] == "seccion":
            limpio.append(f"\n## {b['titulo']}\n")
        else:
            limpio.append(b["texto"])
    (Path(md).parent / "guion-voz.md").write_text("\n".join(limpio) + "\n", encoding="utf-8")
    print(destino, k, "piezas")


if __name__ == "__main__":
    md, paso = sys.argv[1], sys.argv[2]
    if paso == "textos":
        textos(md)
    else:
        armar(md, sys.argv[3] if len(sys.argv) > 3 else "largo02")
