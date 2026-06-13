import { ApiClient } from './apiClient';
import { Management } from '../types';

export class ManagementsService {
    static async getManagements(): Promise<Management[]> {
        return ApiClient.request('/managements');
    }
}
