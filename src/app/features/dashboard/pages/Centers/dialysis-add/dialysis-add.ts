import { Component, inject } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms'; 

@Component({
  selector: 'app-dialysis-add',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dialysis-add.html',
  styleUrl: './dialysis-add.css',
})
export class DialysisAdd {
  private location = inject(Location);
  
  // اللوجيك بتاع الـ Status Toggle
  status: 'Active' | 'Inactive' = 'Active';

  // أيام العمل والأوقات
  days = [
    { name: 'Saturday', active: true, from: '', to: '' },
    { name: 'Sunday', active: true, from: '', to: '' },
    { name: 'Monday', active: true, from: '', to: '' },
    { name: 'Tuesday', active: true, from: '', to: '' },
    { name: 'Wednesday', active: true, from: '', to: '' },
    { name: 'Thursday', active: true, from: '', to: '' },
    { name: 'Friday', active: true, from: '', to: '' }
  ];

  // جهات الاتصال
  newContactName = '';
  newContactPhone = '';
  contacts = [
    { type: 'Hospital', phone: '01119253120' },
    { type: 'Home Care Manager (Mohamed ali)', phone: '01119253120' },
    { type: 'Complaints', phone: '01119253120' }
  ];

  setStatus(val: 'Active' | 'Inactive') {
    this.status = val;
  }

  goBack() { this.location.back(); }

  addContact() {
    if (this.newContactName && this.newContactPhone) {
      this.contacts.push({ type: this.newContactName, phone: this.newContactPhone });
      this.newContactName = '';
      this.newContactPhone = '';
    }
  }

  removeContact(index: number) {
    this.contacts.splice(index, 1);
  }
}