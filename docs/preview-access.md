# Reaching a preview deployment

Production is public. Every preview is not, and that is the whole problem this
document exists for. Measured, not assumed:

```
$ curl -sI https://pixel-fortune.vercel.app | head -1
HTTP/2 307              # -> /welcome. Anyone can read production.

$ curl -sI https://pixel-fortune-<hash>-dpoch.vercel.app | head -2
HTTP/2 302
location: https://vercel.com/sso-api?url=...   # Vercel Authentication
```

So an agent can read that a preview built, and can read production, but cannot
open the thing it just built. A regression that only appears in a production
build of an unmerged branch is invisible until it is merged.

## The fix: Protection Bypass for Automation

Vercel issues a per-project secret that lets an automated client through
Deployment Protection. It is **available on all plans**, Hobby included, since
June 2024 — no upgrade, no add-on, and Deployment Protection stays on.

The alternative Vercel offers, _Deployment Protection Exceptions_, makes a whole
preview domain publicly readable and is Enterprise / Pro-add-on only. It is the
wrong tool here twice over. Don't reach for it, and don't turn protection off.

### Step 1 — the owner creates a secret (dashboard, ~30 seconds)

Only a team Member or Project Administrator can do this, so it is his to do:

1. https://vercel.com/dashboard → the **pixel-fortune** project
2. **Settings** → **Deployment Protection**
   (direct: `https://vercel.com/dpoch/pixel-fortune/settings/deployment-protection`
   — the `dpoch` scope is read off the preview hostname above; correct it if the
   team slug differs)
3. Under **Protection Bypass for Automation**, press **Create**
4. Label it for the one system that will hold it, e.g. `local agents`. Vercel
   supports several secrets per project and each is revoked independently, so
   one secret per consumer means a leak costs one revocation, not all of them.
5. Copy the generated value.

Vercel mirrors one secret into deployments as the `VERCEL_AUTOMATION_BYPASS_SECRET`
system environment variable at **build** time. Deployments built before the
secret existed do not carry it; that only matters if app code ever reads it
(none does today), but it is why regenerating the secret requires a redeploy.

### Step 2 — the secret goes in `.env.local`, and nowhere else

```
VERCEL_AUTOMATION_BYPASS_SECRET="the value from step 1"
```

`.env*.local` is already gitignored (see `.gitignore`), which is why that file is
the place. `.env.example` documents the key with no value. **Nothing else in this
repo may hold it** — not a config file, not a URL in a doc, not a commit message.

If it should also run in CI later, it goes in GitHub repo secrets under the same
name; see "Not done here" below.

## What the secret does and does not do

Bypassed: Vercel Authentication, Password Protection, Trusted IPs, Vercel
Firewall system mitigations, and bot-protection challenges.

Not bypassed: active DDoS mitigations, attack-time rate limits, and attack-time
challenges. A live attack still wins over the token, by design.

Scope: **every deployment in the project, until revoked** — previews and
production alike. It is a project-wide key, not a per-deployment one. Treat it as
a credential to the whole project's protected surface.

### The security read, honestly

The danger is not the token existing; it is the token being reachable.

- **In a URL it is public to everything that logs URLs** — proxies, CDN access
  logs, browser history, `Referer` headers on any outbound link, and the terminal
  scrollback of whatever ran the command. Prefer the header wherever the client
  can set one. `scripts/preview.mjs` exists so the value never has to be pasted
  into a shell line by hand.
- **It only ever goes to this project's own hosts.** `scripts/preview.mjs`
  refuses any URL that is not https to `pixel-fortune.vercel.app` or to a
  preview of the shape `pixel-fortune-<hash>-dpoch.vercel.app`, checked against
  the full hostname. Anyone can deploy under `.vercel.app`, so a deployment URL
  pasted from a PR comment or a CI log is otherwise a way to exfiltrate the
  secret. The cost is deliberate: rename the project or move it to a custom
  domain and the helper refuses until the hosts in the script are updated —
  loudly, never by sending the secret anyway.
