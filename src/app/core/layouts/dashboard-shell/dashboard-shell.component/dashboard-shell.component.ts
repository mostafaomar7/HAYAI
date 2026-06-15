import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../../../navigation/sidebar.component/sidebar.component';
import { NavbarComponent } from '../../../navigation/navbar.component/navbar.component';
import { LayoutService } from '../../layout.service';

@Component({
  selector: 'app-dashboard-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet, SidebarComponent, NavbarComponent],
  templateUrl: './dashboard-shell.component.html',
  styleUrl: './dashboard-shell.component.css'
})
export class DashboardShellComponent {
  layout = inject(LayoutService);
}
