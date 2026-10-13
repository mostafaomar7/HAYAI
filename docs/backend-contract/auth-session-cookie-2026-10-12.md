# BUG-02 — the admin session token is readable by JavaScript

**Severity:** High, from the QA round of 2026-10-11.
**Needs:** an API change. The website side is done and shipped; it is a
mitigation, not the fix.

---

## 1. What was found, and it is correct

The dashboard keeps its bearer token in `localStorage` under `hayai_token`.
Everything running on that page — our code, a dependency, anything injected —
can read it with one line:

```js
localStorage.getItem('hayai_token')
```

A token read that way is a full admin session, reusable from anywhere until it
expires. The browser offers exactly one place a script cannot reach, and it is
a cookie marked `HttpOnly`. Nothing on the front end can substitute for that:
a token the page's own JavaScript must attach to a request is a token the
page's own JavaScript can read.

## 2. What we changed on the website side today

Not a fix — it narrows the way in. The admin pages (`/login`, `/dashboard`,
the client shell) now carry their own **enforced** Content-Security-Policy,
where before they carried the website's report-only one:

```
script-src 'self' 'nonce-…'      ← and nothing else. No GTM, no Clarity,
                                    no CookieYes, no CDN.
frame-ancestors 'none'; frame-src 'none'; object-src 'none'
X-Frame-Options: DENY
Cross-Origin-Opener-Policy: same-origin
```

So an injected `<script>`, an inline handler, or a tag loaded from somewhere
else will not execute on an admin page at all. Verified in Chrome: the
dashboard runs clean under it, zero violations.

That raises the bar. It does not change the fact that one successful script
execution is one stolen admin session.

## 3. What we need from the API

### 3.1 The shape

On a successful `POST /auth/login` from the dashboard, set a session cookie
instead of (or alongside) returning the token in the body:

```
Set-Cookie: hayai_session=<opaque>; HttpOnly; Secure; SameSite=Lax;
            Domain=.hayaihealthcare.com; Path=/; Max-Age=…
```

Each attribute earns its place:

| Attribute | Why |
|---|---|
| `HttpOnly` | the whole point — `document.cookie` cannot see it |
| `Secure` | never sent over plain HTTP |
| `SameSite=Lax` | the browser will not attach it to a cross-site POST, which is most of CSRF handled before you write a line |
| `Domain=.hayaihealthcare.com` | the site is on `hayaihealthcare.com`, the API on `api.hayaihealthcare.com`. Without this the cookie never reaches the API |
| `Path=/` | |

Then `/admin/*` accepts that cookie as authentication.

### 3.2 CORS, because the two are different origins

```
Access-Control-Allow-Origin: https://hayaihealthcare.com   ← the exact origin
Access-Control-Allow-Credentials: true
```

`Access-Control-Allow-Origin: *` is not allowed together with credentials —
the browser refuses the response. The origin has to be named.

### 3.3 CSRF

`SameSite=Lax` covers cross-site form posts. For defence in depth on
state-changing requests, the usual double-submit: a readable
`XSRF-TOKEN` cookie that the client echoes in an `X-XSRF-TOKEN` header. Laravel
and Angular both do this by default, so it is close to free — Angular's
`HttpClient` reads `XSRF-TOKEN` and sends `X-XSRF-TOKEN` with no code from us.

If you are on Sanctum, its SPA mode is this whole section already: add
`hayaihealthcare.com` to `stateful` domains, call `/sanctum/csrf-cookie`
before login, done.

### 3.4 The mobile apps keep bearer tokens

Both apps authenticate against the same API and have no cookie jar in the
browser sense. **Do not remove bearer authentication.** What is needed is for
`/admin/*` to accept *either*: the cookie (dashboard) or the
`Authorization: Bearer` header (apps, Postman, your own scripts). Sanctum
supports both side by side; so does a plain middleware that checks the cookie
first and falls back to the header.

### 3.5 Logout

`POST /auth/logout` should clear the cookie server-side (`Set-Cookie` with an
expiry in the past) **and** invalidate the session, so a copied cookie stops
working rather than merely disappearing from one browser.

## 4. How we switch without a broken afternoon

The dashboard is in daily use, so this goes in two steps, not one.

**Step 1 — you, additive.** The login response sets the cookie *and* keeps
returning the token in the body exactly as today. `/admin/*` accepts both.
Nothing on our side changes; nothing breaks. Tell us when it is live.

