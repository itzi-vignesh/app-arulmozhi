// src/services/authService.ts
import { apiClient } from '@/lib/apiClient';

export const authService = {
  async login(email: string, password: string) {
    // OAuth2PasswordRequestForm requires application/x-www-form-urlencoded
    // URLSearchParams auto-sets the correct Content-Type header
    const params = new URLSearchParams();
    params.append('username', email);
    params.append('password', password);
    const response = await apiClient.post('/auth/login', params);
    return response.data;
  },
  
  async register(data: any) {
    const response = await apiClient.post('/auth/register', data);
    return response.data;
  },

  async logout() {
    const response = await apiClient.post('/auth/logout');
    return response.data;
  },

  async getSession() {
    const response = await apiClient.get('/auth/session');
    return response.data;
  },
  
  async resetPassword(token: string, newPassword: string) {
    const response = await apiClient.post('/auth/reset-password', { token, new_password: newPassword });
    return response.data;
  },
  
  async recoverPassword(email: string) {
    const response = await apiClient.post('/auth/password-recovery', { email });
    return response.data;
  },
  
  async changePassword(currentPassword: string, newPassword: string) {
    const response = await apiClient.post('/auth/change-password', { current_password: currentPassword, new_password: newPassword });
    return response.data;
  },
  
  async getMfaStatus() {
    const response = await apiClient.get('/auth/mfa/status');
    return response.data;
  },

  async setupMfa() {
    const response = await apiClient.post('/auth/mfa/setup');
    return response.data;
  },

  async verifyMfa(code: string) {
    const response = await apiClient.post('/auth/mfa/verify', { code });
    return response.data;
  },

  async loginMfa(mfaToken: string, code: string) {
    const response = await apiClient.post('/auth/mfa/login', { mfa_token: mfaToken, code });
    return response.data;
  },

  async disableMfa(data: any) {
    const response = await apiClient.post('/auth/mfa/disable', data);
    return response.data;
  },

  async deferMfa() {
    const response = await apiClient.post('/auth/mfa/defer');
    return response.data;
  },

  async regenerateBackupCodes(code: string) {
    const response = await apiClient.post('/auth/mfa/regenerate-backup-codes', { code });
    return response.data;
  },

  async getBackupCodesStatus() {
    const response = await apiClient.get('/auth/mfa/recovery');
    return response.data;
  },

  async getPlatformPolicy() {
    const response = await apiClient.get('/auth/mfa/policy');
    return response.data;
  },

  async updatePlatformPolicy(data: any) {
    const response = await apiClient.post('/auth/mfa/policy', data);
    return response.data;
  }
};
