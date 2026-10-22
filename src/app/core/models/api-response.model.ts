export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  meta?: ApiMeta;
}

export interface ApiMeta {
  pagination?: ApiPagination;
  /**
   * Counters some lists put beside the pagination — `pending_count` on the AI
   * token requests, for the sidebar badge. Kept loose because each list names
   * its own, and `pagination.total` is not the same number once a status
   * filter is on.
   */
  [key: string]: unknown;
}

export interface ApiPagination {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
  from: number;
  to: number;
}

export interface ApiErrorBody {
  success: false;
  message: string;
  errors?: Record<string, string[]>;
}
