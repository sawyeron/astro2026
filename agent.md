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
