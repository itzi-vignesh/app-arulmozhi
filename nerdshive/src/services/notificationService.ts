// src/services/notificationService.ts
import { apiClient } from '@/lib/apiClient';
import { Notification } from '@/types/api';

export const notificationService = {
  async getNotifications(params?: { page?: number; limit?: number }): Promise<Notification[]> {
    const response = await apiClient.get('/notifications/', { params });
    return response.data;
  },

  async markAsRead(notificationId: string): Promise<Notification> {
    const response = await apiClient.put(`/notifications/${notificationId}/read`);
    return response.data;
  },

  async markAllAsRead(): Promise<void> {
    await apiClient.put('/notifications/read-all');
  }
};

