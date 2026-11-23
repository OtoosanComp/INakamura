"""Arma las caras de Yami anime (boca abierta / ojos cerrados) y las escala x4.

Uso:  python expresiones.py      → personajes/yami/anime/listas/*.png
"""
import numpy as np
import yaml
from PIL import Image, ImageDraw, ImageFilter

from comun import RAIZ
from mejorar import escalar_x4

BASE = RAIZ / "personajes" / "yami" / "anime"
ANIME = "RealESRGAN_x4plus_anime_6B.pth"


def pegar(base, otra, mascara):
    return Image.composite(otra, base, mascara)


def mascara_elipse(tam, centro, radios, difuminado=4):
    m = Image.new("L", tam, 0)
    (cx, cy), (rx, ry) = centro, radios
    ImageDraw.Draw(m).ellipse((cx - rx, cy - ry, cx + rx, cy + ry), fill=255)
    return m.filter(ImageFilter.GaussianBlur(difuminado))


def mascara_caja(tam, caja, difuminado=5):
    m = Image.new("L", tam, 0)
    ImageDraw.Draw(m).rounded_rectangle(caja, radius=18, fill=255)
    return m.filter(ImageFilter.GaussianBlur(difuminado))


def main():
    conf = yaml.safe_load((BASE / "expresiones.yaml").read_text())
    salida = BASE / "listas"
    salida.mkdir(exist_ok=True)
    base = Image.open(BASE / conf["base_habla"]).convert("RGB")
    boca = Image.open(BASE / conf["boca"]["de"]).convert("RGB")
    ojos = Image.open(BASE / conf["ojos"]["de"]).convert("RGB")
    mb = mascara_elipse(base.size, conf["boca"]["centro"], conf["boca"]["radios"])
    mo = mascara_caja(base.size, conf["ojos"]["caja"])
    caras = {
        "seria": base,
        "seria-habla": pegar(base, boca, mb),
        "seria-parpadeo": pegar(base, ojos, mo),
        "seria-habla-parpadeo": pegar(pegar(base, boca, mb), ojos, mo),
    }
    for nombre, ruta in conf["expresiones"].items():
        caras[nombre] = Image.open(BASE / ruta).convert("RGB")
    for nombre, img in caras.items():
        escalar_x4(img, modelo=ANIME).save(salida / f"{nombre}.png", optimize=True)
        print(nombre, "listo", flush=True)


if __name__ == "__main__":
    main()
