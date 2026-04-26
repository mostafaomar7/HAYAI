import { UserRole } from './role.type';

export interface UserModel {
    id: string;
    name: string;
    email: string;
    role: UserRole;
}