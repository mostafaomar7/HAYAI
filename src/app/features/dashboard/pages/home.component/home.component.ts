import { Component } from '@angular/core';

@Component({
  selector: 'app-home', // يفضل دايماً الاسم يكون بدون .component
  standalone: true,
  imports: [],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent {
  stats = [
    { id: 1, title: 'Total Users', value: '15,342', trend: '10.2%', icon: 'total-users' },
    { id: 2, title: 'New Users', value: '10,302', trend: '10.2%', icon: 'new-users' },
    { id: 3, title: 'Total Revenue', value: '140,452', trend: '10.2%', icon: 'total-revenue' },
    { id: 4, title: 'Period Revenue', value: '40,692', trend: '10.2%', icon: 'period-revenue' }
  ];
}