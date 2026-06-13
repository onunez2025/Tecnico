import { User } from '../types';

export class StorageService {
    static setToken(token: string, remember: boolean = true) {
        if (remember) {
            localStorage.setItem('auth_token', token);
        } else {
            sessionStorage.setItem('auth_token', token);
        }
    }
    
    static getToken(): string | null {
        return localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
    }
    
    static setCurrentUser(user: User, remember: boolean = true) {
        if (remember) {
            localStorage.setItem('current_user', JSON.stringify(user));
        } else {
            sessionStorage.setItem('current_user', JSON.stringify(user));
        }
    }
    
    static getCurrentUser(): User | null {
        const user = localStorage.getItem('current_user') || sessionStorage.getItem('current_user');
        return user ? JSON.parse(user) : null;
    }
    
    static remove(key: string) {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
    }

    static clear() {
        localStorage.clear();
        sessionStorage.clear();
    }
}
