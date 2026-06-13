import { ApiClient } from './apiClient';
import { Role, Permission } from '../types';

export class RolesService {
    static async getRoles(): Promise<Role[]> {
        return ApiClient.request('/roles');
    }

    static async saveRole(role: Partial<Role>): Promise<Role> {
        if (role.id) {
            return ApiClient.request(`/roles/${role.id}`, {
                method: 'PUT',
                body: JSON.stringify(role)
            });
        }
        return ApiClient.request('/roles', {
            method: 'POST',
            body: JSON.stringify(role)
        });
    }

    static async deleteRole(id: string): Promise<void> {
        return ApiClient.request(`/roles/${id}`, {
            method: 'DELETE'
        });
    }

    static getAllPermissions(): { id: Permission; label: string; group: string }[] {
        return [
            { id: 'tec.config.users', label: 'Administrar Usuarios', group: 'Configuración' },
            { id: 'tec.config.roles', label: 'Administrar Roles', group: 'Configuración' },
            { id: 'tec.config.audit', label: 'Logs de Auditoría', group: 'Configuración' },
            { id: 'tec.tickets.view', label: 'Ver mis Tickets Asignados', group: 'Servicios Técnicos' },
        ];
    }
}
