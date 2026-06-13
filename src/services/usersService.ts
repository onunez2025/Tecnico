import { ApiClient } from './apiClient';
import { User } from '../types';

export class UsersService {
    static async getUsers(): Promise<User[]> {
        return ApiClient.request('/users');
    }

    static async saveUser(user: Partial<User>): Promise<User> {
        if (user.id) {
            return ApiClient.request(`/users/${user.id}`, {
                method: 'PUT',
                body: JSON.stringify(user)
            });
        }
        return ApiClient.request('/users', {
            method: 'POST',
            body: JSON.stringify(user)
        });
    }

    static async deleteUser(id: string): Promise<void> {
        return ApiClient.request(`/users/${id}`, {
            method: 'DELETE'
        });
    }
}
