import { Component, inject } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-hyperbaric-oxygen-details',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './hyperbaric-oxygen-details.html',
  styleUrl: './hyperbaric-oxygen-details.css',
})
export class HyperbaricOxygenDetails {
  private location = inject(Location);
  private router = inject(Router);

  // داتا وهمية للعرض
  dates = [
    { day: 'Saturday', time: '10:00 AM - 08:00 PM', available: true },
    { day: 'Sunday', time: '10:00 AM - 08:00 PM', available: true },
    { day: 'Monday', time: '10:00 AM - 08:00 PM', available: true },
    { day: 'Tuesday', time: '10:00 AM - 08:00 PM', available: true },
    { day: 'Wednesday', time: '10:00 AM - 08:00 PM', available: true },
    { day: 'Thursday', time: '10:00 AM - 08:00 PM', available: true },
    { day: 'Friday', time: 'Not Available', available: false }
  ];

  contacts = [
    { type: 'Hospital', phone: '01119253120' },
    { type: 'Home Care Manager (Mohamed ali)', phone: '01119253120' },
    { type: 'Complaints', phone: '01119253120' }
  ];

  goBack() { this.location.back(); }
  goToEdit() { this.router.navigate(['/hyperbaric-oxygen/add']); } 
}