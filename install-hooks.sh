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

# Hook opcional: post-commit para generar la nota de bitácora en Obsidian (SIATC Memory).
# Busca hasta 4 niveles hacia arriba una carpeta "Ecosistema SIATC" (algunas apps del
# ecosistema viven directo bajo Antigravity/, otras anidadas una carpeta mas adentro,
# ej. "Antigravity/Gestor FSM/Gestor-de-Tickets-FSM"). Si no la encuentra -- estructura
# de carpetas distinta, ej. un colaborador en otra maquina -- no instala nada, sin error
# ni mensaje ruidoso.
OBSIDIAN_SCRIPT=""
SEARCH_DIR="$REPO_ROOT"
for _ in 1 2 3 4; do
    SEARCH_DIR="$(dirname "$SEARCH_DIR")"
    CANDIDATE="$SEARCH_DIR/Ecosistema SIATC/generate-obsidian-note.sh"
    if [ -f "$CANDIDATE" ]; then
        OBSIDIAN_SCRIPT="$CANDIDATE"
        break
    fi
done
POST_COMMIT_DST="$REPO_ROOT/.git/hooks/post-commit"

if [ -n "$OBSIDIAN_SCRIPT" ]; then
    cat > "$POST_COMMIT_DST" << HOOK_EOF2
#!/bin/sh
bash "$OBSIDIAN_SCRIPT"
HOOK_EOF2
    chmod +x "$POST_COMMIT_DST"
    echo "✅ Hook post-commit instalado (genera bitácora en Obsidian tras cada commit)."
fi

echo ""
echo "Para verificar manualmente: ./check-security.sh"
