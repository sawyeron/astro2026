# Production cutover and rollback runbook

This runbook deliberately leaves public email, the current PGP key, and Cloudflare Web Analytics disabled until confirmed values are supplied.

## Preconditions

- `npm ci && npm run verify` passes under Node 22.
- GitHub Actions passes on `main`.
- A Vercel Preview deployment passes `npm run check:remote -- <preview-origin>`.
- The legacy Hexo source and generated deployment remain read-only and available for at least 90 days after cutover.
- Export the current Cloudflare DNS records and record the current production origin.
- Lower relevant DNS TTL at least one TTL window before cutover.

## Vercel project

- Framework preset: Astro.
- Install command: `npm ci`.
- Build command: `npm run build`.
- Output directory: `dist`.
- Node.js: 22.x.
- Do not configure `PUBLIC_CF_BEACON_TOKEN` until the production token is available.
- Do not add a public contact email or `public/Sawyer.asc` until verified.

## Preview acceptance

Run:

```bash
npm run check:remote -- https://example-preview.vercel.app
```

Manually verify the homepage, all seven topic pages, search, a legal-rule notice, a software-version notice, the 29-footnote company-law article, RSS/Atom, sitemap, robots, Keybase proof, and the raw Google verification file.

## Production cutover

1. Add `imouyang.com` to the Vercel project.
2. Configure the Cloudflare DNS target exactly as Vercel instructs.
3. Configure `www.imouyang.com` as a single permanent redirect to `https://imouyang.com`.
4. Use Cloudflare SSL/TLS **Full (strict)**.
5. Do not duplicate redirects at multiple layers unless tested for loops.
6. Purge Cloudflare cache after the first successful deployment.
7. Run the remote smoke test against `https://imouyang.com`.
8. Confirm representative legacy URLs return either direct HTTP 200 or one permanent redirect, as specified by the manifests.
9. Confirm drafts are not public and analytics is absent while its token is blank.

## Rollback

Rollback if critical article routes, feeds, search, TLS, or the canonical host fail and cannot be corrected quickly.

1. Restore the prior DNS records/origin from the saved export.
2. Purge Cloudflare cache.
3. Confirm the old homepage and representative legacy article URLs are healthy.
4. Keep the Astro deployment available on its Vercel URL for diagnosis.
5. Record the failure, affected routes, timestamps, and corrective action before attempting cutover again.

## Post-cutover observation

For at least 90 days:

- retain the old Hexo source and deployment repository;
- review Vercel and Cloudflare errors for 404/5xx patterns;
- verify feeds and sitemap after content updates;
- run `npm run check:remote -- https://imouyang.com` after deployment changes;
- do not delete legacy assets merely because the new article renderer no longer references them.
