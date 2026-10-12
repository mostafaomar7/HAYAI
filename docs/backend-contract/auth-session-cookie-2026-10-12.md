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

- **No HSTS.** `Strict-Transport-Security` is absent from both the site and
  the API. One nginx line on each; it stops a first request over plain HTTP
  from being downgradeable. Worth doing whatever happens with the token.
- The website's own CSP is still `Report-Only`. That is deliberate for now —
  the tag container loads third-party tags and enforcing it blind would break
  measurement. It should be tightened once the violation reports are read.
