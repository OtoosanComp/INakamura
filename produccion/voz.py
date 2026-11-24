"""Voz de los personajes con Kokoro (CPU) + afinación al tono objetivo + tiempos por palabra.

Uso rápido:  python voz.py --personaje yami --prueba "No tengas miedo, yo te explico."
"""
import argparse
import difflib
import re
import subprocess
import tempfile
import unicodedata
from pathlib import Path

import numpy as np
import soundfile as sf
import yaml

from comun import MODELOS, RAIZ, ffmpeg

MARCA = re.compile(r"\[([^\]|]+)\|([^\]]+)\]")  # [pantalla|pronunciación]


def para_pantalla(texto):
    return MARCA.sub(lambda m: m.group(1), texto)


def para_voz(texto):
    return MARCA.sub(lambda m: m.group(2), texto)


def prompt_eleven(escenas):
    """Texto para ElevenLabs. Sin indicaciones de tono por defecto: con [whispering]/[serious] la voz se iba a
    registros graves y sonaba masculina. Si una escena trae `tono`, se antepone como "[tono]"."""
    return " ".join((f"[{e['tono']}] " if e.get("tono") else "") + para_voz(e["texto"]) for e in escenas)


def cargar_voz(personaje):
    return yaml.safe_load((RAIZ / "personajes" / personaje / "voz.yaml").read_text())


_kokoro = None


def _motor():
    global _kokoro
    if _kokoro is None:
        from kokoro_onnx import Kokoro
        _kokoro = Kokoro(str(MODELOS / "kokoro-v1.0.onnx"), str(MODELOS / "voices-v1.0.bin"))
    return _kokoro


def _estilo(conf):
    k = _motor()
    return np.sum([k.get_voice_style(n) * w for n, w in conf["mezcla"]], axis=0)


def _recortar_silencio(a, sr, umbral=0.01, margen=0.04):
    idx = np.where(np.abs(a) > umbral)[0]
    if len(idx) == 0:
        return a
    i0 = max(idx[0] - int(margen * sr), 0)
    i1 = min(idx[-1] + int(margen * sr), len(a))
    return a[i0:i1]


def mediana_f0(ruta):
    import parselmouth
    p = parselmouth.Sound(str(ruta)).to_pitch(pitch_floor=75, pitch_ceiling=600).selected_array["frequency"]
    p = p[p > 0]
    return float(np.median(p)) if len(p) else 0.0


def sintetizar(textos, personaje, destino):
    """Genera un WAV (48 kHz) con todas las frases y devuelve [(inicio, fin), ...] por frase."""
    conf = cargar_voz(personaje)
    k, estilo = _motor(), _estilo(conf)
    pausa = conf.get("pausa_entre_escenas_s", 0.3)
    trozos, tramos, t, sr = [], [], 0.0, 24000
    for i, texto in enumerate(textos):
        a, sr = k.create(para_voz(texto), voice=estilo, speed=conf["velocidad"], lang="es")
        a = _recortar_silencio(a, sr)
        tramos.append((t, t + len(a) / sr))
        trozos.append(a)
        t += len(a) / sr
        if i < len(textos) - 1:
            trozos.append(np.zeros(int(pausa * sr), dtype=a.dtype))
            t += pausa
    with tempfile.TemporaryDirectory() as tmp:
        crudo = Path(tmp) / "crudo.wav"
        sf.write(crudo, np.concatenate(trozos), sr)
        f0 = mediana_f0(crudo)
        objetivo = conf["f0_objetivo_hz"]
        razon = objetivo / f0 if f0 else 1.0
        efectos = " ".join(conf["efectos"].split())
        for _ in range(3):  # el desplazamiento real no siempre es exacto: medir y corregir
            cadena = f"rubberband=pitch={razon:.5f}:formant=preserved:pitchq=quality:transients=smooth,{efectos}"
            ffmpeg("-i", crudo, "-af", cadena, "-ar", 48000, "-ac", 1, destino)
            final = mediana_f0(destino)
            if not final or abs(final / objetivo - 1) < 0.02:
                break
            razon *= objetivo / final
    return tramos, {"f0_original": round(f0, 1), "f0_final": round(final, 1), "razon": round(razon, 4)}


# ---------- tiempos por palabra (Whisper + alineación con el guion) ----------

def _norm(p):
    p = unicodedata.normalize("NFKD", p.lower())
    return re.sub(r"[^a-z0-9ñ]", "", "".join(c for c in p if not unicodedata.combining(c)))


_whisper = None


def _asr():
    global _whisper
    if _whisper is None:
        from faster_whisper import WhisperModel
        _whisper = WhisperModel("small", device="cpu", compute_type="int8", download_root=str(MODELOS / "whisper"))
    return _whisper


def _audio16k(ruta, t0, t1):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{t0}", "-to", f"{t1}", "-i", str(ruta),
                          "-ac", "1", "-ar", "16000", "-f", "f32le", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32)


