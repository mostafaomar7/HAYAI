import { ContactItem, ScheduleSlot } from '../../core/models/scheduled-entity.model';

export function appendScalar(form: FormData, key: string, value: unknown): void {
  if (value === null || value === undefined) return;
  if (typeof value === 'boolean') {
    form.append(key, value ? '1' : '0');
    return;
  }
  form.append(key, String(value));
}

export function appendFile(form: FormData, key: string, file: File | null): void {
  if (file) form.append(key, file);
}

export function appendSchedule(form: FormData, schedule: ScheduleSlot[]): void {
  schedule.forEach((s, i) => {
    form.append(`schedule[${i}][day]`, s.day);
    form.append(`schedule[${i}][active]`, s.active ? '1' : '0');
    form.append(`schedule[${i}][from]`, s.active ? (s.from ?? '') : '');
    form.append(`schedule[${i}][to]`, s.active ? (s.to ?? '') : '');
  });
}

export function appendServices(form: FormData, services: string[]): void {
  services.forEach((srv, i) => form.append(`services[${i}]`, srv));
}

export function appendContacts(form: FormData, contacts: ContactItem[]): void {
  contacts.forEach((c, i) => {
    form.append(`contacts[${i}][title]`, c.title);
    form.append(`contacts[${i}][phone]`, c.phone);
  });
}
