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


def _buscar(normas, frase, desde):
    obj = _n(frase)
    for i in range(desde, len(normas) - len(obj) + 1):
        if normas[i:i + len(obj)] == obj:
            return i, i + len(obj) - 1
    raise SystemExit(f"No encontré la frase: {frase!r}")


def resolver_cues(conf, datos):
    """Cada cue ocurre en `seccion: N` o cuando se dice la frase `en:`. Con `hasta: "frase"` dura hasta que
    termina esa frase (Yami que habla). El orden del YAML tiene que ser cronológico."""
    pal = datos["palabras"]
    normas = [(_n(p["palabra"]) or [""])[0] for p in pal]
    secs = datos["secciones"]
    cues, desde = [], 0
    for c in conf["cues"]:
        if "seccion" in c:
            t = secs[c["seccion"]]["ini"] - (0.15 if c["seccion"] else 0)
            desde = next(i for i, p in enumerate(pal) if p["ini"] >= secs[c["seccion"]]["ini"] - 0.05)
            i0 = desde
        else:
            i0, _ = _buscar(normas, c["en"], desde)
            t, desde = pal[i0]["ini"] - 0.1, i0 + 1
        c = {**c, "t": max(t, 0.0)}
        if "hasta" in c:
            _, i1 = _buscar(normas, c["hasta"], i0)
            c["t_fin"] = pal[i1]["fin"] + 0.35
        cues.append(c)
    rellenar(conf, datos, cues)
    cues.sort(key=lambda c: c["t"])
    # un rótulo suelto que cae encima de una tarjeta de capítulo espera a que ésta termine
    caps = [(c["t"], c["t"] + c.get("dur", 3.2)) for c in cues if c.get("capitulo")]
    for c in cues:
        if c.get("tarjeta") and not (c.get("capitulo") or c.get("img") or c.get("yami")):
            for a, b in caps:
                if a <= c["t"] < b:
                    c["t"] = b + 0.1
    return cues


def _fin_cue(c):
    fines = [c["t"] + 0.5]
    for clave, dur in (("yami", None), ("irl", None), ("cosplay", "dur_cosplay"), ("sticker", "dur_sticker"),
                       ("capitulo", "dur"), ("foto", "dur_foto")):
        if c.get(clave):
            fines.append(c.get("t_fin", c["t"] + 4.0) if dur is None else c["t"] + c.get(dur, 6.0 if clave != "capitulo" else 3.2))
    return max(fines)


