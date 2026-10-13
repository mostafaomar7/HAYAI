import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { NotificationsService, BroadcastTarget } from '../../../../core/services/notifications.service';
import { TPipe } from '../../../../core/i18n/t.pipe';

@Component({
  selector: 'app-notification',
  standalone: true,
  imports: [CommonModule, FormsModule, TPipe],
  templateUrl: './notification.html',
  styleUrl: './notification.css'
})
export class Notification {
  private svc = inject(NotificationsService);

  title = '';
  body = '';
  audience: string = 'all';

  sending = signal(false);
  successMsg = signal<string | null>(null);
  errorMsg = signal<string | null>(null);

  // Keys, not words. These are the same names the sidebar and the user
  // lists already carry, so the audience a notification goes to reads the
  // same wherever an admin sees it — in either language.
  audiences = [
    { value: 'all', label: 'notif.send.audience.all' },
    { value: 'patient', label: 'users.patient.title' },
    { value: 'tourist', label: 'users.tourist.title' },
    { value: 'doctor', label: 'users.doctor.title' },
    { value: 'hospital', label: 'users.hospital.title' },
    { value: 'clinic', label: 'users.clinic.title' },
    { value: 'pharmacy', label: 'users.pharmacy.title' },
    { value: 'lab', label: 'users.lab.title' },
    { value: 'medical_issuance', label: 'users.issuance.title' },
    { value: 'home_care', label: 'users.home_care.title' },
    { value: 'physical_therapy', label: 'users.therapy.title' },
    { value: 'employment_office', label: 'users.employment.title' },
    { value: 'medical_devices', label: 'users.medical_devices.title' }
  ];

  sendNotification() {
    if (!this.title || !this.body) {
      this.errorMsg.set('Title and body are required.');
      return;
    }
    const target: BroadcastTarget =
      this.audience === 'all'
        ? { type: 'all' }
        : { type: 'user_type', userTypes: [this.audience] };

    this.sending.set(true);
    this.errorMsg.set(null);
    this.successMsg.set(null);

    this.svc.broadcast({ title: this.title, body: this.body, target_audience: target }).subscribe({
      next: r => {
        this.sending.set(false);
        this.successMsg.set(`Notification queued to ${r.queued_recipients} recipients.`);
        this.title = '';
        this.body = '';
      },
      error: (err: HttpErrorResponse) => {
        this.sending.set(false);
        this.errorMsg.set(err.error?.message ?? 'Send failed');
      }
    });
  }
}
