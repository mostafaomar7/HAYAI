import { Component, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-tourists',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tourists.html',
  styleUrl: './tourists.css',
})
export class Tourists {
  openActionMenuId: number | null = null;
  showFilter = false;

  // الداتا الوهمية بناءً على الصورة المرفقة
  touristsList = [
    { id: 1, name: 'Olivia Rhye', email: 'olivia@untitledui.com', gender: 'Female', status: 'Active', avatar: 'https://i.pravatar.cc/150?img=1' },
    { id: 2, name: 'Phoenix Baker', email: 'phoenix@untitledui.com', gender: 'Male', status: 'Active', avatar: 'https://i.pravatar.cc/150?img=2' },
    { id: 3, name: 'Lana Steiner', email: 'lana@untitledui.com', gender: 'Female', status: 'Active', avatar: 'https://i.pravatar.cc/150?img=3' },
    { id: 4, name: 'Demi Wilkinson', email: 'demi@untitledui.com', gender: 'Female', status: 'Active', avatar: 'https://i.pravatar.cc/150?img=4' },
    { id: 5, name: 'Candice Wu', email: 'candice@untitledui.com', gender: 'Female', status: 'Active', avatar: 'https://i.pravatar.cc/150?img=5' },
    { id: 6, name: 'Natali Craig', email: 'natali@untitledui.com', gender: 'Female', status: 'Active', avatar: 'https://i.pravatar.cc/150?img=6' },
    { id: 7, name: 'Drew Cano', email: 'drew@untitledui.com', gender: 'Male', status: 'Active', avatar: 'https://i.pravatar.cc/150?img=7' },
    { id: 8, name: 'Orlando Diggs', email: 'orlando@untitledui.com', gender: 'Male', status: 'Active', avatar: 'https://i.pravatar.cc/150?img=8' },
    { id: 9, name: 'Andi Lane', email: 'andi@untitledui.com', gender: 'Female', status: 'Active', avatar: 'https://i.pravatar.cc/150?img=9' },
    { id: 10, name: 'Kate Morrison', email: 'kate@untitledui.com', gender: 'Female', status: 'Active', avatar: 'https://i.pravatar.cc/150?img=10' }
  ];

  // دالة فتح/قفل قائمة الـ 3 نقط
  toggleActionMenu(id: number, event: Event) {
    event.stopPropagation(); 
    this.openActionMenuId = this.openActionMenuId === id ? null : id;
    this.showFilter = false; 
  }

  // دالة فتح/قفل الفلتر
  toggleFilter(event: Event) {
    event.stopPropagation();
    this.showFilter = !this.showFilter;
    this.openActionMenuId = null; 
  }

  // منع الإغلاق عند الضغط داخل الفلتر أو القائمة
  preventClose(event: Event) {
    event.stopPropagation();
  }

  // إغلاق أي قائمة عند الضغط في أي مكان في الشاشة
  @HostListener('document:click')
  closeDropdowns() {
    this.openActionMenuId = null;
    this.showFilter = false;
  }

  // دالة البلوك
  blockUser(id: number) {
    console.log('Blocked Tourist ID:', id);
    this.openActionMenuId = null; 
  }
}