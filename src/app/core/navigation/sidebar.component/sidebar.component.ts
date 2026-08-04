import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { MENU_ITEMS } from '../menu.config';
import { UserRole } from '../../models/role.type';
import { TPipe } from '../../i18n/t.pipe';
import { LayoutService } from '../../layouts/layout.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, TPipe],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css',
  changeDetection: ChangeDetectionStrategy.Default
})
export class SidebarComponent {
  private auth = inject(AuthService);
  private layout = inject(LayoutService);
  currentUser = this.auth.currentUser;

  openDropdownId: string | null = null;

  menuItems = computed(() => {
    // `admin` is the only user_type the backend lets through `/admin/*`;
    // anything else would 403 behind every link, so show no menu at all.
    const role = this.currentUser()?.user_type;
    if (role !== 'admin') return [];
    return MENU_ITEMS.filter(item => item.roles.includes(role satisfies UserRole));
  });

  toggleMenu(item: any, event: Event) {
    if (item.hasDropdown) {
      event.preventDefault();
      this.openDropdownId = this.openDropdownId === item.id ? null : item.id;
    }
  }

  /** Called when a leaf link is clicked — auto-close the drawer on mobile. */
  onNavigate() {
    if (window.matchMedia('(max-width: 768px)').matches) {
      this.layout.closeSidebar();
    }
  }
}
