import { Page, Route, expect, test } from '@playwright/test';

/**
 * What the site pushes to the tag manager, checked in a real browser against
 * the server-rendered build. Section 9 of the measurement spec: a container
 * that passed QA on launch day breaks silently the first time a button or a
 * form is redesigned, and this is what catches it.
 *
 * Form submissions never reach the API: the request is answered here. The
 * tests are about what the browser does with the answer, and a CI run must
 * not file a real lead in the client's dashboard.
 */

type Row = Record<string, unknown>;

const EMERGENCY = '/ar/' + encodeURIComponent('الطوارئ-والعناية-المركزة');

const PATIENT = {
  name: 'CI Tracking Test',
  email: 'qa+ci@hayaihealthcare.com',
  phone: '01000000000',
  message: 'Automated tracking test, please ignore.'
};

async function dataLayer(page: Page): Promise<Row[]> {
  return page.evaluate(() => ((window as unknown as { dataLayer?: Row[] }).dataLayer ?? []).filter(r => !Array.isArray(r) && typeof r === 'object' && !('0' in r)));
}

async function events(page: Page, name: string): Promise<Row[]> {
  return (await dataLayer(page)).filter(r => r['event'] === name);
}

/** The first push the server rendered: the page's classification. */
async function pageMetadata(page: Page): Promise<Row> {
  const rows = await dataLayer(page);
  const row = rows.find(r => 'page_sensitivity' in r && !('event' in r));
  expect(row, 'server-rendered page metadata').toBeTruthy();
  return row!;
}

/**
 * The app has taken over the server HTML. A click before this is a plain
 * browser navigation, which is a page load and not an in-app move.
 *
 * Hydration removes the `ngh` markers the server wrote on each component as
 * it claims them, so none left means the page is live.
 */
async function hydrated(page: Page): Promise<void> {
  await page.waitForFunction(() => !document.querySelector('[ngh]'));
}

function answerForm(page: Page, status: number, body: Row): Promise<void> {
  return page.route('**/forms/*/submissions', (route: Route) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
  );
}

async function fillContactForm(page: Page): Promise<void> {
  const form = page.locator('#form-contact');
  await form.scrollIntoViewIfNeeded();
  await form.locator('[name="name"]').fill(PATIENT.name);
  await form.locator('[name="email"]').fill(PATIENT.email);
  await form.locator('[name="phone"]').fill(PATIENT.phone);
  await form.locator('[name="message"]').fill(PATIENT.message);
  await form.locator('[name="__consent"]').check();
  await form.locator('button[type="submit"]').click();
}

test.describe('page metadata', () => {
  test('the home page is standard, typed and in its language', async ({ page }) => {
    await page.goto('/ar');
    const m = await pageMetadata(page);
    expect(m['page_sensitivity']).toBe('standard');
    expect(m['page_type']).toBe('home');
    expect(m['page_language']).toBe('ar');
    expect(m['content_group']).toBeTruthy();
    expect(m['journey_stage']).toBeTruthy();
    expect(m['clarity_allowed']).toBe(true);
  });

  test('the emergency page is sensitive and never recorded', async ({ page }) => {
    await page.goto(EMERGENCY);
    const m = await pageMetadata(page);
    expect(m['page_sensitivity']).toBe('sensitive');
    expect(m['clarity_allowed']).toBe(false);
  });

  test('an in-app move to a sensitive page reports it as sensitive', async ({ page }) => {
    await page.goto('/ar');
    await hydrated(page);
    await page.locator(`a[href="${EMERGENCY}"]`).first().click();
    await expect.poll(async () => (await events(page, 'virtual_page_view')).length).toBe(1);
    const [view] = await events(page, 'virtual_page_view');
    expect(view['page_sensitivity']).toBe('sensitive');
    expect(view['clarity_allowed']).toBe(false);
    expect(view['page_language']).toBe('ar');
    expect(String(view['page_location'])).toContain('/ar/');
  });
});