**Step 2 — us.** We stop storing the token, turn on `withCredentials`, and
rely on the cookie. We ask you to confirm the endpoints answer with the cookie
alone, then you can drop the token from the login response body whenever you
like.

Rolling back from step 2 is one deploy of ours, which is why it is worth
having the two steps.

## 5. What we need to know before step 2

1. Will you do this with Sanctum SPA mode, or a cookie your own middleware
   reads? It changes whether we call `/sanctum/csrf-cookie` first.
2. The cookie name, and the CSRF cookie/header names if they are not Laravel's
   defaults.
3. How long is a session, and is there a refresh, or does the admin sign in
   again?
4. Is the `Domain=.hayaihealthcare.com` cookie acceptable to you? It is
   readable by any subdomain, so if anything untrusted is ever hosted on one,
   say so now and we find another arrangement.
5. A staging host to try it against, if there is one. If not, we do step 1 on
   production and verify with a test admin before step 2.

## 6. Not in this item, but found alongside it

- **The API has no HSTS** (BUG-05 in the QA list, which only looked at the
  website). Measured on 2026-10-12:

  ```
  $ curl -sI https://api.hayaihealthcare.com/api/v1/public/en/site
  X-Frame-Options: SAMEORIGIN          ✓
  X-Content-Type-Options: nosniff      ✓
  Referrer-Policy: strict-origin-…     ✓
  Strict-Transport-Security            ← absent
  ```

  The website side was fixed on our deploy. Yours is the one that matters
  more: the admin token travels to this host on every request, and without
  HSTS a first request made over plain HTTP can be downgraded. One line:

  ```nginx
  add_header Strict-Transport-Security "max-age=31536000" always;
  ```

  `includeSubDomains` is deliberately left off until somebody has confirmed
  every subdomain of hayaihealthcare.com serves HTTPS — it is a year-long
  commitment that no deploy can undo.
- **The advertisement redirect link needs validating server-side**
  (BUG-06). `POST`/`PATCH /admin/advertisements` accepts `redirect_link` as
  free text today — `javascript:alert(1)`, `اهلا يا جماعة` and
  `https://hayaihealthcare.com@evil.test` all store fine.

  The dashboard now refuses those before sending, but that is a form guard,
  not a boundary: the same values go straight in with curl and the mobile
  apps open whatever is stored. The rule we apply, to match:

  | Rejected | Why |
  |---|---|
  | any scheme that is not `http`/`https` | `javascript:`, `data:`, `intent:`, `file:` have no business in an advert |
  | a URL carrying credentials, `https://hayaihealthcare.com@evil.test` | what a person reads is the username; the real host is the last one. Oldest trick there is |
  | a host with no dot | a typo, or an internal name |

  In Laravel terms: `['required', 'url', 'regex:/^https?:\/\//i']` plus a
  check that the parsed host contains a dot and the string holds no `@`
  before the host.

- **Advertisements: `owner_id` means a user id, and nothing says so**
  (BUG-21, and something worse found underneath it). Measured 2026-10-13 on
  live data:

  ```
  POST /admin/advertisements  owner_id=20  provider_type=doctor
      -> stored as provider_type "medical_devices"
  POST /admin/advertisements  owner_id=90  provider_type=doctor
      -> stored as provider_type "doctor"
  ```

  Doctor id 20 is user id 90. The dashboard was sending the provider row's own
  id, so **every advertisement created through it has been attached to
  whichever account happened to hold that number.** Fixed on our side — the
  picker sends `user_id` now — but the five adverts already in the database
  were created the old way and their owners should be checked.

  Two requests, both small:

  1. **`GET /admin/advertisements/{id}` should return the owner.** Today it
     returns `provider_type` and nothing else — no `owner_id`, no `user_id`,
     no name. So the edit form cannot show who owns an advert, and an admin
     who picks one to satisfy a required field silently reassigns it. We have
     made the field optional on edit and omit it when untouched (verified:
     an update carrying only `redirect_link` leaves the owner alone), but
     that is a workaround for a field that should simply be there.
  2. **Reject an `owner_id` that does not match `provider_type`** rather than
     storing the mismatch. A 422 would have caught this on the first try.

  While you are in there: `provider_type` is inconsistent — live rows hold
  `doctor`, `clinic`, `medical_insurance` and `pharmacies`, singular for
  three and plural for one. We normalise around it, but one spelling would be
  better.

- The website's own CSP is still `Report-Only`. That is deliberate for now —
  the tag container loads third-party tags and enforcing it blind would break
  measurement. It should be tightened once the violation reports are read.
