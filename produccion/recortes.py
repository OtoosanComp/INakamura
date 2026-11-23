"""Recorta y escala x4 los rostros de un personaje según personajes/<p>/recortes.yaml."""
import argparse

import yaml
from PIL import Image

from comun import RAIZ
from mejorar import escalar_x4

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--personaje", default="yami")
    a = ap.parse_args()
    base = RAIZ / "personajes" / a.personaje
    destino = base / "recortes"
    destino.mkdir(exist_ok=True)
    for nombre, r in yaml.safe_load((base / "recortes.yaml").read_text()).items():
        x, y, w, h = r["caja"]
        img = Image.open(base / r["fuente"]).convert("RGB").crop((x, y, x + w, y + h))
        escalar_x4(img).save(destino / f"{nombre}.png", optimize=True)
        print(nombre, "listo")
