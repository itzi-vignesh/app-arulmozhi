import { apiClient } from '@/lib/apiClient';

export interface Invoice {
  id: string;
  company_id: string;
  plan_name: string;
  billing_type: string;
  price_per_seat: number;
  seats: number;
  subtotal: number;
  gst_rate: number;
  gst_amount: number;
  total_amount: number;
  invoice_date: string;
  status: 'unpaid' | 'paid';
  created_at: string;
  invoice_number?: string;
  company_name?: string;
  company_gst_number?: string;
  billing_start_date?: string;
  billing_end_date?: string;
  due_date?: string;
  payment_date?: string;
  invoice_status?: string;
  voided_by?: string;
  voided_at?: string;
  void_reason?: string;
}

export const invoiceService = {
  getCompanyInvoices: async (companyId: string): Promise<Invoice[]> => {
    const response = await apiClient.get(`/invoices/company/${companyId}`);
    return response.data;
  },

  payInvoice: async (invoiceId: string): Promise<Invoice> => {
    const response = await apiClient.post(`/invoices/${invoiceId}/pay`);
    return response.data;
  },

  getSuperuserBillingOverview: async (): Promise<any[]> => {
    const response = await apiClient.get('/invoices/superuser/billing');
    return response.data;
  },

  suspendSubscription: async (companyId: string): Promise<any> => {
    const response = await apiClient.post(`/invoices/company/${companyId}/suspend`);
    return response.data;
  },

  reactivateSubscription: async (companyId: string): Promise<any> => {
    const response = await apiClient.post(`/invoices/company/${companyId}/reactivate`);
    return response.data;
  }
};
