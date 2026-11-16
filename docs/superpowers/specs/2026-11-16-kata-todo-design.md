# kata-todo — design

A Herdr desktop mod (`herdr-app`): a quiet todo list for the repository you
are in, where any item can become a [kata](https://katatracker.com) issue in
one click. Shown in Herdr as **Todo**. Generic: nothing in it knows about a
particular project, sandbox or machine.

## Goals

- A beautiful, very clean todo list: one flat list, no chrome, actions only on
  hover, drawn entirely from the current theme.
- Jot drafts fast; turn any one into a kata issue that agents can pick up
  through kata's own workflow (`search`, `claim`, `close`).
- Work without kata: with no `kata` on the machine's PATH it is a plain todo
  list.

## Non-goals

- Starting or messaging an agent. Handing work over is kata's job.
- Tracking an issue after it is created (status, claims, closing). The row
  keeps the issue's id and nothing more; a kata viewer mod covers the rest.
- Configuring how kata is invoked. The mod runs `kata` from the PATH; any
  wrapping (a sandbox, a remote daemon) is the person's own setup.
- Syncing lists between machines or exposing them to agents.

## Data

**Which list.** The focused space's repository: the git top-level of the space's
first terminal's live folder (`panes()[…].cwd`, else `space.folder`), from
`git rev-parse --show-toplevel` run on the space's machine. A folder outside
git uses the folder itself. The list key is `"<machine or local>:<path>"`.

**Storage.** Herdr shared state, one key `kata-todo.lists`:

```json
{ "local:/Users/me/github/app": [ { "id": "k3f9", "title": "…", "note": "", "done": false, "created": 1794827037, "kata": null } ] }
```

Saved by Herdr in `shared.json`, kept across restarts, no files in any repo.
Written only from user actions, never from `render`.

**A todo.** `id`: short random id. `title`: one line, required. `note`:
optional text. `done`: boolean. `created`: seconds. `kata`: `null` until
sent, then `{ "ref": "<short id>" }`.

**Kata availability.** Once per machine per session, `sh -c 'command -v kata'`
on that machine. `→ kata` is shown only where it succeeds.

## What you see

Theme colours only (`theme()`): chrome background, `foreground`, `muted`,
`dim`, `accent`, `done`, `border`, `raised` for hover. Sizes are px at zoom 1.

- **Header.** `Todo` (15px, semibold) left; `<repo name> · N open` (11px,
  `dim`) right.
- **Add field.** Under the header, rounded 8, 1px `border`, background
  `background`, placeholder `Add a todo…`. Enter adds to the top of the open
  items; Escape clears the field.
- **Row.** 13px text, 8px vertical padding: a 14px ring checkbox, the title
  (one line, truncated). Hover (`raised`) reveals, at the right, `→ kata`
  (`accent`, only when kata is available and the todo is unsent) and `×`
  (`dim`). Delete has no confirmation.
- **Note.** Clicking a title opens the row in place: an editable title and a
  small note field below it. Edits save as typed. Escape, or opening another
  row, closes it. A closed row with a note shows a faint `¶`.
- **Sent.** A small `dim` chip with the issue's short id after the title. No
  further tracking; the person ticks the todo off.
- **Sending.** The action reads `sending…` until kata answers.
- **Error.** One line under the row in `ansi1` at reduced opacity: kata's first
  error line, or `looks like <refs>` for kata's duplicate refusal. The todo
  stays and `→ kata` returns.
- **Done.** Below the open items, `dim` with a strikethrough. `Clear done`
  (11px, `dim`) at the bottom when any exist.
- **Empty.** `Nothing to do.` centred in `dim`.

## Sending to kata

In the repository folder, on the space's machine:

```
kata create <title> [--body <note>] --idempotency-key <key> --json
```

- `--body` only when the note is not empty.
- `key = "todo-<id>-<hash>"`, `hash` = short stable hash of `title + "\0" + note`.
  kata returns the original issue for a repeated key but refuses the same key
  with changed fields, so a double click is harmless and an edit after a
  failed send gets a fresh key instead of a refusal.
- The issue id comes from `.issue.short_id` in the JSON reply.
- Exit 5 with matching refs (kata's "looks like an existing issue") shows
  `looks like <refs>`. The mod never passes `--force-new`.
- Any other non-zero exit shows the first stderr line. A machine that cannot
  be reached or a timeout shows that.
- A reply arriving after the person moved to another repo still updates the
  todo it was sent for (looked up by list key and id).

## Code

`mods/kata-todo/`:

| File | Role |
|---|---|
| `mod.json` | `{ "place": "none", "title": "Todo" }` |
| `list.js` | Pure functions on plain data: `listKey`, `addTodo`, `toggle`, `edit`, `remove`, `clearDone`, `ordered`, `openCount`. No Herdr imports. |
| `kata.js` | Pure functions: `createArgs(todo)`, `idempotencyKey(todo)`, `parseCreate({code, stdout, stderr})` → `{ref}` or `{error}`. No Herdr imports. |
| `main.js` | The `View`: resolves the repo, reads/writes shared state, runs `git` and `kata` through `exec`, draws the list. |

Functional core, imperative shell: everything that decides lives in `list.js`
and `kata.js`; `main.js` only gathers facts, calls them, and performs effects.

## Testing

- `node --test tests/*.test.mjs` for `list.js` and `kata.js`: ordering, key
  stability and change on edit, argument building (with and without a note,
  titles with quotes and leading dashes), JSON parsing, exit 5 and other
  failures. No Herdr, no kata.
- `herdr-app check mods/kata-todo`.
- One live pass in the app: add, edit with a note, send to kata, see the id,
  tick off, clear done, delete; and in a folder without kata, no `→ kata`.

## Repository

`herdr-mod-kata-todo`, shaped like the mods on herdr.dev: `mods/kata-todo/`,
`README.md`, `RECIPE.md`, `preview.png`, `tests/`, `docs/`. The README says
`→ kata` needs `kata` on the PATH of the space's machine. A person's layout
(a Todo tab, a tab-bar button) and any kata wrapper are their own setup and are
not in the repository.
