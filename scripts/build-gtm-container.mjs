#!/usr/bin/env node
/**
 * Builds the GTM container import file (Admin → Import Container) for
 * GTM-5VKC5CMT from the configuration in docs/gtm-container-setup.md.
 *
 *   node scripts/build-gtm-container.mjs   → tracking/gtm/hayai-container-import.json
 *
 * Generated, not hand-written, so the container and the website cannot drift:
 * every dataLayer key and event name below is one the site pushes
 * (tracking/plan.json). Change the plan, re-run this, re-import.
 *
 * Two tags are NOT in the file and are added from the Community Template
 * Gallery after import: CookieYes CMP and Microsoft Clarity. A gallery
 * template is only importable together with its full source, which belongs to
 * its vendor; adding it from the Gallery keeps it on the vendor's updates.
 * The triggers they fire on are in the file.
 */
import { mkdirSync, writeFileSync } from 'node:fs';

const IDS = {
  container: 'GTM-5VKC5CMT',
  ga4Live: 'G-NS1Q07ZLBF',
  ga4Staging: 'G-EXCKD07VXC',
  ads: '18499939113',
  labels: {
    lead: '8zBYCL-7zZQdEKnWuvVE',
    whatsapp: 'vjE2CMK7zZQdEKnWuvVE',
    phone: '9eobCMW7zZQdEKnWuvVE'
  }
};

const ACCOUNT = '0';
const CONTAINER = '0';
const BUILTIN_INITIALIZATION = '2147479573';
const BUILTIN_ALL_PAGES = '2147479553';

// ---- parameter helpers ------------------------------------------------------
const t = (key, value) => ({ type: 'TEMPLATE', key, value: String(value) });
const b = (key, value) => ({ type: 'BOOLEAN', key, value: String(value) });
const i = (key, value) => ({ type: 'INTEGER', key, value: String(value) });
const list = (key, maps) => ({ type: 'LIST', key, list: maps });
const map = (entries) => ({ type: 'MAP', map: entries });
const paramRows = (rows) => rows.map(([k, v]) => map([t('parameter', k), t('parameterValue', v)]));
const cond = (type, arg0, arg1, negate = false) => ({
  type,
  parameter: [t('arg0', arg0), t('arg1', arg1), ...(negate ? [b('negate', true)] : [])]
});
const consent = (...types) =>
  types.length
    ? { consentStatus: 'NEEDED', consentType: { type: 'LIST', list: types.map(v => ({ type: 'TEMPLATE', value: v })) } }
    : { consentStatus: 'NOT_NEEDED' };

let nextId = 1;
const id = () => String(nextId++);
const base = () => ({ accountId: ACCOUNT, containerId: CONTAINER });

// ---- variables --------------------------------------------------------------
const variables = [];
const dlv = (key) => {
  variables.push({
    ...base(),
    variableId: id(),
    name: `DLV - ${key}`,
    type: 'v',
    parameter: [i('dataLayerVersion', 2), b('setDefaultValue', false), t('name', key)]
  });
  return `{{DLV - ${key}}}`;
};

const DL_KEYS = [
  'page_type', 'page_language', 'page_sensitivity', 'content_group', 'journey_stage', 'care_category',
  'clarity_allowed', 'traffic_type', 'page_location', 'page_title',
  'ft_source', 'ft_medium', 'ft_campaign',
  'transaction_id', 'event_id', 'form_id', 'lead_type', 'value', 'currency',
  'cta_kind', 'cta_tracking_key', 'placement',
  'result_count', 'area', 'error_type'
];
const V = Object.fromEntries(DL_KEYS.map(k => [k, dlv(k)]));

variables.push({
  ...base(),
  variableId: id(),
  name: 'LT - GA4 ID by hostname',
  type: 'smm',
  parameter: [
    b('setDefaultValue', true),
    t('input', '{{Page Hostname}}'),
    t('defaultValue', IDS.ga4Staging),
    list('map', [
      map([t('key', 'hayaihealthcare.com'), t('value', IDS.ga4Live)]),
      map([t('key', 'www.hayaihealthcare.com'), t('value', IDS.ga4Live)])
    ])
  ]
});
const GA4_ID = '{{LT - GA4 ID by hostname}}';

variables.push({ ...base(), variableId: id(), name: 'CONST - Google Ads ID', type: 'c', parameter: [t('value', IDS.ads)] });
const ADS_ID = '{{CONST - Google Ads ID}}';

