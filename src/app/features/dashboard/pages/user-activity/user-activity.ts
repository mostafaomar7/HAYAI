import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ActivityDirection,
  ActivityIdType,
  ActivityMeta,
  ActivityQuery,
  ActivityRow,
  ActivityService,
  ActivitySummary,
  ActivityTypeOption
} from '../../../../core/services/activity.service';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { TPipe } from '../../../../core/i18n/t.pipe';
import { PaginationComponent } from '../../../../shared/ui/pagination.component/pagination.component';

@Component({
  selector: 'app-user-activity',
  standalone: true,
  imports: [CommonModule, TPipe, PaginationComponent],
  templateUrl: './user-activity.html',
  styleUrl: './user-activity.css'
})
export class UserActivity {
  private route = inject(ActivatedRoute);
  private location = inject(Location);
  private svc = inject(ActivityService);
  private i18n = inject(I18nService);

  private id = 0;
  /**
   * Absent means the path id is a user id. Provider lists hand us an
   * organization / facility / doctor id instead, and the endpoint has to be
   * told which — a wrong value is a 422, not a silent empty list.
   */
  private idType: ActivityIdType | undefined;

  loading = signal(true);
  errorMessage = signal<string | null>(null);

  rows = signal<ActivityRow[]>([]);
  meta = signal<ActivityMeta | null>(null);
  summary = signal<ActivitySummary | null>(null);

  readonly perPage = 20;
  page = signal(1);
  total = signal(0);

  // ---- filters ----
  selectedTypes = signal<string[]>([]);
  direction = signal<ActivityDirection | ''>('');
  status = signal('');
  from = signal('');
  to = signal('');

  activeFilterCount = computed(() =>
    this.selectedTypes().length +
    (this.direction() ? 1 : 0) +
    (this.status() ? 1 : 0) +
    (this.from() ? 1 : 0) +
    (this.to() ? 1 : 0)
  );

  /**
   * The chips come from `meta.available_types`, which differs per account — a
   * patient has no incoming rows at all. Grouping by direction keeps "what they
   * did" and "what was sent to them" from reading as one flat list.
   */
  outgoingTypes = computed(() => this.typesByDirection('outgoing'));
  incomingTypes = computed(() => this.typesByDirection('incoming'));

  private typesByDirection(dir: ActivityDirection): ActivityTypeOption[] {
    return (this.meta()?.available_types ?? []).filter(t => t.direction === dir);
  }

  /** `by_status` is an object; the template needs it as rows. */
  statusCounts = computed(() => Object.entries(this.summary()?.by_status ?? {}));

  constructor() {
    this.id = Number(this.route.snapshot.paramMap.get('id') ?? 0);
    const type = this.route.snapshot.queryParamMap.get('id_type');
    this.idType = this.isIdType(type) ? type : undefined;
    this.load();
    this.loadSummary();
  }

  private isIdType(value: string | null): value is ActivityIdType {
    return value === 'user' || value === 'organization' || value === 'facility' || value === 'doctor';
  }

  private query(withPaging: boolean): ActivityQuery {
    return {
      ...(withPaging ? { page: this.page(), per_page: this.perPage } : {}),
      type: this.selectedTypes(),
      direction: this.direction() || undefined,
      status: this.status() || undefined,
      from: this.from() || undefined,
      to: this.to() || undefined,
      id_type: this.idType
    };
  }

  load() {
    this.loading.set(true);
    this.errorMessage.set(null);
    this.svc.list(this.id, this.query(true)).subscribe({
      next: r => {
        this.rows.set(r.items);
        if (r.meta) {
          this.meta.set(r.meta);
          this.total.set(r.meta.pagination?.total ?? r.items.length);
        }
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.rows.set([]);
        // 404 = no account owns that id, 422 = wrong `id_type`. Both name the
        // reason in `message`, which is more use than a generic failure.
        this.errorMessage.set(err.error?.message ?? 'dialog.try_again');
      }
    });
  }

  /** The counters answer the same question as the list, so they take the same filters. */
  private loadSummary() {
    this.svc.summary(this.id, this.query(false)).subscribe({
      next: s => this.summary.set(s),
      error: () => this.summary.set(null)
    });
  }

  private reload() {
    this.page.set(1);
    this.load();
    this.loadSummary();
  }

  goToPage(page: number) { this.page.set(page); this.load(); }

  toggleType(type: string) {
    this.selectedTypes.update(list =>
      list.includes(type) ? list.filter(t => t !== type) : [...list, type]
    );
    this.reload();
  }

  setDirection(next: ActivityDirection | '') {
    if (this.direction() === next) return;
    this.direction.set(next);
    // A type chip from the other direction would now match nothing.
    this.selectedTypes.update(list => {
      if (!next) return list;
      const allowed = new Set(this.typesByDirection(next).map(t => t.type));
      return list.filter(t => allowed.has(t));
    });
    this.reload();
  }

  setStatus(next: string) { this.status.set(next); this.reload(); }
  setFrom(value: string) { this.from.set(value); this.reload(); }
  setTo(value: string) { this.to.set(value); this.reload(); }

  resetFilters() {
    this.selectedTypes.set([]);
    this.direction.set('');
    this.status.set('');
    this.from.set('');
    this.to.set('');
    this.reload();
  }

  goBack() { this.location.back(); }

  /** `title` is often null — fall back to the kind plus the record's own id. */
  rowTitle(row: ActivityRow): string {
    return row.title?.trim() || `${row.label} #${row.id}`;
  }

  /**
   * `by_status` uses the literal key `none` for record types that carry no
   * status at all. Showing the word "none" would read as a status of its own.
   */
  statusLabel(status: string | null | undefined): string {
    return !status || status === 'none' ? '—' : status;
  }

  /**
   * Relative time in the active language. `happened_at` is ISO 8601 and may be
   * null, in which case there is nothing to render.
   */
  relativeTime(iso: string | null): string {
    if (!iso) return '';
    const then = Date.parse(iso);
    if (!Number.isFinite(then)) return '';

    const seconds = Math.round((then - Date.now()) / 1000);
    const units: [Intl.RelativeTimeFormatUnit, number][] = [
      ['year', 31536000], ['month', 2592000], ['week', 604800],
      ['day', 86400], ['hour', 3600], ['minute', 60]
    ];
    const fmt = new Intl.RelativeTimeFormat(this.i18n.lang(), { numeric: 'auto' });
    for (const [unit, size] of units) {
      if (Math.abs(seconds) >= size) return fmt.format(Math.round(seconds / size), unit);
    }
    return fmt.format(Math.round(seconds), 'second');
  }

  /** Absolute timestamp for the row's tooltip — relative time alone loses the date. */
  absoluteTime(iso: string | null): string {
    if (!iso) return '';
    const parsed = new Date(iso);
    return Number.isNaN(parsed.getTime()) ? '' : parsed.toLocaleString(this.i18n.lang());
  }
}
