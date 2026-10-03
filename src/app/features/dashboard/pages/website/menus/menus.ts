import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TPipe } from '../../../../../core/i18n/t.pipe';
import { I18nService } from '../../../../../core/i18n/i18n.service';
import { DialogService } from '../../../../../core/services/dialog.service';
import { WebsiteApiService, errorMessage, fieldErrors } from '../../../../../core/services/website/website-api.service';
import { WebsiteContextService } from '../../../../../core/services/website/website-context.service';
import {
  AttachedCta, Locale, MenuItemNode, WebsiteCta, WebsiteMenu, WebsitePageRow
} from '../../../../../core/services/website/website.models';
import { pickLocalized, translationFor } from '../shared/website-utils';

/** Editable menu node. `uid` is local only (tracking + error paths), never sent. */
interface EditNode {
  uid: number;
  id?: number;
  label: string;
  mode: 'page' | 'url';
  page_id: string;
  url: string;
  /** Kept as-is: the editor does not expose it, but saving must not drop it. */
  target: string | null;
  children: EditNode[];
}

interface CtaRow {
  uid: number;
  cta_id: string;
  placement: string;
  is_enabled: boolean;
}

const LOCALES: Locale[] = ['en', 'ar'];

/**
 * Navigation menus (header, footer, …) and the sitewide CTAs that hang off
 * them. Items are per language and saved per language (`PUT /menus/{key}/items`
 * replaces that language's whole tree). Two levels only: the site's header
 * renders one dropdown level and nothing deeper.
 */
@Component({
  selector: 'app-website-menus',
  standalone: true,
  imports: [CommonModule, TPipe],
  templateUrl: './menus.html',
  styleUrls: ['../shared/website.shared.css', './menus.css']
})
export class Menus {
  private api = inject(WebsiteApiService);
  private ctx = inject(WebsiteContextService);
  private dialog = inject(DialogService);
  private i18n = inject(I18nService);
  private destroyRef = inject(DestroyRef);

  menus = signal<WebsiteMenu[]>([]);
  listLoading = signal(true);
  listError = signal<string | null>(null);

  activeKey = signal<string | null>(null);
  menu = signal<WebsiteMenu | null>(null);
  menuLoading = signal(false);
  menuError = signal<string | null>(null);

  locale = signal<Locale>('en');
  trees = signal<Record<Locale, EditNode[]>>({ en: [], ar: [] });
  dirty = signal<Record<Locale, boolean>>({ en: false, ar: false });
  itemErrors = signal<Record<string, string>>({});
  itemsError = signal<string | null>(null);
  savingItems = signal(false);

  ctaRows = signal<CtaRow[]>([]);
  ctasDirty = signal(false);
  ctaErrors = signal<Record<string, string>>({});
  ctasError = signal<string | null>(null);
  savingCtas = signal(false);

  pages = signal<WebsitePageRow[]>([]);
  ctaLibrary = signal<WebsiteCta[]>([]);
  placements = signal<string[]>([]);

  canUpdate = computed(() => this.ctx.can('cms.update'));
  tree = computed(() => this.trees()[this.locale()]);
  /** A key opened by hand that has never been saved (not in `GET /menus`). */
  activeIsNew = computed(() => !!this.activeKey() && !this.menus().some(m => m.key === this.activeKey()));
  lang = computed<Locale>(() => (this.i18n.lang() === 'ar' ? 'ar' : 'en'));
  private uid = 0;

  constructor() {
    this.loadMenus();
    // Every page, not only published ones: linking a page before it launches
    // is normal — the site simply hides the item until the page is live.
    this.api.pages({ per_page: 100 }).pipe(takeUntilDestroyed())
      .subscribe({ next: r => this.pages.set(r.items), error: () => {} });
    this.api.ctas({ per_page: 100 }).pipe(takeUntilDestroyed())
      .subscribe({ next: r => this.ctaLibrary.set(r.items), error: () => {} });
    this.ctx.enums().pipe(takeUntilDestroyed())
      .subscribe({ next: e => this.placements.set(e.cta_placements ?? []), error: () => {} });
  }

