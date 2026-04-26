import { Component, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-patients',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './patients.html',
  styleUrl: './patients.css',
})
export class Patients {
  openActionMenuId: number | null = null;
  showFilter = false;

  patientsList = [
    { id: 1, name: 'Olivia Rhye', email: 'olivia@untitledui.com', phone: '01228358129', gov: 'Giza', gender: 'Female', status: 'Active', avatar: 'https://i.pravatar.cc/150?img=1' },
    { id: 2, name: 'Phoenix Baker', email: 'phoenix@untitledui.com', phone: '01228358129', gov: 'Giza', gender: 'Male', status: 'Active', avatar: 'https://i.pravatar.cc/150?img=2' },
    { id: 3, name: 'Lana Steiner', email: 'lana@untitledui.com', phone: '01228358129', gov: 'Giza', gender: 'Female', status: 'Active', avatar: 'https://i.pravatar.cc/150?img=3' },
    { id: 4, name: 'Demi Wilkinson', email: 'demi@untitledui.com', phone: '01228358129', gov: 'Giza', gender: 'Female', status: 'Active', avatar: 'https://i.pravatar.cc/150?img=4' },
    { id: 5, name: 'Candice Wu', email: 'candice@untitledui.com', phone: '01228358129', gov: 'Giza', gender: 'Female', status: 'Active', avatar: 'https://i.pravatar.cc/150?img=5' },
    { id: 6, name: 'Natali Craig', email: 'natali@untitledui.com', phone: '01228358129', gov: 'Giza', gender: 'Female', status: 'Active', avatar: 'https://i.pravatar.cc/150?img=6' },
    { id: 7, name: 'Drew Cano', email: 'drew@untitledui.com', phone: '01228358129', gov: 'Cairo', gender: 'Male', status: 'Active', avatar: 'https://i.pravatar.cc/150?img=7' }
  ];

  // دالة فتح/قفل قائمة الأكشن (الـ 3 نقط)
  toggleActionMenu(id: number, event: Event) {
    event.stopPropagation(); 
    this.openActionMenuId = this.openActionMenuId === id ? null : id;
    this.showFilter = false; // يقفل الفلتر لو كان مفتوح
  }

  // دالة فتح/قفل الفلتر
  toggleFilter(event: Event) {
    event.stopPropagation();
    this.showFilter = !this.showFilter;
    this.openActionMenuId = null; // يقفل أي قائمة أكشن مفتوحة
  }

  // منع قفل الفلتر أو القائمة عند الضغط بداخلهم
  preventClose(event: Event) {
    event.stopPropagation();
  }

  // الدالة دي بتقفل القوائم لو ضغطت في أي مكان فاضي في الشاشة
  @HostListener('document:click')
  closeDropdowns() {
    this.openActionMenuId = null;
    this.showFilter = false;
  }

  // دالة البلوك
  blockUser(id: number) {
    console.log('Blocked User ID:', id);
    this.openActionMenuId = null; 
  }
}