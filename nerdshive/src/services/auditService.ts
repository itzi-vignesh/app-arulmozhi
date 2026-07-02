// src/services/auditService.ts
import { apiClient } from '@/lib/apiClient';
import { UsageLog, QueryLog, ActivityLog } from '@/types/api';

export const auditService = {
  async getUsageLogs(params?: { page?: number; limit?: number; sort?: string }): Promise<UsageLog[]> {
    const response = await apiClient.get('/usage_logs', { params });
    return response.data;
  },

  async getQueries(params?: { page?: number; limit?: number; sort?: string }): Promise<QueryLog[]> {
    const response = await apiClient.get('/queries', { params });
    return response.data;
  },
  
  async createQuery(message: string): Promise<QueryLog> {
    const response = await apiClient.post('/queries', { message });
    return response.data;
  },
  
  async updateQuery(queryId: string, status: string, responseMsg?: string): Promise<QueryLog> {
    const response = await apiClient.put(`/queries/${queryId}`, { status, response: responseMsg });
    return response.data;
  },

  async getActivityLogs(params?: { page?: number; limit?: number; sort?: string }): Promise<ActivityLog[]> {
    const response = await apiClient.get('/activity_logs', { params });
    return response.data;
  },

  async createActivityLog(action: string): Promise<ActivityLog> {
    const response = await apiClient.post('/activity_logs', { action });
    return response.data;
  },
  
  async updateAdminTabView(tabName: string): Promise<any> {
    // Legacy RPC replacement
    const response = await apiClient.post('/admin_tab_views', { tab_name: tabName });
    return response.data;
  },

  async getContentSections(): Promise<any[]> {
    const response = await apiClient.get('/content_sections');
    return response.data;
  },

  async upsertContentSection(section: string, content: string): Promise<any> {
    const response = await apiClient.post('/content_sections', { section, content });
    return response.data;
  }
};
