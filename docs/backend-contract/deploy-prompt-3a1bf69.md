# Paste-into-Claude prompt — deploying website release `3a1bf69`

For whoever deploys with Claude Code (or any AI assistant) on the server
instead of running the commands by hand. Upload `hayai-web-3a1bf69.tar.gz` to
the server first, then paste everything between the lines, replacing the one
path.

---

Deploy a new build of the HAYAI public website on this server. Work step by
step and show me the output of each command before moving on.

Context you must not get wrong:

- The website is an **Angular SSR app**: a Node process, not static files. It
  runs under Supervisor as the program `hayai-web`, from
  `/var/www/hayai-web`, listening on `127.0.0.1:4000`, with nginx in front.
  Never copy it into `public_html` or any static web root.
- The uploaded package is at `/tmp/hayai-web-3a1bf69.tar.gz` ← correct this
  path if it is somewhere else.
- The package contains only `browser/` and `server/` plus a `DEPLOY.md`. It is
  self-contained: **do not run `npm install`**, and do not create a
  `node_modules` folder.
- **Do not touch the environment variables.** They live in
  `/etc/supervisor/conf.d/hayai-web.conf` and nothing in this release changes
  them. One of them, `WEBSITE_SERVER_KEY`, is a secret: do not print it, do not
  copy it into a file, and do not include it in anything you show me.
- Do not touch Laravel, the database, nginx config, or anything outside
  `/var/www/hayai-web` and `/tmp`.

Steps:

1. Confirm the current state before changing anything: `supervisorctl status
   hayai-web`, and `ls /var/www/hayai-web`.
2. Extract the package into `/tmp` and verify it produced `/tmp/hayai-web/`
   with a `browser/` and a `server/` inside.
3. Copy the currently running build aside as a rollback:
   `/var/www/hayai-web.prev`. Replace any previous `.prev` folder.
4. Delete `/var/www/hayai-web/browser` and `/var/www/hayai-web/server`, then
   copy the new `browser/` and `server/` into `/var/www/hayai-web/`. Deleting
   first is deliberate: file names are hashed per build, so extracting on top
   of the old ones accumulates dead files.
5. `chown -R www-data:www-data /var/www/hayai-web`.
6. `supervisorctl restart hayai-web`, then `status` — it must say RUNNING.
7. Run these checks and show me every result:

   ```bash
   S=https://hayaihealthcare.com
   curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:4000/en          # expect 200
   curl -s $S/ar | grep -o 'GTM-5VKC5CMT' | wc -l                              # expect 2
   curl -s $S/login | grep -o 'GTM-5VKC5CMT' | wc -l                           # expect 0
   curl -s -o /dev/null -w '%{http_code}\n' $S/en/this-page-does-not-exist     # expect 404
   curl -s -o /dev/null -w '%{http_code}\n' $S/login                           # expect 200
   curl -s -o /dev/null -w '%{http_code}\n' $S/dashboard/account-deletion-requests   # expect 200
   tail -n 20 /var/log/hayai-web.log                                           # no errors
   ```

8. If any check fails, roll back immediately — copy `browser/` and `server/`
   back from `/var/www/hayai-web.prev`, `chown` again, restart — and tell me
   which check failed with its output. Do not try to fix the application code:
   the build is fixed, a failure here is a deploy or configuration problem.

When the count on `/ar` comes back `0` but the site is up, the Supervisor
variables were lost rather than the build being wrong: run `supervisorctl
reread && supervisorctl update && supervisorctl restart hayai-web` and check
again.

Report at the end: the status line, the six check results, and whether you
rolled back.

---

## For a human doing it by hand

[`website-release-3a1bf69.md`](website-release-3a1bf69.md), section 2. It is
four commands.