def tiempos_palabras(ruta, textos, tramos):
    """Devuelve lista de palabras de pantalla: {palabra, ini, fin, escena}. Se alinea por escena."""
    salida = []
    for i, (texto, (t0, t1)) in enumerate(zip(textos, tramos)):
        guion = para_pantalla(texto).split()
        segs, _ = _asr().transcribe(_audio16k(ruta, t0, t1), language="es", word_timestamps=True)
        oidas = [(w.word.strip(), w.start + t0, w.end + t0) for s in segs for w in (s.words or [])]
        tiempos = [None] * len(guion)
        sm = difflib.SequenceMatcher(a=[_norm(g) for g in guion], b=[_norm(o[0]) for o in oidas], autojunk=False)
        for bloque in sm.get_matching_blocks():
            for j in range(bloque.size):
                o = oidas[bloque.b + j]
                tiempos[bloque.a + j] = (o[1], o[2])
        # Interpolar las palabras no reconocidas (nombres, números) según su largo.
        anclas = [(-1, t0, t0)] + [(j, *tt) for j, tt in enumerate(tiempos) if tt] + [(len(guion), t1, t1)]
        for (ja, _, fa), (jb, ib, _) in zip(anclas, anclas[1:]):
            hueco = list(range(ja + 1, jb))
            if not hueco:
                continue
            pesos = np.array([max(len(_norm(guion[j])), 1) for j in hueco], float)
            cortes = fa + (ib - fa) * np.concatenate([[0], np.cumsum(pesos) / pesos.sum()])
            for n, j in enumerate(hueco):
                tiempos[j] = (cortes[n], cortes[n + 1])
        salida += [{"palabra": g, "ini": float(a), "fin": float(b), "escena": i} for g, (a, b) in zip(guion, tiempos)]
    return salida


def desde_audio(origen, textos, destino):
    """Voz ya generada (p. ej. ElevenLabs, guion completo en una toma): limpieza suave, sin cambio de tono.
    Alinea con Whisper todas las palabras del guion y deduce dónde empieza y termina cada escena."""
    ffmpeg("-i", origen, "-af", "highpass=f=70,acompressor=threshold=-22dB:ratio=2:attack=15:release=200",
           "-ar", 48000, "-ac", 1, destino)
    import soundfile as sf
    total = sf.info(str(destino)).duration
    guion = [(p, i) for i, texto in enumerate(textos) for p in para_pantalla(texto).split()]
    segs, _ = _asr().transcribe(_audio16k(destino, 0, total), language="es", word_timestamps=True)
    oidas = [(w.word.strip(), w.start, w.end) for s in segs for w in (s.words or [])]
    tiempos = [None] * len(guion)
    sm = difflib.SequenceMatcher(a=[_norm(g) for g, _ in guion], b=[_norm(o[0]) for o in oidas], autojunk=False)
    for b in sm.get_matching_blocks():
        for j in range(b.size):
            tiempos[b.a + j] = oidas[b.b + j][1:]
    anclas = [(-1, 0.0, 0.0)] + [(j, *tt) for j, tt in enumerate(tiempos) if tt] + [(len(guion), total, total)]
    for (ja, _, fa), (jb, ib, _) in zip(anclas, anclas[1:]):
        hueco = list(range(ja + 1, jb))
        if hueco:
            pesos = np.array([max(len(_norm(guion[j][0])), 1) for j in hueco], float)
            cortes = fa + (ib - fa) * np.concatenate([[0], np.cumsum(pesos) / pesos.sum()])
            for n, j in enumerate(hueco):
                tiempos[j] = (cortes[n], cortes[n + 1])
    # Quitar el silencio del principio: el gancho tiene que sonar desde el segundo 0.
    corte = max(tiempos[0][0] - 0.05, 0.0)
    if corte > 0.02:
        recortado = Path(str(destino) + ".tmp.wav")
        ffmpeg("-ss", f"{corte:.3f}", "-i", destino, recortado)
        recortado.replace(destino)
    palabras = [{"palabra": g, "ini": float(a) - corte, "fin": float(b) - corte, "escena": i}
                for (g, i), (a, b) in zip(guion, tiempos)]
    tramos = []
    for i in range(len(textos)):
        ps = [p for p in palabras if p["escena"] == i]
        tramos.append((ps[0]["ini"], ps[-1]["fin"]))
    reconocidas = sum(1 for t in sm.get_matching_blocks() for _ in range(t.size))
    return tramos, palabras, {"f0_final": round(mediana_f0(destino), 1),
                              "palabras_reconocidas": f"{reconocidas}/{len(guion)}"}


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--personaje", default="yami")
    ap.add_argument("--prueba", required=True)
    ap.add_argument("--salida", default=str(RAIZ / "salida" / "prueba-voz.wav"))
    a = ap.parse_args()
    Path(a.salida).parent.mkdir(parents=True, exist_ok=True)
    tramos, info = sintetizar([a.prueba], a.personaje, a.salida)
    print(a.salida, info)
