import { Injectable } from '@angular/core';
import Swal, { SweetAlertResult } from 'sweetalert2';

@Injectable({ providedIn: 'root' })
export class DialogService {
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
  }): Promise<boolean> {
    const result: SweetAlertResult = await Swal.fire({
      title: opts.title,
      text: opts.text,
      icon: opts.icon ?? 'warning',
      showCancelButton: true,
      confirmButtonText: opts.confirmText ?? 'Confirm',
      cancelButtonText: opts.cancelText ?? 'Cancel',
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
  }): Promise<string | null> {
    const result: SweetAlertResult = await Swal.fire({
      title: opts.title,
      text: opts.text,
      input: opts.inputType ?? 'text',
      inputPlaceholder: opts.placeholder,
      inputValue: opts.defaultValue ?? '',
      showCancelButton: true,
      confirmButtonText: opts.confirmText ?? 'OK',
      cancelButtonText: opts.cancelText ?? 'Cancel',
      confirmButtonColor: '#2563eb',
      cancelButtonColor: '#6b7280',
      reverseButtons: true
    });
    return result.isConfirmed ? (result.value ?? '') : null;
  }

  success(title: string, text?: string) {
    return Swal.fire({ icon: 'success', title, text, confirmButtonColor: '#2563eb' });
  }

  error(title: string, text?: string) {
    return Swal.fire({ icon: 'error', title, text, confirmButtonColor: '#2563eb' });
  }

  info(title: string, text?: string) {
    return Swal.fire({ icon: 'info', title, text, confirmButtonColor: '#2563eb' });
  }

  toast(icon: 'success' | 'error' | 'info' | 'warning', title: string) {
    return Swal.fire({
      toast: true,
      position: 'top-end',
      icon,
      title,
      showConfirmButton: false,
      timer: 2500,
      timerProgressBar: true
    });
  }
}
