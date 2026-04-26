import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-plans',
  standalone: true,
  imports: [],
  templateUrl: './plans.html',
  styleUrl: './plans.css',
})
export class Plans {
  private router = inject(Router);

  plansList = [
    {
      id: 1,
      title: 'Free',
      subtitle: 'Free',
      desc: 'Basic presence in the system',
      type: 'Hospital',
      features: [
        { name: 'Professional Profile', included: true },
        { name: 'Profile Preview', included: true },
        { name: 'View Patient File', included: true },
        { name: 'No requests', included: false },
        { name: 'No patient management', included: false }
      ]
    },
    {
      id: 2,
      title: 'Free',
      subtitle: 'Free',
      desc: 'Basic presence in the system',
      type: 'Hospital',
      features: [
        { name: 'Professional Profile', included: true },
        { name: 'Profile Preview', included: true },
        { name: 'View Patient File', included: true },
        { name: 'No requests', included: false },
        { name: 'No patient management', included: false }
      ]
    },
    {
      id: 3,
      title: 'Free',
      subtitle: 'Free',
      desc: 'Basic presence in the system',
      type: 'Hospital',
      features: [
        { name: 'Professional Profile', included: true },
        { name: 'Profile Preview', included: true },
        { name: 'View Patient File', included: true },
        { name: 'No requests', included: false },
        { name: 'No patient management', included: false }
      ]
    }
  ];

  goToDetails(id: number) {
    this.router.navigate(['/dashboard/plans/details', id]);
  }

  goToAdd() {
    this.router.navigate(['/dashboard/plans/add']);
  }
}