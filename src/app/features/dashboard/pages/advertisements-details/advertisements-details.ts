import { Component, inject } from '@angular/core';
import { Location } from '@angular/common';

@Component({
  selector: 'app-advertisements-details',
  standalone: true,
  imports: [],
  templateUrl: './advertisements-details.html',
  styleUrl: './advertisements-details.css',
})
export class AdvertisementsDetails {
  private location = inject(Location);

  // المتغير ده عشان نـ Test بيه شكل الصورة وهي مرفوعة، ممكن تخليه null عشان تشوف شكل الرفع
  uploadedImage: string | null = 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80';

  goBack() {
    this.location.back();
  }

  removeImage() {
    this.uploadedImage = null;
  }
}