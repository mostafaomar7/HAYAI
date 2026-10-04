import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TPipe } from '../../../../../core/i18n/t.pipe';
import { I18nService } from '../../../../../core/i18n/i18n.service';
import { DialogService } from '../../../../../core/services/dialog.service';
import {
  VersionedEntity, WebsiteApiService, errorMessage
} from '../../../../../core/services/website/website-api.service';
import { WebsiteContextService } from '../../../../../core/services/website/website-context.service';
import { ContentVersion, VersionDiff } from '../../../../../core/services/website/website.models';
import { fmtDate } from './website-utils';

interface DiffRow {
  path: string;
  kind: 'added' | 'removed' | 'changed';
  from: string;
  to: string;
}

/**
 * Version history for a page or product (§2.10). Every publish is an
 * immutable version; restoring copies it into the working copy only, so the
 * live site does not change until the next publish — the panel says so,
 * because "restore" reads like an instant rollback otherwise.
 */
@Component({
  selector: 'app-versions-panel',
  standalone: true,
  imports: [CommonModule, TPipe],
  templateUrl: './versions-panel.html',
  styleUrls: ['./website.shared.css', './editor-panel.css']
})
export class VersionsPanel {
  private api = inject(WebsiteApiService);
  private ctx = inject(WebsiteContextService);
  private dialog = inject(DialogService);
  private i18n = inject(I18nService);

  entity = input.required<VersionedEntity>();
  entityId = input.required<number>();

  /** Emitted after a version is restored into the working copy. */
  restored = output<number>();

  versions = signal<ContentVersion[]>([]);
  loading = signal(true);
  compareFrom = signal<number | null>(null);
  compareTo = signal<number | 'current'>('current');
  diff = signal<DiffRow[] | null>(null);
  diffLoading = signal(false);

  private updatePerm = computed(() => (this.entity() === 'pages' ? 'cms.update' : 'products.update'));
  canEdit = computed(() => this.ctx.can(this.updatePerm()));

  constructor() {
    effect(() => {
      const [entity, id] = [this.entity(), this.entityId()];
      untracked(() => this.load(entity, id));
    });
  }

  load(entity = this.entity(), id = this.entityId()): void {
    this.loading.set(true);
    this.api.versions(entity, id).subscribe({
      next: list => {
        const sorted = [...(list ?? [])].sort((a, b) => b.version - a.version);
        this.versions.set(sorted);
        if (sorted.length && this.compareFrom() === null) this.compareFrom.set(sorted[0].version);
        this.loading.set(false);
      },
      error: () => {
        this.versions.set([]);
        this.loading.set(false);
      }
    });
  }

  date(v: string): string {
    return fmtDate(v, this.i18n.lang(), true);
  }

  async saveNamed(): Promise<void> {
    const label = await this.dialog.prompt({ title: 'web.versions.save_named', placeholder: 'web.versions.label_placeholder' });
    if (label === null) return;
    this.api.saveVersion(this.entity(), this.entityId(), label.trim() || 'Snapshot').subscribe({
      next: () => {
        this.dialog.toast('success', 'web.versions.saved');
        this.load();
      },
      error: err => this.dialog.error('common.error', errorMessage(err, 'web.versions.save_failed'))
    });
  }

  async restore(v: ContentVersion): Promise<void> {
    const ok = await this.dialog.confirm({
      title: 'web.versions.restore_title',
      text: 'web.versions.restore_text',
      params: { v: v.version },
      confirmText: 'web.versions.restore'
    });
    if (!ok) return;
    this.api.restoreVersion(this.entity(), this.entityId(), v.version).subscribe({
      next: () => {
        this.dialog.toast('success', 'web.versions.restored');
        this.restored.emit(v.version);
        this.load();
      },
      error: err => this.dialog.error('common.error', errorMessage(err, 'web.versions.restore_failed'))
    });
  }

  compare(): void {
    const from = this.compareFrom();
    if (from === null) return;
    this.diffLoading.set(true);
    this.api.compareVersions(this.entity(), this.entityId(), from, this.compareTo()).subscribe({
      next: res => {
        this.diff.set(this.flatten(res));
        this.diffLoading.set(false);
      },
      error: err => {
        this.diffLoading.set(false);
        this.dialog.error('common.error', errorMessage(err, 'web.versions.compare_failed'));
      }
    });
  }

  setTo(value: string): void {
    this.compareTo.set(value === 'current' ? 'current' : Number(value));
  }

  private flatten(res: VersionDiff): DiffRow[] {
    const show = (v: unknown) => (v === null || v === undefined ? '—' : typeof v === 'string' ? v : JSON.stringify(v));
    const d = res?.diff ?? { added: {}, removed: {}, changed: {} };
    return [
      ...Object.entries(d.changed ?? {}).map(([path, c]) => ({ path, kind: 'changed' as const, from: show(c?.from), to: show(c?.to) })),
      ...Object.entries(d.added ?? {}).map(([path, v]) => ({ path, kind: 'added' as const, from: '—', to: show(v) })),
      ...Object.entries(d.removed ?? {}).map(([path, v]) => ({ path, kind: 'removed' as const, from: show(v), to: '—' }))
    ];
  }

  eventLabel(e: string): string {
    const key = `web.versions.event.${e}`;
    const t = this.i18n.translate(key);
    return t === key ? e : t;
  }
}
