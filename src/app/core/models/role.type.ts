/**
 * The only role that can reach `/admin/*`. The backend's `EnsureAdmin`
 * middleware compares `user_type` against the exact string `admin` and 403s
 * everything else, so there is no second dashboard role to model today.
 * Finer-grained access will arrive as a `permissions: string[]` list on
 * `/auth/me`, which can be layered on without changing this union.
 */
export type UserRole = 'admin';
