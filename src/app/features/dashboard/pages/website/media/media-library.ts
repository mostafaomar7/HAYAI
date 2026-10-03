import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TPipe } from '../../../../../core/i18n/t.pipe';
import { I18nService } from '../../../../../core/i18n/i18n.service';
import { DialogService } from '../../../../../core/services/dialog.service';
import { WebsiteApiService, errorMessage, fieldErrors } from '../../../../../core/services/website/website-api.service';
import { WebsiteContextService } from '../../../../../core/services/website/website-context.service';
import { Locale, MediaUsage, WebsiteMedia } from '../../../../../core/services/website/website.models';
import { PaginationComponent } from '../../../../../shared/ui/pagination.component/pagination.component';
import { debounce } from '../../../../../shared/utils/debounce.util';
import { fmtDate, nullIfEmpty } from '../shared/website-utils';

const MB = 1024 * 1024;

/**
 * Section 11 upload rules, checked here so a 90 MB PDF fails in a second
 * instead of after the upload. SVG is refused by the backend on purpose
 * (it can carry script), so it gets its own message rather than "wrong type".
 */
const LIMITS: { exts: string[]; max: number; kind: 'image' | 'document' | 'video' }[] = [
  { exts: ['jpg', 'jpeg', 'png', 'webp', 'gif'], max: 8 * MB, kind: 'image' },
  { exts: ['pdf'], max: 20 * MB, kind: 'document' },
  { exts: ['mp4', 'webm'], max: 100 * MB, kind: 'video' }
];
const ACCEPT = LIMITS.flatMap(l => l.exts.map(e => '.' + e)).join(',');

type QueueStatus = 'ready' | 'invalid' | 'uploading' | 'done' | 'duplicate' | 'failed';

interface QueueItem {
  uid: number;
  file: File;
  kind: 'image' | 'document' | 'video' | null;
  previewUrl: string | null;
  altEn: string;
  altAr: string;
  status: QueueStatus;
  /** i18n key or backend message. */
  message: string | null;
  params?: Record<string, string | number>;
  result?: WebsiteMedia;
}

interface DetailDraft {
  alt_en: string;
  alt_ar: string;
  caption_en: string;
  caption_ar: string;
  focal_x: string;
  focal_y: string;
}

/**
 * Media library: every image, PDF and video the website uses. Images get
 * responsive variants generated in the background after upload
 * (`variants_status` pending → ready), and their alt text is what screen
 * readers and image search see, so missing alt is flagged everywhere.
 */
@Component({
  selector: 'app-website-media-library',
  standalone: true,
  imports: [CommonModule, TPipe, PaginationComponent],
  templateUrl: './media-library.html',
  styleUrls: ['../shared/website.shared.css', './media-library.css']
})
export class MediaLibrary {
  private api = inject(WebsiteApiService);
  private ctx = inject(WebsiteContextService);
  private dialog = inject(DialogService);
  private i18n = inject(I18nService);
  private destroyRef = inject(DestroyRef);

  readonly accept = ACCEPT;

  items = signal<WebsiteMedia[]>([]);
  loading = signal(true);
  loadError = signal<string | null>(null);
  total = signal(0);
  readonly perPage = 24;
  page = signal(1);
  q = signal('');
  kind = signal('');
  kinds = signal<string[]>(['image', 'document', 'video']);

  // upload
  queue = signal<QueueItem[]>([]);
  dragOver = signal(false);
  uploading = signal(false);
  private uid = 0;

  // detail
  selected = signal<WebsiteMedia | null>(null);
  detailLoading = signal(false);
  usage = signal<MediaUsage[] | null>(null);
  usageLoading = signal(false);
  detail = signal<DetailDraft>({ alt_en: '', alt_ar: '', caption_en: '', caption_ar: '', focal_x: '', focal_y: '' });
  detailSaving = signal(false);
  detailError = signal<string | null>(null);
  detailErrors = signal<Record<string, string>>({});

  canUpload = computed(() => this.ctx.can('media.upload'));
  canDelete = computed(() => this.ctx.can('media.delete'));
  lang = computed<Locale>(() => (this.i18n.lang() === 'ar' ? 'ar' : 'en'));
  missingAltOnPage = computed(() => this.items().filter(m => this.missingAlt(m).length).length);
  readyCount = computed(() => this.queue().filter(q => q.status === 'ready').length);

