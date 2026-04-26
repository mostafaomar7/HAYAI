import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-advertisements',
  standalone: true,
  imports: [],
  templateUrl: './advertisements.html',
  styleUrl: './advertisements.css',
})
export class Advertisements {
  private router = inject(Router);

  // داتا وهمية للتيست وفيها مسار صورة طبية 
  adsList = [
    { id: 1, link: 'Link: yellowpages.com', image: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80' },
    { id: 2, link: 'Link: yellowpages.com', image: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80' },
    { id: 3, link: 'Link: yellowpages.com', image: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80' },
    { id: 4, link: 'Link: yellowpages.com', image: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80' },
    { id: 5, link: 'Link: yellowpages.com', image: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80' },
    { id: 6, link: 'Link: yellowpages.com', image: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80' },
  ];

  onAdd() {
    this.router.navigate(['/dashboard/Advertisements/add']); // عدل المسار حسب الـ Routing بتاعك
  }

  onEdit(id: number) {
    this.router.navigate(['/dashboard/Advertisements/edit', id]); // بينقل لصفحة التعديل مع الـ ID
  }
}