# Client report source

`seo-geo-report.html` is the source of
[`../HAYAI-SEO-GEO-requirements-AR.pdf`](../HAYAI-SEO-GEO-requirements-AR.pdf) —
the Arabic reference the client is walked through: every requirement from their
Technical SEO & GEO Specification, what was built against it, and how to verify
it from the dashboard or a browser.

## Regenerating the PDF

The Cairo font files are not committed (they are Google's, and 350 KB). Fetch
them first:

```bash
python - <<'PY'
import urllib.request, re, os
UA = {'User-Agent': 'Mozilla/5.0 (Windows NT 5.1)'}   # an old UA gets TTF, not woff2
css = urllib.request.urlopen(urllib.request.Request(
    'https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900', headers=UA)).read().decode()
os.makedirs('fonts', exist_ok=True)
for w, u in zip(re.findall(r'font-weight:\s*(\d+);', css), re.findall(r'url\((https://[^)]+\.ttf)\)', css)):
    open(f'fonts/Cairo-{w}.ttf', 'wb').write(
        urllib.request.urlopen(urllib.request.Request(u, headers=UA)).read())
PY
```

Then print it with headless Chrome:

```bash
chrome --headless=new --disable-gpu --no-pdf-header-footer \
  --virtual-time-budget=25000 \
  --print-to-pdf=../HAYAI-SEO-GEO-requirements-AR.pdf \
  file:///<abs-path>/seo-geo-report.html
```

The fonts must be local files. Loading them from Google Fonts leaves Chrome to
fall back to Segoe UI in the PDF, with no error.
