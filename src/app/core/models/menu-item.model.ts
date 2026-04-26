import { UserRole } from './role.type';

export interface MenuItem {
   id: string;
  label: string;
  route: string;
  
  // الخاصية القديمة (ممكن نخليها اختياري لو لسه بتستخدمها في مكان تاني)
  icon?: string; 
  
  // الخصائص الجديدة اللي ضفناها
  iconName?: string; 
  hasDropdown?: boolean;
    roles: UserRole[];
    children?: { id: string; label: string; route: string; }[];
} 