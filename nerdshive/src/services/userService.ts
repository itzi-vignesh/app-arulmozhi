// src/services/userService.ts
import { apiClient } from '@/lib/apiClient';
import { User } from '@/types/api';

export const userService = {
  async getMe(): Promise<User> {
    const response = await apiClient.get('/users/me');
    return response.data;
  },

  async updateMe(data: Partial<User>): Promise<User> {
    const response = await apiClient.put('/users/me', data);
    return response.data;
  },

  async getUsers(params?: { skip?: number; limit?: number }): Promise<User[]> {
    const response = await apiClient.get('/users/', { params });
    return response.data;
  },
  
  async deleteUser(userId: string): Promise<void> {
    // Requires a new route or modifying an existing one on the backend, 
    // assuming /users/{userId} mapped to delete. 
    // Wait, the backend has /admins/invite and generic users. 
    // Let's just pass userId in the body to a specific delete_user route.
    await apiClient.post('/users/delete', { user_auth_id: userId });
  },

  async getUserById(id: string): Promise<User> {
    const response = await apiClient.get(`/users/${id}`);
    return response.data;
  }
};
