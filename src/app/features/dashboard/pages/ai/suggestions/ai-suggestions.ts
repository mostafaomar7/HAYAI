import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import {
  AiSuggestion,
  AiSuggestionModule,
  AiSuggestionsService,
  SuggestionRole
} from '../../../../../core/services/ai-suggestions.service';
import { AdminAccessService } from '../../../../../core/services/admin-access.service';
import { DialogService } from '../../../../../core/services/dialog.service';
import { TPipe } from '../../../../../core/i18n/t.pipe';
import { CanManageDirective } from '../../../../../shared/directives/can-manage.directive';

/** '' = both, '1' = active, '0' = switched off. */
type ActiveFilter = '' | '1' | '0';

/**
 * The questions the AI assistant offers in each app, one tab per app.
 *
 * The whole role is loaded at once (60 rows at most today): reorder has to send
 * every id of the role, so the screen never holds a partial list, and the
 * filters run on what is already here rather than asking the server again.
 *
 * Everything here is live in the apps, released builds included.
 */
@Component({
  selector: 'app-ai-suggestions',
  standalone: true,
  imports: [CommonModule, CanManageDirective, TPipe],
  templateUrl: './ai-suggestions.html',
  styleUrl: './ai-suggestions.css'
})
export class AiSuggestions {
  private svc = inject(AiSuggestionsService);
  private access = inject(AdminAccessService);
  private dialog = inject(DialogService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  readonly roles: SuggestionRole[] = ['patient', 'doctor'];

  role = signal<SuggestionRole>('patient');
  loading = signal(true);
  loadError = signal<string | null>(null);
  rows = signal<AiSuggestion[]>([]);
  modules = signal<AiSuggestionModule[]>([]);

  moduleFilter = signal('');
  activeFilter = signal<ActiveFilter>('');
  search = signal('');

  /** Ids whose active switch is being saved. */
  toggling = signal<ReadonlySet<number>>(new Set());

  canManage = computed(() => this.access.can('ai', 'manage'));
  filtered = computed(() => !!(this.moduleFilter() || this.activeFilter() || this.search().trim()));
  /** The server needs the complete list, so a filtered view cannot be reordered. */
  canReorder = computed(() => this.canManage() && !this.filtered() && this.rows().length > 1);

  visible = computed(() => {
    const mod = this.moduleFilter();
    const active = this.activeFilter();
    const term = this.search().trim().toLowerCase();
    return this.rows().filter(r =>
      (!mod || r.module_key === mod) &&
      (active === '' || r.is_active === (active === '1')) &&
      (!term || [r.title_en, r.title_ar, r.slug].some(v => (v ?? '').toLowerCase().includes(term)))
    );
  });

  activeCount = computed(() => this.rows().filter(r => r.is_active).length);

  constructor() {
    const asked = this.route.snapshot.queryParamMap.get('role');
    if (asked === 'doctor' || asked === 'patient') this.role.set(asked);
    // `?module=` opens the list on one assistant (from AI Assistants).
    const module = this.route.snapshot.queryParamMap.get('module');
    if (module) this.moduleFilter.set(module);
    this.load();
  }

  load(): void {
    const role = this.role();
    this.loading.set(true);
    this.loadError.set(null);
    this.svc.modules(role).subscribe({
      next: rows => { if (this.role() === role) this.modules.set(rows ?? []); },
      error: () => { if (this.role() === role) this.modules.set([]); }
    });
    this.svc.list(role).subscribe({
      next: rows => {
        if (this.role() !== role) return;
        this.rows.set(rows);
        this.committed = rows;
        this.loading.set(false);
      },
      error: () => {
        if (this.role() !== role) return;
        this.loadError.set('ai.suggestions.load_failed');
        this.loading.set(false);
      }
    });
  }

  setRole(role: SuggestionRole): void {
    if (this.role() === role) return;
    this.role.set(role);
    this.clearFilters();
    this.rows.set([]);
    this.modules.set([]);
    // The tab rides in the URL, so returning from the form lands on it.
    this.router.navigate([], { relativeTo: this.route, queryParams: { role }, replaceUrl: true });
    this.load();
  }

  clearFilters(): void {
    this.moduleFilter.set('');
    this.activeFilter.set('');
    this.search.set('');
  }

  // ------------------------------------------------------------ display

  /** The other language's title, for the hover text. */
  otherTitle(row: AiSuggestion): string {
    return row.title === row.title_en ? (row.title_ar ?? '') : row.title_en;
  }

  /** Who sees the assistant, when that is not simply this app's users. */
  audienceKey(m: AiSuggestionModule | undefined): string | null {
    if (!m) return null;
    if (!m.enabled) return 'ai.suggestions.badge.off';
    const types = [...(m.user_types ?? [])].sort().join(',');
    if (types === 'tourist') return 'ai.suggestions.badge.tourists';
    if (types === 'patient,tourist') return 'ai.suggestions.badge.both';
    return null;
  }

  moduleOf(row: AiSuggestion): AiSuggestionModule | undefined {
    return this.modules().find(m => m.key === row.module_key);
  }

  // ------------------------------------------------------------ navigation

  add(): void {
    this.router.navigate(['/dashboard/ai/suggestions/new'], { queryParams: { role: this.role() } });
  }

  edit(row: AiSuggestion): void {
    this.router.navigate(['/dashboard/ai/suggestions', row.id, 'edit'], { queryParams: { role: this.role() } });
  }

  // ------------------------------------------------------------ active switch

  /** Saves on the click; the row flips at once and flips back if the save fails. */
  toggleActive(row: AiSuggestion, event: Event): void {
    event.stopPropagation();
    if (!this.canManage() || this.toggling().has(row.id)) return;
    const next = !row.is_active;
    this.patchRow(row.id, { is_active: next });
    this.toggling.update(s => new Set(s).add(row.id));
    const done = () => this.toggling.update(s => { const n = new Set(s); n.delete(row.id); return n; });

    this.svc.update(row.id, { is_active: next }).subscribe({
      next: saved => { done(); this.patchRow(row.id, saved); },
      error: (err: HttpErrorResponse) => {
        done();
        this.patchRow(row.id, { is_active: !next });
        this.dialog.error('ai.suggestions.toggle_failed', err.error?.message ?? 'dialog.try_again');
      }
    });
  }

  private patchRow(id: number, changes: Partial<AiSuggestion>): void {
    const apply = (list: AiSuggestion[]) => list.map(r => (r.id === id ? { ...r, ...changes } : r));
    this.rows.update(apply);
    this.committed = apply(this.committed);
  }

  // ------------------------------------------------------------ delete

  async remove(row: AiSuggestion, event: Event): Promise<void> {
    event.stopPropagation();
    const ok = await this.dialog.confirm({
      title: 'ai.suggestions.delete_title',
      text: 'ai.suggestions.delete_text',
      params: { name: row.title },
      confirmText: 'common.delete',
      danger: true
    });
    if (!ok) return;

    this.svc.delete(row.id).subscribe({
      next: () => {
        this.rows.update(list => list.filter(r => r.id !== row.id));
        this.committed = this.committed.filter(r => r.id !== row.id);
        this.dialog.toast('success', 'ai.suggestions.deleted');
      },
      error: (err: HttpErrorResponse) =>
        this.dialog.error('ai.suggestions.delete_failed', err.error?.message ?? 'dialog.try_again')
    });
  }

  // ------------------------------------------------------------ reorder

  /** The last order the server confirmed; a failed reorder goes back to it. */
  private committed: AiSuggestion[] = [];
  reordering = signal(false);
  /** Set when the order changed again while a save was running. */
  private reorderAgain = false;

  moveBy(index: number, delta: -1 | 1, event: Event): void {
    event.stopPropagation();
    this.moveTo(index, index + delta);
  }

  private moveTo(from: number, to: number): void {
    if (!this.canReorder()) return;
    const list = [...this.rows()];
    if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return;
    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved);
    this.rows.set(list);
    this.saveOrder();
  }

