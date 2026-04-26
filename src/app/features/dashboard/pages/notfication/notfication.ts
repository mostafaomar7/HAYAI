import { Component } from '@angular/core';

@Component({
  selector: 'app-notfication', // نفس الاسم اللي بعته
  standalone: true,
  imports: [],
  templateUrl: './notfication.html',
  styleUrl: './notfication.css',
})
export class Notfication {
  
  // دالة بسيطة تتنفذ لما تدوس على الزرار
  sendNotification() {
    console.log('Notification sent!');
    // هنا هتحط كود الـ API بتاعك مستقبلاً
  }
}