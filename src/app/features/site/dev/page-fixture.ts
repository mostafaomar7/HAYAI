/**
 * DEV-ONLY. A complete §18.2 page payload holding all 27 block types (the
 * contract's own examples, see contract-blocks.ts), used
 * to check the server-rendered HTML (one h1, direct answer right after it,
 * real tables, JSON-LD, price text) before the CMS has real content.
 *
 * Reachable only at `/{locale}/__fixture` in a development build: the import
 * sits behind `ngDevMode`, which production builds replace with `false`, so
 * this file is not even emitted there.
 */
import { PagePayload } from '../models/site.models';
import { SiteLocale } from '../site-paths';
import { CONTRACT_SECTIONS } from './contract-blocks';

const cta = (label: string, kind: string, extra: Record<string, unknown> = {}) => ({
  id: 1,
  key: label.toLowerCase().replace(/\W+/g, '-'),
  type: kind,
  label,
  sublabel: null,
  style: 'primary',
  icon: null,
  placement: 'hero',
  tracking_key: `cta.${label.toLowerCase().replace(/\W+/g, '-')}`,
  action: { kind, href: null, target: '_self', rel: null, form_key: null, product: null, ...extra }
});
const contactForm = {
  key: 'contact',
  type: 'contact',
  name: 'Contact us',
  submit_label: 'Send',
  success_message: 'Thank you.',
  requires_consent: true,
  consent_text: 'I agree that HAYAI may store these details.',
  privacy_url: null,
  honeypot_field: 'website',
  submit_endpoint: '/api/v1/public/en/forms/contact/submissions',
  fields: [
    { key: 'name', type: 'text', label: 'Full name', placeholder: null, help: null, required: true, validation: { max_length: 191 }, visibility: null, options: [], accept: null, max_kb: null, max_files: null },
    { key: 'email', type: 'email', label: 'Work email', placeholder: null, help: null, required: true, validation: {}, visibility: null, options: [], accept: null, max_kb: null, max_files: null },
    { key: 'has_icu', type: 'select', label: 'Do you run an ICU?', placeholder: null, help: null, required: true, validation: {}, visibility: null, options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }], accept: null, max_kb: null, max_files: null },
    { key: 'icu_beds', type: 'number', label: 'ICU beds', placeholder: null, help: null, required: true, validation: { min: 1, max: 500 }, visibility: { field: 'has_icu', operator: 'equals', value: 'yes' }, options: [], accept: null, max_kb: null, max_files: null },
    { key: 'license', type: 'file', label: 'License (PDF)', placeholder: null, help: null, required: false, validation: {}, visibility: null, options: [], accept: ['pdf'], max_kb: 2048, max_files: 1 },
    { key: 'message', type: 'textarea', label: 'Message', placeholder: null, help: null, required: false, validation: { max_length: 5000 }, visibility: null, options: [], accept: null, max_kb: null, max_files: null }
  ]
};

export function pageFixture(locale: SiteLocale): PagePayload {
  const base = `https://hayaihealthcare.com/${locale}`;
  return {
    entity: 'page', id: 999, type: 'landing', locale, lang: locale, dir: locale === 'ar' ? 'rtl' : 'ltr',
    slug: '__fixture', path: `/${locale}/__fixture`, url: `${base}/__fixture`,
    title: 'Partner with HAYAI', subtitle: null, excerpt: null,
    h1: { text: 'Partner with HAYAI', source: 'hero', section_id: 1 },
    body: null,
    geo: {
      direct_answer: {
        question: 'What does a HAYAI hospital partnership include?',
        answer: 'Hospitals that partner with HAYAI receive insured patients who were matched to their accepted policies before arrival, list real-time ICU and emergency bed availability, and get referrals routed by coverage, so admission desks spend less time on insurance checks and more beds are filled appropriately.',
        word_count: 50
      },
      key_facts: [{ label: 'Setup time', value: '48 hours', source_url: null }]
    },
    sections: CONTRACT_SECTIONS,
    ctas: { sticky_mobile: [cta('Call HAYAI', 'tel', { href: 'tel:+20212345678' })], bottom: [] },
    forms: {
      contact: contactForm,
      'request-demo': { ...contactForm, key: 'request-demo', type: 'request_demo', name: 'Request a demo' },
      'purchase-inquiry': { ...contactForm, key: 'purchase-inquiry', type: 'purchase_inquiry', name: 'Purchase inquiry' }
    },
    sources: [{ title: 'FRA report', url: 'https://fra.gov.eg', organization: 'FRA', published_on: '2026-01-01' }],
    breadcrumbs: [{ name: 'Home', url: base, path: `/${locale}` }, { name: 'Partner with HAYAI', url: `${base}/__fixture`, path: `/${locale}/__fixture` }],
    dates: { published_at: '2026-10-02', modified_at: '2026-10-02T18:00:00+00:00', display_published: 'Published 2 October 2026', display_modified: 'Updated October 2026' },
    seo: {
      title: 'Partner with HAYAI | HAYAI', description: 'Hospitals partner with HAYAI.', canonical: `${base}/__fixture`,
      robots: 'noindex, nofollow',
      alternates: [{ hreflang: 'en', href: 'https://hayaihealthcare.com/en/__fixture' }, { hreflang: 'ar', href: 'https://hayaihealthcare.com/ar/__fixture' }, { hreflang: 'x-default', href: 'https://hayaihealthcare.com/en/__fixture' }],
      open_graph: { type: 'website', title: 'Partner with HAYAI', url: `${base}/__fixture`, site_name: 'HAYAI', locale: 'en_US', alternate_locales: ['ar_EG'] },
      twitter: { card: 'summary_large_image', title: 'Partner with HAYAI' }
    },
    schema_script: JSON.stringify({ '@context': 'https://schema.org', '@graph': [{ '@type': 'WebPage', name: 'Partner with HAYAI </script> test' }, { '@type': 'FAQPage' }] }),
    is_preview: false
  };
}
