import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TPipe } from '../../../../../core/i18n/t.pipe';
import { WebsiteApiService, errorMessage } from '../../../../../core/services/website/website-api.service';
import { WebsiteContextService } from '../../../../../core/services/website/website-context.service';
import { WebsiteMedia } from '../../../../../core/services/website/website.models';
import { DialogService } from '../../../../../core/services/dialog.service';
import { debounce } from '../../../../../shared/utils/debounce.util';

/**
 * Media-library picker for every `media` field (block images, featured image,
 * OG image, author photo, product gallery …).
 *
 * Single mode binds one id (`value` / `valueChange`); `multiple` mode binds an
 * ordered id list (`values` / `valuesChange`). The dialog lists the library,
 * searches it, and can upload in place — alt text is asked for on upload
 * because an image without it fails the SEO audit later anyway.
 */
@Component({
  selector: 'app-media-picker',
  standalone: true,
  imports: [CommonModule, TPipe],
  templateUrl: './media-picker.html',
  styleUrls: ['./website.shared.css', './media-picker.css']
})
export class MediaPicker {
  private api = inject(WebsiteApiService);
  private ctx = inject(WebsiteContextService);
  private dialog = inject(DialogService);

  value = input<number | null | undefined>(null);
  values = input<number[] | null | undefined>(null);
  multiple = input(false);
  /** Restricts the library to one kind (`image` by default). */
  kind = input<'image' | 'document' | 'video' | ''>('image');
  disabled = input(false);

  valueChange = output<number | null>();
  valuesChange = output<number[]>();

  /** Resolved items for the current selection, for thumbnails. */
  selected = signal<WebsiteMedia[]>([]);

  open = signal(false);
  library = signal<WebsiteMedia[]>([]);
  loading = signal(false);
  search = signal('');
  page = signal(1);
  lastPage = signal(1);
  uploading = signal(false);
  altEn = signal('');
  altAr = signal('');

  canUpload = computed(() => this.ctx.can('media.upload'));
  private cache = new Map<number, WebsiteMedia>();

  onSearch = debounce((v: string) => {
    this.search.set(v);
    this.page.set(1);
    this.loadLibrary();
  });

  constructor() {
    // Resolve thumbnails whenever the bound ids change from outside.
    effect(() => {
      const ids = this.multiple() ? (this.values() ?? []) : (this.value() ? [this.value() as number] : []);
      untracked(() => this.resolve(ids));
    });
  }

  private resolve(ids: number[]): void {
    const known = ids.map(id => this.cache.get(id)).filter((m): m is WebsiteMedia => !!m);
    this.selected.set(known);
    for (const id of ids.filter(i => !this.cache.has(i))) {
      this.api.mediaItem(id).subscribe({
        next: m => {
          this.cache.set(m.id, m);
          this.selected.set(ids.map(i => this.cache.get(i)).filter((x): x is WebsiteMedia => !!x));
        },
        error: () => {}
      });
    }
  }

  openDialog(): void {
    if (this.disabled()) return;
    this.open.set(true);
    this.loadLibrary();
  }

  close(): void {
    this.open.set(false);
  }

  loadLibrary(): void {
    this.loading.set(true);
    this.api.media({ page: this.page(), per_page: 24, q: this.search() || undefined, kind: this.kind() || undefined }).subscribe({
      next: res => {
        this.library.set(res.items);
        res.items.forEach(m => this.cache.set(m.id, m));
        this.lastPage.set(res.pagination.last_page || 1);
        this.loading.set(false);
      },
      error: () => {
        this.library.set([]);
        this.loading.set(false);
      }
    });
  }

  goPage(delta: number): void {
    const next = this.page() + delta;
    if (next < 1 || next > this.lastPage()) return;
    this.page.set(next);
    this.loadLibrary();
  }

  isSelected(m: WebsiteMedia): boolean {
    return this.multiple() ? (this.values() ?? []).includes(m.id) : this.value() === m.id;
  }

  choose(m: WebsiteMedia): void {
    this.cache.set(m.id, m);
    if (this.multiple()) {
      const cur = this.values() ?? [];
      this.valuesChange.emit(cur.includes(m.id) ? cur.filter(i => i !== m.id) : [...cur, m.id]);
      return;
    }
    this.valueChange.emit(m.id);
    this.close();
  }

  clear(id?: number): void {
    if (this.multiple()) {
      this.valuesChange.emit((this.values() ?? []).filter(i => i !== id));
    } else {
      this.valueChange.emit(null);
    }
  }

  move(id: number, delta: number): void {
    const list = [...(this.values() ?? [])];
    const i = list.indexOf(id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    this.valuesChange.emit(list);
  }

  upload(event: Event): void {
    const inputEl = event.target as HTMLInputElement;
    const file = inputEl.files?.[0];
    inputEl.value = '';
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    if (this.altEn().trim()) form.append('alt_en', this.altEn().trim());
    if (this.altAr().trim()) form.append('alt_ar', this.altAr().trim());
    this.uploading.set(true);
    this.api.uploadMedia(form).subscribe({
      next: m => {
        this.uploading.set(false);
        this.altEn.set('');
        this.altAr.set('');
        this.cache.set(m.id, m);
        this.library.update(list => [m, ...list.filter(x => x.id !== m.id)]);
        this.choose(m);
      },
      error: err => {
        this.uploading.set(false);
        this.dialog.error('common.error', errorMessage(err, 'web.media.upload_failed'));
      }
    });
  }

  thumb(m: WebsiteMedia): string | null {
    if (m.kind !== 'image') return null;
    return m.variants?.find(v => v.width <= 400)?.url ?? m.url;
  }
}