  onSearch = debounce((v: string) => {
    this.q.set(v.trim());
    this.page.set(1);
    this.load();
  });

  constructor() {
    this.load();
    this.ctx.enums().pipe(takeUntilDestroyed()).subscribe({
      next: e => { if (e.media_kinds?.length) this.kinds.set(e.media_kinds); },
      error: () => {}
    });
    this.destroyRef.onDestroy(() => this.queue().forEach(q => q.previewUrl && URL.revokeObjectURL(q.previewUrl)));
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.api
      .media({ page: this.page(), per_page: this.perPage, q: this.q() || undefined, kind: this.kind() || undefined })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          this.items.set(res.items);
          this.total.set(res.pagination.total);
          this.loading.set(false);
        },
        error: err => {
          this.items.set([]);
          this.loadError.set(errorMessage(err, 'web.medialib.load_failed'));
          this.loading.set(false);
        }
      });
  }

  setKind(v: string): void {
    this.kind.set(v);
    this.page.set(1);
    this.load();
  }

  goToPage(p: number): void {
    this.page.set(p);
    this.load();
  }

  kindLabel(k: string): string {
    const key = `web.medialib.kind_${k}`;
    const t = this.i18n.translate(key);
    return t === key ? k : t;
  }

  thumb(m: WebsiteMedia): string | null {
    if (m.kind !== 'image') return null;
    return m.variants?.find(v => v.width >= 300 && v.width <= 800)?.url ?? m.variants?.[0]?.url ?? m.url;
  }

  /**
   * Locales whose alt text is missing on an image. The per-language fields are
   * authoritative when the payload has them; otherwise fall back to `alt`.
   */
  missingAlt(m: WebsiteMedia): Locale[] {
    if (m.kind !== 'image') return [];
    if (!('alt_en' in m) && !('alt_ar' in m)) return m.alt ? [] : ['en', 'ar'];
    return (['en', 'ar'] as Locale[]).filter(l => !(m[`alt_${l}`] ?? '').toString().trim());
  }

  size(bytes: number | null | undefined): string {
    if (bytes === null || bytes === undefined) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < MB) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / MB).toFixed(1)} MB`;
  }

  date(v: string | undefined): string {
    return fmtDate(v, this.lang(), true);
  }

  name(m: WebsiteMedia): string {
    return m.original_name || m.filename || `#${m.id}`;
  }

  // ── upload queue ────────────────────────────────────────────────

  onDragOver(e: DragEvent): void {
    if (!this.canUpload()) return;
    e.preventDefault();
    this.dragOver.set(true);
  }

  onDrop(e: DragEvent): void {
    e.preventDefault();
    this.dragOver.set(false);
    if (!this.canUpload()) return;
    this.addFiles(Array.from(e.dataTransfer?.files ?? []));
  }

  onPick(e: Event): void {
    const input = e.target as HTMLInputElement;
    this.addFiles(Array.from(input.files ?? []));
    input.value = '';
  }

  private addFiles(files: File[]): void {
    const added = files.map(f => this.check(f));
    this.queue.update(q => [...q, ...added]);
  }

  private check(file: File): QueueItem {
    const ext = (file.name.split('.').pop() ?? '').toLowerCase();
    const base: QueueItem = {
      uid: ++this.uid, file, kind: null, previewUrl: null, altEn: '', altAr: '', status: 'ready', message: null
    };
    if (ext === 'svg' || file.type === 'image/svg+xml') {
      return { ...base, status: 'invalid', message: 'web.medialib.svg_rejected' };
    }
    const rule = LIMITS.find(l => l.exts.includes(ext));
    if (!rule) {
      return { ...base, status: 'invalid', message: 'web.medialib.type_rejected', params: { ext: ext || '?' } };
    }
    if (file.size > rule.max) {
      return {
        ...base, kind: rule.kind, status: 'invalid', message: 'web.medialib.too_large',
        params: { max: Math.round(rule.max / MB), size: this.size(file.size) }
      };
    }
    return { ...base, kind: rule.kind, previewUrl: rule.kind === 'image' ? URL.createObjectURL(file) : null };
  }

  setQueueAlt(uid: number, field: 'altEn' | 'altAr', value: string): void {
    this.queue.update(q => q.map(i => (i.uid === uid ? { ...i, [field]: value } : i)));
  }

  dropQueued(uid: number): void {
    const item = this.queue().find(i => i.uid === uid);
    if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
    this.queue.update(q => q.filter(i => i.uid !== uid));
  }

  clearFinished(): void {
    this.queue().filter(i => i.status !== 'ready' && i.status !== 'uploading')
      .forEach(i => i.previewUrl && URL.revokeObjectURL(i.previewUrl));
    this.queue.update(q => q.filter(i => i.status === 'ready' || i.status === 'uploading'));
  }

  queuedMissingAlt(i: QueueItem): boolean {
    return i.kind === 'image' && (!i.altEn.trim() || !i.altAr.trim());
  }

  /** One at a time: parallel uploads of 100 MB videos would starve each other. */
  async uploadAll(): Promise<void> {
    const pending = this.queue().filter(i => i.status === 'ready');
    if (!pending.length) return;
    if (pending.some(i => this.queuedMissingAlt(i))) {
      const go = await this.dialog.confirm({
        title: 'web.medialib.alt_missing_title',
        text: 'web.medialib.alt_missing_text',
        confirmText: 'web.medialib.upload_anyway'
      });
      if (!go) return;
    }
    this.uploading.set(true);
    let added = 0;
    // Ids already on screen or returned earlier in this batch: the backend hands
    // back the existing item for a re-upload, so a known id means "duplicate".
    const knownIds = new Set(this.items().map(i => i.id));
    for (const item of pending) {
      this.patchQueue(item.uid, { status: 'uploading', message: null });
      const started = Date.now();
      try {
        const m = await this.uploadOne(item);
        // The backend de-duplicates by content hash and answers with the
        // existing item instead of a new one. The contract does not promise a
        // flag, so an item created well before this upload started counts too.
        const created = m.created_at ? Date.parse(m.created_at) : NaN;
        const dup = !!((m as any).duplicate || (m as any).is_duplicate || (m as any).existing)
          || knownIds.has(m.id)
          || (!isNaN(created) && created < started - 60_000);
        knownIds.add(m.id);
        this.patchQueue(item.uid, {
          status: dup ? 'duplicate' : 'done',
          result: m,
          message: dup ? 'web.medialib.duplicate' : null,
          params: dup ? { name: this.name(m) } : undefined
        });
        if (!dup) added++;
      } catch (err: any) {
        const fe = fieldErrors(err);
        this.patchQueue(item.uid, { status: 'failed', message: fe['file'] || errorMessage(err, 'web.medialib.upload_failed') });
      }
    }
    this.uploading.set(false);
    if (added) this.dialog.toast('success', 'web.medialib.uploaded', { count: added });
    this.page.set(1);
    this.load();
  }

  private uploadOne(item: QueueItem): Promise<WebsiteMedia> {
    const form = new FormData();
    form.append('file', item.file);
    if (item.altEn.trim()) form.append('alt_en', item.altEn.trim());
    if (item.altAr.trim()) form.append('alt_ar', item.altAr.trim());
    return new Promise((resolve, reject) =>
      this.api.uploadMedia(form).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: resolve, error: reject })
    );
  }

  private patchQueue(uid: number, patch: Partial<QueueItem>): void {
    this.queue.update(q => q.map(i => (i.uid === uid ? { ...i, ...patch } : i)));
  }

  // ── detail ──────────────────────────────────────────────────────

  openDetail(m: WebsiteMedia): void {
    this.selected.set(m);
    this.fillDetail(m);
    this.detailError.set(null);
    this.detailErrors.set({});
    this.usage.set(null);
    this.detailLoading.set(true);
    this.api.mediaItem(m.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: full => {
        this.selected.set(full);
        this.fillDetail(full);
        this.detailLoading.set(false);
      },
      error: () => this.detailLoading.set(false)
    });
    this.loadUsage(m.id);
  }

  private loadUsage(id: number): void {
    this.usageLoading.set(true);
    this.api.mediaUsage(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: u => {
        this.usage.set(Array.isArray(u) ? u : []);
        this.usageLoading.set(false);
      },
      error: () => {
        this.usage.set(null);
        this.usageLoading.set(false);
      }
    });
  }

  private fillDetail(m: WebsiteMedia): void {
    const s = (v: unknown) => (v === null || v === undefined ? '' : String(v));
    this.detail.set({
      alt_en: s(m.alt_en ?? (m.alt_ar === undefined ? m.alt : '')),
      alt_ar: s(m.alt_ar),
      caption_en: s(m.caption_en ?? (m.caption_ar === undefined ? m.caption : '')),
      caption_ar: s(m.caption_ar),
      focal_x: s(m.focal_x ?? m.focal_point?.x),
      focal_y: s(m.focal_y ?? m.focal_point?.y)
    });
  }

  closeDetail(): void {
    this.selected.set(null);
  }

  setDetail<K extends keyof DetailDraft>(key: K, value: string): void {
    this.detail.update(d => ({ ...d, [key]: value }));
  }

  /** Click on the image → focal point in percent of its rendered box. */
  pickFocal(e: MouseEvent): void {
    if (!this.canUpload()) return;
    const el = e.currentTarget as HTMLElement;
    const r = el.getBoundingClientRect();
    const x = Math.round(((e.clientX - r.left) / r.width) * 100);
    const y = Math.round(((e.clientY - r.top) / r.height) * 100);
    this.detail.update(d => ({ ...d, focal_x: String(this.clamp(x)), focal_y: String(this.clamp(y)) }));
  }

  private clamp(n: number): number {
    return Math.min(100, Math.max(0, n));
  }

  focal(): { x: number; y: number } | null {
    const d = this.detail();
    if (d.focal_x === '' || d.focal_y === '') return null;
    const x = Number(d.focal_x);
    const y = Number(d.focal_y);
    return isNaN(x) || isNaN(y) ? null : { x: this.clamp(x), y: this.clamp(y) };
  }

  clearFocal(): void {
    this.detail.update(d => ({ ...d, focal_x: '', focal_y: '' }));
  }

  detailErrorFor(f: string): string | null {
    return this.detailErrors()[f] ?? null;
  }

  saveDetail(): void {
    const m = this.selected();
    if (!m) return;
    const d = this.detail();
    const num = (v: string) => (v === '' ? null : this.clamp(Math.round(Number(v))));
    const body = {
      alt_en: nullIfEmpty(d.alt_en.trim()),
      alt_ar: nullIfEmpty(d.alt_ar.trim()),
      caption_en: nullIfEmpty(d.caption_en.trim()),
      caption_ar: nullIfEmpty(d.caption_ar.trim()),
      focal_x: num(d.focal_x),
      focal_y: num(d.focal_y)
    };
    this.detailSaving.set(true);
    this.detailError.set(null);
    this.detailErrors.set({});
    this.api.updateMedia(m.id, body).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: updated => {
        this.detailSaving.set(false);
        const merged = { ...m, ...updated };
        this.selected.set(merged);
        this.items.update(list => list.map(i => (i.id === m.id ? merged : i)));
        this.dialog.toast('success', 'common.saved');
      },
      error: err => {
        this.detailSaving.set(false);
        if (err?.status === 422) {
          this.detailErrors.set(fieldErrors(err));
          this.detailError.set(errorMessage(err, 'web.medialib.save_failed'));
        } else {
          this.dialog.error('common.error', errorMessage(err, 'web.medialib.save_failed'));
        }
      }
    });
  }

  async copy(text: string | null | undefined): Promise<void> {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      this.dialog.toast('success', 'common.copied');
    } catch {
      this.dialog.toast('error', 'common.error');
    }
  }

  usageTitle(u: MediaUsage): string {
    const pick = ['title', 'name', 'label', 'key', 'path'].map(k => u[k]).find(v => typeof v === 'string' && v);
    return (pick as string) || `#${u.id}`;
  }

  usageExtra(u: MediaUsage): string[] {
    return ['field', 'locale', 'role', 'block']
      .map(k => u[k])
      .filter((v): v is string | number => (typeof v === 'string' && !!v) || typeof v === 'number')
      .map(String);
  }

  async remove(m: WebsiteMedia): Promise<void> {
    const ok = await this.dialog.confirm({
      title: 'web.medialib.delete_title',
      text: 'web.medialib.delete_text',
      params: { name: this.name(m) },
      confirmText: 'common.delete',
      danger: true
    });
    if (!ok) return;
    this.api.deleteMedia(m.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.dialog.toast('success', 'web.medialib.deleted');
        this.selected.set(null);
        if (this.items().length === 1 && this.page() > 1) this.page.set(this.page() - 1);
        this.load();
      },
      // 422 while anything still uses the file; the message names where, and
      // the usage list in the panel shows the same thing.
      error: err => {
        this.dialog.error('common.error', errorMessage(err, 'web.medialib.delete_failed'));
        if (this.selected()?.id === m.id) this.loadUsage(m.id);
      }
    });
  }
}
