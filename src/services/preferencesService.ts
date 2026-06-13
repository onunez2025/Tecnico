import { ApiClient } from './apiClient';

export const PreferencesService = {
  async getPreferences(): Promise<Record<string, any>> {
    try {
      return await ApiClient.request(`/user/preferences`);
    } catch (err) {
      console.error('Error fetching preferences:', err);
      return {};
    }
  },

  async savePreference(clave: string, valor: any): Promise<boolean> {
    try {
      await ApiClient.request(`/user/preferences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clave, valor })
      });
      return true;
    } catch (err) {
      console.error('Error saving preference:', err);
      return false;
    }
  }
};
