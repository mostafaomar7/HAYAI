import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  PlatformSetting,
  SettingsService
} from '../../../../core/services/settings.service';
import { DialogService } from '../../../../core/services/dialog.service';
import { TPipe } from '../../../../core/i18n/t.pipe';

interface SettingGroup {
  name: string;
  rows: PlatformSetting[];
}

/** Roughly what a monthly allowance buys, so the number means something. */
const TOKENS_PER_ANSWER = 1667;

/**
 * The platform switches.
 *
 * Built from the rows the API returns, not from a list written here: a switch
 * added server-side appears on its own. The only per-type knowledge is which
 * control to draw.
 */
@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, TPipe],
  templateUrl: './settings.html',
  styleUrl: './settings.css'
})
export class Settings {
  private svc = inject(SettingsService);
  private dialog = inject(DialogService);

  loading = signal(true);
  saving = signal(false);
  loadError = signal<string | null>(null);
  formError = signal<string | null>(null);
  rows = signal<PlatformSetting[]>([]);
  /** key → edited value, holding only what the admin actually touched. */
  edits = signal<Record<string, unknown>>({});
  errors = signal<Record<string, string>>({});

  groups = computed<SettingGroup[]>(() => {
    const byGroup = new Map<string, PlatformSetting[]>();
    for (const row of this.rows()) {
      const list = byGroup.get(row.group) ?? [];
      list.push(row);
      byGroup.set(row.group, list);
    }
    return [...byGroup.entries()].map(([name, rows]) => ({ name, rows }));
  });

  dirtyCount = computed(() => Object.keys(this.edits()).length);

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.svc.list().subscribe({
      next: rows => { this.rows.set(rows); this.edits.set({}); this.loading.set(false); },
      error: () => { this.loadError.set('settings.load_failed'); this.loading.set(false); }
    });
  }

  // ------------------------------------------------------------ reading

  /** The edited value when the admin touched it, otherwise what the server has. */
  valueOf(row: PlatformSetting): unknown {
    const edits = this.edits();
    return row.key in edits ? edits[row.key] : row.value;
  }

  boolValue(row: PlatformSetting): boolean {
    return this.valueOf(row) === true;
  }

  /**
   * `null` is an empty box and `0` is a typed zero — they mean opposite things,
   * so the empty string is only ever produced for null.
   */
  tokensValue(row: PlatformSetting): string {
    const v = this.valueOf(row);
    return v === null || v === undefined ? '' : String(v);
  }

  textValue(row: PlatformSetting): string {
    const v = this.valueOf(row);
    return v === null || v === undefined ? '' : String(v);
  }

  /** Which of the three token states this row is in, for the helper line. */
  tokensState(row: PlatformSetting): 'uncapped' | 'none' | 'capped' {
    const v = this.valueOf(row);
    if (v === null || v === undefined || v === '') return 'uncapped';
    return Number(v) === 0 ? 'none' : 'capped';
  }

  approxAnswers(row: PlatformSetting): number {
    return Math.max(1, Math.round(Number(this.valueOf(row)) / TOKENS_PER_ANSWER));
  }

  isDirty(row: PlatformSetting): boolean {
    return row.key in this.edits();
  }

  // ------------------------------------------------------------ writing

  private setValue(row: PlatformSetting, value: unknown): void {
    this.edits.update(e => {
      const next = { ...e };
      // Editing back to the stored value is not a change, so it stops being one.
      if (value === row.value) delete next[row.key];
      else next[row.key] = value;
      return next;
    });
    this.errors.update(e => { const n = { ...e }; delete n[row.key]; return n; });
  }

  setBool(row: PlatformSetting, checked: boolean): void {
    this.setValue(row, checked);
  }

  /**
   * An empty box is `null`, never `0`: "no cap" and "no free AI at all" are
   * opposite instructions and the server reads them that way.
   */
  setTokens(row: PlatformSetting, raw: string): void {
    const trimmed = raw.trim();
    this.setValue(row, trimmed === '' ? null : Number(trimmed));
  }

  setText(row: PlatformSetting, raw: string): void {
    this.setValue(row, raw === '' ? null : raw);
  }

  reset(): void {
    this.edits.set({});
    this.errors.set({});
    this.formError.set(null);
  }

  async save(): Promise<void> {
    const changes = this.edits();
    if (!Object.keys(changes).length) return;

    // Turning the master AI switch off silences every assistant on the
    // platform, so it is confirmed rather than saved on a single click.
    if (changes['ai.enabled'] === false) {
      const ok = await this.dialog.confirm({
        title: 'settings.confirm_ai_off_title',
        text: 'settings.confirm_ai_off_text',
        confirmText: 'settings.confirm_ai_off_confirm',
        danger: true
      });
      if (!ok) return;
    }

    this.saving.set(true);
    this.formError.set(null);
    this.errors.set({});
    this.svc.patch(changes).subscribe({
      next: rows => {
        this.saving.set(false);
        this.rows.set(rows);
        this.edits.set({});
        this.dialog.toast('success', 'settings.saved');
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        const bag = err.error?.errors as Record<string, string[] | string> | undefined;
        if (err.status === 422 && bag) {
          this.errors.set(Object.fromEntries(
            Object.entries(bag).map(([k, v]) => [k, Array.isArray(v) ? v[0] : String(v)])));
          // Nothing was saved, not even the valid keys — the edits are kept so
          // the admin can correct one field rather than retype everything.
          this.formError.set('settings.fix_errors');
        } else {
          this.formError.set(err.error?.message ?? 'settings.save_failed');
        }
      }
    });
  }
}
