import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CenterCategory } from '../../../../../core/services/centers.service';
import { CenterAddBase } from '../center-add.base';

@Component({
  selector: 'app-dialysis-add',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dialysis-add.html',
  styleUrl: './dialysis-add.css'
})
export class DialysisAdd extends CenterAddBase {
  override category: CenterCategory = 'dialysis';
  override listRoute = '/dashboard/dialysis';

  constructor() {
    super();
    this.init();
  }
}
