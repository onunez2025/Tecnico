#!/bin/bash
# install-hooks.sh — Instala los git hooks de seguridad SIATC
# Ejecutar una vez después de clonar o cuando se actualice check-security.sh:
#   bash install-hooks.sh

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"

if [ -z "$REPO_ROOT" ]; then
    echo "❌ Error: no se encontró un repositorio git en este directorio."
    exit 1
fi

HOOK_SRC="$REPO_ROOT/check-security.sh"
HOOK_DST="$REPO_ROOT/.git/hooks/pre-push"

if [ ! -f "$HOOK_SRC" ]; then
    echo "❌ Error: no se encontró check-security.sh en la raíz del repo."
    exit 1
fi

cp "$HOOK_SRC" "$HOOK_DST"
chmod +x "$HOOK_DST"

echo "✅ Hook pre-push instalado correctamente."
echo "   Cada 'git push' ejecutará automáticamente check-security.sh."
echo ""
echo "Para verificar manualmente: ./check-security.sh"