def rellenar(conf, datos, cues):
    """Si pasan más de `umbral` s sin nada nuevo en pantalla, mete algo: Yami IRL hablando (PNGtuber), Yami 2D
    hablando o una foto de cosplay. En las secciones de `serias` solo Yami 2D (sin fotos ni chistes)."""
    r = conf.get("relleno")
    if not r:
        return
    import random
    rnd = random.Random(7)
    secs = datos["secciones"]
    total = datos["duracion"]
    pal = datos["palabras"]
    eventos = sorted(cues, key=lambda c: c["t"])
    tiempos = [c["t"] for c in eventos] + [total]
    ocupado = 0.0
    tipos = r.get("orden", ["irl", "yami", "cosplay"])
    n = 0
    nuevos = []
    for i, c in enumerate(eventos):
        ocupado = max(ocupado, _fin_cue(c))
        a, b = c["t"], tiempos[i + 1]
        t0 = max(a + r.get("espera", 2.5), ocupado + 0.6)
        while b - t0 > 3.5:
            sec = max([j for j, x in enumerate(secs) if x["ini"] <= t0] or [0])
            serio = sec in r.get("serias", [])
            tipo = "yami" if serio else tipos[n % len(tipos)]
            dur = min(r.get("dur", 6.0), b - t0 - 0.4)
            # termina en el final de una palabra para que no corte a la mitad
            fin = max([p["fin"] for p in pal if t0 + 2.0 <= p["fin"] <= t0 + dur] or [t0 + dur]) + 0.3
            nc = {"t": t0, "auto": True}
            lado = "der" if n % 3 != 2 else "izq"
            if tipo == "irl":
                nc.update(irl=rnd.sample(r["irl"], 3), t_fin=fin, lado=lado, cambio=max((fin - t0) / 3, 1.2))
            elif tipo == "yami":
                nc.update(yami=rnd.choice(r.get("yami", ["seria"])) if not serio else "seria", t_fin=fin, lado=lado)
            else:
                nc.update(cosplay=r["cosplay"][n // len(tipos) % len(r["cosplay"])], dur_cosplay=fin - t0,
                          lado_cosplay=lado, inclina=rnd.choice([-5, -3, 3, 5]))
            nuevos.append(nc)
            n += 1
            ocupado = fin
            t0 = fin + r.get("cada", 4.0)
    cues.extend(nuevos)


# ---------------- subtítulos dinámicos (al centro del espacio libre, palabra activa en naranja neón) ----------------

NEON = (255, 122, 47)


def bloques_dinamicos(palabras, max_pal=3, max_chars=20):
    out, act = [], []
    corte = re.compile(r"[.?!…:;,]$")
    for i, p in enumerate(palabras):
        act.append(p)
        texto = " ".join(x["palabra"] for x in act)
        sig = palabras[i + 1] if i + 1 < len(palabras) else None
        if (sig is None or corte.search(p["palabra"]) or len(act) >= max_pal
                or len(texto) + 1 + len(sig["palabra"]) > max_chars or sig["ini"] - p["fin"] > 0.5):
            out.append({"pal": [dict(x) for x in act], "ini": act[0]["ini"], "fin": act[-1]["fin"]})
            act = []
    for a, b in zip(out, out[1:]):
        if b["ini"] - a["fin"] < 0.35:
            a["fin"] = b["ini"]
        else:
            a["fin"] += 0.25
    return out


def _limpia(w):
    return re.sub(r"(\.\.\.|…|,|\.|:|;)$", "", w)


_fd = {}


def render_bloque(b, activa, tam):
    k = (id(b), activa, tam)
    if k in _cache:
        return _cache[k]
    fz = _fd.setdefault(tam, fuente("Black", tam))
    palabras = [_limpia(p["palabra"]).upper() for p in b["pal"]]
    esp = int(tam * 0.28)
    anchos = [fz.getbbox(w)[2] for w in palabras]
    w = sum(anchos) + esp * (len(palabras) - 1) + 40
    h = int(tam * 1.5)
    capa = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    brillo = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d, db = ImageDraw.Draw(capa), ImageDraw.Draw(brillo)
    x = 20
    for i, (pw, aw) in enumerate(zip(palabras, anchos)):
        if i == activa:
            db.text((x, 8), pw, font=fz, fill=NEON + (255,))
        d.text((x, 8), pw, font=fz, fill=NEON if i == activa else (255, 255, 255), stroke_width=max(4, tam // 12),
               stroke_fill=(0, 0, 0))
        x += aw + esp
    out = brillo.filter(ImageFilter.GaussianBlur(tam // 5))
    out.alpha_composite(capa)
    _cache[k] = out
    return out


def subtitulo_dinamico(f, bloques, t, izq_ocupado, der_ocupado):
    for b in bloques:
        if b["ini"] <= t < b["fin"]:
            break
    else:
        return
    activa = max([i for i, p in enumerate(b["pal"]) if p["ini"] - 0.05 <= t] or [0])
    if izq_ocupado and der_ocupado:
        cx, cy, tam = W // 2, H - 95, 44
    elif der_ocupado:
        cx, cy, tam = int(W * 0.36), int(H * 0.56), 58
    elif izq_ocupado:
        cx, cy, tam = int(W * 0.64), int(H * 0.56), 58
    else:
        cx, cy, tam = W // 2, int(H * 0.62), 62
    im = render_bloque(b, activa, tam)
    dt = t - b["ini"]
    if dt < 0.12:  # aparece con un pequeño "pop"
        s = 0.85 + 0.15 * suave(dt / 0.12)
        im = im.resize((max(1, int(im.width * s)), max(1, int(im.height * s))))
    f.alpha_composite(im, (cx - im.width // 2, cy - im.height // 2))


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

CACHE_IMG = Path.home() / ".cache" / "proyecto-meta" / "imagenes"
ROCKSTAR = "https://www.rockstargames.com/VI/_next/static/media/"
_cache = {}


def _ruta(d):
    """`archivo` = ruta en el repo. `rockstar`/`url` = imagen de terceros: se descarga a la caché (NO se sube al repo)."""
    if "archivo" in d:
        return RAIZ / d["archivo"]
    url = ROCKSTAR + d["rockstar"] if "rockstar" in d else d["url"]
    destino = CACHE_IMG / (d.get("nombre") or url.rsplit("/", 1)[-1].split("?")[0])
    if not destino.exists():
        destino.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(["curl", "-fsSL", "-m", "90", "-A", "Mozilla/5.0", "-o", str(destino), url], check=True)
    return destino


def imagen(ref, conf):
    if ref not in _cache:
        d = conf["imagenes"][ref]
        im = Image.open(_ruta(d)).convert("RGB")
        if "recorte" in d:
            im = im.crop(tuple(d["recorte"]))
        if max(im.size) > 2400:  # las de Rockstar vienen en 4K: con 2x de 720p sobra
            im.thumbnail((2400, 2400), Image.LANCZOS)
        _cache[ref] = im
    return _cache[ref]


def lienzo(ref, conf):
    """Imagen lista para el Ken Burns. Tiras muy anchas o retratos verticales: al centro, con fondo desenfocado."""
    k = ("lienzo", ref)
    if k not in _cache:
        im = imagen(ref, conf)
        ar = im.width / im.height
        d = conf["imagenes"][ref]
        if ar < 1 and d.get("llenar", str(d.get("archivo", "")).startswith("assets/fondos/") and "retrato" not in str(d.get("archivo", ""))):
            # fondo vertical de Reel (escenario sin personaje): se recorta a 16:9 y llena la pantalla
            h = int(im.width * 9 / 16)
            y0 = int((im.height - h) * d.get("y", 0.45))
            _cache[k] = im.crop((0, y0, im.width, y0 + h))
            return _cache[k]
        if 1.3 <= ar <= 2.0 or (ar > 2.0 and ar < 2.7 and im.height >= 700):  # panorámicas en HD: llenan
            _cache[k] = im
        else:
            GW, GH = int(W * 1.25), int(H * 1.25)
            s = max(GW / im.width, GH / im.height)
            fondo = im.resize((int(im.width * s) + 1, int(im.height * s) + 1)).crop((0, 0, GW, GH))
            fondo = fondo.filter(ImageFilter.GaussianBlur(28))
            fondo = Image.blend(fondo, Image.new("RGB", (GW, GH), (10, 6, 16)), 0.5)
            s = min(GW * 0.96 / im.width, GH * 0.94 / im.height)
            frente = im.resize((int(im.width * s), int(im.height * s)), Image.LANCZOS)
            fondo.paste(frente, ((GW - frente.width) // 2, (GH - frente.height) // 2))
            _cache[k] = fondo
    return _cache[k]


def cubrir(im, t, dur, semilla):
    """Ken Burns: zoom 1.00↔1.10 y paneo leve, alternando dirección."""
    p = suave(t / max(dur, 0.1)) * 0.6 + min(max(t / max(dur, 0.1), 0), 1) * 0.4
    z = 1.0 + 0.10 * p if semilla % 2 == 0 else 1.10 - 0.10 * p
    esc = max(W / im.width, H / im.height)
    cw, ch = W / (esc * z), H / (esc * z)
    dx = (im.width - cw) * (0.5 + 0.35 * math.sin(semilla * 1.7) * (p - 0.5))
    dy = (im.height - ch) * (0.45 + 0.15 * math.cos(semilla) * (p - 0.5))
    a = cw / W
    return im.transform((W, H), Image.AFFINE, (a, 0, dx, 0, a, dy), Image.BILINEAR)


def _redondeada(w, h, r, color):
    m = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(m).rounded_rectangle((0, 0, w - 1, h - 1), r, fill=color)
    return m


def tarjeta_imagen(im, alto=None, ancho=None, borde=COBRE, r=24, grosor=4):
    """Foto en tarjeta redondeada con borde y sombra (RGBA)."""
    s = (alto / im.height) if alto else (ancho / im.width)
    im = im.resize((max(1, int(im.width * s)), max(1, int(im.height * s))), Image.LANCZOS)
    m = 24
    out = Image.new("RGBA", (im.width + 2 * m, im.height + 2 * m), (0, 0, 0, 0))
    sombra = Image.new("RGBA", out.size, (0, 0, 0, 0))
    ImageDraw.Draw(sombra).rounded_rectangle((m, m + 8, m + im.width, m + im.height + 8), r, fill=(0, 0, 0, 170))
    out.alpha_composite(sombra.filter(ImageFilter.GaussianBlur(12)))
    mascara = _redondeada(im.width, im.height, r, (255, 255, 255, 255)).split()[3]
    out.paste(im, (m, m), mascara)
    ImageDraw.Draw(out).rounded_rectangle((m, m, m + im.width - 1, m + im.height - 1), r, outline=borde + (230,),
                                          width=grosor)
    return out


_tarjetas = {}


def tarjeta(texto, sub=None):
    """Rótulo superior izquierdo: concepto en grande + fuente en chico."""
    k = (texto, sub)
    if k not in _tarjetas:
        f1, f2 = fuente("Black", 40), fuente("SemiBold", 24)
        w1 = f1.getbbox(texto)[2]
        w2 = f2.getbbox(sub)[2] if sub else 0
        w, h = max(w1, w2) + 56, 78 + (36 if sub else 0)
        im = _redondeada(w, h, 18, (14, 8, 22, 215))
        d = ImageDraw.Draw(im)
        d.rectangle((0, 14, 7, h - 14), fill=COBRE + (255,))
        d.text((28, 16), texto, font=f1, fill=(255, 255, 255))
        if sub:
            d.text((28, 70), sub, font=f2, fill=(235, 200, 185))
        _tarjetas[k] = im
    return _tarjetas[k]


def con_alfa(im, a):
    if a >= 0.999:
        return im
    c = im.copy()
    c.putalpha(c.split()[3].point(lambda v: int(v * a)))
    return c


# ---------------- Yami ----------------

LISTAS = RAIZ / "personajes" / "yami" / "anime" / "listas"
ALTO_YAMI = 470
_animador = None


def yami_cara(expr, boca, parpadeo):
    """Tarjeta de Yami anime. `seria` habla (boca) y parpadea; las demás expresiones son fijas."""
    nombre = expr
    if expr == "seria":
        nombre = "seria" + ("-habla" if boca else "") + ("-parpadeo" if parpadeo else "")
    k = ("yami", nombre)
    if k not in _cache:
        _cache[k] = tarjeta_imagen(Image.open(LISTAS / f"{nombre}.png").convert("RGB"), alto=ALTO_YAMI)
    return _cache[k]


def animador(d, palabras):
    global _animador
    if _animador is None:
        from render import Animador
        _animador = Animador(d / "voz.wav", palabras)
    return _animador


def entrada(t, ini, fin, dur_in=0.45, dur_out=0.35):
    """0→1 al entrar, 1→0 al salir (con suavizado)."""
    return suave((t - ini) / dur_in) * suave((fin - t) / dur_out)


# ---------------- capítulos, rótulos, créditos ----------------

def capitulo(f, c, t, conf):
    dur = c.get("dur", 3.2)
    dt = t - c["t"]
    a = entrada(t, c["t"], c["t"] + dur, 0.4, 0.5)
    # banda oscura a la izquierda
    k = ("banda",)
    if k not in _cache:
        g = np.clip(1.25 - np.linspace(0, 1.6, W), 0, 1) ** 1.3
        alfa = (np.tile(g, (H, 1)) * 215).astype(np.uint8)
        _cache[k] = Image.fromarray(np.dstack([np.full((H, W, 3), (12, 6, 20), np.uint8), alfa]), "RGBA")
    f.alpha_composite(con_alfa(_cache[k], a))
    x = int(70 - 60 * (1 - suave(dt / 0.5)))
    if a > 0.05:
        capa = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        dc = ImageDraw.Draw(capa)
        dc.text((x, 230), c.get("numero", ""), font=fuente("SemiBold", 30), fill=COBRE + (255,))
        y = 272
        for linea in c["capitulo"].split("\n"):
            dc.text((x, y), linea, font=fuente("Black", 72), fill=(255, 255, 255, 255))
            y += 82
        if c.get("sub"):
            dc.text((x + 2, y + 12), c["sub"], font=fuente("SemiBold", 28), fill=(235, 200, 185, 255))
        dc.rectangle((x, 220, x + int(140 * suave(dt / 0.7)), 224), fill=COBRE + (255,))
        f.alpha_composite(con_alfa(capa, a))
    if c.get("retrato"):
        k = ("retrato", c["retrato"])
        if k not in _cache:
            _cache[k] = tarjeta_imagen(imagen(c["retrato"], conf), alto=560)
        im = _cache[k]
        xr = int(W - im.width - 40 + (im.width + 60) * (1 - suave(dt / 0.55)) + (im.width + 60) * (1 - suave(
            (c["t"] + dur - t) / 0.45)))
        f.alpha_composite(im, (xr, (H - im.height) // 2 - 20))


def cosplay(f, c, t, conf):
    """Foto grande tipo polaroid, un poco inclinada, que entra deslizándose por un lado."""
    dur = c.get("dur_cosplay", 6.0)
    a = entrada(t, c["t"], c["t"] + dur, 0.5, 0.4)
    k = ("cos", c["cosplay"], c.get("inclina", -4))
    if k not in _cache:
        im = tarjeta_imagen(imagen(c["cosplay"], conf), alto=c.get("alto_cosplay", 560), borde=(255, 255, 255),
                            grosor=10, r=10)
        _cache[k] = im.rotate(c.get("inclina", -4), expand=True, resample=Image.BICUBIC)
    im = _cache[k]
    izq = c.get("lado_cosplay", "izq") == "izq"
    x_final = 40 if izq else W - im.width - 40
    x_fuera = -im.width - 20 if izq else W + 20
    dt = t - c["t"]
    rebote = 1.0 + (0.06 * math.sin(min(dt / 0.35, 1) * math.pi) if c.get("rebote") else 0)
    if rebote > 1.001:
        im = im.resize((int(im.width * rebote), int(im.height * rebote)))
    f.alpha_composite(im, (int(x_fuera + (x_final - x_fuera) * a), (H - im.height) // 2 - 30))


def portada(f, c, t, conf):
    """Portada oficial chica (referencia), abajo a la izquierda, con título y año."""
    dur = c.get("dur_portada", 5.0)
    a = entrada(t, c["t"], c["t"] + dur, 0.4, 0.4)
    k = ("port", c["portada"])
    if k not in _cache:
        d = conf["imagenes"][c["portada"]]
        im = tarjeta_imagen(imagen(c["portada"], conf), ancho=d.get("ancho", 170), borde=COBRE, grosor=4, r=12)
        out = Image.new("RGBA", (max(im.width, 260), im.height + 40), (0, 0, 0, 0))
        out.alpha_composite(im)
        ImageDraw.Draw(out).text((24, im.height - 14), d.get("titulo", ""), font=fuente("ExtraBold", 22),
                                 fill=(255, 255, 255), stroke_width=3, stroke_fill=(0, 0, 0))
        _cache[k] = out
    im = _cache[k]
    f.alpha_composite(con_alfa(im, a), (int(20 - 40 * (1 - a)), H - im.height - 100))


def yami_irl(f, c, t, conf, energia):
    """Yami realista "hablando" estilo PNGtuber: rebota con la voz y cambia de expresión cada ~2.4 s."""
    fin = c.get("t_fin", c["t"] + 4.0)
    caras = c["irl"] if isinstance(c["irl"], list) else [c["irl"]]
    i = min(int((t - c["t"]) / c.get("cambio", 2.4)), len(caras) - 1)
    k = ("irl", caras[i])
    if k not in _cache:
        _cache[k] = tarjeta_imagen(imagen(caras[i], conf), alto=ALTO_YAMI + 20, borde=(255, 255, 255), grosor=6)
    im = _cache[k]
    a = entrada(t, c["t"], fin)
    s = 1.0 + 0.035 * min(energia, 1.2)
    im = im.resize((int(im.width * s), int(im.height * s)))
    izq = c.get("lado", "der") == "izq"
    x_final = 30 if izq else W - im.width - 30
    x_fuera = -im.width - 10 if izq else W + 10
    y = int(H - im.height - 60 - 14 * min(energia, 1.2))
    f.alpha_composite(im, (int(x_fuera + (x_final - x_fuera) * a), y))


def foto_persona(f, c, t, conf):
    """Foto real de un investigador con su nombre y crédito."""
    dur = c.get("dur_foto", 7.0)
    a = entrada(t, c["t"], c["t"] + dur)
    k = ("foto", c["foto"])
    if k not in _cache:
        im = tarjeta_imagen(imagen(c["foto"], conf), alto=330, borde=(255, 255, 255), grosor=6)
        dd = conf["imagenes"][c["foto"]]
        w = im.width
        out = Image.new("RGBA", (w, im.height + 76), (0, 0, 0, 0))
        out.alpha_composite(im)
        d = ImageDraw.Draw(out)
        d.text((26, im.height - 6), dd.get("persona", ""), font=fuente("ExtraBold", 28), fill=(255, 255, 255),
               stroke_width=3, stroke_fill=(0, 0, 0))
        d.text((26, im.height + 30), dd.get("credito", ""), font=fuente("SemiBold", 16), fill=(220, 220, 220),
               stroke_width=2, stroke_fill=(0, 0, 0))
        _cache[k] = out
    im = _cache[k]
    x = int(W - im.width - 40 + (im.width + 60) * (1 - a))
    f.alpha_composite(im, (x, 70))


def credito(f, texto):
    k = ("cred", texto)
    if k not in _cache:
        fz = fuente("SemiBold", 17)
        w = fz.getbbox(texto)[2] + 20
        im = _redondeada(w, 28, 10, (0, 0, 0, 120))
        ImageDraw.Draw(im).text((10, 4), texto, font=fz, fill=(235, 235, 235))
        _cache[k] = im
    im = _cache[k]
    f.alpha_composite(im, (W - im.width - 14, 12))


_fs = None


def subtitulo(f, texto):
    global _fs
    _fs = _fs or fuente("ExtraBold", 36)
    d = ImageDraw.Draw(f)
    w = d.textbbox((0, 0), texto, font=_fs)[2]
    d.text(((W - w) // 2, H - 88), texto, font=_fs, fill=(255, 255, 255), stroke_width=4, stroke_fill=(0, 0, 0))


def vineta():
    k = ("vineta",)
    if k not in _cache:
        g = np.linspace(0, 1, 230) ** 1.6
        a = np.zeros((H, W), np.uint8)
        a[H - 230:] = (g * 175)[:, None].astype(np.uint8)
        _cache[k] = Image.fromarray(np.dstack([np.zeros((H, W, 3), np.uint8), a]), "RGBA")
    return _cache[k]


def barra_progreso(f, t, total, marcas):
    d = ImageDraw.Draw(f)
    d.rectangle((0, H - 5, W, H), fill=(255, 255, 255, 40))
    d.rectangle((0, H - 5, int(W * t / total), H), fill=COBRE + (255,))
    for m in marcas:
        x = int(W * m / total)
        d.rectangle((x - 1, H - 9, x + 1, H), fill=(255, 255, 255, 200))


# ---------------- cuadro ----------------

def cuadro(t, conf, cues, subs, total, d_out=None, palabras=None):
    con_img = [c for c in cues if c.get("img")]
    idx = max([j for j, c in enumerate(con_img) if c["t"] <= t] or [0])
    c = con_img[idx]
    fin = con_img[idx + 1]["t"] if idx + 1 < len(con_img) else total + 2
    f = cubrir(lienzo(c["img"], conf), t - c["t"], fin - c["t"] + FUNDIDO, idx)
    if idx > 0 and t - c["t"] < FUNDIDO:
        p = con_img[idx - 1]
        g = cubrir(lienzo(p["img"], conf), t - p["t"], c["t"] - p["t"] + FUNDIDO, idx - 1)
        f = Image.blend(g, f, suave((t - c["t"]) / FUNDIDO))
    f = f.convert("RGBA")
    cred = conf["imagenes"][c["img"]].get("credito")
    f.alpha_composite(vineta())
    hay_capitulo = False
    izq = der = False
    for c in cues:
        if c.get("capitulo") and c["t"] <= t < c["t"] + c.get("dur", 3.2):
            capitulo(f, c, t, conf)
            hay_capitulo = True
    for c in cues:
        if c.get("tarjeta") and c["t"] <= t < c["t"] + c.get("dur", 6.0) and not c.get("capitulo"):
            dt = t - c["t"]
            a = entrada(t, c["t"], c["t"] + c.get("dur", 6.0), 0.35, 0.35)
            im = tarjeta(c["tarjeta"], c.get("fuente"))
            x = int(-im.width + (40 + im.width) * suave(dt / 0.45))
            f.alpha_composite(con_alfa(im, a), (x, 40))
        if c.get("foto") and c["t"] <= t < c["t"] + c.get("dur_foto", 7.0):
            foto_persona(f, c, t, conf)
        if c.get("yami") and c["t"] <= t < c.get("t_fin", c["t"] + 4.0):
            izq, der = (True, der) if c.get("lado", "der") == "izq" else (izq, True)
            fin_y = c.get("t_fin", c["t"] + 4.0)
            boca, parp, energia = animador(d_out, palabras).estado(t)
            im = yami_cara(c["yami"], boca, parp)
            a = entrada(t, c["t"], fin_y)
            izq = c.get("lado", "der") == "izq"
            x_final = 30 if izq else W - im.width - 30
            x_fuera = -im.width - 10 if izq else W + 10
            x = int(x_fuera + (x_final - x_fuera) * a)
            y = int(H - im.height - 70 - 6 * energia * (c["yami"] != "seria"))
            f.alpha_composite(im, (x, y))
        if c.get("cosplay") and c["t"] <= t < c["t"] + c.get("dur_cosplay", 6.0):
            izq, der = (True, der) if c.get("lado_cosplay", "izq") == "izq" else (izq, True)
            cosplay(f, c, t, conf)
        if c.get("portada") and c["t"] <= t < c["t"] + c.get("dur_portada", 5.0):
            portada(f, c, t, conf)
        if c.get("irl") and c["t"] <= t < c.get("t_fin", c["t"] + 4.0):
            izq, der = (True, der) if c.get("lado", "der") == "izq" else (izq, True)
            yami_irl(f, c, t, conf, animador(d_out, palabras).estado(t)[2])
        if c.get("sticker") and c["t"] <= t < c["t"] + c.get("dur_sticker", 2.8):
            dt = t - c["t"]
            k = ("st", c["sticker"], c.get("tam", 250))
            if k not in _cache:
                _cache[k] = tarjeta_imagen(imagen(c["sticker"], conf), ancho=c.get("tam", 250),
                                           borde=(255, 255, 255), grosor=7, r=26)
            st = _cache[k]
            fin_st = c["t"] + c.get("dur_sticker", 2.8)
            s = 1.0 + 0.12 * math.sin(min(dt / 0.3, 1) * math.pi)
            sub = suave(dt / 0.3) * suave((fin_st - t) / 0.3)
            if sub > 0.02:
                izq, der = (True, der) if c.get("lado", "der") == "izq" else (izq, True)
                im = st.resize((int(st.width * s), int(st.height * s))) if s > 1.001 else st
                izq = c.get("lado", "der") == "izq"
                x = 30 if izq else W - im.width - 30
                y = int(H - 110 - im.height * sub)
                f.alpha_composite(im.rotate(-4 if not izq else 4, expand=True, resample=Image.BICUBIC),
                                  (x, max(y, 10)))
    if cred and not hay_capitulo:
        credito(f, cred)
    if not hay_capitulo:
        if conf.get("subs_dinamicos"):
            subtitulo_dinamico(f, subs, t, izq, der)
        else:
            for s in subs:
                if s["ini"] <= t < s["fin"]:
                    subtitulo(f, s["texto"])
                    break
    barra_progreso(f, t, total, [c["t"] for c in cues if c.get("capitulo")])
    return f.convert("RGB")


# ---------------- render ----------------

def cargar(ruta_conf):
    conf = yaml.safe_load(Path(ruta_conf).read_text(encoding="utf-8"))
    conf["_dir"] = str(Path(ruta_conf).parent)
    datos = json.loads((SALIDA / conf["id"] / "alineacion.json").read_text())
    cues = resolver_cues(conf, datos)
    subs = bloques_dinamicos(datos["palabras"]) if conf.get("subs_dinamicos") else bloques_subs(datos["palabras"])
    return conf, datos, cues, subs


def _render_parte(args):
    ruta_conf, n, t0, t1, destino = args
    conf, datos, cues, subs = cargar(ruta_conf)
    d = SALIDA / conf["id"]
    total = datos["duracion"] + 1.5
    p = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24",
                          "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-preset", "veryfast",
                          "-crf", "21", "-pix_fmt", "yuv420p", str(destino)], stdin=subprocess.PIPE)
    for k in range(int(round((t1 - t0) * FPS))):
        p.stdin.write(cuadro(t0 + k / FPS, conf, cues, subs, total, d, datos["palabras"]).tobytes())
    p.stdin.close()
    p.wait()
    return n


def musica_en_bucle(origen, total, destino, cruce=2.5):
    import soundfile as sf
    a, sr = sf.read(str(origen), dtype="float32", always_2d=True)
    n, c = int(total * sr), int(cruce * sr)
    out = a.copy()
    while len(out) < n:
        rampa = np.linspace(0, 1, c)[:, None]
        mezcla = out[-c:] * (1 - rampa) + a[:c] * rampa
        out = np.concatenate([out[:-c], mezcla, a[c:]])
    out = out[:n]
    fade = np.minimum(1, np.minimum(np.arange(n) / (1.5 * sr), (n - np.arange(n)) / (3.0 * sr)))[:, None]
    sf.write(str(destino), out * fade, sr)


def mezclar_audio(conf, d, cues, total):
    import audio
    from render import normalizar
    vn = d / "voz_n.wav"
    normalizar(d / "voz.wav", vn, -16)
    mus = d / "musica.wav"
    if conf.get("musica"):
        musica_en_bucle(RAIZ / conf["musica"], total, mus)
    else:
        audio.musica(total, mus)
    mn = d / "musica_n.wav"
    normalizar(mus, mn, conf.get("musica_lufs", -29))
    fx = d / "efectos.wav"
    capitulos = [0.0] + [c["t"] for c in cues if c.get("capitulo")]
    entradas = [c["t"] for c in cues if c.get("sticker") or c.get("yami") or c.get("irl") or c.get("rebote")]
    audio.efectos(total, capitulos, fx, entradas_yami=entradas)
    fxn = d / "efectos_n.wav"
    normalizar(fx, fxn, -30)
    mezcla = d / "mezcla.wav"
    # la música baja ~6 dB cuando habla Yami (ducking) y vuelve en las pausas
    ffmpeg("-i", vn, "-i", mn, "-i", fxn, "-filter_complex",
           "[0]asplit=2[v][sc];[1]aformat=channel_layouts=stereo[m];[sc]aformat=channel_layouts=stereo[sc2];"
           "[m][sc2]sidechaincompress=threshold=0.02:ratio=3:attack=80:release=700:makeup=1[md];"
           "[v][md][2]amix=inputs=3:duration=longest:normalize=0", mezcla)
    final_a = d / "audio_final.wav"
    normalizar(mezcla, final_a, -14)
    return final_a


def video(ruta_conf, solo=None, sin_partes=False):
    conf, datos, cues, subs = cargar(ruta_conf)
    d = SALIDA / conf["id"]
    total = datos["duracion"] + 1.5
    n = math.ceil(total / PARTE_SEG)
    trabajos = []
    for i in range(n):
        t0, t1 = i * PARTE_SEG, min((i + 1) * PARTE_SEG, total)
        destino = d / f"parte{i + 1}.mp4"
        if (solo is None and destino.exists()) or (solo is not None and solo != i + 1):
            continue
        trabajos.append((ruta_conf, i + 1, t0, t1, destino))
    if not sin_partes:
        with ProcessPoolExecutor(max_workers=4) as ex:
            for k in ex.map(_render_parte, trabajos):
                print("parte", k, "lista", flush=True)
    final_a = mezclar_audio(conf, d, cues, total)
    lista = d / "video.txt"
    lista.write_text("".join(f"file 'parte{i + 1}.mp4'\n" for i in range(n)))
    salida = d / f"{conf['id']}_subtitulado.mp4"
    ffmpeg("-f", "concat", "-safe", 0, "-i", lista, "-i", final_a, "-map", "0:v", "-map", "1:a",
           "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", salida)
    escribir_srt(bloques_subs(datos["palabras"]), d / f"{conf['id']}.es-419.srt")
    cuadro(conf.get("portada_t", 2.0), conf, cues, [], total, d, datos["palabras"]).save(d / "portada.jpg", quality=90)
    caps = [(c["t"], c["capitulo"].replace("\n", " ")) for c in cues if c.get("capitulo")]
    print("capítulos:", [(f"{int(t // 60)}:{int(t % 60):02d}", n) for t, n in caps])
    print(salida, round(duracion(salida), 1), "s")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("conf")
    ap.add_argument("paso", choices=["voz", "video", "cues", "audio", "muestra"])
    ap.add_argument("--parte", type=int)
    ap.add_argument("--t", type=float, nargs="*", help="segundos para `muestra` (cuadros sueltos)")
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
            que = " ".join(f"{k}={c[k]}" for k in ("img", "capitulo", "tarjeta", "yami", "irl", "cosplay", "portada", "sticker", "foto") if c.get(k))
            print(f"{c['t']:7.1f}  {c.get('t_fin', 0) or '':>6} {que}")
    elif a.paso == "muestra":
        conf, datos, cues, subs = cargar(a.conf)
        d = SALIDA / conf["id"]
        for t in a.t:
            cuadro(t, conf, cues, subs, datos["duracion"] + 1.5, d, datos["palabras"]).save(d / f"muestra_{t:.1f}.jpg")
    elif a.paso == "audio":
        video(a.conf, sin_partes=True)
    else:
        video(a.conf, a.parte)
