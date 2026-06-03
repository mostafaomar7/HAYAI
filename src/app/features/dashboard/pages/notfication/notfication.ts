import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { NotificationsService, BroadcastTarget } from '../../../../core/services/notifications.service';

@Component({
  selector: 'app-notfication',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './notfication.html',
  styleUrl: './notfication.css'
})
export class Notfication {
  private svc = inject(NotificationsService);

  title = '';
  body = '';
  audience: string = 'all';

  sending = signal(false);
  successMsg = signal<string | null>(null);
  errorMsg = signal<string | null>(null);

  audiences = [
    { value: 'all', label: 'All Users' },
    { value: 'patient', label: 'Patients' },
    { value: 'tourist', label: 'Tourists' },
    { value: 'doctor', label: 'Doctors' },
    { value: 'hospital', label: 'Hospitals' },
    { value: 'clinic', label: 'Clinics' },
    { value: 'pharmacy', label: 'Pharmacies' },
    { value: 'lab', label: 'Labs & Radiology' },
    { value: 'medical_issuance', label: 'Medical Issuance' },
    { value: 'home_care', label: 'Home Care' },
    { value: 'physical_therapy', label: 'Physical Therapy' },
    { value: 'employment_office', label: 'Employment Offices' },
    { value: 'medical_devices', label: 'Medical Devices' }
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
