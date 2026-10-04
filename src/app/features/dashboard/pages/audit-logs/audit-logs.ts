import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AuditLogEntry,
  AuditLogsService
} from '../../../../core/services/audit-logs.service';
import { TPipe } from '../../../../core/i18n/t.pipe';
import { PaginationComponent } from '../../../../shared/ui/pagination.component/pagination.component';
import { debounce } from '../../../../shared/utils/debounce.util';

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

/**
 * The admin audit trail. Read-only: there is no action on a row, because a log
 * an admin can edit is not a log.
 */
@Component({
  selector: 'app-audit-logs',
  standalone: true,
  imports: [CommonModule, TPipe, PaginationComponent],
  templateUrl: './audit-logs.html',
  styleUrl: './audit-logs.css'
})
export class AuditLogs {
  private svc = inject(AuditLogsService);

  readonly methods = METHODS;
  readonly perPage = 25;

  loading = signal(true);
  loadError = signal<string | null>(null);
  rows = signal<AuditLogEntry[]>([]);
  total = signal(0);
  page = signal(1);

  pathFilter = signal('');
  methodFilter = signal('');
  fromFilter = signal('');
  toFilter = signal('');

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.svc
      .list({
        page: this.page(),
        per_page: this.perPage,
        path: this.pathFilter() || undefined,
        method: this.methodFilter() || undefined,
        from: this.fromFilter() || undefined,
        to: this.toFilter() || undefined
      })
      .subscribe({
        next: r => {
          this.rows.set(r.items);
          this.total.set(r.pagination?.total ?? r.items.length);
          this.loading.set(false);
        },
        error: () => { this.loadError.set('audit.load_failed'); this.loading.set(false); }
      });
  }

  onPath = debounce((value: string) => {
    this.pathFilter.set(value);
    this.page.set(1);
    this.load();
  }, 350);

  setMethod(value: string): void {
    this.methodFilter.set(value);
    this.page.set(1);
    this.load();
  }

  setFrom(value: string): void { this.fromFilter.set(value); this.page.set(1); this.load(); }
  setTo(value: string): void { this.toFilter.set(value); this.page.set(1); this.load(); }

  clearFilters(): void {
    this.pathFilter.set('');
    this.methodFilter.set('');
    this.fromFilter.set('');
    this.toFilter.set('');
    this.page.set(1);
    this.load();
  }

  hasFilters(): boolean {
    return !!(this.pathFilter() || this.methodFilter() || this.fromFilter() || this.toFilter());
  }

  goToPage(page: number): void {
    this.page.set(page);
    this.load();
  }

  /** 4xx and 5xx are attempts that were refused — worth seeing at a glance. */
  isRefused(row: AuditLogEntry): boolean {
    return row.status >= 400;
  }

  /** The `/api/v1` prefix is on every row and carries no information. */
  shortPath(row: AuditLogEntry): string {
    return (row.path || '').replace(/^\/?api\/v1\/?/, '/');
  }
}
