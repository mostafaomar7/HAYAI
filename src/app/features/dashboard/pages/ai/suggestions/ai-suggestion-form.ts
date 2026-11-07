import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import {
  AiSuggestion,
  AiSuggestionModule,
  AiSuggestionPayload,
  AiSuggestionsService,
  SUGGESTION_LIMITS,
  SuggestionRole
} from '../../../../../core/services/ai-suggestions.service';
import { AdminAccessService } from '../../../../../core/services/admin-access.service';
import { DialogService } from '../../../../../core/services/dialog.service';
import { TPipe } from '../../../../../core/i18n/t.pipe';
import { CanManageDirective } from '../../../../../shared/directives/can-manage.directive';

interface Draft {
  module_key: string;
  title_en: string;
  title_ar: string;
  slug: string;
  prompt: string;
  is_active: boolean;
}

/** Fields the form can pin an error to; anything else goes to the banner. */
const FIELDS = new Set(['role', 'module_key', 'title_en', 'title_ar', 'slug', 'prompt', 'is_active']);

const emptyDraft = (): Draft => ({
  module_key: '', title_en: '', title_ar: '', slug: '', prompt: '', is_active: true
});

/**
 * Add or edit one suggested question.
 *
 * The role is the tab the admin came from and does not change here: a question
 * moved between apps would also need an assistant of the other app, and the
 * two are never right together by accident. The hidden prompt is the field
 * that matters most and the one users never see, so it gets the room.
 */
