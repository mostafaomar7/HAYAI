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

export const DEFAULT_SCHEDULE: ScheduleSlot[] = [
  { day: 'saturday', active: true, from: '', to: '' },
  { day: 'sunday', active: true, from: '', to: '' },
  { day: 'monday', active: true, from: '', to: '' },
  { day: 'tuesday', active: true, from: '', to: '' },
  { day: 'wednesday', active: true, from: '', to: '' },
  { day: 'thursday', active: true, from: '', to: '' },
  { day: 'friday', active: true, from: '', to: '' }
];
