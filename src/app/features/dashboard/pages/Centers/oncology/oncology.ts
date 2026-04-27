import { Component, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-oncology',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './oncology.html',
  styleUrl: './oncology.css',
})
export class Oncology {
  private router = inject(Router);
  showFilter = false;

  // داتا وهمية للكروت
  centers = Array(6).fill({
    id: 1,
    name: 'Healthcare For All',
    location: 'Healthcare For All',
    contacts: 3,
    services: 5,
    status: 'available',
    image: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80'
  });

  // التنقل لصفحة الإضافة
  goToAdd() {
    this.router.navigate(['/dashboard/Oncology-add']);
  }

  // التنقل لصفحة التفاصيل
  goToDetails(id: number) {
    this.router.navigate(['/dashboard/Oncology-details', id]);
  }

  // التنقل للتعديل من الكارت نفسه
  editCenter(event: Event, id: number) {
    event.stopPropagation(); 
    this.router.navigate(['/dashboard/Oncology-edit', id]); 
  }

  deleteCenter(event: Event, id: number) {
    event.stopPropagation();
    console.log('Delete Center', id);
  }

  toggleFilter(event: Event) {
    event.stopPropagation();
    this.showFilter = !this.showFilter;
  }

  preventClose(event: Event) {
    event.stopPropagation();
  }

  @HostListener('document:click')
  closeFilter() {
    this.showFilter = false;
  }
}