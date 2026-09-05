# Project agent instructions

## Git commits

- Use the commit template configured on this workstation; do not replace it with a Conventional Commits-only message.
- The configured template is `~/.git_commit_msg.txt` and has this structure:

```text
Topic:

Describe(What):

	* What:
	* Why:
	* How:

Related:
```

- Populate every applicable field with the actual change. Keep the headings and bullet structure intact.
- Create commits through the configured Git identity and template, preferably with `git commit` so Git loads `commit.template` automatically.
- If a non-interactive commit is required, write the completed template to a temporary file and use `git commit -F <file>`; do not fall back to a one-line `git commit -m` message.
- Use the repository/workstation Git identity already selected by conditional Git configuration. Do not override `user.name`, `user.email`, signing settings, SSH command, or commit template in repository-local configuration.
- Before committing, confirm the effective settings with:

```bash
git config --get user.name
git config --get user.email
git config --get commit.template
```

- The expected effective identity in this repository is `Oᴜʏᴀɴɢ <sawyer7on@gmail.com>`, and the expected template path is `~/.git_commit_msg.txt`.
- Never commit credentials, `.env` files, build output, browser screenshots, or other ignored local artifacts.

## Movies maintenance

- Keep the approved cinema design stable during regression work. Small native JavaScript for the hero carousel and collection disclosure is approved; do not claim zero business JavaScript globally.
- Run `npm run check:movies:data` and, after building and starting static preview, `npm run check:movies:browser`.
- Keep TMDB integration optional. No R2 upload, credential configuration, or deletion of current local posters without explicit approval. See `docs/movies-stabilization.md` for remaining validation and image-delivery options.

## Local preview

- Always bind Astro development and preview servers to `0.0.0.0`, not `127.0.0.1` or `localhost`, so the preview is reachable from other devices and interfaces on the local network.
- Use the project Node 22 baseline before starting a server:

```bash
export PATH="/usr/local/opt/node@22/bin:$PATH"
```

- Preferred static preview command:

```bash
npm exec astro preview -- --host 0.0.0.0 --port 49152
```

- Preferred development server command:

```bash
npm run dev -- --host 0.0.0.0
```

- Browser checks running on the same workstation may still use `http://127.0.0.1:<port>` as a loopback client URL; this does not change the server binding, which must remain `0.0.0.0`.
- When reporting a preview, state both the binding (`0.0.0.0:<port>`) and a usable client URL. Do not describe the server as bound to `127.0.0.1`.
