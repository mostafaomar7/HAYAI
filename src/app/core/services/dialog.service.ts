import { Injectable, inject } from '@angular/core';
import Swal, { SweetAlertResult } from 'sweetalert2';
import { I18nService } from '../i18n/i18n.service';

type DialogParams = Record<string, string | number>;

@Injectable({ providedIn: 'root' })
export class DialogService {
  private i18n = inject(I18nService);

  /**
   * Every user-facing string below goes through `I18nService.translate`, so
   * call sites pass i18n keys. An unknown key falls back to itself, which
   * keeps backend-supplied messages (e.g. `err.error.message`) intact.
   */
  private t(text: string | undefined, params?: DialogParams): string | undefined {
    return text === undefined ? undefined : this.i18n.translate(text, params);
  }

  /**
   * Confirmation dialog. Returns Promise<boolean> — true if user clicked confirm.
   */
  async confirm(opts: {
    title: string;
    text?: string;
    confirmText?: string;
    cancelText?: string;
    icon?: 'warning' | 'question' | 'info' | 'error';
    danger?: boolean;
    params?: DialogParams;
  }): Promise<boolean> {
    const result: SweetAlertResult = await Swal.fire({
      title: this.t(opts.title, opts.params),
      text: this.t(opts.text, opts.params),
      icon: opts.icon ?? 'warning',
      showCancelButton: true,
      confirmButtonText: this.t(opts.confirmText ?? 'common.confirm'),
      cancelButtonText: this.t(opts.cancelText ?? 'common.cancel'),
      confirmButtonColor: opts.danger ? '#dc2626' : '#2563eb',
      cancelButtonColor: '#6b7280',
      reverseButtons: true
    });
    return result.isConfirmed;
  }

  /**
   * Prompt for input. Returns the string or null if cancelled.
   */
  async prompt(opts: {
    title: string;
    text?: string;
    placeholder?: string;
    defaultValue?: string;
    inputType?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'textarea';
    confirmText?: string;
    cancelText?: string;
    params?: DialogParams;
  }): Promise<string | null> {
    const result: SweetAlertResult = await Swal.fire({
      title: this.t(opts.title, opts.params),
      text: this.t(opts.text, opts.params),
      input: opts.inputType ?? 'text',
      inputPlaceholder: this.t(opts.placeholder),
      inputValue: opts.defaultValue ?? '',
      showCancelButton: true,
      confirmButtonText: this.t(opts.confirmText ?? 'common.confirm'),
      cancelButtonText: this.t(opts.cancelText ?? 'common.cancel'),
      confirmButtonColor: '#2563eb',
      cancelButtonColor: '#6b7280',
      reverseButtons: true
    });
    return result.isConfirmed ? (result.value ?? '') : null;
  }

  /**
   * Single-choice select. Returns the chosen option key, or null if cancelled.
   * Option labels are translated; dynamic labels fall through unchanged.
   */
  async select(opts: {
    title: string;
    options: Record<string, string>;
    defaultValue?: string;
    placeholder?: string;
    confirmText?: string;
    cancelText?: string;
  }): Promise<string | null> {
    const labels = Object.entries(opts.options).reduce<Record<string, string>>((acc, [k, v]) => {
      acc[k] = this.i18n.translate(v);
      return acc;
    }, {});

    const result: SweetAlertResult = await Swal.fire({
      title: this.t(opts.title),
      input: 'select',
      inputOptions: labels,
      inputValue: opts.defaultValue ?? '',
      inputPlaceholder: this.t(opts.placeholder),
      showCancelButton: true,
      confirmButtonText: this.t(opts.confirmText ?? 'common.confirm'),
      cancelButtonText: this.t(opts.cancelText ?? 'common.cancel'),
      confirmButtonColor: '#2563eb',
      cancelButtonColor: '#6b7280',
      reverseButtons: true
    });
    return result.isConfirmed && result.value ? String(result.value) : null;
  }

  /**
   * Shows a value that exists exactly once — a freshly issued password. The API
   * does not store it and a second call produces a different one, so this is
   * deliberately a dialog the admin has to dismiss, with a copy button, rather
   * than a toast that can scroll past.
   */
  async revealSecret(opts: {
    title: string;
    text?: string;
    secret: string;
    copyText?: string;
    copiedText?: string;
    params?: DialogParams;
  }): Promise<void> {
    // The value is server-generated, but an admin may have typed it, so it is
    // escaped rather than trusted into innerHTML.
    const escape = (v: string) =>
      v.replace(/[&<>"']/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

    const copyLabel = this.t(opts.copyText ?? 'common.copy') ?? 'Copy';
    const copiedLabel = this.t(opts.copiedText ?? 'common.copied') ?? 'Copied';

    await Swal.fire({
      title: this.t(opts.title, opts.params),
      icon: 'success',
      html:
        (opts.text ? `<p style="margin:0 0 14px;color:#4b5563;font-size:14px;line-height:1.7">${escape(this.t(opts.text, opts.params) ?? '')}</p>` : '') +
        `<div style="display:flex;gap:8px;align-items:center;justify-content:center;flex-wrap:wrap">
           <code id="secret-value" dir="ltr" style="font-family:Consolas,monospace;font-size:17px;font-weight:700;
                 background:#f1f5f9;border:1px solid #e2e8f0;border-radius:8px;padding:10px 16px;
                 letter-spacing:.5px;user-select:all">${escape(opts.secret)}</code>
           <button id="secret-copy" type="button" style="background:#2563eb;color:#fff;border:none;border-radius:8px;
                   padding:10px 16px;font-size:14px;font-weight:600;cursor:pointer">${escape(copyLabel)}</button>
         </div>`,
      confirmButtonText: this.t('common.done') ?? 'Done',
      confirmButtonColor: '#2563eb',
      allowOutsideClick: false,
      didOpen: () => {
        const btn = document.getElementById('secret-copy');
        btn?.addEventListener('click', () => {
          // clipboard needs a secure context; select-all is the fallback so the
          // admin can still copy by hand rather than being stuck.
          navigator.clipboard?.writeText(opts.secret).then(
            () => { btn.textContent = copiedLabel; },
            () => {
              const el = document.getElementById('secret-value');
              if (el) {
                const range = document.createRange();
                range.selectNodeContents(el);
                const sel = window.getSelection();
                sel?.removeAllRanges();
                sel?.addRange(range);
              }
            }
          );
        });
      }
    });
  }

  success(title: string, text?: string, params?: DialogParams) {
    return this.alert('success', title, text, params);
  }

  error(title: string, text?: string, params?: DialogParams) {
    return this.alert('error', title, text, params);
  }

  info(title: string, text?: string, params?: DialogParams) {
    return this.alert('info', title, text, params);
  }

  toast(icon: 'success' | 'error' | 'info' | 'warning', title: string, params?: DialogParams) {
    return Swal.fire({
      toast: true,
      // Mirror to the leading corner so the toast doesn't cover the RTL sidebar.
      position: this.i18n.isRtl() ? 'top-start' : 'top-end',
      icon,
      title: this.t(title, params),
      showConfirmButton: false,
      timer: 2500,
      timerProgressBar: true
    });
  }

  private alert(
    icon: 'success' | 'error' | 'info',
    title: string,
    text?: string,
    params?: DialogParams
  ) {
    return Swal.fire({
      icon,
      title: this.t(title, params),
      text: this.t(text, params),
      confirmButtonColor: '#2563eb',
      confirmButtonText: this.t('common.confirm')
    });
  }
}
