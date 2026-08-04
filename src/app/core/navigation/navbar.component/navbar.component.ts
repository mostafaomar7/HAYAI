import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ActivatedRouteSnapshot, NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { NotificationsService, NotificationCategory, SystemNotification } from '../../services/notifications.service';
import { I18nService } from '../../i18n/i18n.service';
import { TPipe } from '../../i18n/t.pipe';
import { LayoutService } from '../../layouts/layout.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, TPipe],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.css'
})
export class NavbarComponent {
  private auth = inject(AuthService);
  private notifs = inject(NotificationsService);
  private router = inject(Router);
  i18n = inject(I18nService);
  layout = inject(LayoutService);

  /** i18n key of the page being viewed — see `data.title` in the route table. */
  pageTitle = signal('navbar.title');

  user = this.auth.currentUser;
  userName = computed(() => this.user()?.name ?? 'Admin');
  userEmail = computed(() => this.user()?.email ?? '');
  userAvatar = computed(() => this.user()?.profile_image ?? 'assets/avatar.png');

  isNotificationOpen = false;
  isUserMenuOpen = false;
  activeTab: NotificationCategory = 'userActivity';

  notifications = signal<SystemNotification[]>([]);
  unreadTotal = signal(0);
  loadingFeed = signal(false);

  constructor() {
    this.refreshUnreadCount();

    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd), takeUntilDestroyed())
      .subscribe(() => this.pageTitle.set(this.resolveTitle()));
    // The first NavigationEnd fires before this component exists.
    this.pageTitle.set(this.resolveTitle());
  }

  /**
   * Walks the router's snapshot tree and takes the deepest `title`, so a child
   * route overrides its parent and anything without one inherits.
   *
   * This reads `routerState.snapshot`, not the injected `ActivatedRoute`. The
   * navbar is constructed while the shell is being activated, and at that point
   * `ActivatedRoute.snapshot` is still undefined on any route below the one
   * being activated — walking those threw and killed the whole navigation.
   */
  private resolveTitle(): string {
    let node: ActivatedRouteSnapshot | null = this.router.routerState.snapshot.root;
    let title = 'navbar.title';
    while (node) {
      const routeTitle = node.data?.['title'];
      if (typeof routeTitle === 'string' && routeTitle) title = routeTitle;
      node = node.firstChild;
    }
    return title;
  }

  refreshUnreadCount() {
    this.notifs.unreadCount().subscribe({
      next: c => this.unreadTotal.set(c.total),
      error: () => {}
    });
  }

  toggleNotifications() {
    this.isNotificationOpen = !this.isNotificationOpen;
    if (this.isNotificationOpen) this.loadFeed();
  }

  setActiveTab(tab: NotificationCategory) {
    this.activeTab = tab;
    this.loadFeed();
  }

  loadFeed() {
    this.loadingFeed.set(true);
    this.notifs.list({ category: this.activeTab }).subscribe({
      next: r => { this.notifications.set(r.items); this.loadingFeed.set(false); },
      error: () => this.loadingFeed.set(false)
    });
  }

  markRead(notif: SystemNotification) {
    if (!notif.unread) {
      if (notif.link) this.router.navigateByUrl(notif.link);
      return;
    }
    this.notifs.markRead(notif.id).subscribe(() => {
      this.notifications.update(list =>
        list.map(n => (n.id === notif.id ? { ...n, unread: false } : n))
      );
      this.refreshUnreadCount();
      if (notif.link) this.router.navigateByUrl(notif.link);
    });
  }

  markAllRead() {
    this.notifs.markAllRead(this.activeTab).subscribe(() => {
      this.loadFeed();
      this.refreshUnreadCount();
    });
  }

  toggleUserMenu() {
    this.isUserMenuOpen = !this.isUserMenuOpen;
    if (this.isUserMenuOpen) this.isNotificationOpen = false;
  }

  goToProfile() {
    this.isUserMenuOpen = false;
    this.router.navigate(['/dashboard/profile']);
  }

  goToChangePassword() {
    this.isUserMenuOpen = false;
    this.router.navigate(['/dashboard/change-password']);
  }

  logout() {
    this.isUserMenuOpen = false;
    this.auth.logout().subscribe({
      next: () => this.router.navigate(['/login']),
      error: () => this.router.navigate(['/login'])
    });
  }
}
