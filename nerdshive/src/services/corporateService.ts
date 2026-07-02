import { apiClient } from '@/lib/apiClient';

export interface Company {
  id: string;
  company_name: string;
  company_email: string;
  company_website?: string;
  industry_type?: string;
  gst_number?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  status: string;
  seats_requested: number;
  max_employee_capacity: number;
  created_at: string;
  documents?: any[];
  company_registration_doc_url?: string;
  gst_cert_doc_url?: string;
  auth_signatory_id_url?: string;
  biometric_status?: string;
  biometric_required?: boolean;
  biometric_requested?: boolean;
  seat_upgrade_invoice_status?: string;
  seat_upgrade_invoice_number?: string;
  seat_upgrade_invoice_payment_status?: string;
  seat_upgrade_invoice_status_str?: string;
  seat_upgrade_invoice_is_voided?: boolean;
  allow_future_seat_requests?: boolean;
  seat_allocation_permission_requested?: boolean;
  updated_at?: string;
  admins?: {
    id?: string;
    full_name?: string;
    email?: string;
    mobile?: string;
  }[];
}

export interface DashboardStats {
  total_employees: number;
  active_employees: number;
  checked_in_today: number;
  seats_requested: number;
  seats_available: number;
  pending_requests: number;
  max_employee_capacity: number;
  biometric_status: string;
}

export const corporateService = {
  // Superuser Endpoints
  getCompanies: async () => {
    const response = await apiClient.get('/companies');
    return response.data;
  },

  approveCompany: async (id: string) => {
    const response = await apiClient.put(`/companies/${id}/approve`);
    return response.data;
  },

  rejectCompany: async (id: string) => {
    const response = await apiClient.put(`/companies/${id}/reject`);
    return response.data;
  },

  approveSeatsUpgrade: async (id: string) => {
    const response = await apiClient.put(`/companies/${id}/approve-seats`);
    return response.data;
  },

  rejectSeatsUpgrade: async (id: string) => {
    const response = await apiClient.put(`/companies/${id}/reject-seats`);
    return response.data;
  },

  approveSeatPermission: async (id: string) => {
    const response = await apiClient.put(`/companies/${id}/approve-seat-permission`);
    return response.data;
  },

  rejectSeatPermission: async (id: string) => {
    const response = await apiClient.put(`/companies/${id}/reject-seat-permission`);
    return response.data;
  },

  // Corporate Admin Endpoints
  getDashboardStats: async () => {
    const response = await apiClient.get('/company-admin/dashboard');
    return response.data as DashboardStats;
  },

  getEmployees: async () => {
    const response = await apiClient.get('/company-admin/employees');
    return response.data;
  },

  toggleEmployeeStatus: async (id: string, is_active: boolean) => {
    const response = await apiClient.put(`/company-admin/employees/${id}`, { is_active });
    return response.data;
  },

  getEmployee: async (id: string) => {
    const response = await apiClient.get(`/company-admin/employees/${id}`);
    return response.data;
  },

  addEmployee: async (data: any) => {
    const response = await apiClient.post('/company-admin/employees', data);
    return response.data;
  },

  updateEmployee: async (id: string, data: any) => {
    const response = await apiClient.put(`/company-admin/employees/${id}`, data);
    return response.data;
  },

  deleteEmployee: async (id: string) => {
    const response = await apiClient.delete(`/company-admin/employees/${id}`);
    return response.data;
  },

  getAttendance: async (date?: string, force?: boolean) => {
    let url = '/company-admin/attendance';
    const params: string[] = [];
    if (date) params.push(`date=${date}`);
    if (force) params.push(`force=true`);
    if (params.length > 0) {
      url += `?${params.join('&')}`;
    }
    const response = await apiClient.get(url);
    const data = response.data;
    if (Array.isArray(data) && response.headers) {
      const warning = response.headers['x-biometric-warning'] || response.headers['X-Biometric-Warning'];
      if (warning) {
        (data as any).warning = warning;
      }
    }
    return data;
  },

  getCompanyInfo: async () => {
    const response = await apiClient.get('/company-admin/my-company');
    return response.data;
  },

  updateCompanyInfo: async (data: any) => {
    const response = await apiClient.put('/company-admin/my-company', data);
    return response.data;
  },

  requestSeatPermission: async () => {
    const response = await apiClient.post('/company-admin/request-seat-permission');
    return response.data;
  },

  approveBiometricRequest: async (id: string) => {
    const response = await apiClient.put(`/companies/${id}/biometric-approve`);
    return response.data;
  },

  rejectBiometricRequest: async (id: string) => {
    const response = await apiClient.put(`/companies/${id}/biometric-reject`);
    return response.data;
  },

  disableBiometric: async (id: string) => {
    const response = await apiClient.put(`/companies/${id}/biometric-disable`);
    return response.data;
  },

  deleteCompany: async (id: string) => {
    const response = await apiClient.delete(`/companies/${id}`);
    return response.data;
  },

  suspendCompany: async (id: string) => {
    const response = await apiClient.put(`/companies/${id}/suspend`);
    return response.data;
  },

  activateCompany: async (id: string) => {
    const response = await apiClient.put(`/companies/${id}/activate`);
    return response.data;
  }
};
