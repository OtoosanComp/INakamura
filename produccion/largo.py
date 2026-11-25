"""Arma un VIDEO LARGO horizontal (YouTube, 16:9) desde un guion en Markdown + voz ya generada por partes.

Uso:
  python largo.py ../guiones/largos/01-gta6-jason-lucia/largo.yaml voz      # une las partes y alinea con Whisper
  python largo.py ../guiones/largos/01-gta6-jason-lucia/largo.yaml video    # renderiza por partes (~2 min) y une
  python largo.py ... video --parte 2   # solo rehace una parte (si el contenedor se reinició)

El guion (`guion-adaptado.md`) usa secciones `## ...`; las líneas con `>` son notas y no se leen.
`[pantalla|voz]` = cómo se escribe | cómo se pronuncia (subtítulos usan la forma de pantalla).
En `largo.yaml` cada «cue» cambia la imagen cuando la voz dice la frase `en:` (o al iniciar la sección `seccion:`).
"""
import argparse
import json
import math
import re
import subprocess
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

import numpy as np
import yaml
from PIL import Image, ImageDraw, ImageFilter, ImageFont

from comun import RAIZ, SALIDA, duracion, ffmpeg

W, H, FPS = 1280, 720, 30
PARTE_SEG = 120.0
FUNDIDO = 0.6
PAUSA_ENTRE_PARTES = 0.7
FUENTES = RAIZ / "assets" / "fuentes"
COBRE = (232, 115, 74)


def fuente(peso, tam):
    return ImageFont.truetype(str(FUENTES / f"InterDisplay-{peso}.otf"), tam)


def suave(x):
    x = min(max(x, 0.0), 1.0)
    return x * x * (3 - 2 * x)


# ---------------- guion ----------------

def secciones(md):
    out, actual = [], None
    for linea in Path(md).read_text(encoding="utf-8").splitlines():
        if linea.startswith("## "):
            if linea.startswith("## Fuentes"):
                break
            if not re.match(r"## (\d+\.|Aviso)", linea):
                actual = None
                continue
            actual = {"titulo": linea[3:].strip(), "texto": []}
            out.append(actual)
        elif actual and linea.strip() and not linea.startswith(">") and not linea.startswith("---"):
            actual["texto"].append(linea.strip())
    return [{"titulo": s["titulo"], "texto": " ".join(s["texto"])} for s in out if s["texto"]]


# ---------------- voz ----------------

def preparar_voz(conf, dir_out):
    import voz
    base = Path(conf["_dir"])
    partes = [RAIZ / p for p in conf["voz"]]
    lista = dir_out / "partes.txt"
    sil = dir_out / "silencio.wav"
    ffmpeg("-f", "lavfi", "-i", f"anullsrc=r=48000:cl=mono", "-t", PAUSA_ENTRE_PARTES, sil)
    norm = []
    for i, p in enumerate(partes):
        d = dir_out / f"p{i}.wav"
        ffmpeg("-i", p, "-ar", 48000, "-ac", 1, d)
        norm.append(d)
    with open(lista, "w") as f:
        for i, d in enumerate(norm):
            if i:
                f.write(f"file '{sil}'\n")
            f.write(f"file '{d}'\n")
    unida = dir_out / "voz_unida.wav"
    ffmpeg("-f", "concat", "-safe", 0, "-i", lista, "-c", "copy", unida)
    secs = secciones(base / conf["guion"])
    tramos, palabras, info = voz.desde_audio(unida, [s["texto"] for s in secs], dir_out / "voz.wav")
    datos = {"secciones": [{**s, "ini": a, "fin": b} for s, (a, b) in zip(secs, tramos)],
             "palabras": palabras, "info": info, "duracion": duracion(dir_out / "voz.wav")}
    (dir_out / "alineacion.json").write_text(json.dumps(datos, ensure_ascii=False, indent=1))
    print(info, "duración", round(datos["duracion"], 1))


# ---------------- cues ----------------

def _n(t):
    import voz
    return [voz._norm(x) for x in t.split()]


