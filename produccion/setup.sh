#!/usr/bin/env bash
# Prepara el contenedor para producir videos de Yami. Idempotente: se puede correr varias veces.
# Uso: bash produccion/setup.sh
set -euo pipefail
CACHE="${PROYECTO_META_CACHE:-$HOME/.cache/proyecto-meta}"
M="$CACHE/modelos"
AQUI="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$M"

command -v ffmpeg >/dev/null || { echo "Falta ffmpeg (apt-get install -y ffmpeg)"; exit 1; }

if [ ! -x "$CACHE/venv/bin/python" ]; then python3 -m venv "$CACHE/venv"; fi
PIP="$CACHE/venv/bin/pip"
"$PIP" install -q torch==2.15.0 torchvision==0.29.2 --index-url https://download.pytorch.org/whl/cpu
"$PIP" install -q -r "$AQUI/requirements.txt"

descarga() {  # url destino sha256
  if [ -f "$2" ] && echo "$3  $2" | sha256sum -c --quiet 2>/dev/null; then return; fi
  echo "Descargando $(basename "$2")…"
  curl -fsSL -o "$2.tmp" "$1"
  echo "$3  $2.tmp" | sha256sum -c --quiet || { echo "sha256 no coincide: $2"; rm -f "$2.tmp"; exit 1; }
  mv "$2.tmp" "$2"
}
descarga https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx \
  "$M/kokoro-v1.0.onnx" 7d5df8ecf7d4b1878015a32686053fd0eebe2bc377234608764cc0ef3636a6c5
descarga https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin \
  "$M/voices-v1.0.bin" bca610b8308e8d99f32e6fe4197e7ec01679264efed0cac9140fe9c29f1fbf7d
descarga https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth \
  "$M/RealESRGAN_x4plus.pth" 4fa0d38905f75ac06eb49a7951b426670021be3018265fd191d2125df9d682f1

# Whisper (subtítulos) y el modelo anime se descargan de Hugging Face la primera vez que se usan.
"$CACHE/venv/bin/python" - <<EOF
from faster_whisper import WhisperModel
WhisperModel("small", device="cpu", compute_type="int8", download_root="$M/whisper")
print("Whisper listo")
EOF
echo "✓ Listo. Python: $CACHE/venv/bin/python"
