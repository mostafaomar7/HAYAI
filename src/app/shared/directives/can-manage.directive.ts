import { Directive, TemplateRef, ViewContainerRef, effect, inject, input } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AdminAccessService, AdminArea, areaForUrl } from '../../core/services/admin-access.service';

/**
 * Renders its element only when the admin may change things in this area:
 *
 *   <button *appCanManage (click)="approve(row)">Approve</button>
 *   <button *appCanManage="'pharmacies'" …>  (an explicit area)
 *
 * Without an area it takes the one the screen's route belongs to (the table
 * in AdminAccessService), read from the route this component was opened by
 * rather than `Router.url`, which still holds the previous URL while the new
 * screen is being built. A screen with no area keeps its buttons.
 *
 * Hiding is for the admin's sake only. The API refuses the write anyway
 * (403 `ADMIN_PERMISSION_DENIED`), and the interceptor says so.
 */
@Directive({ selector: '[appCanManage]', standalone: true })
export class CanManageDirective {
  private access = inject(AdminAccessService);
  private route = inject(ActivatedRoute, { optional: true });
  private tpl = inject(TemplateRef<unknown>);
  private vcr = inject(ViewContainerRef);

  readonly appCanManage = input<AdminArea | '' | null | undefined>('');

  private shown = false;

  constructor() {
    effect(() => {
      const explicit = this.appCanManage();
      const allowed = explicit
        ? this.access.can(explicit, 'manage')
        : this.access.canManageAt(this.routeUrl());
      if (allowed && !this.shown) {
        this.vcr.createEmbeddedView(this.tpl);
        this.shown = true;
      } else if (!allowed && this.shown) {
        this.vcr.clear();
        this.shown = false;
      }
    });
  }

  private routeUrl(): string {
    const segments = this.route?.snapshot.pathFromRoot.flatMap(r => r.url.map(s => s.path)) ?? [];
    return '/' + segments.join('/');
  }
}

/** The same check for a component's own code: `canManageHere(route)`. */
export function routeUrlOf(route: ActivatedRoute): string {
  return '/' + route.snapshot.pathFromRoot.flatMap(r => r.url.map(s => s.path)).join('/');
}

export { areaForUrl };
