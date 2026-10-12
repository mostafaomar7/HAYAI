# Website release `b355e25` — deploy guide (2026-10-12)

A fix release on top of `c979a35`. **No variable changes, no API changes** —
only the files.

## Why

The cookie banner (CookieYes) does not appear on the live site, and CookieYes
reports "installation code isn't added to your site". Cause, measured on the
live site: the page told Tag Manager to block a category of tags, and that
category also covers the CookieYes and Clarity templates. This release narrows
the rule so both load.

## Deploy

Same steps as section 3 of `website-release-c979a35.md`, with the new package:

```bash
# Upload hayai-web-b355e25.tar.gz to the server, then:
cd /tmp && rm -rf hayai-web && tar -xzf hayai-web-b355e25.tar.gz

sudo rm -rf /var/www/hayai-web/browser /var/www/hayai-web/server
sudo cp -r /tmp/hayai-web/browser /tmp/hayai-web/server /var/www/hayai-web/
sudo chown -R www-data:www-data /var/www/hayai-web
sudo supervisorctl restart hayai-web
sudo supervisorctl status hayai-web                    # RUNNING
```

The Supervisor file stays exactly as it is.

## Check — paste the output back to us

```bash
S=https://hayaihealthcare.com
curl -s $S/ar | grep -o "gtm.blocklist':\[[^]]*\]"     # gtm.blocklist':['jsm']
curl -s $S/ar | grep -o 'GTM-5VKC5CMT' | wc -l         # 2
curl -s -o /dev/null -w '%{http_code}\n' $S/en          # 200
```

If the first line still shows `customScripts`, the old files are still being
served: check the copy step and restart again.

After that, opening `https://hayaihealthcare.com/ar` in a private window
should show the cookie banner (قبول الكل / رفض / تخصيص).
