import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-renewal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './renewal.html',
  styleUrl: './renewal.css',
})
export class Renewal {
  // للتحكم في ظهور الفلتر
  showFilter = false;

  // الداتا الوهمية للجدول
  renewalUsers = [
    { id: 1, name: 'Olivia Rhye', avatar: 'https://i.pravatar.cc/150?img=1', type: 'Doctor', plan: 'Practice', date: '2026-03-16' },
    { id: 2, name: 'Phoenix Baker', avatar: 'https://i.pravatar.cc/150?img=2', type: 'Hospital', plan: 'Practice', date: '2026-02-05' },
    { id: 3, name: 'Lana Steiner', avatar: 'https://i.pravatar.cc/150?img=3', type: 'Hospital', plan: 'Practice', date: '2026-03-14' },
    { id: 4, name: 'Demi Wilkinson', avatar: 'https://i.pravatar.cc/150?img=4', type: 'Clinic', plan: 'Practice', date: '2026-01-12' },
    { id: 5, name: 'Candice Wu', avatar: 'https://i.pravatar.cc/150?img=5', type: 'Hospital', plan: 'Practice', date: '2026-01-13' },
    { id: 6, name: 'Natali Craig', avatar: 'https://i.pravatar.cc/150?img=6', type: 'Clinic', plan: 'Practice', date: '2026-02-28' },
    { id: 7, name: 'Drew Cano', avatar: 'https://i.pravatar.cc/150?img=7', type: 'Clinic', plan: 'Practice', date: '2026-01-13' },
    { id: 8, name: 'Orlando Diggs', avatar: 'https://i.pravatar.cc/150?img=8', type: 'Doctor', plan: 'Practice', date: '2026-03-06' },
    { id: 9, name: 'Andi Lane', avatar: 'https://i.pravatar.cc/150?img=9', type: 'Clinic', plan: 'Practice', date: '2026-02-05' },
    { id: 10, name: 'Kate Morrison', avatar: 'https://i.pravatar.cc/150?img=10', type: 'Doctor', plan: 'Practice', date: '2026-03-20' }
  ];

  toggleFilter() {
    this.showFilter = !this.showFilter;
  }
}