#!/bin/bash
# check-security.sh — SIATC Security Pre-Push Hook v2.0
# Detecta patrones inseguros antes de permitir el push.
#
# SECURITY_MODE (variable de entorno):
#   WARN  → nuevos controles son advertencias (no bloquean). Usar durante Etapas 0-3.
#   BLOCK → todos los controles bloquean el push. Activar al completar Etapa 3.
#
# Uso manual: ./check-security.sh
# Uso automático: cp check-security.sh .git/hooks/pre-push

SECURITY_MODE="${SECURITY_MODE:-BLOCK}"
ERRORS=0
WARNINGS=0
RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'

echo -e "\n🔍 SIATC Security Check v2.0 (modo: ${CYAN}${SECURITY_MODE}${NC})\n───────────────────────────────────────────"

# ─── Función auxiliar ────────────────────────────────────────────────────────
# dynamic_check <label> <matches_string>
# Si hay matches: BLOCK en modo BLOCK, WARN en modo WARN
dynamic_check() {
    local label="$1"
    local matches="$2"
    local lines="$3"  # opcional: líneas para mostrar
    if [ -n "$matches" ]; then
        if [ "$SECURITY_MODE" = "BLOCK" ]; then
            echo -e "${RED}[${label}]${NC} → $matches"
            [ -n "$lines" ] && echo "$lines" | head -5 | sed 's/^/     /'
            ERRORS=$((ERRORS+1))
        else
            echo -e "${YELLOW}[${label}]${NC} (será BLOCK al activar modo BLOCK) → $matches"
            [ -n "$lines" ] && echo "$lines" | head -3 | sed 's/^/     /'
            WARNINGS=$((WARNINGS+1))
        fi
    fi
}

