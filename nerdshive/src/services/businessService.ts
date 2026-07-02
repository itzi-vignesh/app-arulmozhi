// src/services/businessService.ts
import { apiClient } from '@/lib/apiClient';
import { Plan, Checkin, Pricing } from '@/types/api';

export const businessService = {
  async getMyPlans(): Promise<Plan[]> {
    const response = await apiClient.get('/plans/my');
    return response.data;
  },

  async getPlans(params?: { page?: number; limit?: number }): Promise<Plan[]> {
    const response = await apiClient.get('/plans', { params });
    return response.data;
  },

  async createPlan(data: any): Promise<Plan> {
    const response = await apiClient.post('/plans', data);
    return response.data;
  },

  async getPricing(): Promise<Pricing[]> {
    const response = await apiClient.get('/pricing');
    return response.data;
  },

  async updatePricing(data: Partial<Pricing>): Promise<Pricing> {
    const response = await apiClient.put('/pricing/update', data);
    return response.data;
  },

  async getCustomerPlans(): Promise<any[]> {
    const response = await apiClient.get('/pricing/customer');
    return response.data;
  },
  
  async getCorporatePlans(): Promise<any[]> {
    const response = await apiClient.get('/pricing/corporate');
    return response.data;
  },
  
  async getAdminCustomerPlans(): Promise<any[]> {
    const response = await apiClient.get('/admin/pricing/customer');
    return response.data;
  },

  async getSuperuserPlans(): Promise<any[]> {
    const response = await apiClient.get('/superuser/pricing');
    return response.data;
  },
  
  async updateSuperuserPlan(id: string, data: any): Promise<any> {
    const response = await apiClient.put(`/superuser/pricing/${id}`, data);
    return response.data;
  },

  async createSuperuserPlan(data: any): Promise<any> {
    const response = await apiClient.post('/superuser/pricing', data);
    return response.data;
  },

  async updateAdminCustomerPlan(id: string, data: any): Promise<any> {
    const response = await apiClient.put(`/admin/pricing/customer/${id}`, data);
    return response.data;
  },

  async createAdminCustomerPlan(data: any): Promise<any> {
    const response = await apiClient.post('/admin/pricing/customer', data);
    return response.data;
  },
  
  async getMyCheckins(): Promise<Checkin[]> {
    const response = await apiClient.get('/checkins/my');
    return response.data;
  },

  async getCheckins(params?: { page?: number; limit?: number; status?: string; checkin_approved?: boolean }): Promise<Checkin[]> {
    const response = await apiClient.get('/checkins/', { params });
    return response.data;
  },

  async approveCheckin(checkinId: string): Promise<any> {
    const response = await apiClient.put(`/checkins/${checkinId}/approve`);
    return response.data;
  },
  
  async markExpiredCheckins(): Promise<any> {
    const response = await apiClient.post('/checkins/expired/mark');
    return response.data;
  },
  
  async deleteOldExpiredCheckins(): Promise<any> {
    const response = await apiClient.post('/checkins/expired/delete-old');
    return response.data;
  },

  async verifyPayment(checkinId: string): Promise<any> {
    const response = await apiClient.post(`/checkins/${checkinId}/verify_payment`);
    return response.data;
  },
  
  async createCheckin(data?: { user_id: string, plan_id: string }): Promise<any> {
    const response = await apiClient.post('/checkins/', data);
    return response.data;
  },

  async updateCheckin(checkinId: string, data: any): Promise<any> {
    const response = await apiClient.put(`/checkins/${checkinId}`, data);
    return response.data;
  },

  async deleteCheckin(checkinId: string): Promise<any> {
    const response = await apiClient.delete(`/checkins/${checkinId}`);
    return response.data;
  }
};

