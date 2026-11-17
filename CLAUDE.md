# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A mod for the Herdr desktop app (`herdr-app`): a per-repository todo list shown as **Todo**, where any open item can be sent to [kata](https://katatracker.com) as an issue via `kata create`. Plain ES modules, no build step, no dependencies.

## Commands

```sh
just test                                   # node --test tests/*.test.mjs
node --test tests/kata.test.mjs             # one test file
node --test --test-name-pattern "idempotency" tests/*.test.mjs   # tests matching a name
just check                                  # herdr-app check mods/kata-todo (loads mod, renders empty state)
just install                                # test + check, then rsync into $HERDR_APP_HOME (default ~/.config/herdr-app)/mods/kata-todo
just preview                                # (host, macOS) render preview.png from docs/preview/preview.html via headless Chrome
just sbx                                    # (host) Claude Code in Docker sandbox `claude-herdr-mod-kata-todo`; args pass to claude
```

Inside that sandbox only `node` (v22) is available: no `just`, `herdr-app` or `kata`, so run tests with `node --test tests/*.test.mjs` directly and leave `just check`/`just install` to the host.

`herdr-app check` writes `gpui-kit.d.ts`, `herdr.d.ts`, `jsconfig.json` into the mod folder for editor typing — gitignored, never commit or ship them. It only draws the empty state: `init` returns before starting the repo timer when `checking()` is true, so no `git`/`kata` runs.

## Architecture

Only `mods/kata-todo/` ships; `tests/`, `docs/`, `justfile`, `package.json` are dev-only.

- `main.js` — the `View` (imports `gpui-kit`, `gpui-base`, `herdr`). Gathers facts from Herdr, calls the pure modules, performs effects (`exec`, `setShared`, `readTextFile`), draws. Keep decisions out of it.
- `list.js`, `repo.js`, `kata.js` — pure, no Herdr imports, unit-tested in `tests/*.test.mjs`. New logic belongs here so it can be tested with `node --test`. `tests/fixtures/` holds real `kata create --json` outputs for `parseCreate`.

Key flows that span files:

- **Which list.** Every 500 ms `follow()` computes the focused terminal's folder (`repo.listFolder`, fallback `repo.repoFolder`), runs `git rev-parse --show-toplevel` on the space's machine (`exec(..., { on: machine })`), and keys the list as `listKey(machine, path)` = `<machine or "local">:<path>`. A non-terminal focus keeps the current list.
- **Storage.** All lists live in Herdr shared state under one key `kata-todo.lists` (map of list key → todo array). `write(key, fn)` always re-reads `shared()`, applies one change via `applyToList`, and calls `setShared` only if the result changed — this keeps two mod copies from clobbering each other and avoids per-keystroke writes (every `setShared` re-renders every mod). Edits are debounced 500 ms and patch only changed fields. Pure functions must return the same reference when nothing changed.
- **→ kata gating.** Shown only when `kata` is on the machine's PATH (`sh -c 'command -v kata'` per machine, re-checked every 30 s like the config) AND a `.kata.toml` exists at or above the repo (`kataConfigPaths`, re-checked every 30 s).
- **Sending.** `kata.createArgs` builds `kata create --idempotency-key todo-<id>-<fnv1a(title\0note)> [--body note] --json -- <title>`. The hash in the key is deliberate: kata rejects a reused key with changed fields (`idempotency_mismatch`). `--` before the title is required. `parseCreate` reads success JSON from stdout but error JSON from **stderr**, taking the whole text or its last `{`-line; `duplicate_candidates` → `looks like <refs>`. Success marks the item done.

## Docs to keep in sync

`RECIPE.md` is the authoritative spec (exact sizes, colours, behaviours, "Watch out", "Done when") and doubles as the install recipe an agent follows. Behaviour or UI changes should update `RECIPE.md` and, where user-visible, `README.md` in the same change. Original design/plan: `docs/superpowers/specs/2026-11-16-kata-todo-design.md`.

Constraints from the recipe: colours only from `theme()`; the mod runs only `git`, `sh -c 'command -v kata'`, and `kata create`, and makes no network requests; the one asset path is `svg("mods/kata-todo/check.svg")`; inputs emit no Escape event, so Escape is handled by `on_key_down` on the root.
