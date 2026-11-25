"""Saca el guion en .txt para generar la voz en off en CapCut (Texto → Texto a voz).

Uso:  python texto_capcut.py ../guiones/.../guion.yaml   → salida/<id>/<id>_voz_capcut.txt

- Usa la ortografía HABLADA (p. ej. "Kotonoja"), para que la voz de CapCut lo pronuncie bien.
- Una escena por párrafo (línea en blanco entre escenas): en CapCut puedes pegarlo todo junto o por partes.
- Cuando exportes la voz (audio o video con solo la voz), mándala y se arma el video con:
      python render.py <guion> --audio <archivo de CapCut>
"""
import sys
from pathlib import Path

import yaml

from comun import SALIDA
from voz import para_voz

if __name__ == "__main__":
    g = yaml.safe_load(Path(sys.argv[1]).read_text())
    out = SALIDA / g["id"]
    out.mkdir(parents=True, exist_ok=True)
    destino = out / f"{g['id']}_voz_capcut.txt"
    destino.write_text("\n\n".join(para_voz(e["texto"]) for e in g["escenas"]) + "\n", encoding="utf-8")
    print(destino)