check_file() {
    local f="$1"

    # ════════════════════════════════════════════════════════════════════════
    # BLOQUEOS DUROS — activos siempre, independiente de SECURITY_MODE
    # ════════════════════════════════════════════════════════════════════════

    # C1: req.query.token fuera de verifyTokenForDownload
    if grep -q "req\.query\.token" "$f" 2>/dev/null; then
        if ! grep -q "verifyTokenForDownload" "$f" 2>/dev/null; then
            echo -e "${RED}[C1-CRÍTICO]${NC} req.query.token sin verifyTokenForDownload → $f"
            grep -n "req\.query\.token" "$f" | sed 's/^/     /'
            ERRORS=$((ERRORS+1))
        fi
    fi

    # C2: Paths de Windows hardcodeados
    if grep -q "C:.Users." "$f" 2>/dev/null; then
        echo -e "${RED}[C2-CRÍTICO]${NC} Path hardcodeado de Windows → $f"
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
                echo -e "${RED}[C3-CRÍTICO]${NC} path.normalize+replace detectado (usar path.resolve+startsWith) → $f:$ln"
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

    # C5: .input() con req.params/body/query sin tipo SQL
    local sql_hit
    sql_hit=$(grep -nP "\.input\('[^']+',\s*req\.(params|body|query)\." "$f" 2>/dev/null | grep -v "^\s*//" || true)
    if [ -n "$sql_hit" ]; then
        echo -e "${YELLOW}[C5-ADVERTENCIA]${NC} .input() recibe req.params/body sin tipo SQL → $f"
        echo "$sql_hit" | sed 's/^/     /'
        WARNINGS=$((WARNINGS+1))
    fi

    # C6-UPLOAD: multer() sin fileFilter — BLOQUEO DURO (Etapa 2 ya debe haberlo corregido)
    if [[ "$f" != *"security.ts"* ]]; then
        if grep -q "= multer(" "$f" 2>/dev/null || grep -q "multer({" "$f" 2>/dev/null; then
            if ! grep -q "fileFilter" "$f" 2>/dev/null; then
                echo -e "${RED}[C6-UPLOAD-CRÍTICO]${NC} multer() sin fileFilter detectado — usar createSecureMulter() → $f"
                grep -n "multer(" "$f" | sed 's/^/     /'
                ERRORS=$((ERRORS+1))
            fi
        fi
    fi

    # C9: .input() sin tipo SQL explícito
    if [[ "$f" != *"lib/db"* ]]; then
        local sql9_hit
        sql9_hit=$(grep -nP "\.input\(['\"][^'\"]+['\"]\s*,\s*(?!sql\.)" "$f" 2>/dev/null | grep -v "^\s*//" || true)
        if [ -n "$sql9_hit" ]; then
            echo -e "${YELLOW}[C9-ADVERTENCIA]${NC} .input() sin tipo SQL — usar addInput() de lib/db.ts → $f"
            echo "$sql9_hit" | sed 's/^/     /'
            WARNINGS=$((WARNINGS+1))
        fi
    fi

    # C11: .request().query() directo sin .input()
    if [[ "$f" != *"lib/"* ]] && [[ "$f" != *"scratch/"* ]]; then
        local c11_hit
        c11_hit=$(grep -nP "\.request\(\)\.(query|execute)\(" "$f" 2>/dev/null | grep -v "^\s*//" || true)
        if [ -n "$c11_hit" ]; then
            echo -e "${YELLOW}[C11-ADVERTENCIA]${NC} .request().query() sin .input() — verificar parámetros → $f"
            echo "$c11_hit" | sed 's/^/     /'
            WARNINGS=$((WARNINGS+1))
        fi
    fi

    # ════════════════════════════════════════════════════════════════════════
    # CONTROLES DINÁMICOS — WARN ahora, BLOCK al completar Etapa 3
    # ════════════════════════════════════════════════════════════════════════

    # C10-ERRORES: err.message / error.message en respuesta HTTP sin safeError()
    if [[ "$f" != *"security.ts"* ]]; then
        local errMsg_hit errMsg_lines
        errMsg_lines=$(grep -nE "\.json\(.*err(or)?\.message|res\..*\(.*err(or)?\.message" "$f" 2>/dev/null \
                       | grep -v "safeError\|NODE_ENV\|// sec-ok" || true)
        errMsg_hit=$(echo "$errMsg_lines" | grep -c . || true)
        if [ "${errMsg_hit:-0}" -gt 0 ]; then
            dynamic_check "C10-ERRORES: err.message expuesto en HTTP — usar safeError()" \
                          "$f (${errMsg_hit} ocurrencias)" "$errMsg_lines"
        fi
    fi

    # C5-SQLTYPES: sql.VarChar / sql.NVarChar sin longitud
    if [[ "$f" != *"security.ts"* ]] && [[ "$f" != *"lib/db"* ]]; then
        local varChar_lines varChar_hit
        varChar_lines=$(grep -nP "sql\.(VarChar|NVarChar)[^(]" "$f" 2>/dev/null \
                        | grep -v "^\s*//" || true)
        varChar_hit=$(echo "$varChar_lines" | grep -c . || true)
        if [ "${varChar_hit:-0}" -gt 0 ]; then
            dynamic_check "C5-SQLTYPES: sql.VarChar/NVarChar sin longitud — especificar sql.VarChar(N)" \
                          "$f (${varChar_hit} ocurrencias)" "$varChar_lines"
        fi
    fi

    # C12-LOGINJECT: console.log/error/warn con datos de req sin sanitizeLog()
    if [[ "$f" != *"security.ts"* ]]; then
        local log_lines log_hit
        log_lines=$(grep -nE "console\.(log|error|warn).*req\.(body|params|query|file)" "$f" 2>/dev/null \
                    | grep -v "sanitizeLog\|// sec-ok" || true)
        log_hit=$(echo "$log_lines" | grep -c . || true)
        if [ "${log_hit:-0}" -gt 0 ]; then
            dynamic_check "C12-LOGINJECT: datos de req en console sin sanitizeLog() — riesgo de log injection" \
                          "$f (${log_hit} ocurrencias)" "$log_lines"
        fi
    fi

    # C7-BLACKLIST: endpoint de BACKEND que define /logout sin llamar a blacklistToken
    # (requiere una definición real de ruta Express — evita falsos positivos en hooks
    # de frontend que solo hacen fetch() a /auth/logout, ej. useAuth.tsx)
    if grep -qE "(app|router)\.(post|get|delete)\(['\"\`][^'\"\`]*\/logout" "$f" 2>/dev/null; then
        if ! grep -q "blacklistToken" "$f" 2>/dev/null; then
            dynamic_check "C7-BLACKLIST: endpoint logout sin llamada a blacklistToken()" "$f" ""
        fi
    fi

    # C10-RLS: server.ts con endpoints pero sin casFilter (verificar RLS)
    if [[ "$f" == *"server.ts" ]]; then
        if grep -qE "app\.(get|post|put|delete|patch)\(" "$f" 2>/dev/null; then
            if ! grep -qE "from ['\"].*casFilter|casId|casRUC" "$f" 2>/dev/null; then
                echo -e "${YELLOW}[C10-RLS-ADVERTENCIA]${NC} server.ts con endpoints pero sin referencia a casId/casRUC — verificar RLS → $f"
                WARNINGS=$((WARNINGS+1))
            fi
        fi
    fi
}

