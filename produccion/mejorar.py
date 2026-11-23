"""Escalado x4 con Real-ESRGAN (CPU) para recortes de Yami y fondos."""
import numpy as np
import torch
from PIL import Image

from comun import MODELOS

_modelo = None


def _cargar():
    global _modelo
    if _modelo is None:
        from spandrel import ModelLoader
        _modelo = ModelLoader().load_from_file(str(MODELOS / "RealESRGAN_x4plus.pth")).model.eval()
    return _modelo


def escalar_x4(img: Image.Image, tile=256) -> Image.Image:
    """Escala x4 por mosaicos para no agotar la RAM."""
    m = _cargar()
    x = torch.from_numpy(np.asarray(img.convert("RGB"), dtype=np.float32) / 255.0).permute(2, 0, 1)[None]
    _, _, h, w = x.shape
    out = torch.zeros(1, 3, h * 4, w * 4)
    pad = 16
    with torch.inference_mode():
        for y0 in range(0, h, tile):
            for x0 in range(0, w, tile):
                ya, xa = max(y0 - pad, 0), max(x0 - pad, 0)
                yb, xb = min(y0 + tile + pad, h), min(x0 + tile + pad, w)
                r = m(x[:, :, ya:yb, xa:xb])
                ty, tx = (y0 - ya) * 4, (x0 - xa) * 4
                th, tw = (min(y0 + tile, h) - y0) * 4, (min(x0 + tile, w) - x0) * 4
                out[:, :, y0 * 4:y0 * 4 + th, x0 * 4:x0 * 4 + tw] = r[:, :, ty:ty + th, tx:tx + tw]
    arr = (out[0].clamp(0, 1).permute(1, 2, 0).numpy() * 255).round().astype(np.uint8)
    return Image.fromarray(arr)
