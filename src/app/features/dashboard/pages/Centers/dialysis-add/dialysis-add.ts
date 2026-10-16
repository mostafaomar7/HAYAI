import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CenterCategory } from '../../../../../core/services/centers.service';
import { CenterAddBase } from '../center-add.base';
import { TPipe } from '../../../../../core/i18n/t.pipe';
import { CanManageDirective } from '../../../../../shared/directives/can-manage.directive';

@Component({
  selector: 'app-dialysis-add',
  standalone: true,
  imports: [CommonModule, CanManageDirective, FormsModule, TPipe],
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
