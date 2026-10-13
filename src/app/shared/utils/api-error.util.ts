import { HttpErrorResponse } from '@angular/common/http';

/**
 * Turns a failed request into something worth showing a person.
 *
 * A 422 from this API carries both a heading and the detail:
 *
 * ```json
 * { "message": "Validation failed",
 *   "errors": { "image": ["Ad image is required."] } }
 * ```
 *
 * Showing only `message` leaves "Validation failed" on screen with no clue
 * which field is at fault — the QA round hit exactly that saving an
 * advertisement without a picture, while the answer was sitting in `errors`
 * the whole time.
 *
 * Every field is listed, not just the first: one save can fail on several at
 * once, and fixing them one round trip at a time is its own small misery.
 */
export function apiErrorText(err: unknown, fallback: string): string {
  const body = (err as HttpErrorResponse)?.error;
  const details = collect(body?.errors);
  if (details.length) return details.join(' ');
  return typeof body?.message === 'string' && body.message ? body.message : fallback;
}

/**
 * Laravel writes `{ field: ["msg", …] }`, but a nested rule gives
 * `items.0.name` and some handlers answer with a bare string. Take the first
 * message of each entry and leave the key out: it is a column name, not
 * something to put in front of an admin.
 */
function collect(errors: unknown): string[] {
  if (!errors || typeof errors !== 'object') return [];
  const out: string[] = [];
  for (const value of Object.values(errors as Record<string, unknown>)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (typeof first === 'string' && first.trim() && !out.includes(first)) out.push(first);
  }
  return out;
}
