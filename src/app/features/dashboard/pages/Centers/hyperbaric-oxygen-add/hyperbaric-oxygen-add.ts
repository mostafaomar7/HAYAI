import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CenterCategory } from '../../../../../core/services/centers.service';
import { CenterAddBase } from '../center-add.base';

@Component({
  selector: 'app-hyperbaric-oxygen-add',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './hyperbaric-oxygen-add.html',
  styleUrl: './hyperbaric-oxygen-add.css'
})
export class HyperbaricOxygenAdd extends CenterAddBase {
  override category: CenterCategory = 'hyperbaric_oxygen';
  override listRoute = '/dashboard/HyperbaricOxygen';

  constructor() {
    super();
    this.init();
  }
}
