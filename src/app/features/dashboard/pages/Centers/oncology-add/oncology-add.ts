import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CenterCategory } from '../../../../../core/services/centers.service';
import { CenterAddBase } from '../center-add.base';
import { TPipe } from '../../../../../core/i18n/t.pipe';

@Component({
  selector: 'app-oncology-add',
  standalone: true,
  imports: [CommonModule, FormsModule, TPipe],
  templateUrl: './oncology-add.html',
  styleUrl: './oncology-add.css'
})
export class OncologyAdd extends CenterAddBase {
  override category: CenterCategory = 'oncology';
  override listRoute = '/dashboard/Oncology';

  constructor() {
    super();
    this.init();
  }
}
