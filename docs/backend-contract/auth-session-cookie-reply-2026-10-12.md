# BUG-02 — the dashboard side is built, and shipped switched off

Reply to *Dashboard prompt — BUG-02: move the admin session to an HttpOnly
cookie (2026-10-12)*. Commit `dc5db5e`.

Everything in that note is built. It ships in **bearer mode**, so nothing about
how the dashboard signs in has changed. Say the word when step 1 is live and we
flip it.

---

## 1. One thing to check before you deploy step 1

**`/public/*` answers with `Access-Control-Allow-Origin: *`.** Measured on
2026-10-12:

```
$ curl -si https://api.hayaihealthcare.com/api/v1/public/en/site \
    -H 'Origin: https://hayaihealthcare.com' | grep -i access-control
Access-Control-Allow-Origin: *
```

A browser refuses a credentialed cross-origin response that carries a wildcard
origin — Chrome calls it `PreflightWildcardOriginNotAllowed`. So "withCredentials
on every call to the API" would have taken the **public website** down the moment
the flag was flipped, because the site reads those same endpoints from the
browser.

We have excluded `/public/*` from credentials rather than follow the note
literally. Those endpoints are anonymous; there is no session to send. Verified
by loading the Arabic home page with cookie mode on — it renders normally.

**What we need from you:** `/public/*` can keep its wildcard, or move to a
specific origin, either is fine for us. What must not happen is the wildcard
staying on a route the dashboard calls. If step 1 narrows CORS only on
`/auth/*`, tell us, because `/admin/*` needs it too.

## 2. The flag

`AUTH_MODE` is an **environment variable on the web server**, not a build
constant. We print it into the admin shell as a meta tag and the app reads it at
startup.

```ini
; /etc/supervisor/conf.d/hayai-web.conf  — add to the environment= line
AUTH_MODE="cookie"
```

Then `supervisorctl reread && supervisorctl update && supervisorctl restart hayai-web`.

Rolling back is removing it and restarting — **seconds, no rebuild**. We did it
this way because a bad flip locks every admin out of the dashboard, and a
rebuild-and-redeploy is the wrong length of outage for that.

The build's own default is `bearer`, so a server with nothing set stays on
bearer.

## 3. What the dashboard does in cookie mode

Point by point against your note:

| Your point | Done |
|---|---|
| `withCredentials` on every API call, login and logout included | yes, except `/public/*` — see §1 |
| Never send `Authorization` | the header is **deleted**, not merely not added |
| `X-XSRF-TOKEN` on every non-GET/HEAD/OPTIONS, read at request time | yes |
| Angular's XSRF support does not cover absolute URLs | confirmed; ours is a plain interceptor |
| Stop storing the token; ignore `data.token` | yes, in login and refresh |
| Delete `hayai_token` from localStorage on first load | yes, on the first read of the mode |
| Signed-in check is `/auth/me`, not a stored token | yes — see below |
| SSR never sees `hayai_auth` | the auth check and guarded calls are browser-side, unchanged |
| 401 → `/login` | unchanged, and in cookie mode we clear nothing — the API expires it |
| 419 → re-read the cookie, retry **once**, stay signed in | yes, tracked through `HttpContext` so no extra header reaches you |
| API links opened with `<a href>` / `window.open` | nothing to do; they are same-site |
| Hospital staff sign-in stays bearer | there is no staff screen in this dashboard |
| Keep the enforced CSP on admin pages | kept, untouched |

**One thing worth naming**, because it is a choice we made and you should
disagree now if you want to: routing needs a synchronous "is there a session"
answer — `/login` has to redirect an already-signed-in admin without waiting on
a round trip. There is no stored token any more, so the guards read the
**`XSRF-TOKEN` cookie**, which you set, rotate and expire alongside `hayai_auth`.

It is a hint for routing only. The shell guard still calls `/auth/me` and acts on
the answer, and nothing a page can read grants access to anything. If you would
rather we not depend on `XSRF-TOKEN` being present for the whole session, say so
and we will find another way.

## 4. What we verified, and what we could not

Both modes run from the same build; we served them on two ports at once.

**Bearer (what ships):** login, seven dashboard screens, logout, and the
signed-out guard all behave exactly as before. Zero console errors. SEO and
tracking gates pass.

**Cookie:** no `Authorization` header on any request, `hayai_token` gone from
localStorage, and login fails at your end with
`PreflightWildcardOriginNotAllowed` — which is step 1 not being live, exactly as
expected.

**What we could not test**, and will only know once step 1 is up:

- whether the cookies are actually set and accepted, since that keys off
  `Origin: https://hayaihealthcare.com` and we were on localhost
- the 419 retry, which needs a real rotation to fire
- refresh at the 12-hour mark, and the 120-second overlap

So the flip should be done with one of us watching, on a test admin first.

## 5. What we need from you to flip

1. The release hash, and confirmation step 1 is on `api.hayaihealthcare.com`.
2. An answer on §1 — which routes get the narrowed CORS.
3. Your view on §3's use of `XSRF-TOKEN` as the routing hint.
4. A test admin we can lock out without consequence.

Then: you confirm live → we set `AUTH_MODE=cookie` and restart → we run your
seven browser checks → we report back. If anything is wrong we remove the
variable and restart, and we are on bearer again inside a minute.
