import { Component } from '@angular/core';

@Component({
  selector: 'app-navbar',
  standalone: true,
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.css'
})
export class NavbarComponent {
  isNotificationOpen = false;
  activeTab = 'userActivity';

  // بيانات الـ Mockup للإشعارات
  notifications = [
    { id: 1, type: 'hospital', title: 'New Hospital Registration', desc: 'Cairo Medical Center is waiting for activation', time: '15 min ago', unread: true },
    { id: 2, type: 'doctor', title: 'New Doctor Signup', desc: 'Dr. Mohamed Ali is waiting for activation', time: '30 min ago', unread: true },
    { id: 3, type: 'user', title: 'New Consultation Request', desc: 'Sara Mohamed booked a consultation with Dr. Khaled', time: '30 min ago', unread: false },
    { id: 4, type: 'clinic', title: 'Clinic Registration', desc: 'Smile Clinic is waiting for activation', time: '30 min ago', unread: true },
    { id: 5, type: 'user', title: 'New Lab Request', desc: 'Ahmed Ali requested a blood test from Alfa Lab', time: '30 min ago', unread: false }
  ];

  toggleNotifications() {
    this.isNotificationOpen = !this.isNotificationOpen;
  }

  setActiveTab(tab: string) {
    this.activeTab = tab;
  }
}