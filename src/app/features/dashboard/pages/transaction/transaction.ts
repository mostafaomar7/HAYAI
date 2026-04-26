import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-transaction',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './transaction.html',
  styleUrl: './transaction.css',
})
export class Transaction {
  // للتحكم في الفلتر
  showFilter = false;

  // التابات العلوية
  mainTabs = ['All', 'Tourists', 'Hospitals', 'Clinics', 'Doctors', 'Pharmacies', 'Labs & Radiology', 'Medical Issuance', 'Home Care', 'Medical Devices'];
  activeMainTab = 'All';

  // تابات الحالة
  statusTabs = ['Pending', 'In progress', 'Complete'];
  activeStatusTab = 'Pending';

  // بيانات الجدول (Mock Data)
  transactions = [
    { id: 1, provider: 'Olivia Rhye', providerImg: 'https://i.pravatar.cc/150?img=1', service: 'Doctor', patient: 'Dr.Kareem Mohamed', patientImg: 'https://i.pravatar.cc/150?img=11', requestType: 'Home Visit Request', date: '2026-04-19', status: 'Pending' },
    { id: 2, provider: 'Phoenix Baker', providerImg: 'https://i.pravatar.cc/150?img=2', service: 'Hospital', patient: 'Phoenix Baker', patientImg: 'https://i.pravatar.cc/150?img=12', requestType: 'Home Visit Request', date: '2026-04-19', status: 'Inprogress' },
    { id: 3, provider: 'Lana Steiner', providerImg: 'https://i.pravatar.cc/150?img=3', service: 'Clinic', patient: 'Lana Steiner', patientImg: 'https://i.pravatar.cc/150?img=13', requestType: 'Home Visit Request', date: '2026-04-19', status: 'Complete' },
    { id: 4, provider: 'Demi Wilkinson', providerImg: 'https://i.pravatar.cc/150?img=4', service: 'Pharmacy', patient: 'Demi Wilkinson', patientImg: 'https://i.pravatar.cc/150?img=14', requestType: 'Home Visit Request', date: '2026-04-19', status: 'Pending' },
    { id: 5, provider: 'Candice Wu', providerImg: 'https://i.pravatar.cc/150?img=5', service: 'Home care', patient: 'Candice Wu', patientImg: 'https://i.pravatar.cc/150?img=15', requestType: 'Home Visit Request', date: '2026-04-19', status: 'Complete' },
    { id: 6, provider: 'Natali Craig', providerImg: 'https://i.pravatar.cc/150?img=6', service: 'Clinic', patient: 'Natali Craig', patientImg: 'https://i.pravatar.cc/150?img=16', requestType: 'Home Visit Request', date: '2026-04-19', status: 'Inprogress' },
    { id: 7, provider: 'Drew Cano', providerImg: 'https://i.pravatar.cc/150?img=7', service: 'Doctor', patient: 'Drew Cano', patientImg: 'https://i.pravatar.cc/150?img=17', requestType: 'Home Visit Request', date: '2026-04-19', status: 'Inprogress' },
    { id: 8, provider: 'Orlando Diggs', providerImg: 'https://i.pravatar.cc/150?img=8', service: 'Doctor', patient: 'Orlando Diggs', patientImg: 'https://i.pravatar.cc/150?img=18', requestType: 'Home Visit Request', date: '2026-04-19', status: 'Inprogress' }
  ];

  setMainTab(tab: string) {
    this.activeMainTab = tab;
  }

  setStatusTab(tab: string) {
    this.activeStatusTab = tab;
  }

  toggleFilter() {
    this.showFilter = !this.showFilter;
  }
}