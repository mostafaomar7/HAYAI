import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TPipe } from '../../../../../core/i18n/t.pipe';
import { DialogService } from '../../../../../core/services/dialog.service';
import {
  VersionedEntity, WebsiteApiService, errorMessage, fieldErrors
} from '../../../../../core/services/website/website-api.service';
import { WebsiteContextService } from '../../../../../core/services/website/website-context.service';
import { GeoKeyFact, GeoMeta, Locale } from '../../../../../core/services/website/website.models';
import { clone, joinLines, lines, wordCount } from './website-utils';

const ANSWER_MIN = 40;
const ANSWER_MAX = 60;

/**
 * Openings that make an extracted passage meaningless on its own. An answer
 * engine retrieves this paragraph without the H1 above it, so "It covers…"
 * cites nothing; the API refuses these, and catching them while typing saves
 * a failed publish.
 */
const DANGLING_START = /^(it|this|these|those|they|that)\b|^(هذا|هذه|هؤلاء|ذلك|تلك|هو|هي)(\s|$)/i;

/**
 * GEO tab for one language (answer-engine content): the 40–60 word direct
 * answer, key facts, entity and last-verified date.
 *
 * Pages read it from `GET /pages/{id}/geo/{locale}`; products have no GEO read
 * endpoint, so their editor passes the GEO it already holds in `initial`.
 */
@Component({
  selector: 'app-geo-editor',
  standalone: true,
  imports: [CommonModule, TPipe],
  templateUrl: './geo-editor.html',
  styleUrls: ['./website.shared.css', './editor-panel.css']
})
export class GeoEditor {
  private api = inject(WebsiteApiService);
  private ctx = inject(WebsiteContextService);
  private dialog = inject(DialogService);

  entity = input.required<VersionedEntity>();
  entityId = input.required<number>();
  locale = input.required<Locale>();
  /** GEO already loaded by the parent (products). `undefined` → fetch it (pages). */
  initial = input<GeoMeta | null | undefined>(undefined);
  /** Articles cannot publish without a valid direct answer — the tab says so. */
  required = input(false);

  saved = output<GeoMeta>();

  model = signal<GeoMeta>({ key_facts: [] });
  sameAsText = signal('');
  loading = signal(true);
  saving = signal(false);
  dirty = signal(false);
  errors = signal<Record<string, string>>({});
  formError = signal<string | null>(null);

  canEdit = computed(() => this.ctx.can('seo.update'));
  words = computed(() => wordCount(this.model().direct_answer));
  answerOk = computed(() => this.words() >= ANSWER_MIN && this.words() <= ANSWER_MAX);
  dangling = computed(() => DANGLING_START.test((this.model().direct_answer ?? '').trim()));
  readonly min = ANSWER_MIN;
  readonly max = ANSWER_MAX;

  constructor() {
    effect(() => {
      const [entity, id, locale, initial] = [this.entity(), this.entityId(), this.locale(), this.initial()];
      untracked(() => this.load(entity, id, locale, initial));
    });
  }

  private load(entity: VersionedEntity, id: number, locale: Locale, initial: GeoMeta | null | undefined): void {
    this.errors.set({});
    this.formError.set(null);
    if (initial !== undefined || entity !== 'pages') {
      this.apply(initial ?? null);
      return;
    }
    this.loading.set(true);
    this.api.geo(id, locale).subscribe({
      next: geo => this.apply(geo),
      error: () => this.apply(null)
    });
  }

  private apply(geo: GeoMeta | null): void {
    const m: GeoMeta = clone(geo ?? {});
    m.key_facts = m.key_facts ?? [];
    this.model.set(m);
    this.sameAsText.set(joinLines(m.entity?.same_as));
    this.dirty.set(false);
    this.loading.set(false);
  }

  set<K extends keyof GeoMeta>(key: K, value: GeoMeta[K]): void {
    this.model.update(m => ({ ...m, [key]: value }));
    this.dirty.set(true);
  }

  text(key: 'direct_answer_question' | 'direct_answer' | 'last_verified_at', value: string): void {
    this.set(key, value.trim() === '' ? null : value);
  }

  entityField(key: 'type' | 'name' | 'description', value: string): void {
    this.model.update(m => ({ ...m, entity: { ...(m.entity ?? {}), [key]: value.trim() === '' ? null : value } }));
    this.dirty.set(true);
  }

  setSameAs(value: string): void {
    this.sameAsText.set(value);
    this.dirty.set(true);
  }

  addFact(): void {
    this.set('key_facts', [...(this.model().key_facts ?? []), { label: '', value: '', source_url: null }]);
  }

  updateFact(i: number, key: keyof GeoKeyFact, value: string): void {
    const facts = [...(this.model().key_facts ?? [])];
    facts[i] = { ...facts[i], [key]: key === 'source_url' && value.trim() === '' ? null : value };
    this.set('key_facts', facts);
  }

  removeFact(i: number): void {
    this.set('key_facts', (this.model().key_facts ?? []).filter((_, j) => j !== i));
  }

  verifiedToday(): void {
    this.set('last_verified_at', new Date().toISOString().slice(0, 10));
  }

  save(): void {
    if (!this.canEdit()) return;
    const m = this.model();
    const sameAs = lines(this.sameAsText());
    const entity = m.entity || sameAs.length ? { ...(m.entity ?? {}), same_as: sameAs } : null;
    const body: GeoMeta = {
      ...m,
      key_facts: (m.key_facts ?? []).filter(f => f.label.trim() || f.value.trim()),
      entity: entity && Object.values(entity).some(v => (Array.isArray(v) ? v.length : v)) ? entity : null
    };
    this.saving.set(true);
    this.errors.set({});
    this.formError.set(null);
    this.api.saveGeo(this.entity(), this.entityId(), this.locale(), body).subscribe({
      next: res => {
        this.saving.set(false);
        this.dirty.set(false);
        const merged = res && typeof res === 'object' ? { ...body, ...res } : body;
        this.model.set(merged);
        this.dialog.toast('success', 'web.geo.saved');
        this.saved.emit(merged);
      },
      error: err => {
        this.saving.set(false);
        this.errors.set(fieldErrors(err));
        this.formError.set(errorMessage(err, 'web.geo.save_failed'));
      }
    });
  }
}
