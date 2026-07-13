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

# El hook es un wrapper que delega siempre al check-security.sh trackeado del repo,
# no una copia física — así nunca queda desactualizado cuando se corrige una regla
# (bug real encontrado y corregido en EBM el 2026-07-11: una copia física vieja del
# script bloqueaba pushes con un hallazgo ya corregido en el archivo trackeado).
cat > "$HOOK_DST" << 'HOOK_EOF'
#!/bin/bash
exec "$(git rev-parse --show-toplevel)/check-security.sh" "$@"
HOOK_EOF
chmod +x "$HOOK_DST"

echo "✅ Hook pre-push instalado correctamente (wrapper -> check-security.sh)."
echo "   Cada 'git push' ejecutará automáticamente la versión actual de check-security.sh."
echo ""
echo "Para verificar manualmente: ./check-security.sh"