// Shared on every GA4 hit: the page classification, and first touch as user
// properties.
variables.push({
  ...base(),
  variableId: id(),
  name: 'ES - GA4 shared params',
  type: 'gtes',
  parameter: [
    list('eventSettingsTable', paramRows([
      ['page_type', V.page_type],
      ['page_language', V.page_language],
      ['page_sensitivity', V.page_sensitivity],
      ['content_group', V.content_group],
      ['journey_stage', V.journey_stage],
      ['care_category', V.care_category],
      ['traffic_type', V.traffic_type]
    ])),
    list('userProperties', [
      map([t('name', 'first_source'), t('value', V.ft_source)]),
      map([t('name', 'first_medium'), t('value', V.ft_medium)]),
      map([t('name', 'first_campaign'), t('value', V.ft_campaign)])
    ])
  ]
});
const SHARED = '{{ES - GA4 shared params}}';

// ---- triggers ---------------------------------------------------------------
const triggers = [];
const trig = (name, body) => {
  const triggerId = id();
  triggers.push({ ...base(), triggerId, name, ...body });
  return triggerId;
};
const ce = (event) => trig(`CE - ${event}`, { type: 'CUSTOM_EVENT', customEventFilter: [cond('EQUALS', '{{_event}}', event)] });
const linkClick = (name, regex) =>
  trig(name, {
    type: 'LINK_CLICK',
    filter: [cond('MATCH_REGEX', '{{Click URL}}', regex)],
    // Off on purpose: these links leave the page or open another app, and
    // holding the tap for tags delays the exact interaction that converts.
    waitForTags: b('waitForTags', false),
    checkValidation: b('checkValidation', false),
    waitForTagsTimeout: t('waitForTagsTimeout', 2000),
    uniqueTriggerId: t('uniqueTriggerId', '')
  });
const anyEvent = (name, filter) =>
  trig(name, { type: 'CUSTOM_EVENT', customEventFilter: [cond('MATCH_REGEX', '{{_event}}', '.*')], filter: [filter] });

const T = {
  virtual_page_view: ce('virtual_page_view'),
  generate_lead: ce('generate_lead'),
  purchase_submitted: ce('purchase_submitted'),
  cta_click: ce('cta_click'),
  search_results_view: ce('search_results_view'),
  no_results: ce('no_results'),
  form_error: ce('form_error'),
  whatsapp: linkClick('Click - WhatsApp', 'wa\\.me|api\\.whatsapp\\.com|whatsapp://'),
  // HAYAI's own +20 number only: the ambulance 123 never matches.
  phone: linkClick('Click - Phone', '^tel:\\s*\\+?\\s*20'),
  appStore: linkClick('Click - App store', 'play\\.google\\.com|apps\\.apple\\.com'),
  clarityAllowed: trig('Window Loaded - Clarity allowed', {
    type: 'WINDOW_LOADED',
    filter: [cond('EQUALS', V.clarity_allowed, 'true')]
  }),
  blockSensitive: anyEvent('Block - Sensitive', cond('EQUALS', V.page_sensitivity, 'sensitive')),
  blockStaging: anyEvent('Block - Staging', cond('MATCH_REGEX', '{{Page Hostname}}', '^(www\\.)?hayaihealthcare\\.com$', true)),
  blockInternal: anyEvent('Block - Internal', cond('EQUALS', V.traffic_type, 'internal'))
};
const AD_EXCEPTIONS = [T.blockSensitive, T.blockStaging, T.blockInternal];

// ---- tags -------------------------------------------------------------------
const tags = [];
const tag = (name, type, parameter, firing, opts = {}) =>
  tags.push({
    ...base(),
    tagId: id(),
    name,
    type,
    parameter,
    firingTriggerId: firing,
    ...(opts.blocking ? { blockingTriggerId: opts.blocking } : {}),
    tagFiringOption: 'ONCE_PER_EVENT',
    monitoringMetadata: { type: 'MAP' },
    consentSettings: opts.consent ?? consent('analytics_storage')
  });

tag(
  'Google tag - GA4',
  'googtag',
  [
    t('tagId', GA4_ID),
    // The site's own URL, without the search text or the order-tracking
    // token. GA4 would otherwise record the full address bar.
    list('configSettingsTable', paramRows([['page_location', V.page_location]])),
    t('eventSettingsVariable', SHARED)
  ],
  [BUILTIN_INITIALIZATION]
);

const ga4Event = (name, eventName, firing, rows) =>
  tag(name, 'gaawe', [
    t('eventName', eventName),
    t('measurementIdOverride', GA4_ID),
    t('eventSettingsVariable', SHARED),
    ...(rows.length ? [list('eventSettingsTable', paramRows(rows))] : []),
    b('sendEcommerceData', false),
    b('enhancedUserId', false)
  ], [firing]);

