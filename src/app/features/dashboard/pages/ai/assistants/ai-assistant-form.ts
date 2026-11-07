import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ASSISTANT_LIMITS,
  AiAssistant,
  AiAssistantPayload,
  AiAssistantsService,
  AssistantAudience
} from '../../../../../core/services/ai-assistants.service';
import { AdminAccessService } from '../../../../../core/services/admin-access.service';
import { DialogService } from '../../../../../core/services/dialog.service';
import { TPipe } from '../../../../../core/i18n/t.pipe';
import { CanManageDirective } from '../../../../../shared/directives/can-manage.directive';

interface Draft {
  name_en: string;
  name_ar: string;
  patients: boolean;
  tourists: boolean;
  brief: string;
  entry_question_en: string;
  entry_question_ar: string;
  enabled: boolean;
}

/** Fields the form can pin an error to; anything else goes to the banner. */
const FIELDS = new Set(['name_en', 'name_ar', 'user_types', 'brief', 'entry_question_en', 'entry_question_ar', 'enabled']);

/**
 * Add or edit a custom assistant of the patient app.
 *
 * A new one starts off: its suggested questions are added on AI Suggestions
 * first, and only then is it switched on. `brief` is added on top of HAYAI's
 * standard instructions and safety rules, never instead of them.
 */
