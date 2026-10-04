import { Component, DestroyRef, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { TPipe } from '../../../../../../core/i18n/t.pipe';
import { Locale } from '../../../../../../core/services/website/website.models';
import { debounce } from '../../../../../../shared/utils/debounce.util';
import { BlockLookups, RefKind, RefOption } from './block-lookups.service';

type RefValue = number | string;

/**
 * Picker for the reference field types (`product(s)`, `faqs`, `form`,
 * `page(s)`, `category`, `author`, library CTA). Single mode binds one value,
 * multiple mode an ordered list — order matters because blocks render the
 * chosen products / FAQs / pages in exactly that order.
 */
@Component({
  selector: 'app-ref-picker',
  standalone: true,
  imports: [CommonModule, TPipe],
  templateUrl: './ref-picker.html',
  styleUrls: ['./block-field.css']
})
export class RefPicker {
  private lookups = inject(BlockLookups);
  private destroyRef = inject(DestroyRef);

  kind = input.required<RefKind>();
  locale = input.required<Locale>();
  value = input<unknown>(null);
  multiple = input(false);
  disabled = input(false);
  invalid = input(false);
  inputId = input<string>('');

  valueChange = output<unknown>();

  options = signal<RefOption[]>([]);
  loading = signal(false);
  /** Page search state (pages are searched, not listed). */
  q = signal('');
  results = signal<RefOption[]>([]);
  searching = signal(false);
  private pageLabels = signal<Record<string, string>>({});
  private optSub?: Subscription;
  private searchSub?: Subscription;

  selectedIds = computed<RefValue[]>(() => {
    const v = this.value();
    if (this.multiple()) return Array.isArray(v) ? (v as RefValue[]) : [];
    return v === null || v === undefined || v === '' ? [] : [v as RefValue];
  });

  private byValue = computed(() => {
    const m = new Map<string, RefOption>();
    for (const o of this.options()) m.set(String(o.value), o);
    return m;
  });

  /** Options not chosen yet (multi) — single mode lists everything. */
  available = computed(() => {
    if (!this.multiple()) return this.options();
    const chosen = new Set(this.selectedIds().map(String));
    return this.options().filter(o => !chosen.has(String(o.value)));
  });

  isPage = computed(() => this.kind() === 'page');

  onSearch = debounce((q: string) => this.runSearch(q), 300);

  constructor() {
    // Static lists load per kind / content language (FAQs differ per language).
    effect(() => {
      const kind = this.kind();
      const locale = this.locale();
      untracked(() => {
        this.optSub?.unsubscribe();
        if (kind === 'page') return;
        this.loading.set(true);
        this.optSub = this.lookups.options(kind, locale).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(list => {
          this.options.set(list);
          this.loading.set(false);
        });
      });
    });
    // Resolve titles for already-chosen pages.
    effect(() => {
      if (!this.isPage()) return;
      const ids = this.selectedIds();
      untracked(() => {
        for (const id of ids) {
          if (this.pageLabels()[String(id)]) continue;
          this.lookups.pageTitle(Number(id)).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(label =>
            this.pageLabels.update(m => ({ ...m, [String(id)]: label }))
          );
        }
      });
    });
  }

  labelOf(id: RefValue): string {
    if (this.isPage()) return this.pageLabels()[String(id)] ?? `#${id}`;
    return this.byValue().get(String(id))?.label ?? (this.loading() ? '…' : `#${id}`);
  }

  subOf(id: RefValue): string {
    return this.byValue().get(String(id))?.sub ?? '';
  }

  /** `<select>` gives strings back; map to the option's real (number | key) value. */
  pickFromSelect(event: Event): void {
    const el = event.target as HTMLSelectElement;
    const raw = el.value;
    const opt = this.byValue().get(raw);
    if (this.multiple()) {
      el.value = '';
      if (opt) this.valueChange.emit([...this.selectedIds(), opt.value]);
      return;
    }
    this.valueChange.emit(opt ? opt.value : null);
  }

  choose(opt: RefOption): void {
    if (this.isPage()) this.pageLabels.update(m => ({ ...m, [String(opt.value)]: opt.label }));
    if (this.multiple()) {
      if (!this.selectedIds().some(v => String(v) === String(opt.value))) {
        this.valueChange.emit([...this.selectedIds(), opt.value]);
      }
    } else {
      this.valueChange.emit(opt.value);
    }
    this.q.set('');
    this.results.set([]);
  }

  remove(id: RefValue): void {
    if (this.multiple()) this.valueChange.emit(this.selectedIds().filter(v => v !== id));
    else this.valueChange.emit(null);
  }

  move(index: number, delta: number): void {
    const list = [...this.selectedIds()];
    const j = index + delta;
    if (j < 0 || j >= list.length) return;
    [list[index], list[j]] = [list[j], list[index]];
    this.valueChange.emit(list);
  }

  isChosen(opt: RefOption): boolean {
    return this.selectedIds().some(v => String(v) === String(opt.value));
  }

  private runSearch(q: string): void {
    this.q.set(q);
    this.searchSub?.unsubscribe();
    if (!q.trim()) {
      this.results.set([]);
      return;
    }
    this.searching.set(true);
    this.searchSub = this.lookups.searchPages(q.trim()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(list => {
      this.results.set(list);
      this.searching.set(false);
    });
  }
}
