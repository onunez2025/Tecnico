import { BlobServiceClient, ContainerClient } from '@azure/storage-blob';

// Cliente perezoso, igual que getRedisClient() y getReadPool(): construirlo al importar haria que
// un AZURE_STORAGE_CONNECTION_STRING ausente reventara ANTES que el resto de comprobaciones de
// arranque de index.ts, cambiando que mensaje ve el operador. La comprobacion fatal se queda en
// index.ts, en su posicion original.
let _container: ContainerClient | null = null;

export function getContainerClient(): ContainerClient {
    if (!_container) {
        const conexion = process.env.AZURE_STORAGE_CONNECTION_STRING as string;
        const contenedor = process.env.AZURE_STORAGE_CONTAINER || 'stecnico';
        _container = BlobServiceClient.fromConnectionString(conexion).getContainerClient(contenedor);
    }
    return _container;
}