  /**
   * One request at a time. A move made while one is running is not lost: the
   * newest order is sent once the running one answers.
   */
  private saveOrder(): void {
    if (this.reordering()) { this.reorderAgain = true; return; }
    const role = this.role();
    this.reordering.set(true);
    this.svc.reorder(role, this.rows().map(r => r.id)).subscribe({
      next: rows => {
        this.reordering.set(false);
        if (this.role() !== role) return;
        this.committed = rows;
        if (this.reorderAgain) { this.reorderAgain = false; this.saveOrder(); return; }
        this.rows.set(rows);
      },
      error: (err: HttpErrorResponse) => {
        this.reordering.set(false);
        this.reorderAgain = false;
        if (this.role() !== role) return;
        this.rows.set(this.committed);
        const bag = err.error?.errors as Record<string, string[]> | undefined;
        this.dialog.error('ai.suggestions.reorder_failed', bag?.['ids']?.[0] ?? err.error?.message ?? 'dialog.try_again');
      }
    });
  }

  // Native drag and drop, as on the website blocks screen; the arrows stay the
  // keyboard path. Only the handle arms a row, so a click elsewhere opens it.
  dragId = signal<number | null>(null);
  dropIndex = signal<number | null>(null);
  private armedId = signal<number | null>(null);

  isArmed(row: AiSuggestion): boolean {
    return this.armedId() === row.id;
  }

  arm(row: AiSuggestion): void {
    if (this.canReorder()) this.armedId.set(row.id);
  }

  disarm(): void {
    if (this.dragId() === null) this.armedId.set(null);
  }

  onDragStart(event: DragEvent, row: AiSuggestion): void {
    if (this.armedId() !== row.id) { event.preventDefault(); return; }
    this.dragId.set(row.id);
    event.dataTransfer?.setData('text/plain', String(row.id));
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  onDragOver(event: DragEvent, index: number): void {
    if (this.dragId() === null) return;
    event.preventDefault();
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.dropIndex.set(event.clientY < rect.top + rect.height / 2 ? index : index + 1);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    const id = this.dragId();
    const target = this.dropIndex();
    if (id !== null && target !== null) {
      const from = this.rows().findIndex(r => r.id === id);
      this.moveTo(from, target > from ? target - 1 : target);
    }
    this.onDragEnd();
  }

  onDragEnd(): void {
    this.dragId.set(null);
    this.dropIndex.set(null);
    this.armedId.set(null);
  }
}
