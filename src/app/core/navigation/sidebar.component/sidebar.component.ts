import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { MENU_ITEMS } from '../menu.config';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SidebarComponent {
    // private auth = inject(AuthService);

  // currentUser = this.auth.currentUser;

  // menuItems = computed(() => {
  //   const role = this.currentUser()?.role;
  //   if (!role) return [];
  //   return MENU_ITEMS.filter(item => item.roles.includes(role));
  // });
  private auth = inject(AuthService);
  currentUser = this.auth.currentUser;

  // المتغير اللي بيحفظ القائمة المفتوحة حالياً
  openDropdownId: string | null = null;

  menuItems = computed(() => {
    const role = 'admin'; 
    return MENU_ITEMS.filter(item => item.roles.includes(role));
  });

  // الدالة دي بتشتغل لما تدوس على أي عنصر
  toggleMenu(item: any, event: Event) {
    if (item.hasDropdown) {
      event.preventDefault(); // بيمنع إنه يغير اللينك
      // لو القائمة دي مفتوحة اقفلها، لو مقفولة افتحها واقفل الباقي
      this.openDropdownId = this.openDropdownId === item.id ? null : item.id;
    }
  }
}