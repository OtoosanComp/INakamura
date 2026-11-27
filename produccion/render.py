"""Arma un Reel completo desde un guion YAML.

Uso:  python render.py ../guiones/semana-01-kotonoha/r1-no-nacio-yandere.yaml [--solo-voz]

Salida en salida/<id>/:
  <id>.mp4               video limpio (sin subtítulos) → para CapCut
  <id>_subtitulado.mp4   mismo video con subtítulos quemados → listo para subir
  <id>.es_LA.srt         subtítulos aparte (Facebook / CapCut Web o Escritorio)
  <id>_voz.wav           voz sola
  publicar.txt           descripción, hashtags, comentario fijado y checklist de Meta
  reporte.json           duración, tono medido, escenas
"""
import argparse
import json
import math
import subprocess
from pathlib import Path

import numpy as np
import yaml
from PIL import Image, ImageDraw, ImageFilter, ImageFont

import audio
import subtitulos
import voz
from comun import ALTO, ANCHO, CACHE, FPS, RAIZ, SALIDA, duracion, ffmpeg

FUENTES = RAIZ / "assets" / "fuentes"
COBRE = (232, 115, 74)
MAX_SEG = 60.0
COLA = 1.2       # segundos extra al final
FUNDIDO = 0.30   # transición entre escenas
# Zonas seguras de Reels (1080x1920): arriba ~0-180 y abajo ~1450-1920 los tapa la interfaz.
Y_TITULO, Y_TARJETA, Y_SUBS = 300, 950, 1290
Y_TARJETA_TRAS = 1120  # con imagen detrás: tarjeta más chica y más abajo, para que se vea la cara de atrás
ENTRADA_YAMI = 0.55  # segundos que tarda Yami en subir desde abajo


def fuente(peso, tam):
    return ImageFont.truetype(str(FUENTES / f"InterDisplay-{peso}.otf"), tam)


def suave(x):
    x = min(max(x, 0.0), 1.0)
    return x * x * (3 - 2 * x)


# ---------------------------------------------------------------- capas de texto

class Capa:
    """Imagen RGBA pre-renderizada que se pega con opacidad variable."""

    def __init__(self, img, x, y):
        a = np.asarray(img, dtype=np.float32)
        self.rgb, self.alfa = a[..., :3], a[..., 3:] / 255.0
        self.x, self.y = int(x), int(y)

    def pegar(self, frame, opacidad):
        if opacidad <= 0.01:
            return
        h, w = self.alfa.shape[:2]
        y0, x0 = max(self.y, 0), max(self.x, 0)
        y1, x1 = min(self.y + h, ALTO), min(self.x + w, ANCHO)
        sub = frame[y0:y1, x0:x1]
        a = self.alfa[y0 - self.y:y1 - self.y, x0 - self.x:x1 - self.x] * opacidad
        sub[:] = sub * (1 - a) + self.rgb[y0 - self.y:y1 - self.y, x0 - self.x:x1 - self.x] * a