@Component({
  selector: 'app-ai-suggestion-form',
  standalone: true,
  imports: [CommonModule, CanManageDirective, TPipe],
  templateUrl: './ai-suggestion-form.html',
  styleUrl: './ai-suggestion-form.css'
})
export class AiSuggestionForm {
  private svc = inject(AiSuggestionsService);
  private access = inject(AdminAccessService);
  private dialog = inject(DialogService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  readonly limits = SUGGESTION_LIMITS;

  id = signal<number | null>(null);
  role = signal<SuggestionRole>('patient');
  loading = signal(false);
  saving = signal(false);
  loadError = signal<string | null>(null);
  /** A translation key, or the server's own sentences. */
  formError = signal<string | null>(null);
  formErrorList = signal<string[]>([]);
  errors = signal<Record<string, string>>({});

  modules = signal<AiSuggestionModule[]>([]);
  modulesLoading = signal(true);
  draft = signal<Draft>(emptyDraft());
  /** What the server holds, so an edit sends only what changed. */
  private original: AiSuggestion | null = null;

  isEdit = computed(() => this.id() !== null);
  canManage = computed(() => this.access.can('ai', 'manage'));
  promptLength = computed(() => this.draft().prompt.length);
  promptOver = computed(() => this.promptLength() > SUGGESTION_LIMITS.prompt);
  selectedModule = computed(() => this.modules().find(m => m.key === this.draft().module_key));
  /** A stored assistant the role no longer offers, kept visible rather than silently swapped. */
  missingModule = computed(() => {
    const key = this.draft().module_key;
    return !!key && !this.modulesLoading() && !this.selectedModule();
  });

  constructor() {
    const asked = this.route.snapshot.queryParamMap.get('role');
    if (asked === 'doctor' || asked === 'patient') this.role.set(asked);

    const raw = this.route.snapshot.paramMap.get('id');
    if (raw) {
      this.id.set(Number(raw));
      this.load(Number(raw));
    } else {
      this.loadModules(this.role());
    }
  }

  private load(id: number): void {
    this.loading.set(true);
    this.svc.get(id).subscribe({
      next: s => {
        this.original = s;
        this.role.set(s.role);
        this.draft.set({
          module_key: s.module_key,
          title_en: s.title_en ?? '',
          title_ar: s.title_ar ?? '',
          slug: s.slug ?? '',
          prompt: s.prompt ?? '',
          is_active: s.is_active
        });
        this.loading.set(false);
        this.loadModules(s.role);
      },
      error: (err: HttpErrorResponse) => {
        this.loadError.set(err.status === 404 ? 'ai.suggestions.not_found' : 'ai.suggestions.load_one_failed');
        this.loading.set(false);
      }
    });
  }

  private loadModules(role: SuggestionRole): void {
    this.modulesLoading.set(true);
    this.svc.modules(role).subscribe({
      next: rows => {
        this.modules.set(rows ?? []);
        this.modulesLoading.set(false);
        // The doctor app has one assistant; there is nothing to choose.
        if (!this.isEdit() && !this.draft().module_key && rows?.length === 1) this.set('module_key', rows[0].key);
      },
      error: () => { this.modules.set([]); this.modulesLoading.set(false); }
    });
  }

  // ------------------------------------------------------------ display

  audienceKey(m: AiSuggestionModule | undefined): string | null {
    if (!m) return null;
    if (!m.enabled) return 'ai.suggestions.badge.off';
    const types = [...(m.user_types ?? [])].sort().join(',');
    if (types === 'tourist') return 'ai.suggestions.badge.tourists';
    if (types === 'patient,tourist') return 'ai.suggestions.badge.both';
    return null;
  }

  /** The dropdown option text carries the badge, since an option cannot hold markup. */
  moduleOption(m: AiSuggestionModule, badge: string | null): string {
    return badge ? `${m.name} · ${badge}` : m.name;
  }

  // ------------------------------------------------------------ editing

  set<K extends keyof Draft>(key: K, value: Draft[K]): void {
    this.draft.update(d => ({ ...d, [key]: value }));
    if (this.errors()[key]) {
      this.errors.update(e => { const n = { ...e }; delete n[key]; return n; });
    }
  }

  // ------------------------------------------------------------ saving

  /** The server's rules, checked first so the error sits on the field before a round trip. */
  private validate(d: Draft): Record<string, string> {
    const e: Record<string, string> = {};
    if (!d.module_key) e['module_key'] = 'ai.suggestions.err.module_required';
    if (!d.title_en.trim()) e['title_en'] = 'ai.suggestions.err.title_en_required';
    else if (d.title_en.trim().length > SUGGESTION_LIMITS.title) e['title_en'] = 'ai.suggestions.err.title_too_long';
    if (!d.title_ar.trim()) e['title_ar'] = 'ai.suggestions.err.title_ar_required';
    else if (d.title_ar.trim().length > SUGGESTION_LIMITS.title) e['title_ar'] = 'ai.suggestions.err.title_too_long';
    const slug = d.slug.trim();
    if (slug && slug.length > SUGGESTION_LIMITS.slug) e['slug'] = 'ai.suggestions.err.slug_too_long';
    else if (slug && !SUGGESTION_LIMITS.slugPattern.test(slug)) e['slug'] = 'ai.suggestions.err.slug_format';
    if (d.prompt.trim().length > SUGGESTION_LIMITS.prompt) e['prompt'] = 'ai.suggestions.err.prompt_too_long';
    return e;
  }

  private payload(d: Draft): AiSuggestionPayload {
    return {
      module_key: d.module_key,
      title_en: d.title_en.trim(),
      title_ar: d.title_ar.trim(),
      slug: d.slug.trim() || null,
      prompt: d.prompt.trim() || null,
      is_active: d.is_active
    };
  }

  /** On edit, only what changed: the API is partial and the audit log records each field. */
  private changes(next: AiSuggestionPayload): AiSuggestionPayload {
    const o = this.original!;
    const out: AiSuggestionPayload = {};
    if (next.module_key !== o.module_key) out.module_key = next.module_key;
    if (next.title_en !== o.title_en) out.title_en = next.title_en;
    if (next.title_ar !== (o.title_ar ?? '')) out.title_ar = next.title_ar;
    if (next.slug !== (o.slug ?? null)) out.slug = next.slug;
    if (next.prompt !== (o.prompt ?? null)) out.prompt = next.prompt;
    if (next.is_active !== o.is_active) out.is_active = next.is_active;
    return out;
  }

  save(): void {
    if (!this.canManage() || this.saving()) return;
    const d = this.draft();
    const errors = this.validate(d);
    this.errors.set(errors);
    this.formErrorList.set([]);
    if (Object.keys(errors).length) {
      this.formError.set('ai.suggestions.fix_errors');
      return;
    }
    this.formError.set(null);

    const full = this.payload(d);
    const id = this.id();
    let req;
    if (id === null) {
      req = this.svc.create({ role: this.role(), ...full });
    } else {
      const body = this.changes(full);
      if (!Object.keys(body).length) { this.back(); return; }
      req = this.svc.update(id, body);
    }

    this.saving.set(true);
    req.subscribe({
      next: () => {
        this.saving.set(false);
        this.dialog.toast('success', id === null ? 'ai.suggestions.created' : 'ai.suggestions.updated');
        this.back();
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        const bag = err.error?.errors as Record<string, string[] | string> | undefined;
        if (err.status === 422 && bag) {
          const mapped: Record<string, string> = {};
          const loose: string[] = [];
          for (const [k, v] of Object.entries(bag)) {
            const msg = Array.isArray(v) ? v[0] : String(v);
            if (FIELDS.has(k)) mapped[k] = msg; else loose.push(msg);
          }
          // There is no role field to pin a role error to; it names the app.
          if (mapped['role']) { loose.push(mapped['role']); delete mapped['role']; }
          this.errors.set(mapped);
          this.formErrorList.set(loose);
          this.formError.set('ai.suggestions.fix_errors');
        } else if (err.status === 404) {
          this.formError.set('ai.suggestions.not_found');
        } else {
          this.formError.set(err.error?.message ?? 'ai.suggestions.save_failed');
        }
      }
    });
  }

  back(): void {
    this.router.navigate(['/dashboard/ai/suggestions'], { queryParams: { role: this.role() } });
  }
}
