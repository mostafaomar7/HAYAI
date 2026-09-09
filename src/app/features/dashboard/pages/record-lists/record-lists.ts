import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  RECORD_LISTS,
  RecordColumn,
  RecordListConfig,
  RecordListKey,
  RecordListsService,
  RecordRow
} from '../../../../core/services/record-lists.service';
import { TPipe } from '../../../../core/i18n/t.pipe';
import { PaginationComponent } from '../../../../shared/ui/pagination.component/pagination.component';
import { debounce } from '../../../../shared/utils/debounce.util';

/** One entry of the status dropdown: the machine value plus what to show. */
interface StatusOption {
  value: string;
  label: string;
}

/**
 * The six record lists, on one screen driven by `RECORD_LISTS`.
 *
 * Nothing here knows what a pharmacy order or a job application is — the config
 * names the columns and the paths, and a row opens on the unified record screen.
 * Adding a seventh list is a config entry, not a component.
 */
@Component({
  selector: 'app-record-lists',
  standalone: true,
  imports: [CommonModule, TPipe, PaginationComponent],
  templateUrl: './record-lists.html',
  styleUrl: './record-lists.css'
})
export class RecordLists {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private svc = inject(RecordListsService);

  config = signal<RecordListConfig>(RECORD_LISTS['pharmacy-orders']);

  loading = signal(true);
  loadError = signal<string | null>(null);
  rows = signal<RecordRow[]>([]);
  total = signal(0);
  readonly perPage = 25;
  page = signal(1);
  search = signal('');
  statusFilter = signal('');

  /**
   * Built from the statuses that have actually come back, because the set
   * differs per list and no endpoint publishes it. It accumulates across pages
   * rather than resetting, so filtering never drops an option that was on offer
   * a moment ago. A status that has not appeared yet is not listed — which is
   * the honest state of what this screen knows.
   */
  private seenStatuses = signal<Record<string, string>>({});
  statusOptions = computed<StatusOption[]>(() =>
    Object.entries(this.seenStatuses()).map(([value, label]) => ({ value, label })));

  /** Filtering by account, when the list is reached from someone's timeline. */
  userId = signal<number | null>(null);

  constructor() {
    // One component serves all six routes, so the key has to be watched rather
    // than read once — Angular reuses the instance between them. It rides in
    // route `data`, the same way the option lists carry theirs, so each list
    // can also name the navbar title.
    this.route.data.pipe(takeUntilDestroyed()).subscribe(data => {
      const key = data['listKey'] as RecordListKey | undefined;
      const config = key ? RECORD_LISTS[key] : undefined;
      if (!config) { this.loadError.set('records.unknown_list'); this.loading.set(false); return; }
      // A different list has different columns and different statuses, so none
      // of the previous list's state carries over.
      this.config.set(config);
      this.page.set(1);
      this.search.set('');
      this.statusFilter.set('');
      this.seenStatuses.set({});
      this.rows.set([]);
      this.load();
    });

    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe(q => {
      const raw = q.get('user_id');
      const id = raw ? Number(raw) : null;
      if (id === this.userId()) return;
      this.userId.set(Number.isFinite(id as number) ? id : null);
      this.page.set(1);
      this.load();
    });
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.svc
      .list(this.config(), {
        page: this.page(),
        per_page: this.perPage,
        search: this.search() || undefined,
        status: this.statusFilter() || undefined,
        user_id: this.userId() ?? undefined
      })
      .subscribe({
        next: r => {
          this.rows.set(r.items);
          this.total.set(r.pagination?.total ?? r.items.length);
          this.rememberStatuses(r.items);
          this.loading.set(false);
        },
        error: () => { this.loadError.set('records.load_failed'); this.loading.set(false); }
      });
  }

  private rememberStatuses(rows: RecordRow[]): void {
    const next = { ...this.seenStatuses() };
    let changed = false;
    for (const row of rows) {
      const value = row.status;
      if (!value || next[value]) continue;
      next[value] = row.status_label || value;
      changed = true;
    }
    if (changed) this.seenStatuses.set(next);
  }

  // ------------------------------------------------------------ cell reading

  /** Walks a dotted path; a missing hop is a missing value, not a crash. */
  private valueAt(row: RecordRow, path: string): unknown {
    return path.split('.').reduce<unknown>(
      (acc, part) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[part] : undefined),
      row
    );
  }

  /**
   * Formatting a cell is the one thing this screen does that the config cannot
   * express, so the kinds stay deliberately few. Dates keep the `date` pipe out
   * of the template because the value is `unknown` until it is read.
   */
  cell(row: RecordRow, col: RecordColumn): string {
    const v = this.valueAt(row, col.path);
    if (v === null || v === undefined || v === '') return '—';

    switch (col.kind) {
      case 'money': {
        const currency = col.currencyPath ? this.valueAt(row, col.currencyPath) : null;
        const n = Number(v);
        const amount = Number.isFinite(n) ? n.toFixed(2) : String(v);
        return currency ? `${amount} ${currency}` : amount;
      }
      case 'bool':
        return v === true ? '✓' : '—';
      case 'date':
        return String(v).slice(0, 10);
      case 'datetime': {
        const d = new Date(String(v));
        return isNaN(d.getTime()) ? String(v) : d.toLocaleString();
      }
      default:
        return String(v);
    }
  }

  /** Only the status column gets a pill; everything else is plain text. */
  isStatus(col: RecordColumn): boolean {
    return col.kind === 'status';
  }

  statusValue(row: RecordRow): string {
    return row.status ?? '';
  }

  // ---------------------------------------------------------------- actions

  onSearch = debounce((value: string) => {
    this.search.set(value);
    this.page.set(1);
    this.load();
  }, 350);

  setStatus(value: string): void {
    this.statusFilter.set(value);
    this.page.set(1);
    this.load();
  }

  clearUserFilter(): void {
    this.userId.set(null);
    this.page.set(1);
    this.router.navigate([], { relativeTo: this.route, queryParams: {} });
  }

  goToPage(page: number): void {
    this.page.set(page);
    this.load();
  }

  /** Every row has a detail view already — the unified record screen. */
  open(row: RecordRow): void {
    this.router.navigate(['/dashboard/activity', this.config().recordType, row.id]);
  }
}
