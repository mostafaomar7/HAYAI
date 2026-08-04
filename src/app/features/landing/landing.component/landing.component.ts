import { Component, ElementRef, inject, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TPipe } from '../../../core/i18n/t.pipe';

interface IconCard {
  key: string;
  /** SVG path `d` strings, drawn stroked on a 24×24 viewBox. */
  icon: string[];
}

interface ExperienceCard extends IconCard {
  shots: [string, string];
}

interface Testimonial {
  name: string;
  avatar: string;
  bodyKey: string;
}

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, RouterLink, TPipe],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.css'
})
export class LandingComponent {
  i18n = inject(I18nService);

  /**
   * Store links are intentionally empty until the apps are published — the
   * badges render without an `href` so they cannot navigate. Fill these two
   * strings in and they go live; no markup change needed.
   */
  readonly appStoreUrl = '';
  readonly googlePlayUrl = '';

  readonly currentYear = new Date().getFullYear();

  private track = viewChild<ElementRef<HTMLElement>>('expTrack');

  readonly features: IconCard[] = [
    { key: 'find_doctors', icon: ['M21 21l-4.35-4.35M17 10a7 7 0 11-14 0 7 7 0 0114 0z'] },
    { key: 'appointments', icon: ['M8 7V3m8 4V3M3 11h18M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', 'M9 16l2 2 4-4'] },
    { key: 'records', icon: ['M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z', 'M12 11.5c.9-1.2 3-1 3 .7 0 1.4-1.6 2.5-3 3.3-1.4-.8-3-1.9-3-3.3 0-1.7 2.1-1.9 3-.7z'] },
    { key: 'ai', icon: ['M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3z', 'M18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2z'] },
    { key: 'transport', icon: ['M3 17V7a1 1 0 011-1h9a1 1 0 011 1v10M14 10h3.4a1 1 0 01.8.4l2.4 3.2a1 1 0 01.2.6V17M5 17h1m5 0h5m3 0h1', 'M8 9v4M6 11h4'] },
    { key: 'lab', icon: ['M9 3v6.5L4.5 17A2 2 0 006.2 20h11.6a2 2 0 001.7-3L15 9.5V3M8 3h8M7.5 14h9'] }
  ];

  readonly experience: ExperienceCard[] = [
    {
      key: 'file',
      icon: ['M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z', 'M12 11.5c.9-1.2 3-1 3 .7 0 1.4-1.6 2.5-3 3.3-1.4-.8-3-1.9-3-3.3 0-1.7 2.1-1.9 3-.7z'],
      shots: ['exp-file-a.webp', 'exp-file-b.webp']
    },
    {
      key: 'transport',
      icon: ['M3 17V7a1 1 0 011-1h9a1 1 0 011 1v10M14 10h3.4a1 1 0 01.8.4l2.4 3.2a1 1 0 01.2.6V17M5 17h1m5 0h5m3 0h1', 'M8 9v4M6 11h4'],
      shots: ['exp-transport-a.webp', 'exp-transport-b.webp']
    },
    {
      key: 'ai',
      icon: ['M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3z', 'M18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2z'],
      shots: ['exp-ai-a.webp', 'exp-ai-b.webp']
    }
  ];

  readonly roles: IconCard[] = [
    { key: 'patients', icon: ['M12 12a4 4 0 100-8 4 4 0 000 8z', 'M4 20a8 8 0 0116 0'] },
    { key: 'doctors', icon: ['M6 3v5a4 4 0 008 0V3', 'M10 15v1a5 5 0 0010 0v-1', 'M20 12a2 2 0 100-4 2 2 0 000 4z'] },
    { key: 'hospitals', icon: ['M4 21V7a1 1 0 011-1h4V3h6v3h4a1 1 0 011 1v14', 'M9 21v-5h6v5M12 9v4M10 11h4'] },
    { key: 'clinics', icon: ['M3 11l9-7 9 7v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1v-9z'] },
    { key: 'labs', icon: ['M9 3v6.5L4.5 17A2 2 0 006.2 20h11.6a2 2 0 001.7-3L15 9.5V3M8 3h8M7.5 14h9'] },
    { key: 'organizations', icon: ['M4 21V5a1 1 0 011-1h9a1 1 0 011 1v16M15 21V9h4a1 1 0 011 1v11', 'M8 8h3M8 12h3M8 16h3'] }
  ];

  /**
   * Placeholder reviews carried over verbatim from the design file — they are
   * template lorem, not real customers. Replace before launch.
   */
  readonly testimonials: Testimonial[] = [
    { name: 'Dazzle Healer', avatar: '1', bodyKey: 'landing.reviews.a' },
    { name: 'Crystal Maiden', avatar: '2', bodyKey: 'landing.reviews.b' },
    { name: 'Mirana Marci', avatar: '3', bodyKey: 'landing.reviews.c' },
    { name: 'Bimosaurus', avatar: '4', bodyKey: 'landing.reviews.d' }
  ];

  /** Also placeholder copy from the design file. */
  readonly faqs = ['q1', 'q2', 'q3', 'q4'];
  openFaq = 0;

  toggleFaq(index: number) {
    this.openFaq = this.openFaq === index ? -1 : index;
  }

  scrollExperience(direction: -1 | 1) {
    const el = this.track()?.nativeElement;
    if (!el) return;
    // `scrollBy` is always physical, so "previous" moves right in Arabic.
    const sign = this.i18n.isRtl() ? -direction : direction;
    el.scrollBy({ left: sign * (el.clientWidth * 0.8), behavior: 'smooth' });
  }

  initials(name: string): string {
    const parts = name.trim().split(/\s+/);
    return (parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2)).toUpperCase();
  }
}
