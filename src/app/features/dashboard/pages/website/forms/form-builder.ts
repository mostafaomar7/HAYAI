import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TPipe } from '../../../../../core/i18n/t.pipe';
import { I18nService } from '../../../../../core/i18n/i18n.service';
import { DialogService } from '../../../../../core/services/dialog.service';
import {
  WebsiteApiService, errorMessage, fieldErrors
} from '../../../../../core/services/website/website-api.service';
import { WebsiteContextService } from '../../../../../core/services/website/website-context.service';
import {
  FormFieldOption, FormFieldValidation, FormFieldVisibility, FormInput, Locale,
  WebsiteForm, WebsiteFormField
} from '../../../../../core/services/website/website.models';
import { clone, joinLines, lines, nullIfEmpty } from '../shared/website-utils';
import { enumLabel } from '../purchases/sales-shared';

/** Keys the public submit endpoint uses for itself (honeypot, consent, tracking, product context). */
const RESERVED_KEYS = ['website', 'consent', 'attribution', 'product_id', 'product_slug'];
const OPTION_TYPES = ['select', 'multi_select', 'radio'];
const LENGTH_TYPES = ['text', 'textarea'];
const NUMBER_TYPES = ['number'];
const FILE_TYPES = ['file'];
export const FILE_MIMES = ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx', 'xls', 'xlsx', 'csv'];
const MAX_KB = 10240;
const MAX_FILES = 5;
const OPERATORS: FormFieldVisibility['operator'][] = ['equals', 'not_equals', 'in', 'not_in', 'filled', 'empty'];
/** Error suffixes rendered next to their own input; the rest are listed at the top of the card. */
const INLINE_ERRORS = /^(key|type|label_en|label_ar|maps_to|options|options\.\d+\.(value|label_en|label_ar)|validation\.(min|max|min_length|max_length|mimes|max_kb|max_files)|visibility\.(field|operator|value))$/;

type LocBase = 'label' | 'placeholder' | 'help';
type SettingsLocBase = 'name' | 'description' | 'submit_label' | 'success_message' | 'consent_text';

interface OptionDraft { value: string; label_en: string; label_ar: string }

interface FieldDraft {
  uid: number;
  key: string;
  /** False until the admin types a key, so it can follow the English label. */
  keyTouched: boolean;
  type: string;
  label_en: string; label_ar: string;
  placeholder_en: string; placeholder_ar: string;
  help_en: string; help_ar: string;
  is_required: boolean;
  maps_to: string;
  options: OptionDraft[];
  min: string; max: string; min_length: string; max_length: string;
  mimes: string[]; max_kb: string; max_files: string;
  vis_on: boolean; vis_field: string; vis_operator: FormFieldVisibility['operator']; vis_value: string;
  /** What the API had, so validation keys this editor does not show survive a save. */
  origType: string;
  origValidation: FormFieldValidation | null;
  open: boolean;
}

interface SettingsDraft {
  key: string; type: string;
  name_en: string; name_ar: string;
  description_en: string; description_ar: string;
  submit_label_en: string; submit_label_ar: string;
  success_message_en: string; success_message_ar: string;
  requires_consent: boolean;
  consent_text_en: string; consent_text_ar: string;
  notify_emails: string;
  is_active: boolean;
}

const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v));
const numOrUndef = (v: string): number | undefined => (v.trim() === '' || isNaN(Number(v)) ? undefined : Number(v));

const emptySettings = (): SettingsDraft => ({
  key: '', type: '', name_en: '', name_ar: '', description_en: '', description_ar: '',
  submit_label_en: '', submit_label_ar: '', success_message_en: '', success_message_ar: '',
  requires_consent: true, consent_text_en: '', consent_text_ar: '', notify_emails: '', is_active: true
});

/** `Full name (optional)` → `full_name_optional`. */
function snake(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').replace(/^(\d)/, 'f_$1').slice(0, 60);
}

