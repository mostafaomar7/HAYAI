import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

/**
 * The AI assistants of the mobile apps: switch any of them on or off, and add,
 * edit or delete the patient app's custom ones.
 *
 * Built-in assistants live in code and can only be switched. A switch reaches
 * users on their next request. `brief` (a custom assistant's hidden
 * instructions) never leaves the admin API and is never logged here.
 */

export type AssistantAudience = 'patient' | 'tourist';

export interface AiAssistant {
  key: string;
  /** In the request language. */
  name: string;
  name_en: string;
  name_ar: string;
  /** Which app: `doctor` is the doctor app, `patient` the patient app. */
  user_type: 'patient' | 'doctor';
  /** Who sees it inside that app. */
  user_types: string[];
  /** `direct` sends one fixed question on tap; `suggested` opens a list. */
  interaction: 'direct' | 'suggested';
  enabled: boolean;
  /** The active questions the app shows. Read-only here; never sent back. */
  suggested_questions: unknown[];
  /** Absent on servers from before custom assistants: read as built-in. */
  is_custom?: boolean;
  brief?: string | null;
  entry_question_en?: string | null;
  entry_question_ar?: string | null;
}

export interface AiAssistantPayload {
  name_en?: string;
  name_ar?: string;
  user_types?: AssistantAudience[];
  /** `null` clears it. */
  brief?: string | null;
  entry_question_en?: string | null;
  entry_question_ar?: string | null;
  /** A JSON boolean: the string "true" is a 422. */
  enabled?: boolean;
}

/** The server's own limits, mirrored so the form can stop a save early. */
export const ASSISTANT_LIMITS = {
  name: 150,
  brief: 4000,
  entryQuestion: 300
} as const;

const BASE = '/admin/ai/modules';

@Injectable({ providedIn: 'root' })
export class AiAssistantsService {
  private api = inject(ApiService);

  /** All of them in one array, doctor app first, built-in before custom. */
  list(): Observable<AiAssistant[]> {
    return this.api.get<AiAssistant[]>(BASE);
  }

  get(key: string): Observable<AiAssistant> {
    return this.api.get<AiAssistant>(`${BASE}/${encodeURIComponent(key)}`);
  }

  /** A custom assistant of the patient app. Created off unless told otherwise. */
  create(body: AiAssistantPayload): Observable<AiAssistant> {
    return this.api.post<AiAssistant>(BASE, body);
  }

  /** Partial. A built-in assistant accepts `enabled` only. */
  update(key: string, body: AiAssistantPayload): Observable<AiAssistant> {
    return this.api.patch<AiAssistant>(`${BASE}/${encodeURIComponent(key)}`, body);
  }

  /** Custom only; takes its suggested questions with it. */
  delete(key: string): Observable<void> {
    return this.api.delete<void>(`${BASE}/${encodeURIComponent(key)}`);
  }
}