def texto_grande(lineas, y_centro, tam=96, ancho_max=960):
    medir = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    while tam > 40 and max(medir.textlength(l, font=fuente("Black", tam)) for l in lineas) > ancho_max:
        tam -= 2  # se encoge hasta caber en pantalla
    f = fuente("Black", tam)
    alto_linea = int(tam * 1.12)
    img = Image.new("RGBA", (ANCHO, alto_linea * len(lineas) + 60), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for i, l in enumerate(lineas):
        w = d.textlength(l, font=f)
        color = (255, 255, 255) if i == 0 else COBRE
        d.text(((ANCHO - w) / 2, 30 + i * alto_linea), l, font=f, fill=color,
               stroke_width=8, stroke_fill=(0, 0, 0))
    sombra = img.filter(ImageFilter.GaussianBlur(14))
    base = Image.new("RGBA", img.size, (0, 0, 0, 0))
    base.alpha_composite(Image.eval(sombra, lambda v: v * 0.6))
    base.alpha_composite(img)
    return Capa(base, 0, y_centro - base.height / 2)


def etiqueta(texto, y=240):
    f = fuente("ExtraBold", 46)
    d = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    w = int(d.textlength(texto, font=f)) + 64
    img = Image.new("RGBA", (w, 86), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((0, 0, w - 1, 85), radius=43, fill=COBRE + (235,))
    d.text((32, 14), texto, font=f, fill=(255, 255, 255))
    return Capa(img, (ANCHO - w) / 2, y)


def tarjeta_portada(clave, x=40, y=770, ancho=250):
    """Portada oficial chica + título y año, para ubicar la obra. Se descarga a la caché (no va al repo)."""
    datos = yaml.safe_load((RAIZ / "assets" / "portadas.yaml").read_text())[clave]
    cache = CACHE / "portadas"
    cache.mkdir(parents=True, exist_ok=True)
    ruta = cache / f"{clave}.{datos['url'].rsplit('.', 1)[-1]}"
    if not ruta.exists():
        subprocess.run(["curl", "-sfL", "-o", str(ruta), datos["url"]], check=True)
    img = Image.open(ruta).convert("RGB")
    alto_img = int(ancho * img.height / img.width)
    img = img.resize((ancho, alto_img), Image.LANCZOS)
    f1, f2 = fuente("Black", 30), fuente("SemiBold", 26)
    lienzo = Image.new("RGBA", (ancho + 40, alto_img + 120), (0, 0, 0, 0))
    sombra = Image.new("RGBA", lienzo.size, (0, 0, 0, 0))
    ImageDraw.Draw(sombra).rounded_rectangle((20, 26, 20 + ancho, 26 + alto_img), 18, fill=(0, 0, 0, 190))
    lienzo.alpha_composite(sombra.filter(ImageFilter.GaussianBlur(12)))
    mascara = Image.new("L", img.size, 0)
    ImageDraw.Draw(mascara).rounded_rectangle((0, 0, ancho - 1, alto_img - 1), 18, fill=255)
    lienzo.paste(img, (20, 20), mascara)
    d = ImageDraw.Draw(lienzo)
    d.rounded_rectangle((20, 20, 19 + ancho, 19 + alto_img), 18, outline=COBRE + (220,), width=4)
    titulo = datos["titulo"]
    while d.textlength(titulo, font=f1) > ancho + 10 and f1.size > 18:
        f1 = fuente("Black", f1.size - 2)
    d.text((20, 32 + alto_img), titulo, font=f1, fill=(255, 255, 255), stroke_width=4, stroke_fill=(0, 0, 0))
    d.text((20, 32 + alto_img + f1.size + 6), f"ANIME · {datos['anio']}", font=f2, fill=COBRE, stroke_width=3,
           stroke_fill=(0, 0, 0))
    return Capa(lienzo, x, y)


def marca():
    f = fuente("SemiBold", 34)
    img = Image.new("RGBA", (700, 60), (0, 0, 0, 0))
    ImageDraw.Draw(img).text((0, 8), "@yami.nakamura · avatar IA", font=f, fill=(255, 255, 255, 170),
                             stroke_width=2, stroke_fill=(0, 0, 0, 120))
    return Capa(img, 56, 150)


# ---------------------------------------------------------------- escenas visuales

class Animador:
    """Decide, cuadro por cuadro, si Yami tiene la boca abierta, si parpadea y cuánta energía hay en la voz."""

    def __init__(self, ruta_voz, palabras, semilla=5):
        import soundfile as sf
        a, sr = sf.read(str(ruta_voz), dtype="float32")
        a = a.mean(axis=1) if a.ndim > 1 else a
        paso = sr // FPS
        n = len(a) // paso + 1
        rms = np.array([np.sqrt(np.mean(a[i * paso:(i + 1) * paso] ** 2) + 1e-12) if i * paso < len(a) else 0.0
                        for i in range(n)])  # el último pedazo puede venir vacío
        ref = np.percentile(rms[rms > 1e-4], 90) if (rms > 1e-4).any() else 1.0
        self.energia = np.clip(rms / ref, 0, 1.5)
        # dentro de una palabra y con energía → boca abierta (mínimo 2 cuadros por estado, sin parpadeos raros)
        en_palabra = np.zeros(n, bool)
        for w in palabras:
            en_palabra[int(w["ini"] * FPS):int(w["fin"] * FPS) + 1] = True
        crudo = en_palabra & (self.energia > 0.35)
        boca = crudo.copy()
        for i in range(1, n - 1):
            if crudo[i - 1] == crudo[i + 1] != crudo[i]:
                boca[i] = crudo[i - 1]
        self.boca = boca
        rng = np.random.default_rng(semilla)
        self.parpadeo = np.zeros(n + FPS * 10, bool)
        t = rng.uniform(1.0, 2.5)
        while t * FPS < n:
            i = int(t * FPS)
            self.parpadeo[i:i + 4] = True
            t += rng.uniform(2.5, 5.0)

    def estado(self, t):
        i = min(int(t * FPS), len(self.boca) - 1)
        return bool(self.boca[i]), bool(self.parpadeo[i]), float(self.energia[i])


class Escena:
    def __init__(self, visual, ini, fin, semilla, animador=None, tras=None):
        rng = np.random.default_rng(semilla)
        self.ini, self.fin, self.animador = ini, fin, animador
        self.y_tarjeta = Y_TARJETA
        tipo, nombre = visual.split("/", 1)
        self.tarjetas = None
        if tipo == "fondo":
            self.fondo = Image.open(RAIZ / "assets" / "fondos" / f"{nombre}.jpg").convert("RGB")
        else:
            anime = RAIZ / "personajes" / "yami" / "anime" / "listas"
            if tipo == "yami" and (anime / f"{nombre}.png").exists():
                variantes = {"base": anime / f"{nombre}.png"}
                for clave, sufijo in (("habla", "-habla"), ("parpadeo", "-parpadeo"), ("habla_parpadeo", "-habla-parpadeo")):
                    if (anime / f"{nombre}{sufijo}.png").exists():
                        variantes[clave] = anime / f"{nombre}{sufijo}.png"
                alto = 900
            elif tipo == "cosplay":  # cosplay/<nombre> → fotos de las gemelas en cosplay (personajes/gemelas/cosplay)
                variantes = {"base": RAIZ / "personajes" / "gemelas" / "cosplay" / f"{nombre}.png"}
                alto = 820
            else:  # yamireal/<recorte> → fotos realistas
                variantes = {"base": RAIZ / "personajes" / "yami" / "recortes" / f"{nombre}.png"}
                alto = 820
            caras = {k: Image.open(v).convert("RGB") for k, v in variantes.items()}
            if tras:  # imagen detrás de Yami (p. ej. la personaje de la que habla): Yami más chica y abajo
                self.fondo = Image.eval(Image.open(RAIZ / "assets" / "fondos" / f"{tras.split('/', 1)[-1]}.jpg")
                                        .convert("RGB"), lambda v: int(v * 0.85))
                alto, self.y_tarjeta = 640, Y_TARJETA_TRAS
            else:
                self.fondo = self._cubrir(caras["base"]).filter(ImageFilter.GaussianBlur(36))
                self.fondo = Image.eval(self.fondo, lambda v: int(v * 0.42))
            self.tarjetas = {k: self._tarjeta(c, cuadrada=(nombre == "ojo"), alto_max=alto) for k, c in caras.items()}
        self.z0, self.z1 = (1.0, 1.09) if rng.random() < 0.6 else (1.09, 1.0)
        self.dx, self.dy = rng.uniform(-0.5, 0.5), rng.uniform(-0.5, 0.5)

    @staticmethod
    def _cubrir(img, w=1215, h=2160):
        s = max(w / img.width, h / img.height)
        img = img.resize((math.ceil(img.width * s), math.ceil(img.height * s)), Image.LANCZOS)
        x, y = (img.width - w) // 2, (img.height - h) // 2
        return img.crop((x, y, x + w, y + h))

    @staticmethod
    def _tarjeta(cara, cuadrada, alto_max=820):
        ancho_max = 780
        if cuadrada:
            alto_max = 780
        s = min(ancho_max / cara.width, alto_max / cara.height)
        cara = cara.resize((int(cara.width * s), int(cara.height * s)), Image.LANCZOS)
        w, h = cara.size
        m = 40
        lienzo = Image.new("RGBA", (w + 2 * m, h + 2 * m), (0, 0, 0, 0))
        sombra = Image.new("RGBA", lienzo.size, (0, 0, 0, 0))
        ImageDraw.Draw(sombra).rounded_rectangle((m, m + 12, m + w, m + h + 12), 34, fill=(0, 0, 0, 200))
        lienzo.alpha_composite(sombra.filter(ImageFilter.GaussianBlur(18)))
        mascara = Image.new("L", (w, h), 0)
        ImageDraw.Draw(mascara).rounded_rectangle((0, 0, w - 1, h - 1), 34, fill=255)
        lienzo.paste(cara, (m, m), mascara)
        ImageDraw.Draw(lienzo).rounded_rectangle((m, m, m + w - 1, m + h - 1), 34, outline=COBRE + (200,), width=4)
        return lienzo

    def cuadro(self, t):
        dur = max(self.fin - self.ini, 0.1)
        p = suave((t - self.ini) / dur)
        z = self.z0 + (self.z1 - self.z0) * p
        W, H = self.fondo.size
        cw, ch = W / z, W / z * ALTO / ANCHO
        cx = W / 2 + self.dx * (W - cw) * (p - 0.5)
        cy = H / 2 + self.dy * (H - ch) * (p - 0.5)
        caja = (cx - cw / 2, cy - ch / 2, cx + cw / 2, cy + ch / 2)
        img = self.fondo.resize((ANCHO, ALTO), Image.BILINEAR, box=caja)
        if self.tarjetas is not None:
            # Yami entra desde abajo con un pequeño rebote (ease-out-back) al empezar a hablar.
            e = (t - self.ini) / ENTRADA_YAMI
            if self.ini == 0:
                e = 1.0  # si abre el video, ya está en su lugar desde el primer cuadro
            if e > 0:
                e = min(e, 1.0)
                rebote = 1 + 2.70158 * (e - 1) ** 3 + 1.70158 * (e - 1) ** 2
                dy = (1 - rebote) * 1150
                habla, parpadea, energia = self.animador.estado(t) if self.animador else (False, False, 0.0)
                clave = {(True, True): "habla_parpadeo", (True, False): "habla",
                         (False, True): "parpadeo", (False, False): "base"}[(habla, parpadea)]
                tarjeta = self.tarjetas.get(clave) or self.tarjetas.get("habla" if habla else "base") or self.tarjetas["base"]
                # al hablar se mueve un poquito (respira y rebota con la voz)
                s = 0.97 + 0.05 * p + 0.012 * energia
                dy += -6 * energia + 3 * math.sin(t * 2.1)
                tj = tarjeta.resize((int(tarjeta.width * s), int(tarjeta.height * s)), Image.BILINEAR)
                img = img.convert("RGBA")
                img.alpha_composite(tj, ((ANCHO - tj.width) // 2, int(self.y_tarjeta - tj.height / 2 + dy)))
                img = img.convert("RGB")
        return np.asarray(img, dtype=np.float32)


# ---------------------------------------------------------------- acabado (color, viñeta, grano, polvo)

class Acabado:
    def __init__(self, semilla=3):
        rng = np.random.default_rng(semilla)
        yy, xx = np.mgrid[0:ALTO, 0:ANCHO].astype(np.float32)
        r = np.sqrt(((xx - ANCHO / 2) / (ANCHO * 0.75)) ** 2 + ((yy - ALTO / 2) / (ALTO * 0.70)) ** 2)
        self.vin = (1 - 0.55 * np.clip(r, 0, 1) ** 2.2)[..., None]
        self.tinte = np.array([10, 0, 18], np.float32)
        self.grano = [rng.normal(0, 4, (ALTO, ANCHO, 1)).astype(np.float32) for _ in range(6)]
        self.polvo = rng.uniform(0, 1, (70, 4))  # x, y, velocidad, tamaño

    def aplicar(self, f, n, t):
        f *= self.vin
        f += self.tinte * (1 - f / 255.0)
        f += self.grano[n % 6]
        for x, y, v, s in self.polvo:
            px = int((x * ANCHO + 20 * math.sin(t * 0.6 + y * 9)) % ANCHO)
            py = int((y * ALTO - t * (20 + 50 * v)) % ALTO)
            r = 1 + int(s * 2.5)
            f[py:py + r, px:px + r] += 70 + 80 * s
        return np.clip(f, 0, 255).astype(np.uint8)


# ---------------------------------------------------------------- audio final

def normalizar(entrada, salida, objetivo=-14.0, pico=-1.5):
    """Loudnorm en dos pasadas (medir y luego aplicar lineal) → -14 LUFS, estándar de Reels."""
    r = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(entrada), "-af",
                        f"loudnorm=I={objetivo}:TP={pico}:LRA=11:print_format=json", "-f", "null", "-"],
                       capture_output=True, text=True, check=True).stderr
    m = json.loads(r[r.rindex("{"):r.rindex("}") + 1])
    ffmpeg("-i", entrada, "-af",
           f"loudnorm=I={objetivo}:TP={pico}:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:"
           f"measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true",
           "-ar", 48000, salida)


# Niveles de mezcla (LUFS). La voz manda: música y efectos siempre por debajo.
NIVEL_VOZ, NIVEL_MUSICA, NIVEL_EFECTOS = -16.0, -31.0, -27.0


def mezclar(out, ruta_voz, total, inicios, entradas_yami, destino):
    """Iguala cada pista a su nivel ANTES de mezclar (la voz de ElevenLabs llega mucho más baja que la de Kokoro)."""
    audio.musica(total, out / "musica.wav")
    audio.efectos(total, inicios, out / "efectos.wav", entradas_yami=entradas_yami)
    pistas = {}
    for nombre, ruta, nivel in (("voz", ruta_voz, NIVEL_VOZ), ("musica", out / "musica.wav", NIVEL_MUSICA),
                                ("efectos", out / "efectos.wav", NIVEL_EFECTOS)):
        pistas[nombre] = out / f"_{nombre}_nivel.wav"
        normalizar(ruta, pistas[nombre], objetivo=nivel, pico=-3.0)
    cruda = out / "mezcla_cruda.wav"
    ffmpeg("-i", pistas["voz"], "-i", pistas["musica"], "-i", pistas["efectos"], "-filter_complex",
           "[0:a]apad,asplit=2[v][sc];"
           "[1:a][sc]sidechaincompress=threshold=0.02:ratio=6:attack=20:release=400[md];"
           "[v][md][2:a]amix=inputs=3:normalize=0:duration=longest,"
           f"atrim=0:{total:.3f}", "-ar", 48000, "-ac", 2, cruda)
    normalizar(cruda, destino)
    for f in list(pistas.values()) + [cruda, out / "musica.wav", out / "efectos.wav"]:
        f.unlink(missing_ok=True)


def remezclar(ruta_guion):
    """Rehace solo el audio de un Reel ya renderizado (misma voz y tiempos) y lo cambia en sus MP4."""
    g = yaml.safe_load(Path(ruta_guion).read_text())
    out = SALIDA / g["id"]
    rep = json.loads((out / "reporte.json").read_text())
    total = rep["duracion_s"]
    inicios = [e["ini"] for e in rep["escenas"]]
    entradas = [e["ini"] for e in rep["escenas"] if e["visual"].startswith("yami/") and e["ini"] > 0]
    mezcla = out / "mezcla.wav"
    mezclar(out, out / f"{g['id']}_voz.wav", total, inicios, entradas, mezcla)
    for video in (out / f"{g['id']}.mp4", out / f"{g['id']}_subtitulado.mp4"):
        tmp = video.with_suffix(".tmp.mp4")
        ffmpeg("-i", video, "-i", mezcla, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
               "-shortest", "-movflags", "+faststart", tmp)
        tmp.replace(video)
    mezcla.unlink()
    print(f"✓ audio rehecho: {out}")


# ---------------------------------------------------------------- principal

def render(ruta_guion, solo_voz=False, audio_externo=None):
    g = yaml.safe_load(Path(ruta_guion).read_text())
    out = SALIDA / g["id"]
    out.mkdir(parents=True, exist_ok=True)
    textos = [e["texto"] for e in g["escenas"]]

    print("· voz")
    ruta_voz = out / f"{g['id']}_voz.wav"
    if audio_externo:  # voz ya generada (p. ej. ElevenLabs): se alinea con el guion, sin cambiar el tono
        tramos, palabras, tono = voz.desde_audio(audio_externo, textos, ruta_voz)
    else:
        tramos, tono = voz.sintetizar(textos, "yami", ruta_voz)
        palabras = None
    total = tramos[-1][1] + COLA
    print(f"  {tramos[-1][1]:.1f} s de voz · tono {tono}")
    if solo_voz:
        return

    print("· subtítulos")
    if palabras is None:
        palabras = voz.tiempos_palabras(ruta_voz, textos, tramos)
    bs = subtitulos.bloques(palabras)
    subtitulos.escribir_srt(bs, out / f"{g['id']}.es_LA.srt")
    subtitulos.escribir_ass(bs, out / "subtitulos.ass", g.get("resaltar", []), y=Y_SUBS)

    print("· audio")
    inicios = [0.0] + [t0 for t0, _ in tramos[1:]]
    entradas_yami = [a for e, a in zip(g["escenas"], inicios) if e["visual"].startswith("yami/") and a > 0]
    mezcla = out / "mezcla.wav"
    mezclar(out, ruta_voz, total, inicios, entradas_yami, mezcla)

    print("· video")
    finales = inicios[1:] + [total]
    animador = Animador(ruta_voz, palabras)
    escenas = [Escena(e["visual"], a, b, i + 11, animador, e.get("tras"))
               for i, (e, a, b) in enumerate(zip(g["escenas"], inicios, finales))]
    gancho = texto_grande(g["gancho_pantalla"].split("\n"), Y_TITULO)
    cierre = texto_grande(g["cierre_pantalla"].split("\n"), Y_TITULO, tam=86)
    etiquetas = [etiqueta(e["etiqueta"]) if e.get("etiqueta") else None for e in g["escenas"]]
    portadas = [tarjeta_portada(e["portada"]) if e.get("portada") else None for e in g["escenas"]]
    sello, acabado = marca(), Acabado()
    limpio = out / f"{g['id']}.mp4"
    enc = subprocess.Popen(
        ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{ANCHO}x{ALTO}",
         "-r", str(FPS), "-i", "-", "-i", str(mezcla), "-map", "0:v", "-map", "1:a",
         "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-maxrate", "10M", "-bufsize", "20M",
         "-pix_fmt", "yuv420p", "-profile:v", "high",
         "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", str(limpio)],
        stdin=subprocess.PIPE)
    n_cuadros = int(total * FPS)
    for n in range(n_cuadros):
        t = n / FPS
        i = max(k for k, e in enumerate(escenas) if e.ini <= t + 1e-6)
        f = escenas[i].cuadro(t)
        if i + 1 < len(escenas) and t > escenas[i + 1].ini - FUNDIDO:
            a = suave((t - (escenas[i + 1].ini - FUNDIDO)) / FUNDIDO)
            f = f * (1 - a) + escenas[i + 1].cuadro(t) * a
        e = escenas[i]
        if etiquetas[i]:
            etiquetas[i].pegar(f, suave((t - e.ini) / 0.25) * suave((e.fin - t) / 0.25))
        if portadas[i]:  # entra deslizándose desde la izquierda
            entra = suave((t - e.ini) / 0.35)
            x0 = portadas[i].x
            portadas[i].x = int(x0 - (1 - entra) * 320)
            portadas[i].pegar(f, entra * suave((e.fin - t) / 0.25))
            portadas[i].x = x0
        gancho.pegar(f, 1.0 if t < 2.4 else suave((2.9 - t) / 0.5))
        if i == len(escenas) - 1:
            cierre.pegar(f, suave((t - e.ini) / 0.4))
        sello.pegar(f, 1.0)
        cuadro = acabado.aplicar(f, n, t)
        if n == int(0.6 * FPS):  # portada para subir como 'cover' del Reel
            Image.fromarray(cuadro).save(out / "portada.jpg", quality=92)
        enc.stdin.write(cuadro.tobytes())
        if n % (FPS * 10) == 0:
            print(f"  {t:4.0f} s / {total:.0f} s", flush=True)
    enc.stdin.close()
    enc.wait()

    print("· versión con subtítulos")
    ffmpeg("-i", limpio, "-vf", f"subtitles={out / 'subtitulos.ass'}:fontsdir={FUENTES}",
           "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-maxrate", "10M", "-bufsize", "20M",
           "-pix_fmt", "yuv420p", "-c:a", "copy", "-movflags", "+faststart", out / f"{g['id']}_subtitulado.mp4")

    dur = duracion(limpio)
    (out / "publicar.txt").write_text(
        f"{g['titulo']}\nPublicar: {g['publicar']}\n\n--- DESCRIPCIÓN (copiar) ---\n{g['descripcion'].strip()}\n\n"
        f"{' '.join(g['hashtags'])}\n\n--- COMENTARIO FIJADO ---\n{g['comentario_fijado']}\n\n"
        "--- CHECKLIST ANTES DE PUBLICAR ---\n"
        "[ ] Etiqueta de IA activada (\"Información de IA\" / Perfil generado por IA)\n"
        "[ ] Descripción con 'Contenido educativo y de divulgación, sin material gráfico'\n"
        "[ ] Máximo 3 hashtags, sin enlaces\n"
        "[ ] Subtítulos: usar el _subtitulado.mp4, o el .srt en CapCut Web/Escritorio\n"
        f"[ ] Duración {dur:.1f} s (≤ 60 s)\n\n--- FUENTES ---\n" + "\n".join(g.get("fuentes", [])) + "\n",
        encoding="utf-8")
    reporte = {"id": g["id"], "duracion_s": round(dur, 2), "voz_s": round(tramos[-1][1], 2), "tono": tono,
               "escenas": [{"visual": e["visual"], "ini": round(a, 2), "fin": round(b, 2)}
                           for e, a, b in zip(g["escenas"], inicios, finales)],
               "bloques_subtitulos": len(bs)}
    (out / "reporte.json").write_text(json.dumps(reporte, ensure_ascii=False, indent=2))
    for tmp in ("musica.wav", "efectos.wav", "mezcla.wav"):
        (out / tmp).unlink(missing_ok=True)
    aviso = "" if dur <= MAX_SEG else f"  ⚠ dura {dur:.1f} s: recorta el guion"
    print(f"✓ {limpio} ({dur:.1f} s){aviso}")
    return reporte


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("guion")
    ap.add_argument("--solo-voz", action="store_true")
    ap.add_argument("--audio", help="voz ya generada (ElevenLabs, CapCut…): mp3/wav del guion completo")
    ap.add_argument("--remezclar", action="store_true", help="solo rehacer el audio de un Reel ya renderizado")
    a = ap.parse_args()
    if a.remezclar:
        remezclar(a.guion)
    else:
        render(a.guion, a.solo_voz, a.audio)
