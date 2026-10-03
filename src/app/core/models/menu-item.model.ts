import { UserRole } from './role.type';

export interface MenuChild {
  id: string;
  label: string;
  route: string;
  /**
   * Website CMS permission this entry needs (e.g. `leads.view`). Website
   * access is granular per admin, so an entry the admin cannot open is hidden
   * rather than left to 403. Entries without one are always shown.
   */
  permission?: string;
}

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
    children?: MenuChild[];
  /** Same as `MenuChild.permission`, for a top-level entry. */
  permission?: string;
}
