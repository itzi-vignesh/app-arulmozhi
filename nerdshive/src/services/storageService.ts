// src/services/storageService.ts
import { apiClient } from '@/lib/apiClient';

export const storageService = {
  async uploadFile(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await apiClient.post('/storage/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    return response.data;
  },

  async uploadIdProof(filename: string, file: File): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiClient.post(`/storage/id-proofs/${filename}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data.path;
  },

  async uploadCustomerPhoto(filename: string, file: File): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiClient.post(`/storage/customer-photos/${filename}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data.path;
  },

  getFileUrl(filename: string): string {
    const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001/api/v1';
    return `${API_BASE_URL}/storage/${filename}`;
  }
};
