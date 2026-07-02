// src/types/api.ts

export interface AuthUser {
  id: string;
  email: string;
  is_active: boolean;
  created_at: string;
}

export interface User {
  id: string;
  auth_id: string;
  email: string;
  full_name: string;
  mobile: string;
  gender?: string;
  date_of_birth?: string;
  emergency_contact_name?: string;
  emergency_contact_number: string;
  org_name: string;
  department?: string;
  designation?: string;
  employee_id?: string;
  joining_date?: string;
  duration?: string;
  govt_id_type: string;
  govt_id_number: string;
  requires_parking: boolean;
  vehicle_type?: string;
  vehicle_brand_model?: string;
  vehicle_color?: string;
  vehicle_registration?: string;
  enrollment_source: string;
  customer_id?: string;
  customer_photo_url?: string;
  is_approved: boolean;
  is_active: boolean;
  status?: string;
  created_at: string;
  updated_at: string;
  city?: string;
  location?: string;
  occupation?: string;
  govt_id_copy_url?: string;
  reimbursement?: boolean;
  gst_number?: string;
  org_location?: string;
}

export interface Admin {
  id: string;
  auth_id: string;
  full_name?: string;
  email?: string;
  mobile?: string;
  city?: string;
  location?: string;
  occupation?: string;
  created_at: string;
}

export interface Plan {
  id: string;
  user_id: string;
  plan_type: string;
  amount: number;
  start_date: string;
  end_date: string;
  is_active: boolean;
  payment_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface Checkin {
  id: string;
  user_id: string;
  plan_id: string;
  checkin_time?: string;
  checkout_time?: string;
  status: string;
  checkin_approved: boolean;
  checkin_approved_by?: string;
  checkin_approved_at?: string;
  payment_status: string;
  payment_rejection_date?: string;
  expired: boolean;
  created_at: string;
  updated_at: string;
  user?: User;
  plan?: Plan;
}

export interface Pricing {
  id: string;
  plan_type: string;
  amount: number;
  gst_rate: number;
  updated_by?: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  data?: any;
  created_at: string;
}

export interface UsageLog {
  id: string;
  user_id?: string;
  details?: any;
  created_at: string;
}

export interface QueryLog {
  id: string;
  user_id?: string;
  message: string;
  response?: string;
  status: string;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  action: string;
  performed_by?: string;
  performed_by_name?: string;
  performed_by_role?: string;
  target_user_id?: string;
  target_user_name?: string;
  target_user_email?: string;
  details?: any;
  created_at: string;
}

export interface DashboardStats {
  total_users: number;
  active_plans: number;
  pending_checkins: number;
}
