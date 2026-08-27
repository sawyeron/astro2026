# astro2026

Astro migration source for [imouyang.com](https://imouyang.com). The legacy Hexo source remains at `/Users/otis/Documents/hexoblog/blog` as a read-only migration and rollback reference for at least 90 days after production cutover.

## Development baseline

- **Node.js:** exactly the Node 22 LTS release recorded in [`.nvmrc`](.nvmrc).
- **Package manager:** npm 10 (locked in `package.json`).
- **Output:** pure static files in `dist/`; no SSR, database, CMS, or runtime content API.

This workstation has Node 22 installed as Homebrew's keg-only `node@22`. Until a version manager is adopted, activate it for this project shell:

```bash
export PATH="/usr/local/opt/node@22/bin:$PATH"
node --version
npm ci
npm run verify
```

`npm run check`, `npm run build`, and `npm run dev` refuse to run outside Node 22. `npm run verify` runs formatting, linting, Astro type/content validation, and a static build. The initial homepage is deliberately a migration probe, not the future public design.

## Asset recovery

[`docs/audit/asset-recovery-register.json`](docs/audit/asset-recovery-register.json) tracks every legacy image reference that was already missing from both the Hexo source tree and generated site. Authorized recoveries from `sawyeron/Pics` are committed under `public/images/` at their historical public paths with pinned source commits and SHA-256 values. `npm run check:assets` validates the register and recovered files. Unresolved entries must be recovered, replaced with authorized media, or given an explicit accessible placeholder before production cutover.

## Deployment baseline

- [`.github/workflows/verify.yml`](.github/workflows/verify.yml) uses `.nvmrc` and runs `npm ci` followed by `npm run verify` on pull requests and `main`.
- [`vercel.json`](vercel.json) defines static build settings plus a minimal header and immutable build-asset cache policy. It contains no domain binding or redirects yet.
- Vercel Preview may be connected once a GitHub repository is available. Do **not** bind `imouyang.com` until Phase 6.
- Production-only analytics, public email, PGP key confirmation, Trakt credentials, redirects, and the final CSP remain intentionally out of this bootstrap.

## Content boundaries

The strict collection contract is in [`src/content.config.ts`](src/content.config.ts). Future migration output belongs in:

```text
src/content/blog/     published articles
src/content/drafts/   Git-tracked, never routed or indexed drafts
src/content/pages/    authored standalone pages
```

No legacy Markdown, assets, or drafts have been copied in Phase 1.

See [`docs/migration-implementation-design.md`](docs/migration-implementation-design.md) for the approved architecture and rollout plan, and [`docs/audit/phase-0-report.md`](docs/audit/phase-0-report.md) for the route and resource baseline.
