import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TPipe } from '../../../../../core/i18n/t.pipe';
import { DialogService } from '../../../../../core/services/dialog.service';
import {
  VersionedEntity, WebsiteApiService, errorMessage, fieldErrors
} from '../../../../../core/services/website/website-api.service';
import { WebsiteContextService } from '../../../../../core/services/website/website-context.service';
import { Locale, SeoMeta } from '../../../../../core/services/website/website.models';
import { MediaPicker } from './media-picker';

/** Meta title / description windows the SEO audit grades against (§2.12). */
const TITLE_RANGE = [30, 60] as const;
const DESC_RANGE = [70, 160] as const;

/**
 * SEO tab for one language of a page or product (`GET`/`PUT /{entity}/{id}/seo/{locale}`).
 *
 * Loads itself whenever the entity or language changes and saves on demand,
 * so the page and product editors only drop it in. The custom JSON-LD field is
 * validated client-side for the same things the API rejects — review/rating
 * keys and a non-schema.org `@context` — because "fabricated reviews" is the
 * one schema mistake the spec singles out as penalised.
 */
@Component({
  selector: 'app-seo-editor',
  standalone: true,
  imports: [CommonModule, TPipe, MediaPicker],
  templateUrl: './seo-editor.html',
  styleUrls: ['./website.shared.css', './editor-panel.css']
})
export class SeoEditor {
  private api = inject(WebsiteApiService);
  private ctx = inject(WebsiteContextService);
  private dialog = inject(DialogService);

  entity = input.required<VersionedEntity>();
  entityId = input.required<number>();
  locale = input.required<Locale>();
  /** Shown as the fallback title hint ("empty → <title> | HAYAI"). */
  fallbackTitle = input<string>('');

  saved = output<SeoMeta>();

  model = signal<SeoMeta>({});
  schemaText = signal('');
  loading = signal(true);
  saving = signal(false);
  dirty = signal(false);
  errors = signal<Record<string, string>>({});
  formError = signal<string | null>(null);

  canEdit = computed(() => this.ctx.can('seo.update'));
  titleLen = computed(() => (this.model().meta_title ?? '').length);
  descLen = computed(() => (this.model().meta_description ?? '').length);
  titleOk = computed(() => this.titleLen() === 0 || (this.titleLen() >= TITLE_RANGE[0] && this.titleLen() <= TITLE_RANGE[1]));
  descOk = computed(() => this.descLen() === 0 || (this.descLen() >= DESC_RANGE[0] && this.descLen() <= DESC_RANGE[1]));
  readonly titleRange = TITLE_RANGE;
  readonly descRange = DESC_RANGE;

  constructor() {
    effect(() => {
      const [entity, id, locale] = [this.entity(), this.entityId(), this.locale()];
      untracked(() => this.load(entity, id, locale));
    });
  }

  private load(entity: VersionedEntity, id: number, locale: Locale): void {
    this.loading.set(true);
    this.errors.set({});
    this.formError.set(null);
    this.api.seo(entity, id, locale).subscribe({
      next: seo => {
        const m: SeoMeta = { robots_index: true, robots_follow: true, ...(seo ?? {}) };
        this.model.set(m);
        this.schemaText.set(m.custom_schema ? JSON.stringify(m.custom_schema, null, 2) : '');
        this.dirty.set(false);
        this.loading.set(false);
      },
      error: () => {
        // A language with no SEO row yet answers 404 on some setups — start blank.
        this.model.set({ robots_index: true, robots_follow: true });
        this.schemaText.set('');
        this.loading.set(false);
      }
    });
  }

  set<K extends keyof SeoMeta>(key: K, value: SeoMeta[K]): void {
    this.model.update(m => ({ ...m, [key]: value }));
    this.dirty.set(true);
  }

  text(key: keyof SeoMeta, value: string): void {
    this.set(key, (value.trim() === '' ? null : value) as any);
  }

  setSchema(value: string): void {
    this.schemaText.set(value);
    this.dirty.set(true);
  }

  /** Mirrors the API's custom_schema rules so the admin sees why before saving. */
  private parseSchema(): { ok: true; value: SeoMeta['custom_schema'] } | { ok: false; error: string } {
    const raw = this.schemaText().trim();
    if (!raw) return { ok: true, value: null };
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { ok: false, error: 'web.seo.schema_invalid_json' };
    }
    const list = Array.isArray(parsed) ? parsed : [parsed];
    if (list.some(o => !o || typeof o !== 'object' || !o['@type'])) return { ok: false, error: 'web.seo.schema_needs_type' };
    const banned = /"(aggregateRating|review|reviews|rating)"\s*:/i;
    if (banned.test(raw)) return { ok: false, error: 'web.seo.schema_no_reviews' };
    const ctxBad = list.some(o => o['@context'] && !/^https?:\/\/schema\.org\/?$/.test(String(o['@context'])));
    if (ctxBad) return { ok: false, error: 'web.seo.schema_context' };
    if (raw.length > 20 * 1024) return { ok: false, error: 'web.seo.schema_too_big' };
    return { ok: true, value: parsed };
  }

  save(): void {
    if (!this.canEdit()) return;
    const schema = this.parseSchema();
    if (!schema.ok) {
      this.errors.set({ custom_schema: schema.error });
      return;
    }
    const body: SeoMeta = { ...this.model(), custom_schema: schema.value };
    this.saving.set(true);
    this.errors.set({});
    this.formError.set(null);
    this.api.saveSeo(this.entity(), this.entityId(), this.locale(), body).subscribe({
      next: res => {
        this.saving.set(false);
        this.dirty.set(false);
        if (res && typeof res === 'object') this.model.set({ ...body, ...res });
        this.dialog.toast('success', 'web.seo.saved');
        this.saved.emit(this.model());
      },
      error: err => {
        this.saving.set(false);
        this.errors.set(fieldErrors(err));
        this.formError.set(errorMessage(err, 'web.seo.save_failed'));
      }
    });
  }
}
