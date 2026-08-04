import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TPipe } from '../../../core/i18n/t.pipe';

/**
 * Shared list pagination. Renders nothing when everything fits on one page.
 * Page numbers are collapsed with ellipsis once there are more than 7 pages.
 */
@Component({
  selector: 'app-pagination',
  standalone: true,
  imports: [CommonModule, TPipe],
  templateUrl: './pagination.component.html',
  styleUrl: './pagination.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PaginationComponent {
  page = input.required<number>();
  total = input.required<number>();
  perPage = input<number>(15);

  pageChange = output<number>();

  lastPage = computed(() => Math.max(1, Math.ceil(this.total() / this.perPage())));
  from = computed(() => (this.total() ? (this.page() - 1) * this.perPage() + 1 : 0));
  to = computed(() => Math.min(this.page() * this.perPage(), this.total()));

  /** Page numbers to render; `null` marks an ellipsis gap. */
  pages = computed<(number | null)[]>(() => {
    const last = this.lastPage();
    const current = this.page();
    if (last <= 7) return Array.from({ length: last }, (_, i) => i + 1);

    const out: (number | null)[] = [1];
    const start = Math.max(2, current - 1);
    const end = Math.min(last - 1, current + 1);
    if (start > 2) out.push(null);
    for (let p = start; p <= end; p++) out.push(p);
    if (end < last - 1) out.push(null);
    out.push(last);
    return out;
  });

  go(page: number) {
    if (page < 1 || page > this.lastPage() || page === this.page()) return;
    this.pageChange.emit(page);
  }
}