@Component({
  selector: 'app-ai-assistant-form',
  standalone: true,
  imports: [CommonModule, CanManageDirective, TPipe],
  templateUrl: './ai-assistant-form.html',
  styleUrl: '../suggestions/ai-suggestion-form.css'
})
export class AiAssistantForm {
  private svc = inject(AiAssistantsService);
  private access = inject(AdminAccessService);
  private dialog = inject(DialogService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  readonly limits = ASSISTANT_LIMITS;

  key = signal<string | null>(null);
  loading = signal(false);
  saving = signal(false);
  loadError = signal<string | null>(null);
  formError = signal<string | null>(null);
  formErrorList = signal<string[]>([]);
  errors = signal<Record<string, string>>({});
  draft = signal<Draft>({
    name_en: '', name_ar: '', patients: true, tourists: false,
    brief: '', entry_question_en: '', entry_question_ar: '', enabled: false
  });
  private original: AiAssistant | null = null;

  isEdit = computed(() => this.key() !== null);
  canManage = computed(() => this.access.can('ai', 'manage'));
  briefOver = computed(() => this.draft().brief.length > ASSISTANT_LIMITS.brief);

  constructor() {
    const key = this.route.snapshot.paramMap.get('key');
    if (key) {
      this.key.set(key);
      this.load(key);
    }
  }

  private load(key: string): void {
    this.loading.set(true);
    this.svc.get(key).subscribe({
      next: a => {
        this.loading.set(false);
        // Built-in assistants are defined in code; only their switch is editable.
        if (a.is_custom !== true) { this.loadError.set('ai.assistants.builtin_readonly'); return; }
        this.original = a;
        const types = a.user_types ?? [];
        this.draft.set({
          name_en: a.name_en ?? '',
          name_ar: a.name_ar ?? '',
          patients: types.includes('patient'),
          tourists: types.includes('tourist'),
          brief: a.brief ?? '',
          entry_question_en: a.entry_question_en ?? '',
          entry_question_ar: a.entry_question_ar ?? '',
          enabled: a.enabled
        });
      },
      error: (err: HttpErrorResponse) => {
        this.loadError.set(err.status === 404 ? 'ai.assistants.not_found' : 'ai.assistants.load_one_failed');
        this.loading.set(false);
      }
    });
  }

  set<K extends keyof Draft>(key: K, value: Draft[K]): void {
    this.draft.update(d => ({ ...d, [key]: value }));
    const field = key === 'patients' || key === 'tourists' ? 'user_types' : key;
    if (this.errors()[field]) {
      this.errors.update(e => { const n = { ...e }; delete n[field]; return n; });
    }
  }

  // ------------------------------------------------------------ saving

  private audience(d: Draft): AssistantAudience[] {
    const out: AssistantAudience[] = [];
    if (d.patients) out.push('patient');
    if (d.tourists) out.push('tourist');
    return out;
  }

  private validate(d: Draft): Record<string, string> {
    const e: Record<string, string> = {};
    const L = ASSISTANT_LIMITS;
    if (!d.name_en.trim()) e['name_en'] = 'ai.assistants.err.name_en_required';
    else if (d.name_en.trim().length > L.name) e['name_en'] = 'ai.assistants.err.name_too_long';
    if (!d.name_ar.trim()) e['name_ar'] = 'ai.assistants.err.name_ar_required';
    else if (d.name_ar.trim().length > L.name) e['name_ar'] = 'ai.assistants.err.name_too_long';
    if (!this.audience(d).length) e['user_types'] = 'ai.assistants.err.audience_required';
    if (d.brief.trim().length > L.brief) e['brief'] = 'ai.assistants.err.brief_too_long';
    if (d.entry_question_en.trim().length > L.entryQuestion) e['entry_question_en'] = 'ai.assistants.err.entry_too_long';
    if (d.entry_question_ar.trim().length > L.entryQuestion) e['entry_question_ar'] = 'ai.assistants.err.entry_too_long';
    return e;
  }

  private payload(d: Draft): Required<AiAssistantPayload> {
    return {
      name_en: d.name_en.trim(),
      name_ar: d.name_ar.trim(),
      user_types: this.audience(d),
      brief: d.brief.trim() || null,
      entry_question_en: d.entry_question_en.trim() || null,
      entry_question_ar: d.entry_question_ar.trim() || null,
      enabled: d.enabled
    };
  }

  /** On edit, only what changed: the API is partial. */
  private changes(next: Required<AiAssistantPayload>): AiAssistantPayload {
    const o = this.original!;
    const out: AiAssistantPayload = {};
    if (next.name_en !== o.name_en) out.name_en = next.name_en;
    if (next.name_ar !== o.name_ar) out.name_ar = next.name_ar;
    if ([...next.user_types].sort().join() !== [...(o.user_types ?? [])].sort().join()) out.user_types = next.user_types;
    if (next.brief !== (o.brief ?? null)) out.brief = next.brief;
    if (next.entry_question_en !== (o.entry_question_en ?? null)) out.entry_question_en = next.entry_question_en;
    if (next.entry_question_ar !== (o.entry_question_ar ?? null)) out.entry_question_ar = next.entry_question_ar;
    if (next.enabled !== o.enabled) out.enabled = next.enabled;
    return out;
  }

  save(): void {
    if (!this.canManage() || this.saving()) return;
    const d = this.draft();
    const errors = this.validate(d);
    this.errors.set(errors);
    this.formErrorList.set([]);
    if (Object.keys(errors).length) { this.formError.set('ai.assistants.fix_errors'); return; }
    this.formError.set(null);

    const full = this.payload(d);
    const key = this.key();
    let req;
    if (key === null) {
      req = this.svc.create(full);
    } else {
      const body = this.changes(full);
      if (!Object.keys(body).length) { this.back(); return; }
      req = this.svc.update(key, body);
    }

    this.saving.set(true);
    req.subscribe({
      next: saved => {
        this.saving.set(false);
        if (key === null) this.afterCreate(saved);
        else { this.dialog.toast('success', 'ai.assistants.updated'); this.back(); }
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        const bag = err.error?.errors as Record<string, string[] | string> | undefined;
        if (err.status === 422 && bag) {
          const mapped: Record<string, string> = {};
          const loose: string[] = [];
          for (const [k, v] of Object.entries(bag)) {
            const msg = Array.isArray(v) ? v[0] : String(v);
            // `user_types.0` and friends belong under the audience boxes.
            const field = /^user_types\.\d+$/.test(k) ? 'user_types' : k;
            if (FIELDS.has(field)) { if (!mapped[field]) mapped[field] = msg; } else loose.push(msg);
          }
          this.errors.set(mapped);
          this.formErrorList.set(loose);
          this.formError.set('ai.assistants.fix_errors');
        } else if (err.status === 404) {
          this.formError.set('ai.assistants.not_found');
        } else {
          this.formError.set(err.error?.message ?? 'ai.assistants.save_failed');
        }
      }
    });
  }

  /** The next step is its questions, so the way there is offered at once. */
  private async afterCreate(saved: AiAssistant): Promise<void> {
    const go = await this.dialog.confirm({
      title: 'ai.assistants.created',
      text: 'ai.assistants.created_text',
      params: { name: saved?.name ?? this.draft().name_en },
      icon: 'info',
      confirmText: 'ai.assistants.add_questions',
      cancelText: 'ai.assistants.later'
    });
    if (go && saved?.key) {
      this.router.navigate(['/dashboard/ai/suggestions'], { queryParams: { role: 'patient', module: saved.key } });
    } else {
      this.back();
    }
  }

  back(): void {
    this.router.navigate(['/dashboard/ai/assistants'], { queryParams: { app: 'patient' } });
  }
}