def resolver_cues(conf, datos):
    pal = datos["palabras"]
    normas = [_n(p["palabra"])[0] if _n(p["palabra"]) else "" for p in pal]
    secs = datos["secciones"]
    cues, desde = [], 0
    for c in conf["cues"]:
        if "seccion" in c:
            t = secs[c["seccion"]]["ini"] - (0.15 if c["seccion"] else 0)
        else:
            obj = _n(c["en"])
            t = None
            for i in range(desde, len(normas) - len(obj) + 1):
                if normas[i:i + len(obj)] == obj:
                    t, desde = pal[i]["ini"] - 0.1, i + 1
                    break
            if t is None:
                raise SystemExit(f"No encontré la frase: {c['en']!r}")
        cues.append({**c, "t": max(t, 0.0)})
    return cues


# ---------------- subtítulos (línea de hasta ~42 caracteres) ----------------

def bloques_subs(palabras, max_chars=42):
    out, act = [], []
    corte = re.compile(r"[.?!…:;]$")
    for i, p in enumerate(palabras):
        act.append(p)
        texto = " ".join(x["palabra"] for x in act)
        sig = palabras[i + 1] if i + 1 < len(palabras) else None
        coma = p["palabra"].endswith(",") and len(texto) > 22
        if (sig is None or corte.search(p["palabra"]) or coma
                or len(texto) + 1 + len(sig["palabra"]) > max_chars
                or sig["ini"] - p["fin"] > 0.6):
            out.append({"texto": texto.rstrip(",;"), "ini": act[0]["ini"], "fin": act[-1]["fin"]})
            act = []
    for a, b in zip(out, out[1:]):
        if b["ini"] - a["fin"] < 0.3:
            a["fin"] = b["ini"]
    return out


def _ts(s):
    ms = int(round(s * 1000))
    return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"


def escribir_srt(subs, ruta):
    with open(ruta, "w", encoding="utf-8") as f:
        for i, s in enumerate(subs, 1):
            f.write(f"{i}\n{_ts(s['ini'])} --> {_ts(s['fin'])}\n{s['texto']}\n\n")


# ---------------- imágenes ----------------

_cache = {}


def imagen(ref, conf):
    if ref in _cache:
        return _cache[ref]
    d = conf["imagenes"][ref]
    im = Image.open(RAIZ / d["archivo"]).convert("RGB")
    if "recorte" in d:
        im = im.crop(tuple(d["recorte"]))
    _cache[ref] = im
    return im


