"""Rutas y utilidades compartidas del pipeline de Proyecto Meta."""
from pathlib import Path
import os
import subprocess

RAIZ = Path(__file__).resolve().parent.parent
CACHE = Path(os.environ.get("PROYECTO_META_CACHE", Path.home() / ".cache" / "proyecto-meta"))
MODELOS = CACHE / "modelos"
SALIDA = RAIZ / "salida"

ANCHO, ALTO, FPS = 1080, 1920, 30


def ffmpeg(*args):
    subprocess.run(["ffmpeg", "-v", "error", "-y", *map(str, args)], check=True)


def duracion(ruta):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(ruta)],
        capture_output=True, text=True, check=True,
    ).stdout
    return float(out.strip())
