# HAYAI — admin dashboard and public website

One Angular 20 application that serves two things from the same codebase:

- **The public website** (`/en/…`, `/ar/…`) — **server-rendered**. Crawlers that
  never run JavaScript must receive the complete page, so it is rendered by a
  Node server rather than built in the browser.
- **The admin dashboard** (`/dashboard`, `/login`) — a normal browser app,
  served by that same Node server.

Content comes from the CMS behind `https://api.hayaihealthcare.com/api/v1`.
New CMS pages never need a deploy.

---

## Setting up on a new machine

**You need:** [Node 22](https://nodejs.org) (20 is end of life) and git.
Nothing else — no database, no `.env`, no secrets. The API URL is committed in
[`src/environments/`](src/environments/), and every endpoint the app uses
locally is public or signed in with your own account.

```bash
git clone https://github.com/mostafaomar7/HAYAI.git
cd HAYAI
npm ci
```

Use `npm ci`, not `npm install`: it installs exactly the versions in
`package-lock.json`, so your machine behaves like everyone else's.

Then, to work on the dashboard or the UI:

```bash
npm start          # http://localhost:4200
```

That is the normal dev server, with hot reload. The public site works there
too, but it is **rendered in the browser**, so it cannot tell you what a
crawler would receive.

---

## Running it the way production does

Anything about SEO, structured data, `robots.txt`, real HTTP status codes or
what Googlebot sees has to be checked against the real server:

```bash
npm run build

API_BASE_URL=https://api.hayaihealthcare.com/api/v1 \
SITE_URL=https://hayaihealthcare.com \
NODE_ENV=production \
PORT=4000 \
node dist/BAREEQ/server/server.mjs
```

On Windows PowerShell:

```powershell
npm run build
$env:API_BASE_URL='https://api.hayaihealthcare.com/api/v1'
$env:SITE_URL='https://hayaihealthcare.com'
$env:NODE_ENV='production'
$env:PORT='4000'
node dist/BAREEQ/server/server.mjs
```

Then open `http://localhost:4000/en`. **View the page source** — the whole page
should be there in the HTML.

`WEBSITE_SERVER_KEY` is only needed in production (it stops the API
rate-limiting the whole website as one visitor). Leaving it out locally is fine.

### Checking the SEO / GEO rules

With that server running:

```bash
npm run seo:gate
```

It fetches fifteen page templates and fails on any breach of the client's
specification: structured data, one `<h1>`, the 40–60 word direct answer,
canonical and reciprocal `hreflang`, filters kept out of the index, images,
fabricated ratings, and the sitemap agreeing with `robots`. The same check runs
in CI on every push.

---

## Where things are

| | |
|---|---|
| Public site | [`src/app/features/site/`](src/app/features/site/) |
| Node server | [`src/server.ts`](src/server.ts) |
| Which routes render where | [`src/app/app.routes.server.ts`](src/app/app.routes.server.ts) |
| Dashboard | [`src/app/features/dashboard/`](src/app/features/dashboard/) |
| API services | [`src/app/core/services/`](src/app/core/services/) |
| Arabic / English strings | [`public/assets/i18n/`](public/assets/i18n/) |
| SEO gate | [`scripts/seo-gate.mjs`](scripts/seo-gate.mjs) |

Both `en.json` and `ar.json` must have the same keys. A missing Arabic string
shows the key itself on screen.

## Documentation

| | |
|---|---|
| [`docs/website-ssr-deployment.md`](docs/website-ssr-deployment.md) | How the Node server is deployed, and why static hosting cannot serve this site |
| [`docs/backend-contract/`](docs/backend-contract/) | What we rely on the API for, and the open questions with it |
| [`docs/HAYAI-SEO-GEO-requirements-AR.pdf`](docs/HAYAI-SEO-GEO-requirements-AR.pdf) | The client-facing report: every requirement and how to verify it |

---

## A note on line endings

The repository is checked out with CRLF on Windows. If you also work on macOS
or Linux, set this once per machine so you do not get diffs where the only
change is invisible:

```bash
git config --global core.autocrlf input   # macOS / Linux
git config --global core.autocrlf true    # Windows
```
