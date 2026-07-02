// src/services/adminService.ts
import { apiClient } from '@/lib/apiClient';
import { Admin, User } from '@/types/api';

export const adminService = {
  async getAdmins(params?: { page?: number; limit?: number }): Promise<Admin[]> {
    const response = await apiClient.get('/admins/', { params });
    return response.data;
  },

  async inviteAdmin(email: string): Promise<Admin> {
    const response = await apiClient.post('/admins/invite', { email });
    return response.data;
  },

  async addAdmin(email: string, password: string): Promise<Admin> {
    console.log("Sending POST /admins/invite", { email }); // don't log password
    const response = await apiClient.post('/admins/invite', { email, password });
    console.log("Response from POST /admins/invite", response.data);
    return response.data;
  },

  async deleteAdmin(adminId: string): Promise<any> {
    const response = await apiClient.delete(`/admins/${adminId}`);
    return response.data;
  },

  async getUsers(params?: { is_approved?: boolean; exclude_corporate?: boolean; company_id?: string }): Promise<User[]> {
    const response = await apiClient.get('/users/', { params });
    return response.data;
  },

  async approveUser(userId: string): Promise<User> {
    const response = await apiClient.put(`/users/${userId}/approve`);
    return response.data;
  },

  async rejectUser(userId: string, reason?: string): Promise<User> {
    const response = await apiClient.put(`/users/${userId}/reject`, { reason });
    return response.data;
  },

  async makeUserInactive(userId: string): Promise<User> {
    const response = await apiClient.put(`/users/${userId}/inactive`);
    return response.data;
  },

  async activateUser(userId: string): Promise<User> {
    const response = await apiClient.put(`/users/${userId}/activate`);
    return response.data;
  },

  async updateContent(data: { section: string; content: string }): Promise<any> {
    const response = await apiClient.post('/content_sections', data);
    return response.data;
  },

  async getMe(): Promise<Admin> {
    const response = await apiClient.get('/admins/me');
    return response.data;
  }
};
