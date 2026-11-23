import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * The brand's line icon set (brief §02): 24 px grid, 1.8 px stroke, rounded
 * joins, one pillar colour each. A CMS item names its icon (`icon: "bed"`);
 * an unknown name draws nothing. Paths are drawn for this set, not copied.
 */
const PATHS: Record<string, string> = {
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
  pin: 'M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  bed: 'M3 18V7M3 14h18v4M21 14v-2a3 3 0 0 0-3-3h-7v5M7 12a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z',
  hospital: 'M4 21V7l8-4 8 4v14M2 21h20M12 8v5M9.5 10.5h5M9 21v-4h6v4',
  doctor: 'M6 3v5a4 4 0 0 0 8 0V3M10 12v3a5 5 0 0 0 10 0v-2M20 13a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  shield: 'M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-3zM9 12l2 2 4-4',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  wallet: 'M4 7h15a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a2 2 0 0 1 2-2h11M16 13.5h.01',
  phone: 'M5 4h3l2 5-2.5 1.5a11 11 0 0 0 6 6L15 14l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z',
  chat: 'M4 5h16v11H9l-5 4V5zM8 10h8M8 13h5',
  heart: 'M12 20s-8-4.6-8-10.2A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 8 2.8C20 15.4 12 20 12 20z',
  child: 'M12 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM7 21l1-6-2-3 3-2h6l3 2-2 3 1 6M10 15h4',
  calendar: 'M4 6h16v15H4zM4 10h16M8 3v4M16 3v4M8 14h3',
  file: 'M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9s1-6.5 3.5-9z',
  pill: 'M8.5 15.5l7-7a3.5 3.5 0 0 1 5 5l-7 7a3.5 3.5 0 0 1-5-5zM12 12l5 5M3.5 9.5l5-5',
  lab: 'M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3M7.5 15h9',
  apple: 'M12 7c-1.5-1.5-6-1.6-6 4 0 4 2.5 9 6 9s6-5 6-9c0-5.6-4.5-5.5-6-4zM12 7c0-2 1-3.5 3-4',
  users: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM3 20a6 6 0 0 1 12 0M16 4a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3 6',
  alert: 'M12 4l9 16H3zM12 10v4M12 17h.01',
  ambulance: 'M3 17V8h11v9M14 11h4l3 3v3h-7M7 10v4M5 12h4M7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  plane: 'M10 14l-6 1-1-2 7-3V5a2 2 0 0 1 4 0v5l7 3-1 2-6-1v4l2 2v1l-4-1-4 1v-1l2-2z'
};

const ALIASES: Record<string, string> = {
  location: 'pin', map: 'pin', 'map-pin': 'pin', area: 'pin',
  icu: 'bed', 'icu-bed': 'bed', emergency: 'ambulance',
  clinic: 'hospital', building: 'hospital',
  stethoscope: 'doctor', specialist: 'doctor',
  verified: 'shield', trust: 'shield', 'shield-check': 'shield',
  time: 'clock', availability: 'clock',
  cost: 'wallet', money: 'wallet', price: 'wallet', insurance: 'wallet',
  call: 'phone', hotline: 'phone',
  whatsapp: 'chat', message: 'chat', support: 'chat',
  pregnancy: 'heart', cycle: 'heart', 'heart-pulse': 'heart', care: 'heart',
  baby: 'child', children: 'child', vaccine: 'child', kids: 'child',
  appointment: 'calendar', booking: 'calendar',
  document: 'file', 'medical-file': 'file', report: 'file', records: 'file',
  ai: 'sparkle', 'ai-assistant': 'sparkle', assistant: 'sparkle',
  tourism: 'plane', travel: 'plane', world: 'globe',
  pharmacy: 'pill', medicine: 'pill',
  labs: 'lab', laboratory: 'lab', radiology: 'lab',
  nutrition: 'apple', food: 'apple', diet: 'apple',
  family: 'users', team: 'users', partners: 'users',
  warning: 'alert', urgent: 'alert'
};

/** Journey pillars, in order: Understand, Find, Know, Act, Continue. */
export const PILLARS = ['#0DBBF9', '#0286F2', '#003281', '#FF6449', '#FF3358'];

export function iconKnown(name: string | null | undefined): boolean {
  const n = (name ?? '').toLowerCase().trim();
  return !!(PATHS[n] || PATHS[ALIASES[n]]);
}

@Component({
  selector: 'site-line-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'line-icon', '[style.--pillar]': 'color()', 'aria-hidden': 'true' },
  template: `
    @if (d()) {
      <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8"
           stroke-linecap="round" stroke-linejoin="round" focusable="false"><path [attr.d]="d()" /></svg>
    }
  `
})
export class LineIconComponent {
  readonly name = input<string | null | undefined>(null);
  /** Position in its group: picks the pillar colour. */
  readonly index = input(0);
  protected d = computed(() => {
    const n = (this.name() ?? '').toLowerCase().trim();
    return PATHS[n] ?? PATHS[ALIASES[n]] ?? null;
  });
  protected color = computed(() => PILLARS[this.index() % PILLARS.length]);
}
