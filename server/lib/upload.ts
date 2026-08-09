import fs from 'fs';
import path from 'path';
import multer from 'multer';

// --- VALIDACIÓN POR MAGIC BYTES (previene spoofing de MIME) ---
const MAGIC_BYTES: Record<string, number[][]> = {
    'image/jpeg':      [[0xFF, 0xD8, 0xFF]],
    'image/png':       [[0x89, 0x50, 0x4E, 0x47]],
    'image/webp':      [[0x52, 0x49, 0x46, 0x46]],
    'image/gif':       [[0x47, 0x49, 0x46, 0x38]],
    'application/pdf': [[0x25, 0x50, 0x44, 0x46]],
};
export async function validateFileMagicBytes(filePath: string, declaredMime: string): Promise<boolean> {
    try {
        const fd = await fs.promises.open(filePath, 'r');
        const buf = Buffer.alloc(8);
        await fd.read(buf, 0, 8, 0);
        await fd.close();
        const sigs = MAGIC_BYTES[declaredMime];
        if (!sigs) return false;
        return sigs.some(sig => sig.every((byte, i) => buf[i] === byte));
    } catch {
        return false;
    }
}

// --- CONFIGURACIÓN DE MULTER (CARGA DE ARCHIVOS) ---
// [SECURITY] Restringir tipo de archivo y tamaño máximo para evitar uploads maliciosos.
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
const MAX_FILE_SIZE_MB = 10;

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(process.cwd(), 'uploads');
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Sanitizar el nombre de archivo original
        const safeName = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_');
        cb(null, `${Date.now()}-${safeName}`);
    }
});
const multerFileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error(`Tipo de archivo no permitido: ${file.mimetype}. Solo se aceptan imágenes y PDF.`));
    }
};
export const upload = multer({ storage, fileFilter: multerFileFilter, limits: { fileSize: MAX_FILE_SIZE_MB * 1024 * 1024 } });