def cubrir(im, t, dur, semilla):
    """Ken Burns suave: zoom 1.00→1.08 y paneo leve. Si la imagen es muy ancha (tira), se pone al centro
    con un fondo desenfocado de sí misma."""
    ar = im.width / im.height
    if ar > 2.0:
        key = ("tira", id(im))
        if key not in _cache:
            fondo = im.resize((W, int(W / ar))).resize((W, H)).filter(ImageFilter.GaussianBlur(30))
            fondo = Image.blend(fondo, Image.new("RGB", (W, H), (10, 6, 16)), 0.45)
            alto = int(W / ar)
            frente = im.resize((W, alto), Image.LANCZOS)
            fondo.paste(frente, (0, (H - alto) // 2))
            _cache[key] = fondo
        im = _cache[key]
    p = min(max(t / max(dur, 0.1), 0), 1)
    z = 1.0 + 0.08 * p if semilla % 2 == 0 else 1.08 - 0.08 * p
    esc = max(W / im.width, H / im.height)
    cw, ch = W / (esc * z), H / (esc * z)
    dx = (im.width - cw) * (0.5 + 0.25 * math.sin(semilla * 1.7) * (p - 0.5))
    dy = (im.height - ch) * (0.45 + 0.1 * math.cos(semilla) * (p - 0.5))
    a = cw / W
    return im.transform((W, H), Image.AFFINE, (a, 0, dx, 0, a, dy), Image.BILINEAR)


def _caja_redondeada(w, h, r, color):
    m = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(m).rounded_rectangle((0, 0, w - 1, h - 1), r, fill=color)
    return m


_tarjetas = {}


def tarjeta(texto, sub=None):
    """Rótulo inferior izquierdo: concepto en grande + fuente en chico."""
    k = (texto, sub)
    if k not in _tarjetas:
        f1, f2 = fuente("Black", 40), fuente("SemiBold", 24)
        w1 = f1.getbbox(texto)[2]
        w2 = f2.getbbox(sub)[2] if sub else 0
        w, h = max(w1, w2) + 56, 78 + (36 if sub else 0)
        im = _caja_redondeada(w, h, 18, (14, 8, 22, 215))
        d = ImageDraw.Draw(im)
        d.rectangle((0, 14, 7, h - 14), fill=COBRE + (255,))
        d.text((28, 16), texto, font=f1, fill=(255, 255, 255))
        if sub:
            d.text((28, 70), sub, font=f2, fill=(235, 200, 185))
        _tarjetas[k] = im
    return _tarjetas[k]


def sticker(ref, conf):
    k = ("st", ref)
    if k not in _cache:
        im = imagen(ref, conf).copy()
        im.thumbnail((300, 300), Image.LANCZOS)
        borde = 6
        base = _caja_redondeada(im.width + 2 * borde, im.height + 2 * borde, 26, (255, 255, 255, 255))
        mask = _caja_redondeada(im.width, im.height, 22, (255, 255, 255, 255)).split()[3]
        base.paste(im, (borde, borde), mask)
        sombra = Image.new("RGBA", (base.width + 30, base.height + 30), (0, 0, 0, 0))
        sombra.paste(Image.new("RGBA", base.size, (0, 0, 0, 120)), (15, 18), base.split()[3])
        sombra = sombra.filter(ImageFilter.GaussianBlur(8))
        sombra.alpha_composite(base, (15, 15))
        _cache[k] = sombra
    return _cache[k]


_fs = None


def subtitulo(frame, texto):
    global _fs
    _fs = _fs or fuente("ExtraBold", 36)
    d = ImageDraw.Draw(frame)
    w = d.textbbox((0, 0), texto, font=_fs)[2]
    x, y = (W - w) // 2, H - 86
    d.text((x, y), texto, font=_fs, fill=(255, 255, 255), stroke_width=4, stroke_fill=(0, 0, 0))


# ---------------- render ----------------

def estado_en(cues, t):
    i = max([j for j, c in enumerate(cues) if c["t"] <= t] or [0])
    return i


def cuadro(t, conf, cues, subs, total):
    # imagen de fondo (la última cue con imagen) + fundido desde la anterior
    con_img = [c for c in cues if c.get("img")]
    idx = max([j for j, c in enumerate(con_img) if c["t"] <= t] or [0])
    c = con_img[idx]
    fin = con_img[idx + 1]["t"] if idx + 1 < len(con_img) else total + 2
    f = cubrir(imagen(c["img"], conf), t - c["t"], fin - c["t"] + FUNDIDO, idx)
    if idx > 0 and t - c["t"] < FUNDIDO:
        p = con_img[idx - 1]
        g = cubrir(imagen(p["img"], conf), t - p["t"], c["t"] - p["t"] + FUNDIDO, idx - 1)
        f = Image.blend(g, f, suave((t - c["t"]) / FUNDIDO))
    f = f.convert("RGBA")
    # viñeta abajo para que se lean los subtítulos
    global _vin
    try:
        _vin
    except NameError:
        g = np.linspace(0, 1, 220) ** 1.6
        a = np.zeros((H, W), np.uint8)
        a[H - 220:] = (g * 170)[:, None].astype(np.uint8)
        _vin = Image.fromarray(np.dstack([np.zeros((H, W, 3), np.uint8), a]), "RGBA")
    f.alpha_composite(_vin)
    # rótulos
    for c in cues:
        if c.get("tarjeta") and c["t"] <= t < c["t"] + c.get("dur", 6.0):
            dt = t - c["t"]
            a = suave(dt / 0.35) * suave((c["t"] + c.get("dur", 6.0) - t) / 0.35)
            im = tarjeta(c["tarjeta"], c.get("fuente"))
            x = int(-im.width + (40 + im.width) * suave(dt / 0.45))
            capa = im.copy()
            capa.putalpha(capa.split()[3].point(lambda v: int(v * a)))
            f.alpha_composite(capa, (x, 40))
        if c.get("sticker") and c["t"] <= t < c["t"] + c.get("dur_sticker", 2.8):
            dt = t - c["t"]
            st = sticker(c["sticker"], conf)
            fin_st = c["t"] + c.get("dur_sticker", 2.8)
            s = 1.0 + 0.15 * math.sin(min(dt / 0.3, 1) * math.pi) if dt < 0.3 else 1.0
            sub = suave(dt / 0.3) * suave((fin_st - t) / 0.3)
            im = st.resize((int(st.width * s), int(st.height * s)))
            x = W - im.width - 30
            y = int(H - 120 - im.height * sub)
            if sub > 0.02:
                f.alpha_composite(im, (x, max(y, 20)))
    # subtítulo
    for s in subs:
        if s["ini"] <= t < s["fin"]:
            subtitulo(f, s["texto"])
            break
    return f.convert("RGB")


def _render_parte(args):
    ruta_conf, n, t0, t1, destino = args
    conf, datos, cues, subs = cargar(ruta_conf)
    total = datos["duracion"]
    p = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24",
                          "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-preset", "veryfast",
                          "-crf", "21", "-pix_fmt", "yuv420p", str(destino)], stdin=subprocess.PIPE)
    for k in range(int(round((t1 - t0) * FPS))):
        p.stdin.write(cuadro(t0 + k / FPS, conf, cues, subs, total).tobytes())
    p.stdin.close()
    p.wait()
    return n


