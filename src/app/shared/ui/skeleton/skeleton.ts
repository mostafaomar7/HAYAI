import { Component, Input, booleanAttribute } from '@angular/core';

/**
 * A grey block standing in for content that has not arrived yet.
 *
 * A dashboard page is client-rendered, so there is nothing on screen until the
 * bundle boots and the first request comes back. The word "Loading…" filled
 * that gap with a single line of text, so the page had no shape at all and
 * then jumped into its real layout. A block of the right size holds the shape
 * from the first paint, which is what the QA round asked for.
 *
 * Deliberately dumb: no state, no timers. It is laid out by whatever grid it
 * is placed in, so a skeleton row sits exactly where the real row will.
 */
@Component({
  selector: 'app-skeleton',
  standalone: true,
  template: '',
  host: {
    'class': 'hayai-skeleton',
    '[class.hayai-skeleton--circle]': 'circle',
    '[style.width]': 'w',
    '[style.height]': 'h',
    '[style.border-radius]': 'circle ? "50%" : radius',
    'aria-hidden': 'true'
  },
  styles: [`
    :host {
      display: block;
      background: #EEF1F5;
      overflow: hidden;
      position: relative;
    }
    :host::after {
      content: '';
      position: absolute;
      inset: 0;
      transform: translateX(-100%);
      background: linear-gradient(90deg, transparent, rgba(255, 255, 255, .72), transparent);
      animation: hayai-skeleton-sweep 1.3s infinite;
    }
    /* The sweep travels with the text, so it reads as progress in both
       directions rather than running backwards in Arabic. */
    :host-context([dir="rtl"])::after { animation-name: hayai-skeleton-sweep-rtl; }

    @keyframes hayai-skeleton-sweep { to { transform: translateX(100%); } }
    @keyframes hayai-skeleton-sweep-rtl { to { transform: translateX(-200%); } }

    /* A full-width shimmer repeating across a page of placeholders is exactly
       the kind of motion this setting exists to stop. */
    @media (prefers-reduced-motion: reduce) {
      :host::after { animation: none; }
    }
  `]
})
export class SkeletonComponent {
  /** Any CSS length; the default fills whatever column it is dropped into. */
  @Input() w = '100%';
  @Input() h = '1rem';
  @Input() radius = '6px';
  @Input({ transform: booleanAttribute }) circle = false;
}