  loadMenus(): void {
    this.listLoading.set(true);
    this.listError.set(null);
    this.api.menus().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: list => {
        this.menus.set(list ?? []);
        this.listLoading.set(false);
        const first = list?.find(m => m.key === 'header') ?? list?.[0];
        if (first && !this.activeKey()) this.select(first.key);
      },
      error: err => {
        this.listLoading.set(false);
        this.listError.set(errorMessage(err, 'web.menus.load_failed'));
      }
    });
  }

  menuName(m: WebsiteMenu): string {
    if (m.name) return m.name;
    const key = `web.menus.key_${m.key}`;
    const t = this.i18n.translate(key);
    return t === key ? m.key : t;
  }

  async select(key: string): Promise<void> {
    if (key === this.activeKey()) return;
    if (this.hasUnsaved()) {
      const ok = await this.dialog.confirm({ title: 'web.menus.discard_title', text: 'web.menus.discard_text' });
      if (!ok) return;
    }
    this.activeKey.set(key);
    this.loadMenu(key);
  }

  /** Opens a menu key that is not in the list yet; saving creates it. */
  async openKey(raw: string): Promise<void> {
    const key = raw.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '_');
    if (!key) return;
    await this.select(key);
  }

  hasUnsaved(): boolean {
    return this.dirty().en || this.dirty().ar || this.ctasDirty();
  }

  private loadMenu(key: string): void {
    this.menuLoading.set(true);
    this.menuError.set(null);
    this.resetErrors();
    this.api.menu(key).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: m => {
        this.menu.set(m);
        this.trees.set(this.toTrees(m.items));
        this.ctaRows.set((m.ctas ?? []).map(c => this.toCtaRow(c)));
        this.dirty.set({ en: false, ar: false });
        this.ctasDirty.set(false);
        this.menuLoading.set(false);
      },
      error: err => {
        // An unknown key is a menu that has never been saved: start it empty.
        if (err?.status === 404) {
          this.menu.set({ key, items: { en: [], ar: [] }, ctas: [] });
          this.trees.set({ en: [], ar: [] });
          this.ctaRows.set([]);
          this.dirty.set({ en: false, ar: false });
          this.ctasDirty.set(false);
        } else {
          this.menu.set(null);
          this.menuError.set(errorMessage(err, 'web.menus.load_failed'));
        }
        this.menuLoading.set(false);
      }
    });
  }

  private resetErrors(): void {
    this.itemErrors.set({});
    this.itemsError.set(null);
    this.ctaErrors.set({});
    this.ctasError.set(null);
  }

  // ── reading the menu payload ────────────────────────────────────

  /**
   * `items` comes keyed by locale, or as one flat list whose rows carry
   * `locale` (and possibly `parent_id` instead of nested `children`).
   */
  private toTrees(items: WebsiteMenu['items']): Record<Locale, EditNode[]> {
    const out: Record<Locale, EditNode[]> = { en: [], ar: [] };
    if (!items) return out;
    if (!Array.isArray(items)) {
      for (const l of LOCALES) out[l] = this.nest(items[l] ?? []).map(n => this.toNode(n));
      return out;
    }
    const hasLocale = items.some(i => typeof i['locale'] === 'string');
    for (const l of LOCALES) {
      // A flat list without any locale is the default language's menu.
      const rows = hasLocale ? items.filter(i => i['locale'] === l) : l === 'en' ? items : [];
      out[l] = this.nest(rows).map(n => this.toNode(n));
    }
    return out;
  }

  /** Rebuilds `children` from `parent_id` when the API sends rows flat. */
  private nest(rows: MenuItemNode[]): MenuItemNode[] {
    const flat = rows.some(r => r['parent_id'] !== undefined && r['parent_id'] !== null);
    if (!flat) return rows;
    const sorted = [...rows].sort((a, b) => Number(a['sort_order'] ?? 0) - Number(b['sort_order'] ?? 0));
    const top = sorted.filter(r => !r['parent_id']);
    return top.map(t => ({ ...t, children: sorted.filter(c => c['parent_id'] === t.id) }));
  }

  private toNode(n: MenuItemNode, depth = 0): EditNode {
    return {
      uid: ++this.uid,
      id: n.id,
      label: n.label ?? '',
      mode: n.page_id ? 'page' : 'url',
      page_id: n.page_id ? String(n.page_id) : '',
      url: n.url ?? '',
      target: n.target ?? null,
      // Deeper levels cannot be rendered; flatten them into the second level.
      children: depth === 0 ? this.flattenChildren(n.children ?? []).map(c => this.toNode(c, 1)) : []
    };
  }

  private flattenChildren(children: MenuItemNode[]): MenuItemNode[] {
    return children.flatMap(c => [c, ...this.flattenChildren(c.children ?? [])]);
  }

  private toCtaRow(c: AttachedCta): CtaRow {
    return {
      uid: ++this.uid,
      cta_id: String(c.cta_id ?? c.cta?.id ?? ''),
      placement: c.placement ?? '',
      is_enabled: c.is_enabled !== false
    };
  }

  // ── tree editing ────────────────────────────────────────────────

  private blank(): EditNode {
    return { uid: ++this.uid, label: '', mode: 'page', page_id: '', url: '', target: null, children: [] };
  }

  private mutate(fn: (tree: EditNode[]) => EditNode[]): void {
    const l = this.locale();
    this.trees.update(t => ({ ...t, [l]: fn(t[l]) }));
    this.dirty.update(d => ({ ...d, [l]: true }));
  }

  addTop(): void {
    this.mutate(tree => [...tree, this.blank()]);
  }

  addChild(parent: EditNode): void {
    this.mutate(tree => tree.map(n => (n.uid === parent.uid ? { ...n, children: [...n.children, this.blank()] } : n)));
  }

  remove(node: EditNode, parent?: EditNode): void {
    if (parent) {
      this.mutate(tree => tree.map(n => (n.uid === parent.uid ? { ...n, children: n.children.filter(c => c.uid !== node.uid) } : n)));
    } else {
      this.mutate(tree => tree.filter(n => n.uid !== node.uid));
    }
  }

  move(node: EditNode, delta: number, parent?: EditNode): void {
    const swap = (list: EditNode[]) => {
      const i = list.findIndex(n => n.uid === node.uid);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= list.length) return list;
      const copy = [...list];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    };
    if (parent) {
      this.mutate(tree => tree.map(n => (n.uid === parent.uid ? { ...n, children: swap(n.children) } : n)));
    } else {
      this.mutate(tree => swap(tree));
    }
  }

  /** Demote a top-level item under the one above it (only if it has no children). */
  indent(node: EditNode): void {
    this.mutate(tree => {
      const i = tree.findIndex(n => n.uid === node.uid);
      if (i <= 0 || node.children.length) return tree;
      const prev = tree[i - 1];
      const copy = tree.filter(n => n.uid !== node.uid);
      return copy.map(n => (n.uid === prev.uid ? { ...n, children: [...n.children, node] } : n));
    });
  }

  /** Promote a child back to the top level, right after its parent. */
  outdent(node: EditNode, parent: EditNode): void {
    this.mutate(tree => {
      const out: EditNode[] = [];
      for (const n of tree) {
        if (n.uid === parent.uid) {
          out.push({ ...n, children: n.children.filter(c => c.uid !== node.uid) }, node);
        } else {
          out.push(n);
        }
      }
      return out;
    });
  }

  patch(node: EditNode, change: Partial<EditNode>): void {
    const apply = (n: EditNode): EditNode =>
      n.uid === node.uid ? { ...n, ...change } : { ...n, children: n.children.map(apply) };
    this.mutate(tree => tree.map(apply));
  }

  setLocale(l: Locale): void {
    this.locale.set(l);
    this.itemErrors.set({});
    this.itemsError.set(null);
  }

  /** Copies the other language's structure (labels blanked for translation). */
  async copyFromOther(): Promise<void> {
    const from: Locale = this.locale() === 'en' ? 'ar' : 'en';
    if (this.tree().length) {
      const ok = await this.dialog.confirm({ title: 'web.menus.copy_title', text: 'web.menus.copy_text' });
      if (!ok) return;
    }
    const copy = (n: EditNode): EditNode => ({ ...n, uid: ++this.uid, id: undefined, children: n.children.map(copy) });
    this.mutate(() => this.trees()[from].map(copy));
  }

  pageTitle(p: WebsitePageRow): string {
    return translationFor(p.translations, this.locale())?.title || pickLocalized(p.translations, 'title', this.lang()) || `#${p.id}`;
  }

  pageFor(node: EditNode): WebsitePageRow | undefined {
    return node.page_id ? this.pages().find(p => String(p.id) === node.page_id) : undefined;
  }

  /** Whether the linked page currently renders in this language. */
  pageLive(node: EditNode): boolean {
    const p = this.pageFor(node);
    if (!p) return true;
    const tr = translationFor(p.translations, this.locale());
    return !!p.is_live && !!tr && tr.is_enabled !== false;
  }

  pagePath(node: EditNode): string | null {
    const tr = translationFor(this.pageFor(node)?.translations, this.locale());
    return tr?.published_path || tr?.path || null;
  }

  errorAt(path: string): string | null {
    return this.itemErrors()[path] ?? null;
  }

  // ── saving items ────────────────────────────────────────────────

  private serialize(n: EditNode, withChildren: boolean): MenuItemNode {
    const out: MenuItemNode = {
      label: n.label.trim(),
      page_id: n.mode === 'page' && n.page_id ? Number(n.page_id) : null,
      url: n.mode === 'url' ? n.url.trim() || null : null
    };
    if (n.id) out.id = n.id;
    if (n.target) out.target = n.target;
    if (withChildren) out.children = n.children.map(c => this.serialize(c, false));
    return out;
  }

  private validateTree(tree: EditNode[]): Record<string, string> {
    const e: Record<string, string> = {};
    const check = (n: EditNode, path: string) => {
      if (!n.label.trim()) e[`${path}.label`] = 'common.required';
      if (n.mode === 'page' && !n.page_id) e[`${path}.page_id`] = 'web.menus.pick_page';
      if (n.mode === 'url' && !n.url.trim()) e[`${path}.url`] = 'common.required';
    };
    tree.forEach((n, i) => {
      check(n, `items.${i}`);
      n.children.forEach((c, j) => check(c, `items.${i}.children.${j}`));
    });
    return e;
  }

  saveItems(): void {
    const key = this.activeKey();
    if (!key) return;
    const l = this.locale();
    const tree = this.trees()[l];
    const local = this.validateTree(tree);
    this.itemErrors.set(local);
    this.itemsError.set(null);
    if (Object.keys(local).length) {
      this.itemsError.set('web.menus.fix_errors');
      return;
    }
    this.savingItems.set(true);
    this.api.saveMenuItems(key, l, tree.map(n => this.serialize(n, true)))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: m => {
          this.savingItems.set(false);
          this.dirty.update(d => ({ ...d, [l]: false }));
          // Take the server's ids so the next save updates instead of re-creating.
          if (m?.items) {
            const fresh = this.toTrees(m.items)[l];
            if (fresh.length || !tree.length) this.trees.update(t => ({ ...t, [l]: fresh }));
          }
          if (!this.menus().some(x => x.key === key)) this.loadMenus();
          this.dialog.toast('success', 'web.menus.items_saved');
        },
        error: err => {
          this.savingItems.set(false);
          if (err?.status === 422) {
            this.itemErrors.set(fieldErrors(err));
            this.itemsError.set(errorMessage(err, 'web.menus.save_failed'));
          } else {
            this.dialog.error('common.error', errorMessage(err, 'web.menus.save_failed'));
          }
        }
      });
  }

  // ── sitewide CTAs ───────────────────────────────────────────────

  addCta(): void {
    this.ctaRows.update(r => [...r, { uid: ++this.uid, cta_id: '', placement: '', is_enabled: true }]);
    this.ctasDirty.set(true);
  }

  patchCta(row: CtaRow, change: Partial<CtaRow>): void {
    this.ctaRows.update(rows => rows.map(r => (r.uid === row.uid ? { ...r, ...change } : r)));
    this.ctasDirty.set(true);
  }

  removeCta(row: CtaRow): void {
    this.ctaRows.update(rows => rows.filter(r => r.uid !== row.uid));
    this.ctasDirty.set(true);
  }

  moveCta(row: CtaRow, delta: number): void {
    this.ctaRows.update(rows => {
      const i = rows.findIndex(r => r.uid === row.uid);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= rows.length) return rows;
      const copy = [...rows];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
    this.ctasDirty.set(true);
  }

  /** The library row for a selected CTA (to show its type and whether it is off). */
  ctaFor(row: CtaRow): WebsiteCta | undefined {
    return this.ctaLibrary().find(c => String(c.id) === row.cta_id);
  }

  ctaOption(c: WebsiteCta): string {
    const label = this.lang() === 'ar' ? c.label_ar || c.label_en : c.label_en;
    return `${c.key} — ${label}`;
  }

  enumLabel(group: string, value: string | null | undefined): string {
    if (!value) return '—';
    const key = `web.enum.${group}.${value}`;
    const t = this.i18n.translate(key);
    return t === key ? value : t;
  }

  saveCtas(): void {
    const key = this.activeKey();
    if (!key) return;
    const local: Record<string, string> = {};
    this.ctaRows().forEach((r, i) => {
      if (!r.cta_id) local[`ctas.${i}.cta_id`] = 'common.required';
      if (!r.placement) local[`ctas.${i}.placement`] = 'common.required';
    });
    this.ctaErrors.set(local);
    this.ctasError.set(null);
    if (Object.keys(local).length) return;

    this.savingCtas.set(true);
    const body = this.ctaRows().map(r => ({ cta_id: Number(r.cta_id), placement: r.placement, is_enabled: r.is_enabled }));
    this.api.saveMenuCtas(key, body).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.savingCtas.set(false);
        this.ctasDirty.set(false);
        this.dialog.toast('success', 'web.menus.ctas_saved');
      },
      error: err => {
        this.savingCtas.set(false);
        if (err?.status === 422) {
          this.ctaErrors.set(fieldErrors(err));
          this.ctasError.set(errorMessage(err, 'web.menus.save_failed'));
        } else {
          this.dialog.error('common.error', errorMessage(err, 'web.menus.save_failed'));
        }
      }
    });
  }

  ctaError(i: number, field: string): string | null {
    return this.ctaErrors()[`ctas.${i}.${field}`] ?? null;
  }
}
