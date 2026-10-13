# Two things slowing the dashboard down, both on your side (2026-10-13)

From the QA round's performance item. Neither is a bug in anything you wrote —
they are two defaults that were never changed, and together they cost more than
anything we can still fix on the website.

Both were measured against production today. The commands are here so you can
repeat them.

Nothing here blocks a deploy. Each is one line of config.

---

## 1. Every admin request pays for a CORS preflight, every time

The dashboard is on `hayaihealthcare.com` and the API on
`api.hayaihealthcare.com`, so every request carries `Authorization` and is
therefore not a "simple" request: the browser sends an `OPTIONS` first and
waits for the answer before it sends anything at all. That part is normal and
unavoidable.

This is the part that is not:

```bash
API=https://api.hayaihealthcare.com/api/v1

curl -sI -X OPTIONS "$API/admin/advertisements" \
  -H "Origin: https://hayaihealthcare.com" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: authorization"

HTTP/1.1 204 No Content
Access-Control-Allow-Methods: GET
Access-Control-Allow-Headers: authorization
Access-Control-Max-Age: 0          ← the browser is told not to remember this
```

`0` means the permission may not be cached, so the preflight is repeated for
**every single request**, for as long as the admin is signed in. Opening the
dashboard home costs eight of them before a single byte of data moves:

```
/auth/me                                /admin/analytics/overview
/admin/website/me                       /admin/analytics/users-by-category
/admin/notifications/system/unread-count /admin/analytics/revenue-by-plan-type
/admin/analytics/user-growth            /admin/analytics/revenue-over-time
```

Measured in Chrome with the network recorded: every one of those URLs appears
twice, once as the `OPTIONS` and once as the real call.

On a desk in the office the round trip is 20ms and nobody notices. On a phone
on mobile data it is 150ms or more, and it is spent twice per request for the
whole session.

### What we are asking for

A lifetime on the preflight:

```php
// config/cors.php
'max_age' => 86400,
```

Chrome caps it at 2 hours whatever you send, so a day simply means "as long as
the browser will allow".

Nothing else changes and nothing can break. The only thing being cached is the
answer to "may this origin call this endpoint with this method and these
headers", which does not vary per request and does not depend on who is signed
in. It is not the response, and it is not the authentication.

### How to check it worked

```bash
curl -sI -X OPTIONS "$API/admin/advertisements" \
  -H "Origin: https://hayaihealthcare.com" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: authorization" | grep -i max-age
# Access-Control-Max-Age: 86400
```

---

## 2. Uploaded profile images are stored at full size

The admin avatar in the dashboard header is a circle 42 pixels across. The file
behind it is not:

```bash
curl -sI "https://api.hayaihealthcare.com/storage/profiles/mw9C5d55t0EmsQjDS96j3dqQbwAhJkKojqvDuFWp.png"

Content-Type: image/png
Last-Modified: Thu, 27 Aug 2026 18:45:58 GMT
ETag: "6a9085e6-beae1"
X-Content-Type-Options: nosniff
# 1983 x 793 px, 762 KB
```

762 KB, for a picture displayed at about one two-thousandth of its area. On a
first visit to the dashboard that one file is **three quarters of everything
the browser downloads** — measured with an empty cache: 1049 KB in total, 762
of it this image.

### What we have already done

The dashboard now shrinks a picked picture in the browser before it is sent.
Verified end to end: a 7.5 MB photo leaves as a 121 KB JPEG, 62 times smaller.
**Uploads made through the dashboard from today are already small.**

### What we are asking for

Resize on the way in as well, longest edge about 512px. Ours is a convenience,
not a boundary, and these three are why it is still worth doing on the server:

- it does not touch anything already stored, including the file above;
- the mobile apps upload to the same endpoint and are not covered by it;
- anything posted with curl still arrives at full size.

Something like Intervention Image in the upload handler is enough:

```php
$image = Image::read($request->file('profile_image'))
    ->scaleDown(width: 512, height: 512);
```

### A smaller point about caching, stated carefully

`/storage/*` sends no `Cache-Control` header. We checked what that actually
costs before asking for anything, and the answer is: today, very little.
Loading the dashboard three times in a row, the avatar came from the disk cache
every time after the first, with no revalidation and nothing transferred.

That works because there is a `Last-Modified` header, so the browser applies a
heuristic — roughly a tenth of the file's age. The file above is seven weeks
old, which buys it several days of freshness.

The catch is that the heuristic is proportional to **age**, so a picture
uploaded this morning gets almost none of it, and is revalidated on nearly
every page for its first few days — which is exactly when somebody has just
changed their photo and is looking at it. It is also browser-specific and not
something either of us stated on purpose.

So: worth setting, not urgent. These files are content-addressed — the name
changes when the picture changes — so they can be cached as hard as the browser
will allow:

```nginx
location /storage/ {
    add_header Cache-Control "public, max-age=31536000, immutable";
}
```

---

## Summary

| # | Item | Fix |
|---|---|---|
| 1 | `Access-Control-Max-Age: 0` — a preflight on every request, forever | one line in `config/cors.php` |
| 2 | avatars stored at full size, 762 KB for a 42px circle | resize on upload; our side already shrinks new ones |
| 3 | `/storage/*` has no `Cache-Control`, only a heuristic | one line in nginx, not urgent |

Both of these are also items 6 and 7 of the full QA list,
`qa-round-api-items-2026-10-13.md`, if you would rather work from one document.
