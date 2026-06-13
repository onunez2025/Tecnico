import { StorageService } from './storageService';

export const API_BASE_URL = '/api';

let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

async function tryRefreshToken(): Promise<string | null> {
    if (isRefreshing && refreshPromise) return refreshPromise;
    isRefreshing = true;
    refreshPromise = (async () => {
        try {
            const token = StorageService.getToken();
            if (!token) return null;
            const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!response.ok) return null;
            const data = await response.json();
            const remember = !!localStorage.getItem('auth_token');
            StorageService.setToken(data.token, remember);
            return data.token as string;
        } catch {
            return null;
        } finally {
            isRefreshing = false;
            refreshPromise = null;
        }
    })();
    return refreshPromise;
}

export class ApiClient {
    static async request<T = unknown>(endpoint: string, options: RequestInit = {}, _retry = false): Promise<T> {
        const token = StorageService.getToken();
        const isFormData = options.body instanceof FormData;

        const headers: Record<string, string> = {
            ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        };

        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers: { ...headers, ...options.headers },
        });

        if (response.status === 401 && !_retry) {
            const newToken = await tryRefreshToken();
            if (newToken) {
                return ApiClient.request<T>(endpoint, options, true);
            }
            StorageService.remove('current_user');
            StorageService.remove('auth_token');
            window.location.href = '/login';
            throw new Error('Sesión expirada');
        }

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Error desconocido' }));
            throw new Error(error.error || 'Error en la petición');
        }

        if (response.status === 204) return null as T;
        return response.json() as Promise<T>;
    }

    static async download(endpoint: string) {
        const token = StorageService.getToken();
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            headers: {
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
        });

        if (!response.ok) {
            const contentType = response.headers.get('Content-Type') || '';
            if (contentType.includes('application/json')) {
                const errorBody = await response.json().catch(() => ({}));
                throw new Error(errorBody.error || 'Error al descargar el archivo');
            }
            const text = await response.text().catch(() => '');
            throw new Error(text || `Error ${response.status} al descargar el archivo`);
        }
        return response.blob();
    }
}