/**
 * Create / edit a website form and its fields (`forms/new`, `forms/:id`).
 *
 * Fields are saved as one list (`fields` replaces them all), so the whole
 * builder is one draft and one save. Everything the API would reject for
 * structural reasons — reserved or duplicate keys, a `maps_to` column used
 * twice or on the wrong kind of field, options without values — is checked
 * here first, and a 422 path such as `fields.2.key` is mapped back onto the
 * third card. The preview renders the draft as a visitor would see it in the
 * language being edited, including visibility rules.
 */
@Component({
  selector: 'app-form-builder',
  standalone: true,
  imports: [CommonModule, TPipe],
  templateUrl: './form-builder.html',
  styleUrls: ['../shared/website.shared.css', './form-builder.css']
})
export class FormBuilder {
  private api = inject(WebsiteApiService);
  readonly ctx = inject(WebsiteContextService);
  private i18n = inject(I18nService);
  private dialog = inject(DialogService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  readonly operators = OPERATORS;
  readonly fileMimes = FILE_MIMES;
  readonly maxKb = MAX_KB;
  readonly maxFiles = MAX_FILES;

  id = signal<number | null>(null);
  form = signal<WebsiteForm | null>(null);
  loading = signal(false);
  loadError = signal<string | null>(null);
  saving = signal(false);
  formError = signal<string | null>(null);
  errors = signal<Record<string, string>>({});

  settings = signal<SettingsDraft>(emptySettings());
  fields = signal<FieldDraft[]>([]);
  locale = signal<Locale>('en');
  previewOpen = signal(true);
  previewValues = signal<Record<string, unknown>>({});

  fieldTypes = signal<string[]>([]);
  formTypes = signal<string[]>([]);
  mapsToOptions = signal<string[]>([]);

  private uid = 0;

  isNew = computed(() => this.id() === null);
  isSystem = computed(() => !!this.form()?.is_system);
  canEdit = computed(() => (this.isNew() ? this.ctx.can('cms.create') : this.ctx.can('cms.update')));
  title = computed(() => {
    const s = this.settings();
    if (this.isNew()) return this.i18n.translate('web.forms.new');
    return (this.locale() === 'ar' && s.name_ar) || s.name_en || s.key;
  });

  constructor() {
    const raw = this.route.snapshot.paramMap.get('id');
    if (raw && raw !== 'new') {
      this.id.set(Number(raw));
      this.load();
    } else {
      this.fields.set([this.newField('text')]);
    }
    this.ctx.enums().pipe(takeUntilDestroyed()).subscribe({
      next: e => {
        this.fieldTypes.set(e.form_field_types ?? []);
        this.formTypes.set(e.form_types ?? []);
        this.mapsToOptions.set(e.form_field_maps_to ?? []);
        if (this.isNew() && !this.settings().type && e.form_types?.length) {
          this.setSetting('type', e.form_types[0]);
        }
      },
      error: () => this.formError.set('web.forms.enums_failed')
    });
  }

  // ───────────────────────────── load / map ─────────────────────────────

  load(): void {
    const id = this.id();
    if (id === null) return;
    this.loading.set(true);
    this.loadError.set(null);
    this.api.form(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: f => {
        this.apply(f);
        this.loading.set(false);
      },
      error: err => {
        this.loadError.set(errorMessage(err, 'web.forms.load_failed'));
        this.loading.set(false);
      }
    });
  }