ga4Event('GA4 - page_view (SPA)', 'page_view', T.virtual_page_view, [
  ['page_location', V.page_location],
  ['page_title', V.page_title]
]);
ga4Event('GA4 - generate_lead', 'generate_lead', T.generate_lead, [
  ['transaction_id', V.transaction_id],
  ['form_id', V.form_id],
  ['lead_type', V.lead_type]
]);
ga4Event('GA4 - purchase_submitted', 'purchase_submitted', T.purchase_submitted, [
  ['transaction_id', V.transaction_id],
  ['value', V.value],
  ['currency', V.currency]
]);
ga4Event('GA4 - cta_click', 'cta_click', T.cta_click, [
  ['cta_kind', V.cta_kind],
  ['cta_tracking_key', V.cta_tracking_key],
  ['placement', V.placement]
]);
ga4Event('GA4 - search_results_view', 'search_results_view', T.search_results_view, [
  ['result_count', V.result_count],
  ['area', V.area]
]);
ga4Event('GA4 - no_results', 'no_results', T.no_results, [['area', V.area]]);
ga4Event('GA4 - form_error', 'form_error', T.form_error, [
  ['form_id', V.form_id],
  ['error_type', V.error_type]
]);
ga4Event('GA4 - whatsapp_click', 'whatsapp_click', T.whatsapp, [['link_url', '{{Click URL}}']]);
ga4Event('GA4 - phone_click', 'phone_click', T.phone, [['link_url', '{{Click URL}}']]);
ga4Event('GA4 - app_download_click', 'app_download_click', T.appStore, [['link_url', '{{Click URL}}']]);

tag(
  'Conversion Linker',
  'gclidw',
  [b('enableCrossDomain', false), b('enableUrlPassthrough', false), b('enableCookieOverrides', false)],
  [BUILTIN_ALL_PAGES],
  { consent: { consentStatus: 'NOT_SET' } }
);

const adsConversion = (name, label, firing, extra = []) =>
  tag(name, 'awct', [
    b('enableNewCustomerReporting', false),
    b('enableConversionLinker', true),
    b('enableProductReporting', false),
    b('enableEnhancedConversion', false),
    t('conversionCookiePrefix', '_gcl'),
    b('enableShippingData', false),
    t('conversionId', ADS_ID),
    t('conversionLabel', label),
    b('rdp', false),
    ...extra
  ], [firing], { blocking: AD_EXCEPTIONS, consent: consent('ad_storage', 'ad_user_data') });

// Value left empty on purpose: marketing sets it inside Google Ads.
adsConversion('GAds - Conv - Lead', IDS.labels.lead, T.generate_lead, [t('orderId', V.transaction_id)]);
adsConversion('GAds - Conv - WhatsApp', IDS.labels.whatsapp, T.whatsapp);
adsConversion('GAds - Conv - Phone', IDS.labels.phone, T.phone);

// ---- built-in variables -----------------------------------------------------
const builtInVariable = [
  ['PAGE_URL', 'Page URL'], ['PAGE_HOSTNAME', 'Page Hostname'], ['PAGE_PATH', 'Page Path'], ['REFERRER', 'Referrer'],
  ['EVENT', 'Event'], ['CLICK_ELEMENT', 'Click Element'], ['CLICK_CLASSES', 'Click Classes'], ['CLICK_ID', 'Click ID'],
  ['CLICK_TARGET', 'Click Target'], ['CLICK_URL', 'Click URL'], ['CLICK_TEXT', 'Click Text'],
  ['CONTAINER_VERSION', 'Container Version'], ['ENVIRONMENT_NAME', 'Environment Name']
].map(([type, name]) => ({ ...base(), type, name }));

// ---- export -----------------------------------------------------------------
const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
const out = {
  exportFormatVersion: 2,
  exportTime: now,
  containerVersion: {
    path: `accounts/${ACCOUNT}/containers/${CONTAINER}/versions/0`,
    accountId: ACCOUNT,
    containerId: CONTAINER,
    containerVersionId: '0',
    name: 'HAYAI website — initial build',
    description: 'GA4, Google Ads conversions (Lead / WhatsApp / Phone) and exceptions, built on the dataLayer the website pushes. Add CookieYes CMP and Microsoft Clarity from the Gallery after import.',
    container: {
      path: `accounts/${ACCOUNT}/containers/${CONTAINER}`,
      accountId: ACCOUNT,
      containerId: CONTAINER,
      name: 'hayaihealthcare.com',
      publicId: IDS.container,
      usageContext: ['WEB']
    },
    tag: tags,
    trigger: triggers,
    variable: variables,
    builtInVariable
  }
};

mkdirSync('tracking/gtm', { recursive: true });
writeFileSync('tracking/gtm/hayai-container-import.json', JSON.stringify(out, null, 2) + '\n');
console.log(`tracking/gtm/hayai-container-import.json — ${tags.length} tags, ${triggers.length} triggers, ${variables.length} variables`);
