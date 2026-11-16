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

**Which list.** The focused terminal's repository: the git top-level of its
live folder (`focused().cwd`), from `git rev-parse --show-toplevel` run on the
space's machine. The list follows the focused terminal, not the shown space, so
a new tab that cd's to `~` shows the home list. `listFolder(focused(), space,
panes())` decides the folder: while a non-terminal pane (a diff, a viewer) has
focus, or the terminal's folder is unknown, the current list stays. With
nothing focused at all (first load) the old rule applies: the space's first
terminal, i.e. the first terminal pane of its first tab (lowest `index`,
matched to `panes()` by tab id), as Herdr's own mods name spaces; with none, or
when its folder is unknown, `space.folder`, and an empty `space.folder` is the
machine's home. A folder outside git uses the folder itself. The list key is
`"<machine or local>:<path>"`; the header shows the path's basename.

The repo is resolved off the render path: when that machine or folder changes
(a 500 ms timer), an async `git rev-parse` runs and the previous list stays
drawn until it answers.

**Storage.** Herdr shared state, one key `kata-todo.lists`:

```json
{ "local:/Users/me/github/app": [ { "id": "k3f9", "title": "…", "note": "", "done": false, "created": 1794827037, "kata": null } ] }
```

Saved by Herdr in `shared.json`, kept across restarts, no files in any repo.
Never written from `render`. Each write re-reads `shared()` and applies only
its own change (one todo in one list), so two copies of the mod don't
overwrite each other. Typing in the title or note updates the copy's own state
and is written on blur, on closing the row, or after 500 ms without typing,
not per keystroke (every `setShared` re-renders every mod).

**A todo.** `id`: short random id. `title`: one line, required (stored as one
line; the editor wraps a long one). `note`:
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
  `background`, placeholder `Add a todo…`. Enter (the input's `submit` event)
  adds to the top of the open items; Escape closes an open row first,
  otherwise clears the field. Inputs emit no
  Escape event, so Escape here and in an open row is an `on_key_down` on a
  wrapping element matching `"escape"`.
- **Row.** 13px text, 8px vertical padding: a 14px ring checkbox, the title
  (one line, truncated when closed). Hover (`raised`) reveals, at the right, `→ kata`
  (`accent`, only when kata is available and the todo is unsent and not done)
  and `×` (`dim`). Delete has no confirmation. A ticked checkbox fills with
  `done`.
- **Note.** Clicking a title opens the row in place: an editable title and a
  small note field below it. The title is a `TextareaState` (`rows: 1`,
  `set_auto_grow(1, 6)`) drawn with `Textarea`, so a long title wraps; the open
  row aligns items to the top (`items_start`) so the ring stays at the first
  line. Enter still closes the row: a typed newline is caught on `change`, the
  value is cleaned to one line (`cleanTitle`) and the row closes. Edits save as
  typed. Escape, or opening another row, closes it. A closed row with a note shows a faint `¶`.
- **Sent.** A small `dim` chip with the issue's short id after the title, and
  the todo is marked done: `markSent(list, id, ref)` is
  `updateTodo(list, id, { kata: { ref }, done: true })`. Once it is a kata
  issue, kata tracks it; the todo is handed off. So it is ticked, sinks below
  the open items struck through, and counts in the done footer, where Hide and
  Clear apply to it like any done item. The person can still untick it. No
  further tracking.
- **Sending.** The action reads `sending…` until kata answers.
- **Error.** One line under the row in `ansi1` at reduced opacity: kata's first
  error line, or `looks like <refs>` for kata's duplicate refusal. The todo
  stays open and `→ kata` returns.
- **Done.** Below the open items, `dim` with a strikethrough. When any exist,
  a footer line (11px, `dim`) reads `N done · Hide · Clear`. **Hide** stops
  drawing done rows and the footer becomes `N done hidden · Show · Clear`;
  **Show** brings them back. Off by default (done rows shown). The choice is
  one boolean for the whole mod, kept in the copy's `localStorage` (a view
  preference, not data), so it holds across repos and restarts.
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
  `looks like <refs>`. The mod never passes `--force-new`. Exit 5 without refs
  (an idempotency-key conflict) falls through to the generic error. The exact
  shape of the refusal (where the refs are in the `--json` reply) is read from
  kata's own docs or a refusal in a throwaway kata project before the parser
  tests are written; no made-up fixtures.
- Any other non-zero exit shows kata's `error.message` from its JSON on
  stderr, else the first stderr line. A machine that cannot
  be reached or a timeout shows that.
- A reply arriving after the person moved to another repo still updates the
  todo it was sent for (looked up by list key and id).
- `sending…` is in-memory only. If the mod reloads mid-send the reply is lost
  and the row shows `→ kata` again; the idempotency key makes resending safe.

## Code

`mods/kata-todo/`:

| File | Role |
|---|---|
| `mod.json` | `{ "place": "none", "title": "Todo" }` |
| `list.js` | Pure functions on plain data: `listKey`, `newTodo`, `addTodo`, `updateTodo`, `removeTodo`, `markSent`, `clearDone`, `ordered`, `openCount`, `applyToList`. No Herdr imports. |
| `repo.js` | Pure: `listFolder(focus, space, panes)`, `repoFolder(space, panes)`, `parseToplevel`, `repoName`. No Herdr imports. |
| `kata.js` | Pure functions: `createArgs(todo)`, `idempotencyKey(todo)`, `parseCreate({code, stdout, stderr})` → `{ref}` or `{error}`. No Herdr imports. |
| `main.js` | The `View`: resolves the repo, reads/writes shared state, runs `git` and `kata` through `exec`, draws the list. |

Functional core, imperative shell: everything that decides lives in `list.js`
and `kata.js`; `main.js` only gathers facts, calls them, and performs effects.

## Testing

- A root `package.json` with `"type": "module"` (no dependencies) so Node
  loads the mod's ES modules in tests.
- `node --test tests/*.test.mjs` for `list.js` and `kata.js`: ordering, key
  stability and change on edit, argument building (with and without a note,
  titles with quotes and leading dashes), JSON parsing, exit 5 and other
  failures. No Herdr, no kata.
- `herdr-app check mods/kata-todo`.
- One live pass in the app: add, edit with a note and a long title, send to
  kata, see the id and the ticked row, clear done, delete; a new tab cd'd to
  `~` shows a separate list; and in a folder without kata, no `→ kata`.

## Repository

`herdr-mod-kata-todo`, shaped like the mods on herdr.dev: `mods/kata-todo/`,
`README.md`, `RECIPE.md`, `preview.png`, `tests/`, `docs/`. The README says
`→ kata` needs `kata` on the PATH of the space's machine. A person's layout
(a Todo tab, a tab-bar button) and any kata wrapper are their own setup and are
not in the repository.
