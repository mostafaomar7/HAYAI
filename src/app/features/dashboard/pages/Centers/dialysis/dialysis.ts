import { Component, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-dialysis',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dialysis.html',
  styleUrl: './dialysis.css',
})
export class Dialysis {
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
    this.router.navigate(['/dashboard/dialysis-add']);
  }

  // التنقل لصفحة التفاصيل
  goToDetails(id: number) {
    this.router.navigate(['/dashboard/dialysis-details', id]);
  }

  // التنقل للتعديل من الكارت نفسه
  editCenter(event: Event, id: number) {
    event.stopPropagation(); // عشان ميفتحش التفاصيل لما تدوس على تعديل
    this.router.navigate(['/dashboard/dialysis/edit', id]); // تقدر تخليها تروح للـ Add برضه
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