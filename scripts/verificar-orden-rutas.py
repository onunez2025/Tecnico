#!/usr/bin/env python3
"""Detecta pares de rutas Express que pueden casar la MISMA URL.

Solo para esos pares importa el orden de registro: Express resuelve por orden y gana el primero.
Para el resto, mover una ruta de sitio no cambia el comportamiento.

Compara por SEGMENTOS, no con regex sobre la cadena escapada: re.escape() no escapa ':' en
Python 3.7+, y una version anterior de este script daba "sin solapes" siempre por ese motivo.
La autoprueba de abajo existe para que eso no vuelva a pasar desapercibido.

Uso:  python3 scripts/verificar-orden-rutas.py [dir_servidor]
      python3 scripts/verificar-orden-rutas.py --autoprueba
"""
import re, sys, glob, os, itertools

RE_RUTA = re.compile(r"^\s*(?:app|router)\.(get|post|put|patch|delete)\(\s*'([^']*)'", re.M)

def leer(base):
    out = []
    for f in [os.path.join(base,'index.ts')] + sorted(glob.glob(os.path.join(base,'routes','*.ts'))):
        if os.path.exists(f):
            for m in RE_RUTA.finditer(open(f,encoding='utf-8').read()):
                out.append((m.group(1).upper(), m.group(2), os.path.basename(f)))
    return out

def solapan(a, b):
    """True si alguna URL concreta puede casar las dos rutas."""
    A, B = [s for s in a.split('/') if s != ''], [s for s in b.split('/') if s != '']
    if '*' in a or '*' in b:            # comodin: cualquier cola, se trata como solape posible
        return a.split('*')[0] == b.split('*')[0]
    if len(A) != len(B):
        return False                     # distinto numero de segmentos: nunca casan la misma URL
    for x, y in zip(A, B):
        px, py = x.startswith(':'), y.startswith(':')
        if not px and not py and x != y:
            return False                 # dos literales distintos en la misma posicion
    return True

def autoprueba():
    casos = [
        ('/api/t/:id',      '/api/t/resumen',    True,  'parametro contra literal'),
        ('/api/t/:id',      '/api/t/:otro',      True,  'dos parametros'),
        ('/api/t/resumen',  '/api/t/detalle',    False, 'dos literales distintos'),
        ('/api/t/:id/pagos','/api/t/resumen',    False, 'distinto numero de segmentos'),
        ('/api/a/:x',       '/api/b/:y',         False, 'prefijo distinto'),
        ('/api/t',          '/api/t/:id',        False, 'padre contra hijo'),
    ]
    ok = True
    for a, b, esperado, nota in casos:
        r = solapan(a, b)
        marca = 'ok  ' if r == esperado else 'FALLA'
        if r != esperado: ok = False
        print(f"  [{marca}] {nota:32s} {a}  vs  {b}   -> {r} (esperado {esperado})")
    print("  autoprueba: " + ("TODO CORRECTO" if ok else ">>> EL COMPROBADOR ESTA ROTO <<<"))
    return 0 if ok else 1

if '--autoprueba' in sys.argv:
    sys.exit(autoprueba())

base = sys.argv[1] if len(sys.argv) > 1 else 'server'
R = leer(base)
print(f"  {len(R)} rutas leidas de {base}/")
ch = [(m1,p1,f1,p2,f2) for (m1,p1,f1),(m2,p2,f2) in itertools.combinations(R,2)
      if m1 == m2 and p1 != p2 and solapan(p1,p2)]
if not ch:
    print("  Ningun par puede casar la misma URL: el orden de registro NO afecta a ninguna ruta.")
else:
    print(f"  {len(ch)} par(es) donde el ORDEN SI importa (gana el registrado primero):")
    for m,p1,f1,p2,f2 in ch:
        print(f"    {m:6s} {p1}  ({f1})")
        print(f"           vs {p2}  ({f2})")
