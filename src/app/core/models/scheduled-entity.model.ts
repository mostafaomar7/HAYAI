export type Weekday = 'saturday' | 'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday';

export interface ScheduleSlot {
  day: Weekday;
  active: boolean;
  from: string | null;
  to: string | null;
}

export interface ContactItem {
  id?: string;
  title: string;
  phone: string;
}

/** Display and payload order — the week starts on Saturday. */
export const WEEKDAYS: Weekday[] = [
  'saturday', 'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday'
];

/**
 * What a brand new organisation or centre starts with: closed, every day.
 *
 * Every day used to start switched on with no hours, so anyone who saved a
 * record without touching this section published "open seven days a week,
 * times unknown" — about a place nobody had said anything about. Off is the
 * honest starting point: the form then only claims the days somebody turned
 * on, and those now have to carry times.
 *
 * Used only for a record being created. Loading an existing one replaces this
 * wholesale, so changing it cannot disturb anything already stored.
 */
export const DEFAULT_SCHEDULE: ScheduleSlot[] = [
  { day: 'saturday', active: false, from: '', to: '' },
  { day: 'sunday', active: false, from: '', to: '' },
  { day: 'monday', active: false, from: '', to: '' },
  { day: 'tuesday', active: false, from: '', to: '' },
  { day: 'wednesday', active: false, from: '', to: '' },
  { day: 'thursday', active: false, from: '', to: '' },
  { day: 'friday', active: false, from: '', to: '' }
];
