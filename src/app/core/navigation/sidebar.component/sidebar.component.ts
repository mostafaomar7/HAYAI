import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { MENU_ITEMS } from '../menu.config';
import { UserRole } from '../../models/role.type';
import { TPipe } from '../../i18n/t.pipe';
import { LayoutService } from '../../layouts/layout.service';
import { WebsiteContextService } from '../../services/website/website-context.service';

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
  private website = inject(WebsiteContextService);
  currentUser = this.auth.currentUser;

  openDropdownId: string | null = null;

  constructor() {
    this.website.load().subscribe();
  }

  menuItems = computed(() => {
    // `admin` is the only user_type the backend lets through `/admin/*`;
    // anything else would 403 behind every link, so show no menu at all.
    const role = this.currentUser()?.user_type;
    if (role !== 'admin') return [];
    // Website CMS entries are gated on granular permissions from `/admin/website/me`.
    // Until that answers, `can()` is false for all of them, so they appear once
    // it does rather than flashing in and then disappearing.
    return MENU_ITEMS.filter(item => item.roles.includes(role satisfies UserRole))
      .filter(item => this.website.can(item.permission))
      .map(item => item.children
        ? { ...item, children: item.children.filter(c => this.website.can(c.permission)) }
        : item)
      .filter(item => !item.hasDropdown || (item.children?.length ?? 0) > 0);
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
