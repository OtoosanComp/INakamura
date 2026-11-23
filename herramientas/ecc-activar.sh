#!/usr/bin/env bash
# Activa skills de ECC (vendorizado en herramientas/ecc) copiándolas a .claude/skills/.
#
#   herramientas/ecc-activar.sh               # activa la lista recomendada para Proyecto Meta
#   herramientas/ecc-activar.sh todas         # activa las 328 (≈27,000 tokens extra en CADA sesión)
#   herramientas/ecc-activar.sh seo manim-video   # activa skills sueltas
#   herramientas/ecc-activar.sh --listar      # muestra todas las disponibles
#   herramientas/ecc-activar.sh --quitar nombre   # desactiva una skill de ECC
#
# No activa hooks, agentes ni comandos de ECC (se revisaron: escriben en ~/.claude y corren en cada herramienta).
set -euo pipefail
cd "$(dirname "$0")/.."
ORIGEN=herramientas/ecc/skills
DESTINO=.claude/skills

RECOMENDADAS=(
  article-writing brand-voice content-engine crosspost video-editing
  deep-research research-ops market-research marketing-campaign short-video-distribution
  security-review git-workflow conventional-commit-review python-patterns verification-loop
)
# Nunca activar: piden claves de terceros, leen mensajes privados o hacen pagos.
BLOQUEADAS=" social-publisher fal-ai-media videodb exa-search x-api lead-intelligence messages-ops agent-payment-x402 roundhouse-x402 "

valida() { [[ "$1" =~ ^[a-z0-9][a-z0-9._-]*$ ]] || { echo "Nombre inválido: $1" >&2; exit 1; }; }

activar() {
  valida "$1"
  if [[ "$BLOQUEADAS" == *" $1 "* && "${FORZAR:-}" != "1" ]]; then echo "· $1 bloqueada (usa FORZAR=1 si de verdad la quieres)"; return; fi
  [ -f "$ORIGEN/$1/SKILL.md" ] || { echo "· $1 no existe en ECC" >&2; return; }
  rm -rf "${DESTINO:?}/$1" && mkdir -p "$DESTINO" && cp -r "$ORIGEN/$1" "$DESTINO/$1" && touch "$DESTINO/$1/.ecc"
  echo "✓ $1"
}

case "${1:-}" in
  --listar) ls "$ORIGEN" ;;
  --quitar) shift; for s in "$@"; do valida "$s"; [ -f "$DESTINO/$s/.ecc" ] && rm -rf "${DESTINO:?}/$s" && echo "✗ $s"; done ;;
  todas) for d in "$ORIGEN"/*/; do activar "$(basename "$d")"; done ;;
  "") for s in "${RECOMENDADAS[@]}"; do activar "$s"; done ;;
  *) for s in "$@"; do activar "$s"; done ;;
esac
