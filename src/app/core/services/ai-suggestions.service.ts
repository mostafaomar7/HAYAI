import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService } from './api.service';

/**
 * The questions the AI assistant offers in the patient and doctor apps, and
 * the hidden instructions sent with each one.
 *
 * Live content: released app builds read these too, so a save here reaches
 * users at once. `prompt` never leaves the admin API and is never logged here.
 */

export type SuggestionRole = 'patient' | 'doctor';

export interface AiSuggestion {
  id: number;
  role: SuggestionRole;
  module_key: string;
  /** In the request language, for display. */
  module_name: string;
  slug: string | null;
  /** `title_ar` on an Arabic request when set, else `title_en`. Display only. */
  title: string;
  title_en: string;
  /** Null only on rows imported before the feature. */
  title_ar: string | null;
  /** Hidden instructions appended to the AI's system prompt. */
  prompt: string | null;
  /** 1-based within the role; changed only by reorder. */
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** An assistant a question can belong to. Only assistants with a picker are listed. */
export interface AiSuggestionModule {
  key: string;
  role: SuggestionRole;
  name: string;
  name_en?: string;
  name_ar?: string;
  /** Who sees the assistant: `["tourist"]` means patients never do. */
  user_types: string[];
  /** Listed while off, so questions can be prepared ahead of switching it on. */
  enabled: boolean;
}

export interface AiSuggestionPayload {
  role?: SuggestionRole;
  module_key?: string;
  title_en?: string;
  title_ar?: string;
  /** `null` clears it. */
  slug?: string | null;
  /** `null` clears it. */
  prompt?: string | null;
  is_active?: boolean;
}

/** The server's own limits, mirrored so the form can stop a save early. */
export const SUGGESTION_LIMITS = {
  title: 300,
  prompt: 2000,
  slug: 64,
  slugPattern: /^[a-z0-9_]+$/
} as const;

const BASE = '/admin/ai/suggestions';

@Injectable({ providedIn: 'root' })
export class AiSuggestionsService {
  private api = inject(ApiService);

  modules(role: SuggestionRole): Observable<AiSuggestionModule[]> {
    return this.api.get<AiSuggestionModule[]>(`${BASE}/modules`, { role });
  }

  /**
   * Every row of the role in one page: reorder needs every id, inactive ones
   * included, so the screen never works from a partial list.
   */
  list(role: SuggestionRole): Observable<AiSuggestion[]> {
    return this.api
      .getPaged<AiSuggestion>(BASE, { role, per_page: 'all' })
      .pipe(map(r => r.items));
  }

  get(id: number): Observable<AiSuggestion> {
    return this.api.get<AiSuggestion>(`${BASE}/${id}`);
  }

  create(body: AiSuggestionPayload): Observable<AiSuggestion> {
    return this.api.post<AiSuggestion>(BASE, body);
  }

  /** Partial: only the fields sent change. */
  update(id: number, body: AiSuggestionPayload): Observable<AiSuggestion> {
    return this.api.patch<AiSuggestion>(`${BASE}/${id}`, body);
  }

  /** Soft delete with no restore; the row leaves the apps at once. */
  delete(id: number): Observable<void> {
    return this.api.delete<void>(`${BASE}/${id}`);
  }

  /** `ids` must be every row of the role exactly once. Answers the role's new list. */
  reorder(role: SuggestionRole, ids: number[]): Observable<AiSuggestion[]> {
    return this.api.post<AiSuggestion[]>(`${BASE}/reorder`, { role, ids });
  }
}
