#!/bin/bash
# check-security.sh — Verificador de seguridad pre-push para repos SIATC
# Detecta patrones inseguros antes de permitir el push.
# Uso manual: ./check-security.sh
# Uso automático: instalado como .git/hooks/pre-push

ERRORS=0
WARNINGS=0
RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'; NC='\033[0m'

echo -e "\n🔍 SIATC Security Check\n───────────────────────────────────"

check_file() {
    local f="$1"

    # C1: req.query.token fuera de verifyTokenForDownload
    if grep -q "req\.query\.token" "$f" 2>/dev/null; then
        if ! grep -q "verifyTokenForDownload" "$f" 2>/dev/null; then
            echo -e "${RED}[C1-CRÍTICO]${NC} req.query.token sin verifyTokenForDownload → $f"
            grep -n "req\.query\.token" "$f" | sed 's/^/     /'
            ERRORS=$((ERRORS+1))
        fi
    fi

    # C2: Paths de Windows hardcodeados en strings
    if grep -q "C:.Users." "$f" 2>/dev/null; then
        echo -e "${RED}[C2-CRÍTICO]${NC} Path hardcodeado de Windows detectado → $f"
        grep -n "C:.Users." "$f" | sed 's/^/     /'
        ERRORS=$((ERRORS+1))
    fi

    # C3: path.normalize + replace (path traversal inseguro)
    if grep -q "path\.normalize" "$f" 2>/dev/null; then
        local ln
        ln=$(grep -n "path\.normalize" "$f" | head -1 | cut -d: -f1)
        if [ -n "$ln" ]; then
            local ctx
            ctx=$(sed -n "${ln},$((ln+2))p" "$f" 2>/dev/null)
            if echo "$ctx" | grep -q "\.replace"; then
                echo -e "${RED}[C3-CRÍTICO]${NC} path.normalize + replace detectado (usar path.resolve + startsWith) → $f:$ln"
                ERRORS=$((ERRORS+1))
            fi
        fi
    fi

    # C4: GET /api/applications sin verifyToken
    local app_hit
    app_hit=$(grep -nE "app\.get\(['\"]\/api\/applications['\"]" "$f" 2>/dev/null | grep -v "verifyToken" || true)
    if [ -n "$app_hit" ]; then
        echo -e "${RED}[C4-CRÍTICO]${NC} GET /api/applications sin verifyToken → $f"
        echo "$app_hit" | sed 's/^/     /'
        ERRORS=$((ERRORS+1))
    fi

    # C5: .input() con req.params/body/query directamente sin tipo SQL
    local sql_hit
    sql_hit=$(grep -nP "\.input\('[^']+',\s*req\.(params|body|query)\." "$f" 2>/dev/null | grep -v "^\s*//" || true)
    if [ -n "$sql_hit" ]; then
        echo -e "${YELLOW}[C5-ADVERTENCIA]${NC} .input() recibe req.params/body sin tipo SQL explícito → $f"
        echo "$sql_hit" | sed 's/^/     /'
        WARNINGS=$((WARNINGS+1))
    fi

    # C9: .input() sin tipo SQL explícito (evitar type confusion — CLAUDE.md regla 3)
    if [[ "$f" != *"lib/db"* ]]; then
        local sql9_hit
        sql9_hit=$(grep -nP "\.input\(['\"][^'\"]+['\"]\s*,\s*(?!sql\.)" "$f" 2>/dev/null | grep -v "^\s*//" || true)
        if [ -n "$sql9_hit" ]; then
            echo -e "${YELLOW}[C9-ADVERTENCIA]${NC} .input() sin tipo SQL — usar addInput() de lib/db.ts → $f"
            echo "$sql9_hit" | sed 's/^/     /'
            WARNINGS=$((WARNINGS+1))
        fi
    fi

    # C10: server.ts con endpoints pero sin importar casFilter (verificar RLS)
    if [[ "$f" == *"server.ts" ]]; then
        if grep -qE "app\.(get|post|put|delete|patch)\(" "$f" 2>/dev/null; then
            if ! grep -qE "from ['\"].*casFilter" "$f" 2>/dev/null; then
                echo -e "${YELLOW}[C10-ADVERTENCIA]${NC} server.ts tiene endpoints pero no importa casFilter — verificar RLS → $f"
                WARNINGS=$((WARNINGS+1))
            fi
        fi
    fi

    # C11: .request().query() directo sin .input() encadenado (puede perder parámetros ligados en otro request)
    if [[ "$f" != *"lib/"* ]] && [[ "$f" != *"scratch/"* ]]; then
        local c11_hit
        c11_hit=$(grep -nP "\.request\(\)\.(query|execute)\(" "$f" 2>/dev/null | grep -v "^\s*//" || true)
        if [ -n "$c11_hit" ]; then
            echo -e "${YELLOW}[C11-ADVERTENCIA]${NC} .request().query() sin .input() encadenado — verificar que no se pierdan parámetros → $f"
            echo "$c11_hit" | sed 's/^/     /'
            WARNINGS=$((WARNINGS+1))
        fi
    fi
}

while IFS= read -r -d '' f; do
    check_file "$f"
done < <(find . \( -name "*.ts" -o -name "*.tsx" \) \
    ! -path "*/node_modules/*" ! -path "*/dist/*" ! -path "*/.git/*" \
    -print0 2>/dev/null)

# C6: TypeScript / ESLint
echo -e "\n📐 Verificando TypeScript..."
LINT_CMD=$(node -e "try{const p=require('./package.json');const s=(p.scripts||{}).lint||'';console.log(s.split(/\s+/)[0]);}catch(e){}" 2>/dev/null)
if [ -z "$LINT_CMD" ]; then
    echo -e "${YELLOW}  ⚠ No se encontró script lint en package.json — omitiendo${NC}"
    WARNINGS=$((WARNINGS+1))
elif [ ! -f "node_modules/.bin/$LINT_CMD" ] && [ ! -f "node_modules/.bin/$LINT_CMD.cmd" ]; then
    echo -e "${YELLOW}  ⚠ Dependencias no instaladas ($LINT_CMD no disponible) — omitiendo lint (ejecuta npm install)${NC}"
    WARNINGS=$((WARNINGS+1))
else
    LINT_OUT=$(npm run lint 2>&1)
    LINT_EXIT=$?
    if [ $LINT_EXIT -ne 0 ]; then
        echo -e "${RED}[C6-CRÍTICO]${NC} TypeScript/ESLint reportó errores — corrige antes de hacer push"
        echo "$LINT_OUT" | head -40 | sed 's/^/     /'
        ERRORS=$((ERRORS+1))
    else
        echo -e "${GREEN}  ✓ TypeScript OK${NC}"
    fi
fi

# C8: Build TypeScript + Vite (verifica que el proyecto compila correctamente)
echo -e "\n🔨 Verificando build..."
if [ ! -f "node_modules/.bin/tsc" ] && [ ! -f "node_modules/.bin/tsc.cmd" ]; then
    echo -e "${YELLOW}  ⚠ Dependencias no instaladas — omitiendo build (ejecuta npm install)${NC}"
    WARNINGS=$((WARNINGS+1))
else
    BUILD_OUT=$(npm run build 2>&1)
    BUILD_EXIT=$?
    if [ $BUILD_EXIT -ne 0 ]; then
        echo -e "${RED}[C8-CRÍTICO]${NC} npm run build falló — corrige antes de hacer push"
        echo "$BUILD_OUT" | tail -20 | sed 's/^/     /'
        ERRORS=$((ERRORS+1))
    else
        echo -e "${GREEN}  ✓ Build OK${NC}"
    fi
fi

# C7: npm audit (vulnerabilidades high/critical)
echo -e "\n🔒 Verificando dependencias (npm audit)..."
AUDIT_OUT=$(npm audit --audit-level=high 2>&1)
AUDIT_EXIT=$?
if [ $AUDIT_EXIT -ne 0 ]; then
    echo -e "${YELLOW}[C7-ADVERTENCIA]${NC} npm audit detectó vulnerabilidades high/critical en dependencias"
    echo "$AUDIT_OUT" | tail -15 | sed 's/^/     /'
    WARNINGS=$((WARNINGS+1))
else
    echo -e "${GREEN}  ✓ Sin vulnerabilidades high/critical${NC}"
fi

echo -e "\n───────────────────────────────────"
if [ "$ERRORS" -gt 0 ]; then
    echo -e "${RED}❌ Push BLOQUEADO — $ERRORS error(es) crítico(s), $WARNINGS advertencia(s)${NC}"
    echo -e "   Corrige los problemas listados antes de hacer push.\n"
    exit 1
elif [ "$WARNINGS" -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Push permitido — $WARNINGS advertencia(s) no bloqueante(s)${NC}\n"
    exit 0
else
    echo -e "${GREEN}✅ OK — Sin problemas de seguridad detectados${NC}\n"
    exit 0
fi
