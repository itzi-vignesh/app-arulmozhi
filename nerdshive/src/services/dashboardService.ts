// src/services/dashboardService.ts
import { apiClient } from '@/lib/apiClient';
import { DashboardStats } from '@/types/api';

export const dashboardService = {
  async getStats(): Promise<DashboardStats> {
    const response = await apiClient.get('/dashboard/stats');
    return response.data;
  },

  async getMetrics(): Promise<any> {
    const response = await apiClient.get('/dashboard/metrics');
    return response.data;
  },

  async getMyQueries(): Promise<any[]> {
    const response = await apiClient.get('/queries/my');
    return response.data;
  },

  async getQueries(params?: { status?: string }): Promise<any[]> {
    const response = await apiClient.get('/queries', { params });
    return response.data;
  },

  async createQuery(data: { user_id: string; query_text: string }): Promise<any> {
    const response = await apiClient.post('/queries', { message: data.query_text });
    return response.data;
  },

  async getUpdates(): Promise<any[]> {
    const response = await apiClient.get('/updates');
    return response.data;
  },

  async getUsageLogs(): Promise<any[]> {
    const response = await apiClient.get('/usage_logs');
    return response.data;
  },

  async getContentSections(): Promise<any[]> {
    const response = await apiClient.get('/content_sections');
    return response.data;
  },

  async getActivityCount(): Promise<number> {
    const response = await apiClient.get('/activity_logs/count');
    return response.data;
  },

  async markActivityTabViewed(): Promise<any> {
    const response = await apiClient.post('/admin_tab_views', { tab_name: 'activity' });
    return response.data;
  },

  async updateQuery(queryId: string, data: { response: string; status: string }): Promise<any> {
    const response = await apiClient.put(`/queries/${queryId}`, data);
    return response.data;
  },

  async updateContentSection(section: string, data: { content: string }): Promise<any> {
    const response = await apiClient.post('/content_sections', { section, content: data.content });
    return response.data;
  }
};