- **Anyone holding it can read every unlisted preview in the project.** That is
  the exact thing Deployment Protection was bought to prevent, so the token is
  worth about as much as the protection is.
- **It must never reach the browser bundle.** It has no `NEXT_PUBLIC_` prefix and
  no app code reads it; keep it that way. A bypass secret rendered into HTML is
  the same as having no protection at all, except quieter.
- **Revocation is instant and cheap.** Delete the secret in the same settings
  panel; it stops working on every deployment at once. Rotating means delete,
  create, redeploy, and update `.env.local`.

## How an agent actually uses it

### HTTP clients — use the header

```bash
curl -H "x-vercel-protection-bypass: $VERCEL_AUTOMATION_BYPASS_SECRET" \
  https://pixel-fortune-<hash>-dpoch.vercel.app/api/status
```

or, without handling the value yourself:

```bash
npm run preview -- fetch https://pixel-fortune-<hash>-dpoch.vercel.app/api/status
```

### Browsers — `chrome-devtools-axi` cannot set request headers

This is the constraint that decides the browser recipe. `chrome-devtools-axi`
navigates with `open <url>` and exposes no way to attach a header to that
navigation (`CHROME_DEVTOOLS_AXI_WS_HEADERS` authenticates the _bridge_, not the
page). So the query-parameter form is the only one available, paired with the
cookie header so that in-page navigation afterwards is not challenged again:

```
https://<deployment>/?x-vercel-protection-bypass=<secret>&x-vercel-set-bypass-cookie=true
```

Vercel answers that with a redirect carrying `Set-Cookie`, and every later
request from that browser profile passes on the cookie alone — which matters,
because clicking a link inside the page sends no custom headers and no query
string of ours. Use `samesitenone` instead of `true` only if the page is being
driven inside an iframe.

Rather than typing that URL (and putting the secret in scrollback), run:

```bash
npm run preview -- open https://pixel-fortune-<hash>-dpoch.vercel.app/tarot
```

which builds the primed URL and hands it straight to `chrome-devtools-axi open`.
The secret then appears only in that child process's argv — visible to `ps` on
this machine, not in your transcript. Once the cookie is set, drive the session
normally: `chrome-devtools-axi snapshot`, `click`, `screenshot`, and so on.

## What this does **not** fix: link previews

`src/app/_libs/origin.ts` keeps `SITE_URL` pointed at production even on a
preview because a crawler fetching a preview OG image gets the SSO page. The
bypass secret does not change that and must not be used to: Slack, Twitter and
Facebook will not send our header, and putting the secret in the OG URL as a
query parameter would publish it in the HTML of every preview. That comment
block stays true; only the agent-access half of the problem is solved here.

## Verifying, once the secret exists

```bash
npm run preview -- fetch https://pixel-fortune-<hash>-dpoch.vercel.app/welcome
```

- `200` and HTML — working. `/api/status` is the other good probe: `200` and
  JSON.
- `302` to `vercel.com/sso-api` — the secret is absent, stale or mistyped. Check
  it matches an active secret in the settings panel; if it was regenerated,
  redeploy and re-copy. The helper exits 1 on this so it cannot be read as
  success.

Don't probe the root: `/` redirects to `/welcome`, and the helper does not
follow redirects, so a working bypass on `/` prints `307` with
`location: /welcome` and no body — correct, but not the answer listed above.

## Not done here, and why

- **No CI smoke test against the preview.** It needs `VERCEL_AUTOMATION_BYPASS_SECRET`
  as a GitHub repo secret (Settings → Secrets and variables → Actions), which is
  the owner's to add, and a workflow that silently no-ops without it is worse
  than one that does not exist. The shape, when wanted, is a job keyed on
  `deployment_status` reading `github.event.deployment_status.target_url`.
- **Nothing was enabled on Vercel.** Step 1 requires his account. Everything in
  this repo is inert until that secret exists, and fails loudly rather than
  quietly when it does not.