# ─── Recorrer todos los archivos TS/TSX ──────────────────────────────────────
while IFS= read -r -d '' f; do
    check_file "$f"
done < <(find . \( -name "*.ts" -o -name "*.tsx" \) \
    ! -path "*/node_modules/*" ! -path "*/dist/*" ! -path "*/.git/*" \
    -print0 2>/dev/null)

# ─── Build TypeScript ─────────────────────────────────────────────────────────
echo -e "\n📐 Verificando TypeScript..."
LINT_CMD=$(node -e "try{const p=require('./package.json');const s=(p.scripts||{}).lint||'';console.log(s.split(/\s+/)[0]);}catch(e){}" 2>/dev/null)
if [ -z "$LINT_CMD" ]; then
    echo -e "${YELLOW}  ⚠ No se encontró script lint — omitiendo${NC}"
    WARNINGS=$((WARNINGS+1))
elif [ ! -f "node_modules/.bin/$LINT_CMD" ] && [ ! -f "node_modules/.bin/$LINT_CMD.cmd" ]; then
    echo -e "${YELLOW}  ⚠ Dependencias no instaladas ($LINT_CMD no disponible) — ejecuta npm install${NC}"
    WARNINGS=$((WARNINGS+1))
else
    LINT_OUT=$(npm run lint 2>&1)
    LINT_EXIT=$?
    if [ $LINT_EXIT -ne 0 ]; then
        echo -e "${RED}[C6-CRÍTICO]${NC} TypeScript/ESLint reportó errores"
        echo "$LINT_OUT" | head -40 | sed 's/^/     /'
        ERRORS=$((ERRORS+1))
    else
        echo -e "${GREEN}  ✓ TypeScript OK${NC}"
    fi
fi

# ─── Build completo ───────────────────────────────────────────────────────────
echo -e "\n🔨 Verificando build..."
if [ ! -f "node_modules/.bin/tsc" ] && [ ! -f "node_modules/.bin/tsc.cmd" ]; then
    echo -e "${YELLOW}  ⚠ Dependencias no instaladas — omitiendo build${NC}"
    WARNINGS=$((WARNINGS+1))
else
    BUILD_OUT=$(npm run build 2>&1)
    BUILD_EXIT=$?
    if [ $BUILD_EXIT -ne 0 ]; then
        echo -e "${RED}[C8-CRÍTICO]${NC} npm run build falló"
        echo "$BUILD_OUT" | tail -20 | sed 's/^/     /'
        ERRORS=$((ERRORS+1))
    else
        echo -e "${GREEN}  ✓ Build OK${NC}"
    fi
fi

# ─── npm audit ───────────────────────────────────────────────────────────────
echo -e "\n🔒 Verificando dependencias (npm audit)..."
AUDIT_OUT=$(npm audit --audit-level=high 2>&1)
AUDIT_EXIT=$?
if [ $AUDIT_EXIT -ne 0 ]; then
    echo -e "${YELLOW}[C7-ADVERTENCIA]${NC} npm audit detectó vulnerabilidades high/critical"
    echo "$AUDIT_OUT" | tail -15 | sed 's/^/     /'
    WARNINGS=$((WARNINGS+1))
else
    echo -e "${GREEN}  ✓ Sin vulnerabilidades high/critical${NC}"
fi

# ─── Resultado final ──────────────────────────────────────────────────────────
echo -e "\n───────────────────────────────────────────"
if [ "$ERRORS" -gt 0 ]; then
    echo -e "${RED}❌ Push BLOQUEADO — $ERRORS error(es) crítico(s), $WARNINGS advertencia(s)${NC}"
    echo -e "   Corrige los problemas listados antes de hacer push.\n"
    exit 1
elif [ "$WARNINGS" -gt 0 ]; then
    if [ "$SECURITY_MODE" = "WARN" ]; then
        echo -e "${YELLOW}⚠️  Push permitido con $WARNINGS advertencia(s) — modo WARN activo${NC}"
        echo -e "   Estas advertencias se convertirán en BLOQUEOS al completar Etapa 3.\n"
    else
        echo -e "${YELLOW}⚠️  Push permitido con $WARNINGS advertencia(s)${NC}\n"
    fi
    exit 0
else
    echo -e "${GREEN}✅ OK — Sin problemas de seguridad detectados${NC}\n"
    exit 0
fi
