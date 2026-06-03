export type UserType =
  | 'admin'
  | 'manager'
  | 'patient'
  | 'tourist'
  | 'doctor'
  | 'hospital'
  | 'clinic'
  | 'pharmacy'
  | 'lab'
  | 'medical_issuance'
  | 'home_care'
  | 'physical_therapy'
  | 'employment_office'
  | 'medical_devices';

export interface UserModel {
  id: number;
  name: string;
  username: string | null;
  email: string;
  phone: string | null;
  country_code: string | null;
  user_type: UserType;
  profile_image: string | null;
  profile_complete: boolean;
  last_login_at: string | null;
}

export interface LoginRequest {
  identifier: string;
  password: string;
}

export interface LoginResponse {
  user: UserModel;
  token: string;
}
