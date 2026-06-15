import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LayoutService {
  readonly sidebarOpen = signal(false);

  toggleSidebar() {
    this.sidebarOpen.update(v => !v);
  }

  openSidebar() {
    this.sidebarOpen.set(true);
  }

  closeSidebar() {
    this.sidebarOpen.set(false);
  }
}
