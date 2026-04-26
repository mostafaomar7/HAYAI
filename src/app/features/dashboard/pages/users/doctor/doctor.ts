import { Component, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-doctor',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './doctor.html',
  styleUrl: './doctor.css',
})
export class Doctor {
  openActionMenuId: number | null = null;
  showFilter = false;

  // الداتا الوهمية بناءً على صورة الأطباء
  doctorsList = [
    { id: 1, name: 'Olivia Rhye', email: 'olivia@untitledui.com', phone: '01228358129', plan: 'Practice', role: 'General Practitioner', status: 'Active', avatar: 'https://i.pravatar.cc/150?img=1' },
    { id: 2, name: 'Phoenix Baker', email: 'phoenix@untitledui.com', phone: '01228358129', plan: 'Practice', role: 'General Practitioner', status: 'Active', avatar: 'https://i.pravatar.cc/150?img=2' },
    { id: 3, name: 'Lana Steiner', email: 'lana@untitledui.com', phone: '01228358129', plan: 'Practice', role: 'General Practitioner', status: 'Active', avatar: 'https://i.pravatar.cc/150?img=3' },
    { id: 4, name: 'Demi Wilkinson', email: 'demi@untitledui.com', phone: '01228358129', plan: 'Practice', role: 'General Practitioner', status: 'Active', avatar: 'https://i.pravatar.cc/150?img=4' },
    { id: 5, name: 'Candice Wu', email: 'candice@untitledui.com', phone: '01228358129', plan: 'Practice', role: 'General Practitioner', status: 'Active', avatar: 'https://i.pravatar.cc/150?img=5' },
    { id: 6, name: 'Natali Craig', email: 'natali@untitledui.com', phone: '01228358129', plan: 'Practice', role: 'General Practitioner', status: 'Active', avatar: 'https://i.pravatar.cc/150?img=6' },
    { id: 7, name: 'Drew Cano', email: 'drew@untitledui.com', phone: '01228358129', plan: 'Practice', role: 'General Practitioner', status: 'Active', avatar: 'https://i.pravatar.cc/150?img=7' },
    { id: 8, name: 'Orlando Diggs', email: 'orlando@untitledui.com', phone: '01228358129', plan: 'Practice', role: 'General Practitioner', status: 'Active', avatar: 'https://i.pravatar.cc/150?img=8' },
    { id: 9, name: 'Andi Lane', email: 'andi@untitledui.com', phone: '01228358129', plan: 'Practice', role: 'General Practitioner', status: 'Active', avatar: 'https://i.pravatar.cc/150?img=9' },
    { id: 10, name: 'Kate Morrison', email: 'kate@untitledui.com', phone: '01228358129', plan: 'Practice', role: 'General Practitioner', status: 'Active', avatar: 'https://i.pravatar.cc/150?img=10' }
  ];

  // دالة فتح وقفل قائمة الأكشن (الـ 3 نقط)
  toggleActionMenu(id: number, event: Event) {
    event.stopPropagation(); 
    this.openActionMenuId = this.openActionMenuId === id ? null : id;
    this.showFilter = false; 
  }

  // دالة فتح وقفل الفلتر
  toggleFilter(event: Event) {
    event.stopPropagation();
    this.showFilter = !this.showFilter;
    this.openActionMenuId = null; 
  }

  // منع الإغلاق عند الضغط بداخل الفلتر أو القائمة
  preventClose(event: Event) {
    event.stopPropagation();
  }

  // إغلاق أي قائمة مفتوحة عند الضغط في أي مكان بالشاشة
  @HostListener('document:click')
  closeDropdowns() {
    this.openActionMenuId = null;
    this.showFilter = false;
  }

  // دوال الـ Actions الخاصة بالطبيب
  deactivateDoctor(id: number) {
    console.log('Deactivated Doctor ID:', id);
    this.openActionMenuId = null; 
  }

  changePlan(id: number) {
    console.log('Change Plan for Doctor ID:', id);
    this.openActionMenuId = null; 
  }
}