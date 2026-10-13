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

  /** Which rows have their before/after panel open. Ids, so paging resets it. */
  expanded = signal<ReadonlySet<number>>(new Set());

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
          this.expanded.set(new Set());
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

  /**
   * `role.updated` -> `Role updated`. These come from the API as dotted tokens
   * and there is no fixed list of them — 23 distinct values on one page alone —
   * so they are made readable rather than translated. A token we have not seen
   * still reads correctly instead of appearing as a key.
   */
  actionLabel(row: AuditLogEntry): string {
    const raw = row.action || '';
    if (!raw) return '';
    return raw
      .split('.')
      .join(' ')
      .replace(/[_-]+/g, ' ')
      .replace(/^./, c => c.toUpperCase());
  }

  /** `website_role#7`, or just the type when the row is not about one record. */
  entityLabel(row: AuditLogEntry): string {
    if (!row.entity_type) return '';
    const id = row.entity_id;
    return id === null || id === undefined ? row.entity_type : `${row.entity_type}#${id}`;
  }

  /** Does this row have anything to open? */
  hasChanges(row: AuditLogEntry): boolean {
    return this.changes(row).length > 0;
  }

  /**
   * Before and after, one line per field.
   *
   * The two objects do not always hold the same keys — a create has no
   * `old_values` at all — so the union is walked rather than either side, and
   * a field missing from one side is marked as such instead of printing an
   * empty string that would read as "it was blank".
   */
  changes(row: AuditLogEntry): ReadonlyArray<{ key: string; before: string | null; after: string | null; same: boolean }> {
    const before = row.old_values ?? {};
    const after = row.new_values ?? {};
    const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)])).sort();
    return keys.map(key => {
      const had = Object.prototype.hasOwnProperty.call(before, key);
      const has = Object.prototype.hasOwnProperty.call(after, key);
      const b = had ? formatValue(before[key]) : null;
      const a = has ? formatValue(after[key]) : null;
      return { key, before: b, after: a, same: had && has && b === a };
    });
  }

  toggle(row: AuditLogEntry): void {
    if (!this.hasChanges(row)) return;
    const next = new Set(this.expanded());
    if (!next.delete(row.id)) next.add(row.id);
    this.expanded.set(next);
  }

  isOpen(row: AuditLogEntry): boolean {
    return this.expanded().has(row.id);
  }
}

/**
 * A stored value as one readable line.
 *
 * Arrays are the common shape here — a role's permission list — and reading
 * one as `["cms.view","media.view"]` to spot that `media.view` was added is
 * harder than it needs to be. Objects are rare and are left as JSON rather
 * than invented a layout for.
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (Array.isArray(value)) return value.length ? value.map(v => formatValue(v)).join(', ') : '(empty)';
  if (typeof value === 'object') return JSON.stringify(value);
  const text = String(value);
  return text === '' ? '(empty)' : text;
}
