/**
 * DEV-ONLY. The real API output of all 27 block types, copied verbatim from the
 * examples in website-public-blocks.md (the block contract, §18.6), plus one
 * unknown type that must render nothing. Used by page-fixture.ts.
 */
import { PageSection } from '../models/site.models';

// prettier-ignore
export const CONTRACT_SECTIONS: PageSection[] = [
 {
  "id": 1,
  "type": "hero",
  "anchor": "top",
  "settings": {
   "hide_on": [],
   "theme": "brand",
   "spacing": "spacious"
  },
  "data": {
   "eyebrow": "For hospitals",
   "headline": "Fill your ICU beds with insured patients",
   "subheadline": "Publish live bed availability and receive pre-approved insurance referrals.",
   "is_h1": true,
   "image_media_id": 1,
   "primary_cta": {
    "id": 1,
    "key": "request-demo",
    "type": "request_demo",
    "label": "Request a demo",
    "sublabel": "30-minute call",
    "style": "primary",
    "icon": "calendar",
    "placement": "hero",
    "tracking_key": "cta.request-demo",
    "action": {
     "kind": "form",
     "href": null,
     "target": "_self",
     "rel": null,
     "form_key": "request-demo",
     "product": null
    }
   },
   "secondary_cta": {
    "id": null,
    "key": null,
    "type": "inline",
    "label": "Call sales",
    "sublabel": null,
    "style": "secondary",
    "icon": null,
    "placement": null,
    "tracking_key": "section.1.hero.secondary",
    "action": {
     "kind": "tel",
     "href": "tel:+20225550000",
     "target": "_self",
     "rel": null,
     "form_key": null,
     "product": null
    }
   },
   "alignment": "start",
   "image": {
    "id": 1,
    "kind": "image",
    "url": "https://api.hayaihealthcare.com/storage/website/media/2026/10/b7e575f9.jpg",
    "mime_type": "image/jpeg",
    "width": 1600,
    "height": 900,
    "alt": "ICU team reviewing live bed availability on HAYAI",
    "caption": "Cairo General Hospital ICU",
    "focal_point": {
     "x": 50,
     "y": 40
    },
    "variants": [
     {
      "width": 400,
      "height": 225,
      "url": "https://api.hayaihealthcare.com/storage/website/media/2026/10/b7e575f9-400.webp",
      "mime_type": "image/webp"
     }
    ],
    "srcset": "https://api.hayaihealthcare.com/storage/website/media/2026/10/b7e575f9-400.webp 400w"
   }
  }
 },
 {
  "id": 2,
  "type": "rich_text",
  "anchor": null,
  "settings": null,
  "data": {
   "heading": "Why hospitals choose HAYAI",
   "html": "<h3>Insurance-aware referrals</h3><p>Patients arrive with <strong>verified coverage</strong>. See the <a href=\"/en/pricing\" rel=\"noopener noreferrer\">pricing</a>.</p><ul><li>No paperwork</li><li>Faster admissions</li></ul>"
  }
 },
 {
  "id": 3,
  "type": "direct_answer",
  "anchor": null,
  "settings": null,
  "data": {
   "question": "Does my insurance cover a dermatologist visit in Egypt?",
   "answer": "Most private Egyptian health insurance policies cover outpatient dermatologist visits up to the annual outpatient limit of the policy. HAYAI checks your exact remaining limit for a specific policy in under two minutes, before you book, so you know what you will pay at the clinic and which documents the insurer needs.",
   "word_count": 52
  }
 },
 {
  "id": 4,
  "type": "feature_grid",
  "anchor": null,
  "settings": null,
  "data": {
   "heading": "What you get",
   "intro": "Everything a partner hospital needs.",
   "columns": 3,
   "items": [
    {
     "title": "Live ICU listing",
     "description": "Beds update in real time.",
     "icon": "bed",
     "media_id": 1,
     "link": {
      "id": null,
      "key": null,
      "type": "inline",
      "label": "Learn more",
      "sublabel": null,
      "style": "link",
      "icon": null,
      "placement": null,
      "tracking_key": "section.4.feature_grid.item0",
      "action": {
       "kind": "link",
       "href": "/en/icu",
       "target": "_self",
       "rel": null,
       "form_key": null,
       "product": null
      }
     },
     "image": {
      "id": 1,
      "kind": "image",
      "url": "https://api.hayaihealthcare.com/storage/website/media/2026/10/b7e575f9.jpg",
      "mime_type": "image/jpeg",
      "width": 1600,
      "height": 900,
      "alt": "ICU team reviewing live bed availability on HAYAI",
      "caption": "Cairo General Hospital ICU",
      "focal_point": {
       "x": 50,
       "y": 40
      },
      "variants": [
       {
        "width": 400,
        "height": 225,
        "url": "https://api.hayaihealthcare.com/storage/website/media/2026/10/b7e575f9-400.webp",
        "mime_type": "image/webp"
       }
      ],
      "srcset": "https://api.hayaihealthcare.com/storage/website/media/2026/10/b7e575f9-400.webp 400w"
     }
    },
    {
     "title": "Insurance checks",
     "description": "Coverage verified before arrival.",
     "icon": "shield",
     "media_id": null,
     "link": null,
     "image": null
    }
   ]
  }
 },
 {
  "id": 5,
  "type": "feature_list",
  "anchor": null,
  "settings": null,
  "data": {
   "heading": "Included",
   "intro": "In every plan.",
   "items": [
    {
     "title": "Bed dashboard",
     "description": "One screen for every unit.",
     "icon": "dashboard"
    }
   ]
  }
 },
 {
  "id": 6,
  "type": "pricing",
  "anchor": null,
  "settings": null,
  "data": {
   "heading": "ICU plans",
   "intro": "Monthly, cancel any time.",
   "product_id": 1,
   "tiers": [
    {
     "id": 1,
     "name": "Essential",
     "description": "One ICU unit",
     "price": "4500.00",
     "currency": "EGP",
     "billing_period": "monthly",
     "display": "EGP 4,500 per month",
     "min_quantity": null,
     "features": [
      "ICU listing",
      "Live bed status"
     ],
     "is_recommended": false
    },
    {
     "id": 2,
     "name": "Network",
     "description": "Up to 5 branches",
     "price": "12000.00",
     "currency": "EGP",
     "billing_period": "monthly",
     "display": "EGP 12,000 per month",
     "min_quantity": 1,
     "features": [
      "Everything in Essential",
      "Branch dashboard"
     ],
     "is_recommended": true
    }
   ],
   "product": {
    "id": 1,
    "type": "service",
    "sku": "ICU-LIVE",
    "name": "ICU live availability",
    "slug": "icu-live-availability",
    "path": "/en/products/icu-live-availability",
    "url": "https://hayaihealthcare.com/en/products/icu-live-availability",
    "short_description": "Publish your ICU beds in real time to insured patients and referring doctors.",
    "image": {
     "id": 1,
     "kind": "image",
     "url": "https://api.hayaihealthcare.com/storage/website/media/2026/10/b7e575f9.jpg",
     "mime_type": "image/jpeg",
     "width": 1600,
     "height": 900,
     "alt": "ICU team reviewing live bed availability on HAYAI",
     "caption": "Cairo General Hospital ICU",
     "focal_point": {
      "x": 50,
      "y": 40
     },
     "variants": [
      {
       "width": 400,
       "height": 225,
       "url": "https://api.hayaihealthcare.com/storage/website/media/2026/10/b7e575f9-400.webp",
       "mime_type": "image/webp"
      }
     ],
     "srcset": "https://api.hayaihealthcare.com/storage/website/media/2026/10/b7e575f9-400.webp 400w"
    },
    "category": {
     "id": 1,
     "kind": "product",
     "name": "Hospital solutions",
     "slug": "hospital-solutions",
     "description": "Tools for partner hospitals.",
     "parent_id": null
    },
    "pricing": {
     "type": "fixed",
     "price": "4500.00",
     "compare_at_price": "5000.00",
     "currency": "EGP",
     "billing_period": "monthly",
     "display": "EGP 4,500 per month"
    },
    "availability": {
     "status": "available",
     "label": "Available",
     "schema_org": "https://schema.org/InStock"
    },
    "is_featured": true,
    "is_purchasable": true,
    "quantity": {
     "min": 1,
     "max": 50
    }
   }
  }
 },
 {
  "id": 7,
  "type": "pricing",
  "anchor": null,
  "settings": null,
  "data": {
   "heading": "Simple pricing",
   "intro": "Inline tiers.",
   "product_id": null,
   "tiers": [
    {
     "name": "Starter",
     "price": "999.00",
     "currency": "EGP",
     "billing_period": "monthly",
     "description": "For clinics.",
     "features": [
      "1 branch",
      "Email support"
     ],
     "is_recommended": false,
     "cta": {
      "id": null,
      "key": null,
      "type": "inline",
      "label": "Start",
      "sublabel": null,
      "style": "primary",
      "icon": null,
      "placement": null,
      "tracking_key": "section.7.pricing.tier0",
      "action": {
       "kind": "link",
       "href": "/en/contact",
       "target": "_self",
       "rel": null,
       "form_key": null,
       "product": null
      }
     },
     "display": "EGP 999 per month"
    },
    {
     "name": "Enterprise",
     "price": null,
     "currency": "EGP",
     "billing_period": null,
     "description": "Hospital groups.",
     "features": [
      "Unlimited branches"
     ],
     "is_recommended": true,
     "cta": null,
     "display": "Contact us for pricing"
    }
   ],
   "product": null
  }
 },
 {
  "id": 8,
  "type": "product_grid",
  "anchor": null,
  "settings": null,
  "data": {
   "heading": "Our solutions",
   "intro": "Pick what fits.",
   "columns": 3,
   "product_ids": [
    1
   ],
   "category_id": null,
   "limit": 6,
   "show_price": true,
   "products": [
    {
     "id": 1,
     "type": "service",
     "sku": "ICU-LIVE",
     "name": "ICU live availability",
     "slug": "icu-live-availability",
     "path": "/en/products/icu-live-availability",
     "url": "https://hayaihealthcare.com/en/products/icu-live-availability",
     "short_description": "Publish your ICU beds in real time to insured patients and referring doctors.",
     "image": {
      "id": 1,
      "kind": "image",
      "url": "https://api.hayaihealthcare.com/storage/website/media/2026/10/b7e575f9.jpg",
      "mime_type": "image/jpeg",
      "width": 1600,
      "height": 900,
      "alt": "ICU team reviewing live bed availability on HAYAI",
      "caption": "Cairo General Hospital ICU",
      "focal_point": {
       "x": 50,
       "y": 40
      },
      "variants": [
       {
        "width": 400,
        "height": 225,
        "url": "https://api.hayaihealthcare.com/storage/website/media/2026/10/b7e575f9-400.webp",
        "mime_type": "image/webp"
       }
      ],
      "srcset": "https://api.hayaihealthcare.com/storage/website/media/2026/10/b7e575f9-400.webp 400w"
     },
     "category": {
      "id": 1,
      "kind": "product",
      "name": "Hospital solutions",
      "slug": "hospital-solutions",
      "description": "Tools for partner hospitals.",
      "parent_id": null
     },
     "pricing": {
      "type": "fixed",
      "price": "4500.00",
      "compare_at_price": "5000.00",
      "currency": "EGP",
      "billing_period": "monthly",
      "display": "EGP 4,500 per month"
     },
     "availability": {
      "status": "available",
      "label": "Available",
      "schema_org": "https://schema.org/InStock"
     },
     "is_featured": true,
     "is_purchasable": true,
     "quantity": {
      "min": 1,
      "max": 50
     }
    }
   ]
  }
 },
 {
  "id": 9,
  "type": "product_card",
  "anchor": null,
  "settings": null,
  "data": {
   "product_id": 1,
   "layout": "buy_box",
   "show_price": true,
   "product": {
    "id": 1,
    "type": "service",
    "sku": "ICU-LIVE",
    "name": "ICU live availability",
    "slug": "icu-live-availability",
    "path": "/en/products/icu-live-availability",
    "url": "https://hayaihealthcare.com/en/products/icu-live-availability",
    "short_description": "Publish your ICU beds in real time to insured patients and referring doctors.",
    "image": {
     "id": 1,
     "kind": "image",
     "url": "https://api.hayaihealthcare.com/storage/website/media/2026/10/b7e575f9.jpg",
     "mime_type": "image/jpeg",
     "width": 1600,
     "height": 900,
     "alt": "ICU team reviewing live bed availability on HAYAI",
     "caption": "Cairo General Hospital ICU",
     "focal_point": {
      "x": 50,
      "y": 40
     },
     "variants": [
      {
       "width": 400,
       "height": 225,
       "url": "https://api.hayaihealthcare.com/storage/website/media/2026/10/b7e575f9-400.webp",
       "mime_type": "image/webp"
      }
     ],
     "srcset": "https://api.hayaihealthcare.com/storage/website/media/2026/10/b7e575f9-400.webp 400w"
    },
    "category": {
     "id": 1,
     "kind": "product",
     "name": "Hospital solutions",
     "slug": "hospital-solutions",
     "description": "Tools for partner hospitals.",
     "parent_id": null
    },
    "pricing": {
     "type": "fixed",
     "price": "4500.00",
     "compare_at_price": "5000.00",
     "currency": "EGP",
     "billing_period": "monthly",
     "display": "EGP 4,500 per month"
    },
    "availability": {
     "status": "available",
     "label": "Available",
     "schema_org": "https://schema.org/InStock"
    },
    "is_featured": true,
    "is_purchasable": true,
    "quantity": {
     "min": 1,
     "max": 50
    }
   },
   "tiers": [
    {
     "id": 1,
     "name": "Essential",
     "description": "One ICU unit",
     "price": "4500.00",
     "currency": "EGP",
     "billing_period": "monthly",
     "display": "EGP 4,500 per month",
     "min_quantity": null,
     "features": [
      "ICU listing",
      "Live bed status"
     ],
     "is_recommended": false
    },
    {
     "id": 2,
     "name": "Network",
     "description": "Up to 5 branches",
     "price": "12000.00",
     "currency": "EGP",
     "billing_period": "monthly",
     "display": "EGP 12,000 per month",
     "min_quantity": 1,
     "features": [
      "Everything in Essential",
      "Branch dashboard"
     ],
     "is_recommended": true
    }
   ],
   "ctas": {
    "sidebar": [
     {
      "id": 2,
      "key": "buy-icu-live",
      "type": "purchase",
      "label": "Get ICU live",
      "sublabel": null,
      "style": "primary",
      "icon": "cart",
      "placement": "sidebar",
      "tracking_key": "cta.buy-icu-live",
      "action": {
       "kind": "purchase",
       "href": "/en/products/icu-live-availability",
       "target": "_self",
       "rel": null,
       "form_key": null,
       "product": {
        "id": 1,
        "slug": "icu-live-availability",
        "path": "/en/products/icu-live-availability"
       }
      }
     }
    ],
    "sticky_mobile": [
     {
      "id": 3,
      "key": "whatsapp-sales",
      "type": "whatsapp",
      "label": "WhatsApp sales",
      "sublabel": null,
      "style": "secondary",
      "icon": "whatsapp",
      "placement": "sticky_mobile",
      "tracking_key": "cta.whatsapp-sales",
      "action": {
       "kind": "whatsapp",
       "href": "https://wa.me/201000000000?text=Hello%20HAYAI",
       "target": "_blank",
       "rel": "noopener noreferrer",
       "form_key": null,
       "product": null
      }
     }
    ]
   },
   "purchase": {
    "enabled": true,
    "endpoint": "/api/v1/public/en/purchases",
    "product_id": 1,
    "min_quantity": 1,
    "max_quantity": 50,
    "pricing": {
     "type": "fixed",
     "price": "4500.00",
     "compare_at_price": "5000.00",
     "currency": "EGP",
     "billing_period": "monthly",
     "display": "EGP 4,500 per month"
    },
    "availability": {
     "status": "available",
     "label": "Available",
     "schema_org": "https://schema.org/InStock"
    },
    "fallback_form_key": "purchase-inquiry"
   }
  }
 },
 {
  "id": 10,
  "type": "comparison_table",
  "anchor": null,
  "settings": null,
  "data": {
   "heading": "HAYAI vs calling around",
   "caption": "Finding an ICU bed",
   "columns": [
    {
     "key": "hayai",
     "label": "HAYAI"
    },
    {
     "key": "phone",
     "label": "Phone calls"
    }
   ],
   "rows": [
    {
     "label": "Live bed status",
     "cells": [
      true,
      false
     ]
    },
    {
     "label": "Time to answer",
     "cells": [
      "Seconds",
      "Hours"
     ]
    },
    {
     "label": "Insurance check",
     "cells": [
      true,
      null
     ]
    }
   ],
   "highlight_column": "hayai"
  }
 },
 {
  "id": 11,
  "type": "table",
  "anchor": null,
  "settings": null,
  "data": {
   "heading": "Plan limits",
   "caption": "Limits per plan",
   "headers": [
    "Plan",
    "Branches",
    "Price"
   ],
   "rows": [
    [
     "Essential",
     "1",
     "EGP 4,500"
    ],
    [
     "Network",
     "5",
     "EGP 12,000"
    ]
   ]
  }
 },
 {
  "id": 12,
  "type": "faq",
  "anchor": null,
  "settings": null,
  "data": {
   "heading": "Questions",
   "source": "global",
   "faq_ids": [],
   "group_key": null,
   "limit": 10,
   "include_in_schema": true,
   "items": [
    {
     "id": 1,
     "question": "How long does onboarding take?",
     "answer": "<p>Most hospitals go live in <strong>48 hours</strong>.</p>",
     "group_key": "onboarding"
    }
   ]
  }
 },
 {
  "id": 13,
  "type": "cta",
  "anchor": null,
  "settings": null,
  "data": {
   "heading": "Talk to sales",
   "text": "We reply within one working day.",
   "cta": {
    "id": 3,
    "key": "whatsapp-sales",
    "type": "whatsapp",
    "label": "WhatsApp sales",
    "sublabel": null,
    "style": "secondary",
    "icon": "whatsapp",
    "placement": "sticky_mobile",
    "tracking_key": "cta.whatsapp-sales",
    "action": {
     "kind": "whatsapp",
     "href": "https://wa.me/201000000000?text=Hello%20HAYAI",
     "target": "_blank",
     "rel": "noopener noreferrer",
     "form_key": null,
     "product": null
    }
   },
   "secondary_cta": {
    "id": null,
    "key": null,
    "type": "inline",
    "label": "Email us",
    "sublabel": null,
    "style": "secondary",
    "icon": null,
    "placement": null,
    "tracking_key": "section.13.cta.secondary",
    "action": {
     "kind": "link",
     "href": "mailto:sales@hayaihealthcare.com",
     "target": "_self",
     "rel": null,
     "form_key": null,
     "product": null
    }
   },
   "variant": "banner"
  }
 },
 {
  "id": 14,
  "type": "contact_form",
  "anchor": null,
  "settings": null,
  "data": {
   "heading": "Contact us",
   "intro": "Tell us about your hospital.",
   "form_key": "contact",
   "form": {
    "key": "contact",
    "type": "contact",
    "name": "Contact us",
    "description": null,
    "submit_label": "Send",
    "success_message": "Thank you. Our team will get back to you shortly.",
    "requires_consent": true,
    "consent_text": "I agree that HAYAI may store these details and contact me about this request, as described in the privacy policy.",
    "privacy_url": null,
    "honeypot_field": "website",
    "submit_endpoint": "/api/v1/public/en/forms/contact/submissions",
    "fields": [
     {
      "key": "name",
      "type": "text",
      "label": "Full name",
      "placeholder": null,
      "help": null,
      "required": true,
      "validation": {
       "max_length": 191
      },
      "visibility": null,
      "options": [],
      "accept": null,
      "max_kb": null,
      "max_files": null
     },
     {
      "key": "email",
      "type": "email",
      "label": "Work email",
      "placeholder": null,
      "help": null,
      "required": true,
      "validation": {
       "max_length": 255
      },
      "visibility": null,
      "options": [],
      "accept": null,
      "max_kb": null,
      "max_files": null
     }
    ]
   }
  }
 },
 {
  "id": 15,
  "type": "purchase_cta",
  "anchor": null,
  "settings": null,
  "data": {
   "product_id": 1,
   "heading": "Start today",
   "text": "Live within 48 hours.",
   "cta": {
    "id": 2,
    "key": "buy-icu-live",
    "type": "purchase",
    "label": "Get ICU live",
    "sublabel": null,
    "style": "primary",
    "icon": "cart",
    "placement": "sidebar",
    "tracking_key": "cta.buy-icu-live",
    "action": {
     "kind": "purchase",
     "href": "/en/products/icu-live-availability",
     "target": "_self",
     "rel": null,
     "form_key": null,
     "product": {
      "id": 1,
      "slug": "icu-live-availability",
      "path": "/en/products/icu-live-availability"
     }
    }
   },
   "show_price": true,
   "layout": "buy_box",
   "product": {
    "id": 1,
    "type": "service",
    "sku": "ICU-LIVE",
    "name": "ICU live availability",
    "slug": "icu-live-availability",
    "path": "/en/products/icu-live-availability",
    "url": "https://hayaihealthcare.com/en/products/icu-live-availability",
    "short_description": "Publish your ICU beds in real time to insured patients and referring doctors.",
    "image": {
     "id": 1,
     "kind": "image",
     "url": "https://api.hayaihealthcare.com/storage/website/media/2026/10/b7e575f9.jpg",
     "mime_type": "image/jpeg",
     "width": 1600,
     "height": 900,
     "alt": "ICU team reviewing live bed availability on HAYAI",
     "caption": "Cairo General Hospital ICU",
     "focal_point": {
      "x": 50,
      "y": 40
     },
     "variants": [
      {
       "width": 400,
       "height": 225,
       "url": "https://api.hayaihealthcare.com/storage/website/media/2026/10/b7e575f9-400.webp",
       "mime_type": "image/webp"
      }
     ],
     "srcset": "https://api.hayaihealthcare.com/storage/website/media/2026/10/b7e575f9-400.webp 400w"
    },
    "category": {
     "id": 1,
     "kind": "product",
     "name": "Hospital solutions",
     "slug": "hospital-solutions",
     "description": "Tools for partner hospitals.",
     "parent_id": null
    },
    "pricing": {
     "type": "fixed",
     "price": "4500.00",
     "compare_at_price": "5000.00",
     "currency": "EGP",
     "billing_period": "monthly",
     "display": "EGP 4,500 per month"
    },
    "availability": {
     "status": "available",
     "label": "Available",
     "schema_org": "https://schema.org/InStock"
    },
    "is_featured": true,
    "is_purchasable": true,
    "quantity": {
     "min": 1,
     "max": 50
    }
   },
   "tiers": [
    {
     "id": 1,
     "name": "Essential",
     "description": "One ICU unit",
     "price": "4500.00",
     "currency": "EGP",
     "billing_period": "monthly",
     "display": "EGP 4,500 per month",
     "min_quantity": null,
     "features": [
      "ICU listing",
      "Live bed status"
     ],
     "is_recommended": false
    },
    {
     "id": 2,
     "name": "Network",
     "description": "Up to 5 branches",
     "price": "12000.00",
     "currency": "EGP",
     "billing_period": "monthly",
     "display": "EGP 12,000 per month",
     "min_quantity": 1,
     "features": [
      "Everything in Essential",
      "Branch dashboard"
     ],
     "is_recommended": true
    }
   ],
   "ctas": {
    "sidebar": [
     {
      "id": 2,
      "key": "buy-icu-live",
      "type": "purchase",
      "label": "Get ICU live",
      "sublabel": null,
      "style": "primary",
      "icon": "cart",
      "placement": "sidebar",
      "tracking_key": "cta.buy-icu-live",
      "action": {
       "kind": "purchase",
       "href": "/en/products/icu-live-availability",
       "target": "_self",
       "rel": null,
       "form_key": null,
       "product": {
        "id": 1,
        "slug": "icu-live-availability",
        "path": "/en/products/icu-live-availability"
       }
      }
     }
    ],
    "sticky_mobile": [
     {
      "id": 3,
      "key": "whatsapp-sales",
      "type": "whatsapp",
      "label": "WhatsApp sales",
      "sublabel": null,
      "style": "secondary",
      "icon": "whatsapp",
      "placement": "sticky_mobile",
      "tracking_key": "cta.whatsapp-sales",
      "action": {
       "kind": "whatsapp",
       "href": "https://wa.me/201000000000?text=Hello%20HAYAI",
       "target": "_blank",
       "rel": "noopener noreferrer",
       "form_key": null,
       "product": null
      }
     }
    ]
   },
   "purchase": {
    "enabled": true,
    "endpoint": "/api/v1/public/en/purchases",
    "product_id": 1,
    "min_quantity": 1,
    "max_quantity": 50,
    "pricing": {
     "type": "fixed",
     "price": "4500.00",
     "compare_at_price": "5000.00",
     "currency": "EGP",
     "billing_period": "monthly",
     "display": "EGP 4,500 per month"
    },
    "availability": {
     "status": "available",
     "label": "Available",
     "schema_org": "https://schema.org/InStock"
    },
    "fallback_form_key": "purchase-inquiry"
   }
  }
 },
 {
  "id": 16,
  "type": "hospital_partner_cta",
  "anchor": null,
  "settings": null,
  "data": {
   "heading": "Become a partner hospital",
   "text": "Join the HAYAI network.",
   "benefits": [
    "More insured patients",
    "Faster approvals"
   ],
   "form_key": "hospital-partnership",
   "cta": {
    "id": null,
    "key": null,
    "type": "inline",
    "label": "See partner terms",
    "sublabel": null,
    "style": "secondary",
    "icon": null,
    "placement": null,
    "tracking_key": "section.16.hospital_partner_cta.primary",
    "action": {
     "kind": "link",
     "href": "/en/partners/terms",
     "target": "_self",
     "rel": null,
     "form_key": null,
     "product": null
    }
   },
   "media_id": 1,
   "form": {
    "key": "hospital-partnership",
    "type": "hospital_partnership",
    "name": "Partner with HAYAI",
    "description": null,
    "submit_label": "Send",
    "success_message": "Thank you. Our partnerships team will contact you within two working days.",
    "requires_consent": true,
    "consent_text": "I agree that HAYAI may store these details and contact me about this request, as described in the privacy policy.",
    "privacy_url": null,
    "honeypot_field": "website",
    "submit_endpoint": "/api/v1/public/en/forms/hospital-partnership/submissions",
    "fields": [
     {
      "key": "name",
      "type": "text",
      "label": "Full name",
      "placeholder": null,
      "help": null,
      "required": true,
      "validation": {
       "max_length": 191
      },
      "visibility": null,
      "options": [],
      "accept": null,
      "max_kb": null,
      "max_files": null
     },
     {
      "key": "job_title",
      "type": "text",
      "label": "Job title",
      "placeholder": null,
      "help": null,
      "required": false,
      "validation": {
       "max_length": 191
      },
      "visibility": null,
      "options": [],
      "accept": null,
      "max_kb": null,
      "max_files": null
     }
    ]
   },
   "image": {
    "id": 1,
    "kind": "image",
    "url": "https://api.hayaihealthcare.com/storage/website/media/2026/10/b7e575f9.jpg",
    "mime_type": "image/jpeg",
    "width": 1600,
    "height": 900,
    "alt": "ICU team reviewing live bed availability on HAYAI",
    "caption": "Cairo General Hospital ICU",
    "focal_point": {
     "x": 50,
     "y": 40
    },
    "variants": [
     {
      "width": 400,
      "height": 225,
      "url": "https://api.hayaihealthcare.com/storage/website/media/2026/10/b7e575f9-400.webp",
      "mime_type": "image/webp"
     }
    ],
    "srcset": "https://api.hayaihealthcare.com/storage/website/media/2026/10/b7e575f9-400.webp 400w"
   }
  }
 },
 {
  "id": 17,
  "type": "testimonial",
  "anchor": null,
  "settings": null,
  "data": {
   "heading": "What partners say",
   "items": [
    {
     "quote": "Our ICU occupancy went up within a month.",
     "author_name": "Dr. Samir Fathy",
     "author_title": "Medical director",
     "organization": "Nile Hospital",
     "media_id": 3,
     "image": {
      "id": 3,
      "kind": "image",
      "url": "https://api.hayaihealthcare.com/storage/website/media/2026/10/7a3969a6.jpg",
      "mime_type": "image/jpeg",
      "width": 400,
      "height": 400,
      "alt": "Dr. Hala Mostafa",
      "caption": null,
      "focal_point": {
       "x": 50,
       "y": 40
      },
      "variants": [
       {
        "width": 400,
        "height": 400,
        "url": "https://api.hayaihealthcare.com/storage/website/media/2026/10/7a3969a6-400.webp",
        "mime_type": "image/webp"
       }
      ],
      "srcset": "https://api.hayaihealthcare.com/storage/website/media/2026/10/7a3969a6-400.webp 400w"
     }
    }
   ]
  }
 },
 {
  "id": 18,
  "type": "statistic",
  "anchor": null,
  "settings": null,
  "data": {
   "heading": "In numbers",
   "items": [
    {
     "value": "120+",
     "label": "Partner hospitals",
     "description": "Across 14 governorates.",
     "source_url": "https://example.org/report"
    }
   ]
  }
 },
 {
  "id": 19,
  "type": "image",
  "anchor": null,
  "settings": null,
  "data": {
   "media_id": 1,
   "caption": "Our Cairo operations room",
   "link_url": "/en/about",
   "size": "wide",
   "image": {
    "id": 1,
    "kind": "image",
    "url": "https://api.hayaihealthcare.com/storage/website/media/2026/10/b7e575f9.jpg",
    "mime_type": "image/jpeg",
    "width": 1600,
    "height": 900,
    "alt": "ICU team reviewing live bed availability on HAYAI",
    "caption": "Cairo General Hospital ICU",
    "focal_point": {
     "x": 50,
     "y": 40
    },
    "variants": [
     {
      "width": 400,
      "height": 225,
      "url": "https://api.hayaihealthcare.com/storage/website/media/2026/10/b7e575f9-400.webp",
      "mime_type": "image/webp"
     }
    ],
    "srcset": "https://api.hayaihealthcare.com/storage/website/media/2026/10/b7e575f9-400.webp 400w"
   }
  }
 },
 {
  "id": 20,
  "type": "video",
  "anchor": null,
  "settings": null,
  "data": {
   "title": "HAYAI in two minutes",
   "provider": "youtube",
   "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
   "media_id": null,
   "poster_media_id": 1,
   "description": "A short product tour.",
   "transcript": "Welcome to HAYAI...",
   "duration_seconds": 120,
   "poster": {
    "id": 1,
    "kind": "image",
    "url": "https://api.hayaihealthcare.com/storage/website/media/2026/10/b7e575f9.jpg",
    "mime_type": "image/jpeg",
    "width": 1600,
    "height": 900,
    "alt": "ICU team reviewing live bed availability on HAYAI",
    "caption": "Cairo General Hospital ICU",
    "focal_point": {
     "x": 50,
     "y": 40
    },
    "variants": [
     {
      "width": 400,
      "height": 225,
      "url": "https://api.hayaihealthcare.com/storage/website/media/2026/10/b7e575f9-400.webp",
      "mime_type": "image/webp"
     }
    ],
    "srcset": "https://api.hayaihealthcare.com/storage/website/media/2026/10/b7e575f9-400.webp 400w"
   },
   "video": null,
   "embed_url": "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"
  }
 },
 {
  "id": 21,
  "type": "logo_grid",
  "anchor": null,
  "settings": null,
  "data": {
   "heading": "Insurers we work with",
   "items": [
    {
     "media_id": 2,
     "name": "Allianz Egypt",
     "url": "https://www.allianz.com.eg",
     "image": {
      "id": 2,
      "kind": "image",
      "url": "https://api.hayaihealthcare.com/storage/website/media/2026/10/affa4433.png",
      "mime_type": "image/png",
      "width": 400,
      "height": 200,
      "alt": "Allianz Egypt logo",
      "caption": null,
      "focal_point": {
       "x": 50,
       "y": 40
      },
      "variants": [
       {
        "width": 400,
        "height": 200,
        "url": "https://api.hayaihealthcare.com/storage/website/media/2026/10/affa4433-400.webp",
        "mime_type": "image/webp"
       }
      ],
      "srcset": "https://api.hayaihealthcare.com/storage/website/media/2026/10/affa4433-400.webp 400w"
     }
    }
   ]
  }
 },
 {
  "id": 22,
  "type": "steps",
  "anchor": null,
  "settings": null,
  "data": {
   "heading": "How it works",
   "intro": "Three steps.",
   "items": [
    {
     "title": "Sign the agreement",
     "description": "Online, in minutes."
    },
    {
     "title": "Go live",
     "description": "We set up your units."
    }
   ]
  }
 },
 {
  "id": 23,
  "type": "benefits",
  "anchor": null,
  "settings": null,
  "data": {
   "heading": "Benefits",
   "intro": "For your team.",
   "items": [
    {
     "title": "Less admin",
     "description": "Insurance is pre-checked.",
     "icon": "clock"
    }
   ]
  }
 },
 {
  "id": 24,
  "type": "article_list",
  "anchor": null,
  "settings": null,
  "data": {
   "heading": "From the blog",
   "source": "latest",
   "category_id": null,
   "author_id": null,
   "page_ids": [],
   "limit": 3,
   "articles": [
    {
     "id": 2,
     "type": "article",
     "title": "Does my insurance cover a dermatologist visit in Egypt?",
     "excerpt": "How outpatient limits work for skin-care visits.",
     "path": "/en/blog/insurance-dermatologist",
     "url": "https://hayaihealthcare.com/en/blog/insurance-dermatologist",
     "image": {
      "id": 1,
      "kind": "image",
      "url": "https://api.hayaihealthcare.com/storage/website/media/2026/10/b7e575f9.jpg",
      "mime_type": "image/jpeg",
      "width": 1600,
      "height": 900,
      "alt": "ICU team reviewing live bed availability on HAYAI",
      "caption": "Cairo General Hospital ICU",
      "focal_point": {
       "x": 50,
       "y": 40
      },
      "variants": [
       {
        "width": 400,
        "height": 225,
        "url": "https://api.hayaihealthcare.com/storage/website/media/2026/10/b7e575f9-400.webp",
        "mime_type": "image/webp"
       }
      ],
      "srcset": "https://api.hayaihealthcare.com/storage/website/media/2026/10/b7e575f9-400.webp 400w"
     },
     "author": {
      "id": 1,
      "slug": "dr-hala-mostafa",
      "name": "Dr. Hala Mostafa",
      "job_title": "Medical advisor",
      "credentials": "MBBS, MSc Health Economics",
      "bio": null,
      "photo": {
       "id": 3,
       "kind": "image",
       "url": "https://api.hayaihealthcare.com/storage/website/media/2026/10/7a3969a6.jpg",
       "mime_type": "image/jpeg",
       "width": 400,
       "height": 400,
       "alt": "Dr. Hala Mostafa",
       "caption": null,
       "focal_point": {
        "x": 50,
        "y": 40
       },
       "variants": [
        {
         "width": 400,
         "height": 400,
         "url": "https://api.hayaihealthcare.com/storage/website/media/2026/10/7a3969a6-400.webp",
         "mime_type": "image/webp"
        }
       ],
       "srcset": "https://api.hayaihealthcare.com/storage/website/media/2026/10/7a3969a6-400.webp 400w"
      },
      "same_as": [
       "https://www.linkedin.com/in/hala-example"
      ],
      "url": "https://hayaihealthcare.com/en/authors/dr-hala-mostafa",
      "path": "/en/authors/dr-hala-mostafa"
     },
     "category": {
      "id": 2,
      "kind": "article",
      "name": "Insurance guides",
      "slug": "insurance-guides",
      "description": null,
      "parent_id": null
     },
     "tags": [
      "insurance",
      "dermatology"
     ],
     "reading_time_minutes": 1,
     "is_featured": false,
     "published_at": "2026-10-03T20:11:06+00:00",
     "modified_at": "2026-10-03T20:11:06+00:00"
    }
   ]
  }
 },
 {
  "id": 25,
  "type": "doctor_list",
  "anchor": null,
  "settings": null,
  "data": {
   "heading": "Our dermatologists",
   "specialty": "dermatology",
   "limit": 6,
   "available": true,
   "doctors": [
    {
     "entity": "doctor",
     "id": 1,
     "slug": "dr-amina-saleh",
     "name": "Dr. Amina Saleh",
     "image": null,
     "specialty": {
      "name": "Dermatology",
      "slug": "dermatology"
     },
     "subspecialty": null,
     "job_title": "Consultant dermatologist",
     "years_of_experience": 12,
     "location": null,
     "is_verified": false,
     "rating": null,
     "path": "/en/doctors/dermatology/dr-amina-saleh",
     "url": "https://hayaihealthcare.com/en/doctors/dermatology/dr-amina-saleh",
     "url_path": "doctors/dermatology/dr-amina-saleh"
    }
   ]
  }
 },
 {
  "id": 26,
  "type": "hospital_list",
  "anchor": null,
  "settings": null,
  "data": {
   "heading": "Partner hospitals",
   "icu_only": true,
   "limit": 6,
   "available": true,
   "hospitals": []
  }
 },
 {
  "id": 27,
  "type": "custom_link",
  "anchor": null,
  "settings": null,
  "data": {
   "label": "Read the partner guide",
   "url": "https://docs.example.org/partner-guide",
   "description": "PDF, 12 pages.",
   "target": "_blank",
   "rel": "noopener noreferrer"
  }
 },
 {
  "id": 28,
  "type": "breadcrumbs",
  "anchor": null,
  "settings": null,
  "data": {
   "items": [
    {
     "name": "Home",
     "url": "https://hayaihealthcare.com/en",
     "path": "/en"
    },
    {
     "name": "Partner with HAYAI",
     "url": "https://hayaihealthcare.com/en/partner-with-hayai",
     "path": "/en/partner-with-hayai"
    }
   ]
  }
 },
 {
  "id": 99,
  "type": "unknown_future_block",
  "anchor": null,
  "settings": null,
  "data": {}
 }
];