test.describe('lead form', () => {
  test('one generate_lead, with the server id and no personal data', async ({ page }) => {
    await answerForm(page, 201, { data: { reference: 'LD-CI-000001', duplicate: false, type: 'contact' } });
    await page.goto('/ar');
    await hydrated(page);
    await fillContactForm(page);

    await expect.poll(async () => (await events(page, 'generate_lead')).length).toBe(1);
    const [lead] = await events(page, 'generate_lead');
    expect(lead['transaction_id']).toBe('LD-CI-000001');
    expect(lead['event_id']).toBe('LD-CI-000001');
    expect(lead['form_id']).toBe('contact');
    expect(lead['page_sensitivity']).toBe('standard');
    expect(lead).not.toHaveProperty('user_data');

    const all = JSON.stringify(await dataLayer(page));
    for (const value of Object.values(PATIENT)) expect(all).not.toContain(value);
  });

  test('a retry the server recognised is not a second conversion', async ({ page }) => {
    await answerForm(page, 200, { data: { reference: 'LD-CI-000001', duplicate: true, type: 'contact' } });
    await page.goto('/ar');
    await hydrated(page);
    await fillContactForm(page);
    await expect(page.locator('#form-contact, .form-done').first()).toBeVisible();
    await page.waitForTimeout(500);
    expect(await events(page, 'generate_lead')).toHaveLength(0);
  });

  test('a rejected submit is a form_error, not a lead', async ({ page }) => {
    await answerForm(page, 422, { message: 'The given data was invalid.', errors: { 'fields.email': ['The email is invalid.'] } });
    await page.goto('/ar');
    await hydrated(page);
    await fillContactForm(page);

    await expect.poll(async () => (await events(page, 'form_error')).length).toBe(1);
    const [error] = await events(page, 'form_error');
    expect(error['form_id']).toBe('contact');
    expect(error['error_type']).toBe('validation');
    expect(await events(page, 'generate_lead')).toHaveLength(0);
    expect(JSON.stringify(error)).not.toContain(PATIENT.email);
  });
});

test.describe('whatsapp reference code', () => {
  test('a tap adds one code to the message and reports it to the API', async ({ page, context }) => {
    // Never leave for WhatsApp, and never file a real code on the API.
    await context.route(/wa\.me|api\.whatsapp\.com/, route => route.abort());
    const beacons: { body: Record<string, unknown>; type: string | undefined }[] = [];
    await page.route('**/whatsapp-refs', route => {
      beacons.push({ body: JSON.parse(route.request().postData() || '{}'), type: route.request().headers()['content-type'] });
      return route.fulfill({ status: 204 });
    });

    await page.goto('/ar?utm_source=ci&utm_medium=test&utm_campaign=wa-ref');
    await hydrated(page);
    const link = page.locator('a[href*="wa.me"], a[href*="api.whatsapp.com"]').first();
    test.skip((await link.count()) === 0, 'no WhatsApp link on the home page');

    // Stay on the page so the link can be read back: the site adds the code
    // in the capture phase, this cancels the navigation after it.
    await page.evaluate(() => document.addEventListener('click', e => e.preventDefault()));
    await link.click();
    await expect.poll(() => beacons.length).toBe(1);

    const ref = String(beacons[0].body['ref']);
    expect(ref).toMatch(/^H-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{7}$/);
    expect(beacons[0].type).toContain('text/plain');
    expect((beacons[0].body['attribution'] as Record<string, unknown>)['utm_campaign']).toBe('wa-ref');
    // The chat opens with the same code in its message, written with %20.
    const href = await link.getAttribute('href');
    expect(decodeURIComponent(href ?? '')).toContain(ref);
    expect(href).not.toContain('+');
  });
});

test.describe('search', () => {
  test('results are counted, the query is never sent', async ({ page }) => {
    await page.goto('/en/search?q=chest+pain');
    const m = await pageMetadata(page);
    expect(m['page_sensitivity']).toBe('sensitive');
    expect(m['page_type']).toBe('search_results');

    await expect.poll(async () => (await events(page, 'search_results_view')).length).toBe(1);
    const [view] = await events(page, 'search_results_view');
    expect(typeof view['result_count']).toBe('number');
    if (view['result_count'] === 0) expect(await events(page, 'no_results')).toHaveLength(1);

    // Nowhere — including page_location, which the Google tag reports as the URL.
    expect(String(m['page_location'])).toContain('/en/search');
    const all = JSON.stringify(await dataLayer(page)).toLowerCase();
    expect(all).not.toContain('chest');
  });
});
