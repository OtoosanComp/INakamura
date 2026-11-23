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
from comun import ALTO, ANCHO, FPS, RAIZ, SALIDA, duracion, ffmpeg

FUENTES = RAIZ / "assets" / "fuentes"
COBRE = (232, 115, 74)
MAX_SEG = 60.0
COLA = 1.2       # segundos extra al final
FUNDIDO = 0.30   # transición entre escenas
# Zonas seguras de Reels (1080x1920): arriba ~0-180 y abajo ~1450-1920 los tapa la interfaz.
Y_TITULO, Y_TARJETA, Y_SUBS = 320, 910, 1280
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


def marca():
    f = fuente("SemiBold", 34)
    img = Image.new("RGBA", (700, 60), (0, 0, 0, 0))
    ImageDraw.Draw(img).text((0, 8), "@yami.nakamura · avatar IA", font=f, fill=(255, 255, 255, 170),
                             stroke_width=2, stroke_fill=(0, 0, 0, 120))
    return Capa(img, 56, 150)


# ---------------------------------------------------------------- escenas visuales

class Escena:
    def __init__(self, visual, ini, fin, semilla):
        rng = np.random.default_rng(semilla)
        self.ini, self.fin = ini, fin
        tipo, nombre = visual.split("/", 1)
        if tipo == "fondo":
            self.fondo = Image.open(RAIZ / "assets" / "fondos" / f"{nombre}.jpg").convert("RGB")
            self.tarjeta = None
        else:
            cara = Image.open(RAIZ / "personajes" / "yami" / "recortes" / f"{nombre}.png").convert("RGB")
            self.fondo = self._cubrir(cara).filter(ImageFilter.GaussianBlur(36))
            self.fondo = Image.eval(self.fondo, lambda v: int(v * 0.42))
            self.tarjeta = self._tarjeta(cara, cuadrada=(nombre == "ojo"))
        self.z0, self.z1 = (1.0, 1.09) if rng.random() < 0.6 else (1.09, 1.0)
        self.dx, self.dy = rng.uniform(-0.5, 0.5), rng.uniform(-0.5, 0.5)

    @staticmethod
    def _cubrir(img, w=1215, h=2160):
        s = max(w / img.width, h / img.height)
        img = img.resize((math.ceil(img.width * s), math.ceil(img.height * s)), Image.LANCZOS)
        x, y = (img.width - w) // 2, (img.height - h) // 2
        return img.crop((x, y, x + w, y + h))

    @staticmethod
    def _tarjeta(cara, cuadrada):
        ancho_max, alto_max = (780, 780) if cuadrada else (780, 820)
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
        if self.tarjeta is not None:
            # Yami entra desde abajo con un pequeño rebote (ease-out-back) al empezar a hablar.
            e = (t - self.ini) / ENTRADA_YAMI
            if self.ini == 0:
                e = 1.0  # si abre el video, ya está en su lugar desde el primer cuadro
            if e > 0:
                e = min(e, 1.0)
                rebote = 1 + 2.70158 * (e - 1) ** 3 + 1.70158 * (e - 1) ** 2
                dy = (1 - rebote) * 1150
                s = 0.97 + 0.05 * p
                tj = self.tarjeta.resize((int(self.tarjeta.width * s), int(self.tarjeta.height * s)), Image.BILINEAR)
                img = img.convert("RGBA")
                img.alpha_composite(tj, ((ANCHO - tj.width) // 2, int(Y_TARJETA - tj.height / 2 + dy)))
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


# ---------------------------------------------------------------- principal

def render(ruta_guion, solo_voz=False):
    g = yaml.safe_load(Path(ruta_guion).read_text())
    out = SALIDA / g["id"]
    out.mkdir(parents=True, exist_ok=True)
    textos = [e["texto"] for e in g["escenas"]]

    print("· voz")
    ruta_voz = out / f"{g['id']}_voz.wav"
    tramos, tono = voz.sintetizar(textos, "yami", ruta_voz)
    total = tramos[-1][1] + COLA
    print(f"  {tramos[-1][1]:.1f} s de voz · tono {tono}")
    if solo_voz:
        return

    print("· subtítulos")
    palabras = voz.tiempos_palabras(ruta_voz, textos, tramos)
    bs = subtitulos.bloques(palabras)
    subtitulos.escribir_srt(bs, out / f"{g['id']}.es_LA.srt")
    subtitulos.escribir_ass(bs, out / "subtitulos.ass", g.get("resaltar", []), y=Y_SUBS)

    print("· audio")
    inicios = [0.0] + [t0 for t0, _ in tramos[1:]]
    audio.musica(total, out / "musica.wav")
    entradas_yami = [a for e, a in zip(g["escenas"], inicios) if e["visual"].startswith("yami/") and a > 0]
    audio.efectos(total, inicios, out / "efectos.wav", entradas_yami=entradas_yami)
    mezcla_cruda, mezcla = out / "mezcla_cruda.wav", out / "mezcla.wav"
    ffmpeg("-i", ruta_voz, "-i", out / "musica.wav", "-i", out / "efectos.wav", "-filter_complex",
           "[0:a]apad,asplit=2[v][sc];[1:a]volume=0.55[m];"
           "[m][sc]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=350[md];"
           "[v][md][2:a]amix=inputs=3:normalize=0:duration=longest,"
           f"atrim=0:{total:.3f}", "-ar", 48000, "-ac", 2, mezcla_cruda)
    normalizar(mezcla_cruda, mezcla)
    mezcla_cruda.unlink()

    print("· video")
    finales = inicios[1:] + [total]
    escenas = [Escena(e["visual"], a, b, i + 11) for i, (e, a, b) in enumerate(zip(g["escenas"], inicios, finales))]
    gancho = texto_grande(g["gancho_pantalla"].split("\n"), Y_TITULO)
    cierre = texto_grande(g["cierre_pantalla"].split("\n"), Y_TITULO, tam=86)
    etiquetas = [etiqueta(e["etiqueta"]) if e.get("etiqueta") else None for e in g["escenas"]]
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
    a = ap.parse_args()
    render(a.guion, a.solo_voz)
