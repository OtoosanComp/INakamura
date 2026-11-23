"""Genera los fondos anime de una semana (Stable Diffusion local, CPU).

Uso:  python fondos.py ../guiones/semana-01-kotonoha [--solo id1,id2] [--rehacer]
Lee <semana>/fondos.yaml y guarda assets/fondos/<id>.jpg (1215x2160, con margen
para el movimiento de cámara). Los que ya existen se saltan salvo --rehacer.
"""
import argparse
import time
from pathlib import Path

import torch
import yaml
from PIL import Image

from comun import MODELOS, RAIZ
from mejorar import escalar_x4

MODELO = "Meina/MeinaMix_V11"          # CreativeML OpenRAIL-M (uso comercial permitido)
LCM = "latent-consistency/lcm-lora-sdv1-5"  # OpenRAIL++
SALIDA = RAIZ / "assets" / "fondos"


def pipeline():
    from diffusers import LCMScheduler, StableDiffusionPipeline
    torch.set_num_threads(max(1, torch.get_num_threads()))
    cache = str(MODELOS / "hf")
    pipe = StableDiffusionPipeline.from_pretrained(
        MODELO, torch_dtype=torch.float32, safety_checker=None,
        requires_safety_checker=False, cache_dir=cache)
    pipe.scheduler = LCMScheduler.from_config(pipe.scheduler.config)
    pipe.load_lora_weights(LCM, cache_dir=cache)
    pipe.fuse_lora()
    return pipe


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("semana")
    ap.add_argument("--solo", default="")
    ap.add_argument("--rehacer", action="store_true")
    a = ap.parse_args()
    conf = yaml.safe_load((Path(a.semana) / "fondos.yaml").read_text())
    estilo, negativo = conf["estilo"], conf["negativo"]
    solo = set(filter(None, a.solo.split(",")))
    SALIDA.mkdir(parents=True, exist_ok=True)
    pendientes = [f for f in conf["fondos"]
                  if (not solo or f["id"] in solo) and (a.rehacer or not (SALIDA / f"{f['id']}.jpg").exists())]
    if not pendientes:
        print("Nada que generar.")
        return
    pipe = pipeline()
    for f in pendientes:
        t = time.time()
        img = pipe(f"{f['prompt']}, {estilo}", negative_prompt=negativo,
                   num_inference_steps=f.get("pasos", 6), guidance_scale=1.5,
                   width=512, height=896,
                   generator=torch.Generator().manual_seed(f.get("semilla", 7))).images[0]
        grande = escalar_x4(img).resize((1215, 2160), Image.LANCZOS)
        grande.save(SALIDA / f"{f['id']}.jpg", quality=90)
        print(f"{f['id']}: {time.time() - t:.0f} s", flush=True)


if __name__ == "__main__":
    main()
