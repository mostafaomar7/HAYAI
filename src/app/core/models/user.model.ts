/** Mirrors the `users.user_type` enum on the backend. */
export type UserType =
  | 'admin'
  | 'patient'
  | 'tourist'
  | 'doctor'
  | 'hospital'
  | 'clinic'
  | 'pharmacies'
  | 'labs_radiology'
  | 'medical_insurance'
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
