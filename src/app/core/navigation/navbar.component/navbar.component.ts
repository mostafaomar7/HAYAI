import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { NotificationsService, NotificationCategory, SystemNotification } from '../../services/notifications.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.css'
})
export class NavbarComponent {
  private auth = inject(AuthService);
  private notifs = inject(NotificationsService);
  private router = inject(Router);

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
