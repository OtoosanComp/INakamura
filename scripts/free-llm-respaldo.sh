#!/usr/bin/env bash
# Respaldo con modelos gratuitos (Free-LLM Router) para cuando Claude no esté disponible.
# Se instala UNA vez por computadora y sirve en cualquier proyecto.
#
#   ./scripts/free-llm-respaldo.sh instalar   # instala la versión revisada + configuración guiada
#   ./scripts/free-llm-respaldo.sh usar       # abre Claude Code con modelos gratuitos (solo esta sesión)
#   ./scripts/free-llm-respaldo.sh quitar     # desinstala y deshace cualquier cambio
#
# No usamos `free-llm setup claude`: ese comando cambia ~/.claude/settings.json y hace que
# TODAS las sesiones de Claude usen modelos gratuitos. `launch` solo afecta la sesión que abre.
set -euo pipefail

# Versión revisada el 2026-11-23. Cambiar solo después de revisar la nueva versión.
COMMIT="85864c4d0f29b74db442b296087862b96f4d84a1"

case "${1:-}" in
  instalar)
    command -v node >/dev/null || { echo "Falta Node.js 18.17 o superior"; exit 1; }
    npm install -g "github:nejib1/Free-LLM#${COMMIT}"
    free-llm   # configuración guiada: agrega claves de proveedores gratuitos
    ;;
  usar)
    shift
    free-llm launch claude -- "$@"
    ;;
  quitar)
    free-llm stop 2>/dev/null || true
    free-llm setup claude --remove 2>/dev/null || true
    npm uninstall -g free-llm
    echo "Desinstalado. Tus claves y configuración siguen en ~/.free-llm (bórralo si ya no lo quieres)."
    ;;
  *)
    sed -n 2,10p "$0"; exit 1
    ;;
esac
