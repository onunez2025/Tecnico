import type { Request, Response, NextFunction } from 'express';
import type { ZodSchema } from 'zod';

/**
 * Valida `req.body` contra un esquema Zod antes de ejecutar el handler. Si no cuadra, responde 400 con
 * el detalle por campo; si cuadra, `req.body` queda reemplazado por el dato ya parseado y tipado.
 *
 * Por qué existe: `zod` está declarado en los 11 repos pero casi solo se usa en el login, y el resto de
 * `req.body` se valida a mano con `if` sueltos de calidad desigual — desde comprobar tipo, rango y
 * formato hasta comprobar únicamente que el campo venga. Este middleware es el mismo que ya funciona en
 * Liquidaciones y Valorizaciones.
 *
 * Ojo al adoptarlo en un endpoint que ya está en producción: un esquema más estricto que los datos
 * reales empieza a rechazar peticiones que hoy pasan. Conviene mirar antes lo que llega de verdad.
 *
 * Uso:
 *   const crearSchema = z.object({
 *     ticket:  z.string().max(50),
 *     importe: z.number().positive(),
 *   });
 *
 *   router.post('/algo', verifyToken, validateBody(crearSchema), async (req, res) => {
 *     const { ticket, importe } = req.body; // tipado y validado
 *   });
 */
export function validateBody<T>(schema: ZodSchema<T>) {
    return (req: Request, res: Response, next: NextFunction): void => {
        const result = schema.safeParse(req.body);
        if (!result.success) {
            res.status(400).json({
                error: 'Datos inválidos',
                details: result.error.flatten().fieldErrors,
            });
            return;
        }
        (req as unknown as { body: T }).body = result.data;
        next();
    };
}