def cargar(ruta_conf):
    conf = yaml.safe_load(Path(ruta_conf).read_text(encoding="utf-8"))
    conf["_dir"] = str(Path(ruta_conf).parent)
    datos = json.loads((SALIDA / conf["id"] / "alineacion.json").read_text())
    cues = resolver_cues(conf, datos)
    subs = bloques_subs(datos["palabras"])
    return conf, datos, cues, subs


def video(ruta_conf, solo=None):
    conf, datos, cues, subs = cargar(ruta_conf)
    d = SALIDA / conf["id"]
    total = datos["duracion"] + 1.5
    n = math.ceil(total / PARTE_SEG)
    trabajos = []
    for i in range(n):
        t0, t1 = i * PARTE_SEG, min((i + 1) * PARTE_SEG, total)
        destino = d / f"parte{i + 1}.mp4"
        if solo is None and destino.exists() or (solo is not None and solo != i + 1):
            continue
        trabajos.append((ruta_conf, i + 1, t0, t1, destino))
    with ProcessPoolExecutor(max_workers=4) as ex:
        for k in ex.map(_render_parte, trabajos):
            print("parte", k, "lista", flush=True)
    # audio: voz + música (cada pista igualada antes de mezclar)
    import audio
    from render import normalizar
    musica = d / "musica.wav"
    audio.musica(total, musica)
    vn, mn = d / "voz_n.wav", d / "musica_n.wav"
    normalizar(d / "voz.wav", vn, -16)
    normalizar(musica, mn, -31)
    mezcla = d / "mezcla.wav"
    ffmpeg("-i", vn, "-i", mn, "-filter_complex", "[0][1]amix=inputs=2:duration=longest:normalize=0", mezcla)
    final_a = d / "audio_final.wav"
    normalizar(mezcla, final_a, -14)
    lista = d / "video.txt"
    lista.write_text("".join(f"file 'parte{i + 1}.mp4'\n" for i in range(n)))
    salida = d / f"{conf['id']}_subtitulado.mp4"
    ffmpeg("-f", "concat", "-safe", 0, "-i", lista, "-i", final_a, "-map", "0:v", "-map", "1:a",
           "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", salida)
    escribir_srt(subs, d / f"{conf['id']}.es-419.srt")
    # miniatura de prueba
    cuadro(conf.get("portada_t", 2.0), conf, cues, [], datos["duracion"]).save(d / "portada.jpg", quality=90)
    print(salida, round(duracion(salida), 1), "s")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("conf")
    ap.add_argument("paso", choices=["voz", "video", "cues"])
    ap.add_argument("--parte", type=int)
    a = ap.parse_args()
    if a.paso == "voz":
        conf = yaml.safe_load(Path(a.conf).read_text(encoding="utf-8"))
        conf["_dir"] = str(Path(a.conf).parent)
        d = SALIDA / conf["id"]
        d.mkdir(parents=True, exist_ok=True)
        preparar_voz(conf, d)
    elif a.paso == "cues":
        conf, datos, cues, subs = cargar(a.conf)
        for c in cues:
            print(f"{c['t']:7.1f}  {c.get('img', ''):14} {c.get('tarjeta', '') or ''} {c.get('sticker', '') or ''}")
    else:
        video(a.conf, a.parte)
