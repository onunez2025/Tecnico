import { ApiClient } from './apiClient';

export interface DashboardStats {
    total: number;
    pendientes_recepcionar: number;
    liquidados_sap: number;
    rechazados_total: number;
    alertas_pos: number;
    por_recepcionar_logistica: number;
    observados_logistica: number;
    sin_factura: number;
    sin_materiales: number;
    pendiente_aprobacion: number;
    monto_total: number;
}

export interface TechnicianStat {
    tecnico: string;
    total_cobros: number;
    pendientes_recepcionar: number;
    pendientes_liquidar: number;
    rechazados: number;
    monto_total: number;
}

export class DashboardService {
    static async getStats(): Promise<DashboardStats> {
        return ApiClient.request('/dashboard/stats');
    }

    static async getTechnicians(): Promise<TechnicianStat[]> {
        return ApiClient.request('/dashboard/technicians');
    }

    static async getCasPerformance(zone?: string, casId?: string): Promise<any[]> {
        const params = new URLSearchParams();
        if (zone) params.append('zone', zone);
        if (casId) params.append('casId', casId);
        const query = params.toString();
        return ApiClient.request(`/dashboard/cas-performance${query ? `?${query}` : ''}`);
    }

    static async getTechnicianMetrics(name: string): Promise<any> {
        return ApiClient.request(`/dashboard/technician/${encodeURIComponent(name)}/metrics`);
    }
}
