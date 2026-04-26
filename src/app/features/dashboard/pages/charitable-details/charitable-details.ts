import { Component, inject } from '@angular/core';
import { CommonModule, Location } from '@angular/common';

@Component({
  selector: 'app-charitable-details',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './charitable-details.html',
  styleUrl: './charitable-details.css',
})
export class CharitableDetails {
  private location = inject(Location);

  // مصفوفة المواعيد عشان الـ HTML يكون أنظف
  schedule = [
    { day: 'Saturday', time: '10:00 AM - 08:00 PM', available: true },
    { day: 'Sunday', time: '10:00 AM - 08:00 PM', available: true },
    { day: 'Monday', time: '10:00 AM - 08:00 PM', available: true },
    { day: 'Tuesday', time: '10:00 AM - 08:00 PM', available: true },
    { day: 'Wednesday', time: '10:00 AM - 08:00 PM', available: true },
    { day: 'Thursday', time: '10:00 AM - 08:00 PM', available: true },
    { day: 'Friday', time: 'Not Available', available: false },
  ];

  goBack() {
    this.location.back();
  }
}