import { apiClient } from '@/lib/apiClient';

export interface FinanceUser {
  id: string;
  auth_id: string;
  email?: string;
  full_name: string;
  mobile?: string;
  city?: string;
  location?: string;
  occupation?: string;
  status: string;
  permissions?: string[];
  created_at: string;
}

export const financeService = {
  // Superuser management of Finance accounts
  async getFinanceUsers(params?: { page?: number; limit?: number }): Promise<FinanceUser[]> {
    const response = await apiClient.get('/finance/', { params });
    return response.data;
  },

  async inviteFinanceUser(data: any): Promise<FinanceUser> {
    const response = await apiClient.post('/finance/invite', data);
    return response.data;
  },

  async updateFinanceUser(financeId: string, data: any): Promise<FinanceUser> {
    const response = await apiClient.put(`/finance/${financeId}`, data);
    return response.data;
  },

  async resetFinancePassword(financeId: string, password: string): Promise<any> {
    const response = await apiClient.post(`/finance/${financeId}/reset-password`, password, {
      headers: { 'Content-Type': 'application/json' }
    });
    return response.data;
  },

  async deleteFinanceUser(financeId: string): Promise<any> {
    const response = await apiClient.delete(`/finance/${financeId}`);
    return response.data;
  },

  // Finance/Superuser general billing actions
  async getFinanceMe(): Promise<FinanceUser> {
    const response = await apiClient.get('/finance/me');
    return response.data;
  },

  async updateFinanceMe(data: any): Promise<FinanceUser> {
    const response = await apiClient.put('/finance/me', data);
    return response.data;
  },

  async getFinanceDashboard(): Promise<any> {
    const response = await apiClient.get('/finance/dashboard');
    return response.data;
  },

  async getFinanceCustomers(): Promise<any[]> {
    const response = await apiClient.get('/finance/customers');
    return response.data;
  },

  async getFinanceCompanies(): Promise<any[]> {
    const response = await apiClient.get('/finance/companies');
    return response.data;
  },

  async getFinanceInvoices(params?: { status?: string }): Promise<any[]> {
    const response = await apiClient.get('/invoices/', { params });
    return response.data;
  },

  async payInvoice(invoiceId: string): Promise<any> {
    const response = await apiClient.post(`/invoices/${invoiceId}/pay`);
    return response.data;
  },

  async voidInvoice(invoiceId: string, reason: string): Promise<any> {
    const response = await apiClient.post(`/invoices/${invoiceId}/void`, { reason });
    return response.data;
  },

  async downloadInvoicePdf(invoiceId: string): Promise<any> {
    const response = await apiClient.get(`/invoices/${invoiceId}/pdf`);
    return response.data;
  },

  async emailInvoice(invoiceId: string): Promise<any> {
    const response = await apiClient.post(`/invoices/${invoiceId}/email`);
    return response.data;
  },

  async createInvoice(data: any): Promise<any> {
    const response = await apiClient.post('/invoices/', data);
    return response.data;
  },

  async getFinancePayments(): Promise<any[]> {
    const response = await apiClient.get('/finance/payments');
    return response.data;
  },

  async getFinanceSubscriptions(): Promise<any[]> {
    const response = await apiClient.get('/finance/subscriptions');
    return response.data;
  },

  async upgradeCustomerSubscription(userId: string, data: any): Promise<any> {
    const response = await apiClient.post(`/finance/customers/${userId}/upgrade`, data);
    return response.data;
  },

  async suspendCustomerSubscription(userId: string): Promise<any> {
    const response = await apiClient.post(`/finance/customers/${userId}/suspend`);
    return response.data;
  },

  async resumeCustomerSubscription(userId: string): Promise<any> {
    const response = await apiClient.post(`/finance/customers/${userId}/resume`);
    return response.data;
  },

  async getSeatBillingQueue(): Promise<any[]> {
    const response = await apiClient.get('/finance/seat-billing');
    return response.data;
  },

  async calculateSeatCharges(companyId: string): Promise<any> {
    const response = await apiClient.post(`/finance/seat-billing/${companyId}/calculate`);
    return response.data;
  },

  async generateSeatUpgradeInvoice(companyId: string): Promise<any> {
    const response = await apiClient.post(`/finance/seat-billing/${companyId}/invoice`);
    return response.data;
  },

  async approveSeatBilling(companyId: string, verification: any): Promise<any> {
    const response = await apiClient.post(`/finance/seat-billing/${companyId}/approve`, verification);
    return response.data;
  },

  async rejectSeatBilling(companyId: string): Promise<any> {
    const response = await apiClient.post(`/finance/seat-billing/${companyId}/reject`);
    return response.data;
  },

  async getFinanceRefunds(): Promise<any[]> {
    const response = await apiClient.get('/finance/refunds');
    return response.data;
  },

  async requestRefund(data: any): Promise<any> {
    const response = await apiClient.post('/finance/refunds', data);
    return response.data;
  },

  async approveRefund(refundId: string): Promise<any> {
    const response = await apiClient.post(`/finance/refunds/${refundId}/approve`);
    return response.data;
  },

  async rejectRefund(refundId: string): Promise<any> {
    const response = await apiClient.post(`/finance/refunds/${refundId}/reject`);
    return response.data;
  },

  async getFinanceReports(): Promise<any> {
    const response = await apiClient.get('/finance/reports');
    return response.data;
  },

  async getFinanceAuditLogs(): Promise<any[]> {
    const response = await apiClient.get('/finance/audit');
    return response.data;
  }
};
