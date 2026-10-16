import { Component, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ActivatedRouteSnapshot, NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { Title } from '@angular/platform-browser';
import { AuthService } from '../../services/auth.service';
import {
  NotificationsService,
  NotificationCategory,
  SystemNotification,
  notificationTarget
} from '../../services/notifications.service';
import { I18nService } from '../../i18n/i18n.service';
import { TPipe } from '../../i18n/t.pipe';
import { LayoutService } from '../../layouts/layout.service';
import { PushService } from '../../services/push.service';
import { DialogService } from '../../services/dialog.service';

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
  private titleService = inject(Title);
  private dialog = inject(DialogService);
  push = inject(PushService);

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

    // Browser notifications: re-register where the admin already allowed
    // them (a rotated token has to reach the API), and while a dashboard tab
    // has focus Firebase hands the push here instead of showing it — so the
    // bell catches up and a toast says what arrived.
    void this.push.resume();
    this.push.foreground.pipe(takeUntilDestroyed()).subscribe(msg => {
      this.refreshUnreadCount();
      if (this.isNotificationOpen) this.loadFeed();
      if (msg.title) this.dialog.toast('info', msg.title);
    });

    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd), takeUntilDestroyed())
      .subscribe(() => this.applyTitle());
    // The first NavigationEnd fires before this component exists.
    this.applyTitle();

    // The heading is translated through the dictionary, which arrives after
    // the first navigation. Without this the tab would keep whatever the first
    // page resolved to before the words existed.
    effect(() => {
      this.i18n.lang();
      this.setDocumentTitle(this.pageTitle());
    });
  }

  /**
   * The page name goes to two places: the heading in the bar, and the browser
   * tab. The tab said "Hayai" on every page of the dashboard — the value baked
   * into index.html — because nothing ever wrote to it. It is what a person
   * reads to find the right window among eight, and what a bookmark is named
   * after.
   */
  private applyTitle(): void {
    const key = this.resolveTitle();
    this.pageTitle.set(key);
    this.setDocumentTitle(key);
  }

  private setDocumentTitle(key: string): void {
    const name = this.i18n.translate(key);
    // Before the dictionary lands `translate` answers with nothing, and an
    // empty tab is worse than a generic one.
    this.titleService.setTitle(name ? `${name} | HAYAI` : 'HAYAI');
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

  /** Null for a notification with nowhere to go — the row stays unclickable. */
  targetFor(notif: SystemNotification): string | null {
    return notificationTarget(notif.link, notif.data?.dashboard_path);
  }

  markRead(notif: SystemNotification) {
    const target = this.targetFor(notif);
    const go = () => {
      if (!target) return;
      // The panel is absolutely positioned inside the navbar, so it has to be
      // dismissed explicitly — a route change alone leaves it hanging open.
      this.isNotificationOpen = false;
      this.router.navigateByUrl(target);
    };

    if (!notif.unread) { go(); return; }
    this.notifs.markRead(notif.id).subscribe(() => {
      this.notifications.update(list =>
        list.map(n => (n.id === notif.id ? { ...n, unread: false } : n))
      );
      this.refreshUnreadCount();
      go();
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

  /**
   * "Turn on notifications". The browser only shows its permission prompt
   * for a click, which is why this is a button and not something done on
   * load. Once refused, only the browser's site settings can undo it.
   */
  async togglePush() {
    if (this.push.state() === 'blocked') {
      this.dialog.info('navbar.push.blocked_title', 'navbar.push.blocked_text');
      return;
    }
    const state = await this.push.enable();
    if (state === 'on') this.dialog.toast('success', 'navbar.push.enabled');
    else if (state === 'blocked') this.dialog.info('navbar.push.blocked_title', 'navbar.push.blocked_text');
    else if (state === 'off') this.dialog.toast('warning', 'navbar.push.failed');
  }

  async logout() {
    this.isUserMenuOpen = false;
    // Before the session ends: the API needs it to drop this browser's
    // token, or the next admin here would get this one's alerts.
    await this.push.unregister();
    this.auth.logout().subscribe({
      next: () => this.router.navigate(['/login']),
      error: () => this.router.navigate(['/login'])
    });
  }
}
