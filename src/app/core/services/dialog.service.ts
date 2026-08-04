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
