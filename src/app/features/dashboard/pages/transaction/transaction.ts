import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TPipe } from '../../../../core/i18n/t.pipe';

@Component({
  selector: 'app-transaction',
  standalone: true,
  imports: [CommonModule, TPipe],
  templateUrl: './transaction.html',
  styleUrl: './transaction.css'
})
export class Transaction {}
