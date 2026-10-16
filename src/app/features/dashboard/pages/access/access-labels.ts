import { I18nService } from '../../../../core/i18n/i18n.service';

/**
 * Display names for roles and website permissions. Both are the API's
 * machine names; a translation is used where there is one (`web.role.*`,
 * `web.perm.*`, `web.roles.group.*` — the keys the website roles screen
 * introduced), and a role created later shows its own name until then.
 */
export function roleLabel(i18n: I18nService, name: string): string {
  return lookup(i18n, `web.role.${name}`, name);
}

export function permLabel(i18n: I18nService, perm: string): string {
  return lookup(i18n, `web.perm.${perm}`, perm);
}

export function websiteGroupLabel(i18n: I18nService, group: string): string {
  return lookup(i18n, `web.roles.group.${group}`, group);
}

function lookup(i18n: I18nService, key: string, fallback: string): string {
  const t = i18n.translate(key);
  return t === key ? fallback : t;
}
