import { Component, inject } from '@angular/core';
import { CommonModule, Location } from '@angular/common';

@Component({
  selector: 'app-charitable-add',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './charitable-add.html',
  styleUrl: './charitable-add.css',
})
export class CharitableAdd {
  private location = inject(Location);

  // Status
  isActive = true;

  // Image Upload
  uploadedImage: string | null = 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80';

  // Schedule
  schedule = [
    { day: 'Saturday', active: true, from: '', to: '' },
    { day: 'Sunday', active: true, from: '', to: '' },
    { day: 'Monday', active: true, from: '', to: '' },
    { day: 'Tuesday', active: true, from: '', to: '' },
    { day: 'Wednesday', active: true, from: '', to: '' },
    { day: 'Thursday', active: true, from: '', to: '' },
    { day: 'Friday', active: true, from: '', to: '' },
  ];

  // Services
  services = [
    'Free Medical Consultations',
    'Patient Transportation',
    'Child Healthcare Support',
    'Elderly Care Assistance',
    'Chronic Disease Support'
  ];

  // Contacts
  contacts = [
    { title: 'Hospital', phone: '01119253120' },
    { title: 'Home Care Manager ( Mohamed ali )', phone: '01119253120' },
    { title: 'Complaints', phone: '01119253120' }
  ];

  goBack() {
    this.location.back();
  }

  setStatus(status: boolean) {
    this.isActive = status;
  }

  removeImage() {
    this.uploadedImage = null;
  }

  toggleDay(index: number) {
    this.schedule[index].active = !this.schedule[index].active;
  }

  removeService(index: number) {
    this.services.splice(index, 1);
  }

  removeContact(index: number) {
    this.contacts.splice(index, 1);
  }
}