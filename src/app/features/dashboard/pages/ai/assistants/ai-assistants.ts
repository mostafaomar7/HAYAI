import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AiAssistant, AiAssistantsService } from '../../../../../core/services/ai-assistants.service';
import { AdminAccessService } from '../../../../../core/services/admin-access.service';
import { SettingsService } from '../../../../../core/services/settings.service';
import { DialogService } from '../../../../../core/services/dialog.service';
import { TPipe } from '../../../../../core/i18n/t.pipe';
import { CanManageDirective } from '../../../../../shared/directives/can-manage.directive';

type AppTab = 'patient' | 'doctor';
/** '' = both, '1' = on, '0' = off. */
type StatusFilter = '' | '1' | '0';

/**
 * Every AI assistant of the two apps, one tab per app, each with its own
 * switch. A switch reaches users on their next request, which is how an
 * assistant is kept hidden until it is announced.
 *
 * Built-in assistants can only be switched. Custom ones (patient app only)
 * can also be edited and deleted, and are created off so their questions can
 * be added on AI Suggestions before anyone sees them.
 */
@Component({
  selector: 'app-ai-assistants',
  standalone: true,
  imports: [CommonModule, CanManageDirective, TPipe],
  templateUrl: './ai-assistants.html',
  styleUrl: './ai-assistants.css'
})
export class AiAssistants {
  private svc = inject(AiAssistantsService);
  private settings = inject(SettingsService);
  private access = inject(AdminAccessService);
  private dialog = inject(DialogService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  readonly tabs: AppTab[] = ['patient', 'doctor'];

  tab = signal<AppTab>('patient');
  loading = signal(true);
  loadError = signal<string | null>(null);
  all = signal<AiAssistant[]>([]);
  search = signal('');
  statusFilter = signal<StatusFilter>('');
  /** Keys whose switch is being saved: one request per row at a time. */
  saving = signal<ReadonlySet<string>>(new Set());
  /** True when the platform-wide AI switch is off, which hides every assistant. */
  globalOff = signal(false);

  canManage = computed(() => this.access.can('ai', 'manage'));
  inTab = computed(() => this.all().filter(a => a.user_type === this.tab()));
  onCount = computed(() => this.inTab().filter(a => a.enabled).length);
  filtered = computed(() => !!(this.search().trim() || this.statusFilter()));

  rows = computed(() => {
    const term = this.search().trim().toLowerCase();
    const status = this.statusFilter();
    return this.inTab().filter(a =>
      (status === '' || a.enabled === (status === '1')) &&
      (!term || [a.name, a.name_en, a.name_ar, a.key].some(v => (v ?? '').toLowerCase().includes(term)))
    );
  });

  constructor() {
    const asked = this.route.snapshot.queryParamMap.get('app');
    if (asked === 'doctor' || asked === 'patient') this.tab.set(asked);
    this.load();
    this.loadGlobalSwitch();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.svc.list().subscribe({
      next: rows => { this.all.set(rows ?? []); this.loading.set(false); },
      error: () => { this.loadError.set('ai.assistants.load_failed'); this.loading.set(false); }
    });
  }

  /** Read from the Settings screen's own endpoint; a failure just hides the banner. */
  private loadGlobalSwitch(): void {
    this.settings.list().subscribe({
      next: rows => this.globalOff.set(rows.find(r => r.key === 'ai.enabled')?.value === false),
      error: () => this.globalOff.set(false)
    });
  }

  setTab(tab: AppTab): void {
    if (this.tab() === tab) return;
    this.tab.set(tab);
    this.router.navigate([], { relativeTo: this.route, queryParams: { app: tab }, replaceUrl: true });
  }

  clearFilters(): void {
    this.search.set('');
    this.statusFilter.set('');
  }

  // ------------------------------------------------------------ display

  isCustom(a: AiAssistant): boolean {
    return a.is_custom === true;
  }

  audienceKey(a: AiAssistant): string | null {
    const types = [...(a.user_types ?? [])].sort().join(',');
    if (types === 'tourist') return 'ai.suggestions.badge.tourists';
    if (types === 'patient,tourist') return 'ai.suggestions.badge.both';
    return null;
  }

  questionCount(a: AiAssistant): number {
    return Array.isArray(a.suggested_questions) ? a.suggested_questions.length : 0;
  }

  /** The other language's name, for the hover text. */
  otherName(a: AiAssistant): string {
    return a.name === a.name_en ? a.name_ar : a.name_en;
  }

  // ------------------------------------------------------------ navigation

  openQuestions(a: AiAssistant): void {
    this.router.navigate(['/dashboard/ai/suggestions'], {
      queryParams: { role: a.user_type, module: a.key }
    });
  }

  add(): void {
    this.router.navigate(['/dashboard/ai/assistants/new']);
  }

  edit(a: AiAssistant): void {
    this.router.navigate(['/dashboard/ai/assistants', a.key, 'edit']);
  }

  // ------------------------------------------------------------ switch

  /**
   * Off is confirmed, because users lose the assistant at once; on is not.
   * The row flips before the answer and flips back if the save fails.
   */
  async toggle(a: AiAssistant, event: Event): Promise<void> {
    // The box has already flipped by the time this runs; a cancelled
    // confirmation puts it back by hand, since the bound value never changed.
    const box = event.target as HTMLInputElement;
    if (!this.canManage() || this.saving().has(a.key)) { box.checked = a.enabled; return; }
    const next = !a.enabled;

    if (!next) {
      const ok = await this.dialog.confirm({
        title: 'ai.assistants.off_title',
        text: a.key === 'doctor_assistance' ? 'ai.assistants.off_text_doctor' : 'ai.assistants.off_text',
        params: { name: a.name },
        confirmText: 'ai.assistants.off_confirm',
        danger: true
      });
      if (!ok) { box.checked = a.enabled; return; }
    }

    this.patch(a.key, { enabled: next });
    this.saving.update(s => new Set(s).add(a.key));
    const done = () => this.saving.update(s => { const n = new Set(s); n.delete(a.key); return n; });

    this.svc.update(a.key, { enabled: next }).subscribe({
      next: saved => {
        done();
        if (saved) this.patch(a.key, saved);
        // Switched on with nothing to offer: the app would show an empty list.
        if (next && a.interaction === 'suggested' && this.questionCount(a) === 0) {
          this.dialog.toast('warning', 'ai.assistants.on_no_questions');
        } else {
          this.dialog.toast('success', next ? 'ai.assistants.turned_on' : 'ai.assistants.turned_off', { name: a.name });
        }
      },
      error: (err: HttpErrorResponse) => {
        done();
        this.patch(a.key, { enabled: !next });
        this.dialog.error('ai.assistants.toggle_failed', err.error?.message ?? 'dialog.try_again');
      }
    });
  }

  private patch(key: string, changes: Partial<AiAssistant>): void {
    this.all.update(list => list.map(a => (a.key === key ? { ...a, ...changes } : a)));
  }

  // ------------------------------------------------------------ delete

  async remove(a: AiAssistant, event: Event): Promise<void> {
    event.stopPropagation();
    const ok = await this.dialog.confirm({
      title: 'ai.assistants.delete_title',
      text: 'ai.assistants.delete_text',
      params: { name: a.name },
      confirmText: 'common.delete',
      danger: true
    });
    if (!ok) return;

    this.svc.delete(a.key).subscribe({
      next: () => {
        this.all.update(list => list.filter(x => x.key !== a.key));
        this.dialog.toast('success', 'ai.assistants.deleted');
      },
      error: (err: HttpErrorResponse) => {
        const bag = err.error?.errors as Record<string, string[]> | undefined;
        this.dialog.error('ai.assistants.delete_failed', bag?.['key']?.[0] ?? err.error?.message ?? 'dialog.try_again');
      }
    });
  }
}