  private apply(f: WebsiteForm): void {
    this.form.set(f);
    this.settings.set({
      key: f.key, type: f.type,
      name_en: str(f.name_en), name_ar: str(f.name_ar),
      description_en: str(f.description_en), description_ar: str(f.description_ar),
      submit_label_en: str(f.submit_label_en), submit_label_ar: str(f.submit_label_ar),
      success_message_en: str(f.success_message_en), success_message_ar: str(f.success_message_ar),
      requires_consent: !!f.requires_consent,
      consent_text_en: str(f.consent_text_en), consent_text_ar: str(f.consent_text_ar),
      notify_emails: joinLines(f.notify_emails),
      is_active: !!f.is_active
    });
    const sorted = [...(f.fields ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    this.fields.set(sorted.map(x => this.fromField(x)));
    this.previewValues.set({});
  }

  private fromField(f: WebsiteFormField): FieldDraft {
    const v = (f.validation && !Array.isArray(f.validation) ? f.validation : {}) as FormFieldValidation;
    const vis = f.visibility;
    return {
      uid: ++this.uid,
      key: f.key, keyTouched: true, type: f.type,
      label_en: str(f.label_en), label_ar: str(f.label_ar),
      placeholder_en: str(f.placeholder_en), placeholder_ar: str(f.placeholder_ar),
      help_en: str(f.help_en), help_ar: str(f.help_ar),
      is_required: !!f.is_required,
      maps_to: str(f.maps_to),
      options: (f.options ?? []).map(o => ({ value: str(o.value), label_en: str(o.label_en), label_ar: str(o.label_ar) })),
      min: str(v.min), max: str(v.max), min_length: str(v.min_length), max_length: str(v.max_length),
      mimes: [...(v.mimes ?? [])], max_kb: str(v.max_kb), max_files: str(v.max_files),
      vis_on: !!vis,
      vis_field: str(vis?.field),
      vis_operator: vis?.operator ?? 'equals',
      vis_value: Array.isArray(vis?.value) ? (vis!.value as unknown[]).join(', ') : str(vis?.value),
      origType: f.type,
      origValidation: f.validation && !Array.isArray(f.validation) ? clone(f.validation) : null,
      open: false
    };
  }

  private newField(type: string): FieldDraft {
    return {
      uid: ++this.uid, key: '', keyTouched: false, type,
      label_en: '', label_ar: '', placeholder_en: '', placeholder_ar: '', help_en: '', help_ar: '',
      is_required: false, maps_to: '',
      options: OPTION_TYPES.includes(type) ? [{ value: '', label_en: '', label_ar: '' }] : [],
      min: '', max: '', min_length: '', max_length: '',
      mimes: FILE_TYPES.includes(type) ? ['pdf'] : [], max_kb: FILE_TYPES.includes(type) ? '5120' : '', max_files: FILE_TYPES.includes(type) ? '1' : '',
      vis_on: false, vis_field: '', vis_operator: 'equals', vis_value: '',
      origType: type, origValidation: null, open: true
    };
  }

  // ───────────────────────────── settings ─────────────────────────────

  setSetting<K extends keyof SettingsDraft>(key: K, value: SettingsDraft[K]): void {
    this.settings.update(s => ({ ...s, [key]: value }));
  }

  sLoc(base: SettingsLocBase): string {
    return this.settings()[`${base}_${this.locale()}` as keyof SettingsDraft] as string;
  }

  setSLoc(base: SettingsLocBase, value: string): void {
    this.setSetting(`${base}_${this.locale()}` as keyof SettingsDraft, value as never);
  }

  // ───────────────────────────── fields ─────────────────────────────

  patch(i: number, p: Partial<FieldDraft>): void {
    this.fields.update(list => list.map((f, idx) => (idx === i ? { ...f, ...p } : f)));
  }

  fLoc(f: FieldDraft, base: LocBase): string {
    return f[`${base}_${this.locale()}` as keyof FieldDraft] as string;
  }

  setFLoc(i: number, base: LocBase, value: string): void {
    const p: Partial<FieldDraft> = { [`${base}_${this.locale()}`]: value };
    // A new field's key follows its English label until the admin edits the key.
    const f = this.fields()[i];
    if (base === 'label' && this.locale() === 'en' && !f.keyTouched) p.key = snake(value);
    this.patch(i, p);
  }

  setKey(i: number, value: string): void {
    this.patch(i, { key: value.trim(), keyTouched: true });
  }

  setType(i: number, type: string): void {
    const f = this.fields()[i];
    const p: Partial<FieldDraft> = { type };
    if (OPTION_TYPES.includes(type) && !f.options.length) p.options = [{ value: '', label_en: '', label_ar: '' }];
    if (FILE_TYPES.includes(type) && !f.mimes.length) {
      p.mimes = ['pdf'];
      p.max_kb = f.max_kb || '5120';
      p.max_files = f.max_files || '1';
    }
    // email / phone columns only accept fields of that kind.
    if (!this.mapsToAllowedForType(f.maps_to, type)) p.maps_to = '';
    this.patch(i, p);
  }

  addField(): void {
    this.fields.update(list => [...list.map(f => ({ ...f, open: false })), this.newField('text')]);
    // Server error indices refer to the old order.
    this.clearFieldErrors();
  }

  async removeField(i: number): Promise<void> {
    const f = this.fields()[i];
    const usedBy = this.fields().filter((x, idx) => idx !== i && x.vis_on && x.vis_field && x.vis_field === f.key);
    if (f.key || f.label_en) {
      const ok = await this.dialog.confirm({
        title: 'web.forms.remove_field_title',
        text: usedBy.length ? 'web.forms.remove_field_used' : 'web.forms.remove_field_text',
        params: { key: f.key || f.label_en, count: usedBy.length },
        confirmText: 'common.remove',
        danger: true
      });
      if (!ok) return;
    }
    this.fields.update(list => list.filter((_, idx) => idx !== i));
    this.clearFieldErrors();
  }

  moveField(i: number, dir: -1 | 1): void {
    const j = i + dir;
    const list = [...this.fields()];
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    this.fields.set(list);
    this.clearFieldErrors();
  }

  toggle(i: number): void {
    this.patch(i, { open: !this.fields()[i].open });
  }

  expandAll(open: boolean): void {
    this.fields.update(list => list.map(f => ({ ...f, open })));
  }

  private clearFieldErrors(): void {
    const e = { ...this.errors() };
    for (const k of Object.keys(e)) if (k.startsWith('fields.')) delete e[k];
    this.errors.set(e);
  }

  isOptionType(type: string): boolean { return OPTION_TYPES.includes(type); }
  isLengthType(type: string): boolean { return LENGTH_TYPES.includes(type); }
  isNumberType(type: string): boolean { return NUMBER_TYPES.includes(type); }
  isFileType(type: string): boolean { return FILE_TYPES.includes(type); }

  // options
  addOption(i: number): void {
    const f = this.fields()[i];
    this.patch(i, { options: [...f.options, { value: '', label_en: '', label_ar: '' }] });
  }

  setOption(i: number, j: number, p: Partial<OptionDraft>): void {
    const f = this.fields()[i];
    this.patch(i, { options: f.options.map((o, idx) => (idx === j ? { ...o, ...p } : o)) });
  }

  removeOption(i: number, j: number): void {
    const f = this.fields()[i];
    this.patch(i, { options: f.options.filter((_, idx) => idx !== j) });
  }

  moveOption(i: number, j: number, dir: -1 | 1): void {
    const f = this.fields()[i];
    const k = j + dir;
    if (k < 0 || k >= f.options.length) return;
    const opts = [...f.options];
    [opts[j], opts[k]] = [opts[k], opts[j]];
    this.patch(i, { options: opts });
  }

  toggleMime(i: number, mime: string, on: boolean): void {
    const f = this.fields()[i];
    const set = new Set(f.mimes);
    if (on) set.add(mime); else set.delete(mime);
    this.patch(i, { mimes: FILE_MIMES.filter(m => set.has(m)) });
  }

  // maps_to
  mapsToAllowedForType(value: string, type: string): boolean {
    if (!value) return true;
    if (value === 'email') return type === 'email';
    if (value === 'phone') return type === 'phone';
    return true;
  }

  mapsToTakenBy(value: string, i: number): FieldDraft | undefined {
    return this.fields().find((f, idx) => idx !== i && f.maps_to === value);
  }

  // visibility
  /** Fields a rule can depend on: any other field with a key. */
  visTargets(i: number): FieldDraft[] {
    return this.fields().filter((f, idx) => idx !== i && f.key);
  }

  visTarget(f: FieldDraft): FieldDraft | undefined {
    return this.fields().find(x => x !== f && x.key === f.vis_field);
  }

  needsVisValue(op: string): boolean {
    return op !== 'filled' && op !== 'empty';
  }

  // labels
  typeLabel(type: string): string {
    return enumLabel(this.i18n, 'form_field_type', type);
  }

  formTypeLabel(type: string): string {
    return enumLabel(this.i18n, 'form_type', type);
  }

  mapsLabel(value: string): string {
    return enumLabel(this.i18n, 'form_field_maps_to', value);
  }

  opLabel(op: string): string {
    return this.i18n.translate(`web.forms.op.${op}`);
  }

  // ───────────────────────────── errors ─────────────────────────────

  err(path: string): string | null {
    return this.errors()[path] ?? null;
  }

  /** The label error for whichever language is shown, plus the EN one when editing AR (EN is the required one). */
  locErr(prefix: string, base: string): string | null {
    return this.err(`${prefix}${base}_${this.locale()}`) ?? (this.locale() === 'ar' ? this.err(`${prefix}${base}_en`) : null);
  }

  cardErrorCount(i: number): number {
    const p = `fields.${i}.`;
    return Object.keys(this.errors()).filter(k => k.startsWith(p)).length;
  }

  cardOtherErrors(i: number): { path: string; msg: string }[] {
    const p = `fields.${i}.`;
    return Object.entries(this.errors())
      .filter(([k]) => k.startsWith(p) && !INLINE_ERRORS.test(k.slice(p.length)))
      .map(([k, msg]) => ({ path: k.slice(p.length), msg }));
  }

  /** Errors that belong to no card or settings input (e.g. `fields` itself). */
  generalErrors = computed(() =>
    Object.entries(this.errors())
      .filter(([k]) => !/^fields\.\d+\./.test(k) && !SETTINGS_PATHS.has(k))
      .map(([path, msg]) => ({ path, msg }))
  );

  private validate(): Record<string, string> {
    const e: Record<string, string> = {};
    const s = this.settings();
    const req = 'web.forms.err.required';

    if (!this.isSystem()) {
      if (!s.key.trim()) e['key'] = req;
      else if (!/^[a-z][a-z0-9]*(?:[_-][a-z0-9]+)*$/.test(s.key.trim())) e['key'] = 'web.forms.err.form_key';
      if (!s.type) e['type'] = req;
    }
    if (!s.name_en.trim()) e['name_en'] = req;
    const badEmail = lines(s.notify_emails).find(x => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x));
    if (badEmail) e['notify_emails'] = 'web.forms.err.email_list';

    const list = this.fields();
    if (!list.length) e['fields'] = 'web.forms.err.no_fields';
    const keys = new Map<string, number>();
    const maps = new Map<string, number>();

    list.forEach((f, i) => {
      const p = `fields.${i}.`;
      const key = f.key.trim();
      if (!key) e[p + 'key'] = req;
      else if (RESERVED_KEYS.includes(key)) e[p + 'key'] = 'web.forms.err.reserved_key';
      else if (!/^[a-z][a-z0-9_]*$/.test(key)) e[p + 'key'] = 'web.forms.err.field_key';
      else if (keys.has(key)) e[p + 'key'] = 'web.forms.err.duplicate_key';
      else keys.set(key, i);

      if (!f.type) e[p + 'type'] = req;
      if (!f.label_en.trim()) e[p + 'label_en'] = req;

      if (f.maps_to) {
        if (!this.mapsToAllowedForType(f.maps_to, f.type)) {
          e[p + 'maps_to'] = f.maps_to === 'email' ? 'web.forms.err.maps_email' : 'web.forms.err.maps_phone';
        } else if (maps.has(f.maps_to)) {
          e[p + 'maps_to'] = 'web.forms.err.maps_once';
        } else {
          maps.set(f.maps_to, i);
        }
      }

      if (this.isOptionType(f.type)) {
        if (!f.options.length) e[p + 'options'] = 'web.forms.err.no_options';
        const seen = new Set<string>();
        f.options.forEach((o, j) => {
          const v = o.value.trim();
          if (!v) e[`${p}options.${j}.value`] = req;
          else if (seen.has(v)) e[`${p}options.${j}.value`] = 'web.forms.err.duplicate_option';
          seen.add(v);
          if (!o.label_en.trim()) e[`${p}options.${j}.label_en`] = req;
        });
      }

      const bad = (a: string, b: string) => numOrUndef(a) !== undefined && numOrUndef(b) !== undefined && Number(a) > Number(b);
      if (this.isNumberType(f.type) && bad(f.min, f.max)) e[p + 'validation.max'] = 'web.forms.err.min_max';
      if (this.isLengthType(f.type)) {
        if (f.min_length && !(Number(f.min_length) >= 0)) e[p + 'validation.min_length'] = 'web.forms.err.non_negative';
        if (bad(f.min_length, f.max_length)) e[p + 'validation.max_length'] = 'web.forms.err.min_max';
      }
      if (this.isFileType(f.type)) {
        if (!f.mimes.length) e[p + 'validation.mimes'] = 'web.forms.err.no_mimes';
        const kb = numOrUndef(f.max_kb);
        if (kb !== undefined && (kb < 1 || kb > MAX_KB)) e[p + 'validation.max_kb'] = 'web.forms.err.max_kb';
        const files = numOrUndef(f.max_files);
        if (files !== undefined && (files < 1 || files > MAX_FILES || !Number.isInteger(files))) e[p + 'validation.max_files'] = 'web.forms.err.max_files';
      }

      if (f.vis_on) {
        if (!f.vis_field) e[p + 'visibility.field'] = req;
        else if (f.vis_field === key || !list.some((x, idx) => idx !== i && x.key.trim() === f.vis_field)) {
          e[p + 'visibility.field'] = 'web.forms.err.vis_field';
        }
        if (this.needsVisValue(f.vis_operator) && !f.vis_value.trim()) e[p + 'visibility.value'] = req;
      }
    });
    return e;
  }

  // ───────────────────────────── save ─────────────────────────────

  private toField(f: FieldDraft, i: number): WebsiteFormField {
    // Start from the API's validation only if the type is unchanged, minus the
    // keys this editor shows, so e.g. an email field's max_length survives.
    const v: Record<string, unknown> = {};
    if (f.origValidation && f.type === f.origType) {
      for (const [k, val] of Object.entries(f.origValidation)) {
        if (!this.shownValidationKeys(f.type).includes(k)) v[k] = val;
      }
    }
    if (this.isNumberType(f.type)) {
      v['min'] = numOrUndef(f.min);
      v['max'] = numOrUndef(f.max);
    }
    if (this.isLengthType(f.type)) {
      v['min_length'] = numOrUndef(f.min_length);
      v['max_length'] = numOrUndef(f.max_length);
    }
    if (this.isFileType(f.type)) {
      v['mimes'] = f.mimes;
      v['max_kb'] = numOrUndef(f.max_kb);
      v['max_files'] = numOrUndef(f.max_files);
    }
    for (const k of Object.keys(v)) if (v[k] === undefined) delete v[k];

    let visibility: FormFieldVisibility | null = null;
    if (f.vis_on && f.vis_field) {
      visibility = { field: f.vis_field, operator: f.vis_operator };
      if (f.vis_operator === 'in' || f.vis_operator === 'not_in') {
        visibility.value = f.vis_value.split(',').map(x => x.trim()).filter(Boolean);
      } else if (this.needsVisValue(f.vis_operator)) {
        visibility.value = f.vis_value.trim();
      }
    }

    return {
      key: f.key.trim(),
      type: f.type,
      label_en: f.label_en.trim(),
      label_ar: nullIfEmpty(f.label_ar.trim()),
      placeholder_en: nullIfEmpty(f.placeholder_en.trim()),
      placeholder_ar: nullIfEmpty(f.placeholder_ar.trim()),
      help_en: nullIfEmpty(f.help_en.trim()),
      help_ar: nullIfEmpty(f.help_ar.trim()),
      is_required: f.is_required,
      maps_to: f.maps_to || null,
      options: this.isOptionType(f.type)
        ? f.options.map<FormFieldOption>(o => ({ value: o.value.trim(), label_en: o.label_en.trim(), label_ar: nullIfEmpty(o.label_ar.trim()) }))
        : [],
      validation: Object.keys(v).length ? (v as FormFieldValidation) : null,
      visibility,
      sort_order: i
    };
  }

  private shownValidationKeys(type: string): string[] {
    if (this.isNumberType(type)) return ['min', 'max'];
    if (this.isLengthType(type)) return ['min_length', 'max_length'];
    if (this.isFileType(type)) return ['mimes', 'max_kb', 'max_files'];
    return [];
  }

  save(): void {
    if (!this.canEdit() || this.saving()) return;
    const local = this.validate();
    if (Object.keys(local).length) {
      this.showErrors(local, 'web.forms.fix_errors');
      return;
    }

    const s = this.settings();
    const fieldsOut: WebsiteFormField[] = this.fields().map((f, i) => this.toField(f, i));
    const body: FormInput = {
      name_en: s.name_en.trim(),
      name_ar: nullIfEmpty(s.name_ar.trim()),
      description_en: nullIfEmpty(s.description_en.trim()),
      description_ar: nullIfEmpty(s.description_ar.trim()),
      submit_label_en: nullIfEmpty(s.submit_label_en.trim()),
      submit_label_ar: nullIfEmpty(s.submit_label_ar.trim()),
      success_message_en: nullIfEmpty(s.success_message_en.trim()),
      success_message_ar: nullIfEmpty(s.success_message_ar.trim()),
      requires_consent: s.requires_consent,
      consent_text_en: nullIfEmpty(s.consent_text_en.trim()),
      consent_text_ar: nullIfEmpty(s.consent_text_ar.trim()),
      notify_emails: lines(s.notify_emails),
      is_active: s.is_active,
      fields: fieldsOut
    };
    // A system form's key and type are fixed (the site looks it up by key).
    if (!this.isSystem()) {
      body['key'] = s.key.trim();
      body['type'] = s.type;
    }

    this.saving.set(true);
    this.errors.set({});
    this.formError.set(null);
    const id = this.id();
    const req = id === null ? this.api.createForm(body) : this.api.updateForm(id, body);
    req.subscribe({
      next: f => {
        this.saving.set(false);
        this.dialog.toast('success', 'common.saved');
        if (id === null) {
          this.id.set(f.id);
          this.router.navigate(['/dashboard/website/forms', f.id], { replaceUrl: true });
        }
        // Keep the open/closed state of cards the admin was working in.
        const open = new Set(this.fields().filter(x => x.open).map(x => x.key));
        this.apply(f.fields ? f : { ...f, fields: fieldsOut });
        this.fields.update(list => list.map(x => ({ ...x, open: open.has(x.key) })));
      },
      error: e => {
        this.saving.set(false);
        if (e?.status === 422) {
          this.showErrors(fieldErrors(e), errorMessage(e, 'web.forms.fix_errors'));
        } else {
          this.formError.set(errorMessage(e, 'web.forms.save_failed'));
        }
      }
    });
  }

  private showErrors(errors: Record<string, string>, message: string): void {
    this.errors.set(errors);
    this.formError.set(message);
    // Open every card with a problem; EN is the required language, so show it if that is where the gap is.
    const bad = new Set(Object.keys(errors).map(k => /^fields\.(\d+)\./.exec(k)?.[1]).filter(Boolean).map(Number));
    this.fields.update(list => list.map((f, i) => (bad.has(i) ? { ...f, open: true } : f)));
    if (Object.keys(errors).some(k => k.endsWith('_en'))) this.locale.set('en');
    setTimeout(() => document.querySelector('.form-error, .field-card.has-error')?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  }

  async deleteForm(): Promise<void> {
    const f = this.form();
    if (!f || f.is_system) return;
    const ok = await this.dialog.confirm({
      title: 'web.forms.delete_title',
      text: f.leads_count ? 'web.forms.delete_text_leads' : 'web.forms.delete_text',
      params: { name: this.title(), count: f.leads_count ?? 0 },
      confirmText: 'common.delete',
      danger: true
    });
    if (!ok) return;
    this.api.deleteForm(f.id).subscribe({
      next: () => {
        this.dialog.toast('success', 'web.forms.deleted');
        this.back();
      },
      error: err => this.dialog.error('common.error', errorMessage(err, 'web.forms.delete_failed'))
    });
  }

  back(): void {
    this.router.navigate(['/dashboard/website/forms']);
  }

  viewLeads(): void {
    const id = this.id();
    if (id !== null) this.router.navigate(['/dashboard/website/leads'], { queryParams: { form_id: id } });
  }

  // ───────────────────────────── preview ─────────────────────────────

  pv(f: FieldDraft): unknown {
    return this.previewValues()[f.key];
  }

  setPv(f: FieldDraft, value: unknown): void {
    this.previewValues.update(v => ({ ...v, [f.key]: value }));
  }

  togglePvMulti(f: FieldDraft, value: string, on: boolean): void {
    const cur = Array.isArray(this.pv(f)) ? (this.pv(f) as string[]) : [];
    this.setPv(f, on ? [...cur, value] : cur.filter(x => x !== value));
  }

  pvHas(f: FieldDraft, value: string): boolean {
    const cur = this.pv(f);
    return Array.isArray(cur) && cur.includes(value);
  }

  /** Same rule the public site applies: hidden fields are neither shown nor required. */
  visibleInPreview(f: FieldDraft): boolean {
    if (!f.vis_on || !f.vis_field) return true;
    const raw = this.previewValues()[f.vis_field];
    const vals = (Array.isArray(raw) ? raw : raw === undefined || raw === null || raw === '' || raw === false ? [] : [raw]).map(String);
    const list = f.vis_value.split(',').map(x => x.trim()).filter(Boolean);
    switch (f.vis_operator) {
      case 'filled': return vals.length > 0;
      case 'empty': return vals.length === 0;
      case 'equals': return vals.includes(f.vis_value.trim());
      case 'not_equals': return !vals.includes(f.vis_value.trim());
      case 'in': return vals.some(v => list.includes(v));
      case 'not_in': return !vals.some(v => list.includes(v));
      default: return true;
    }
  }

  pvText(f: FieldDraft, base: LocBase): string {
    const own = this.fLoc(f, base);
    // A missing Arabic text falls back to English on the site too.
    return own || (f[`${base}_en` as keyof FieldDraft] as string);
  }

  pvSetting(base: SettingsLocBase): string {
    const own = this.sLoc(base);
    return own || (this.settings()[`${base}_en` as keyof SettingsDraft] as string);
  }

  optLabel(o: OptionDraft): string {
    return (this.locale() === 'ar' && o.label_ar) || o.label_en || o.value;
  }

  inputType(type: string): string {
    switch (type) {
      case 'email': return 'email';
      case 'phone': return 'tel';
      case 'number': return 'number';
      case 'date': return 'date';
      case 'url': return 'url';
      default: return 'text';
    }
  }

  pvDefault(key: string): string {
    return this.i18n.translate(key);
  }
}

/** Settings inputs that render their own error. */
const SETTINGS_PATHS = new Set([
  'key', 'type', 'name_en', 'name_ar', 'description_en', 'description_ar', 'submit_label_en', 'submit_label_ar',
  'success_message_en', 'success_message_ar', 'consent_text_en', 'consent_text_ar', 'notify_emails', 'requires_consent', 'is_active'
]);
