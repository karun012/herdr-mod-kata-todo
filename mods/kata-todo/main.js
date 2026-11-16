// kata-todo: a quiet todo list for the repo you're in; any item can become a
// kata issue. Decisions live in list.js / repo.js / kata.js; this file only
// gathers facts from Herdr, calls them, and performs the effects.
import { View, div } from "gpui-kit";
import { v_flex, h_flex, InputState, Input, TextareaState, Textarea } from "gpui-base";
import { spaces, panes, exec, shared, setShared, theme, checking } from "herdr";
import { LISTS_KEY, listKey, newTodo, addTodo, updateTodo, removeTodo, clearDone, ordered, openCount, applyToList, listOf, cleanTitle, changedFields } from "./list.js";
import { repoFolder, parseToplevel, repoName } from "./repo.js";
import { createArgs, parseCreate } from "./kata.js";

const HIDE_DONE = "kata-todo.hide-done";
const SAVE_AFTER_MS = 500;
const makeId = () => Math.random().toString(36).slice(2, 8);

function readHideDone() {
  try { return localStorage.getItem(HIDE_DONE) === "1"; } catch { return false; }
}
function writeHideDone(on) {
  try { localStorage.setItem(HIDE_DONE, on ? "1" : "0"); } catch {}
}

export default class KataTodo extends View {
  init(_props, cx) {
    this.repo = null;          // { key, path, name, machine }
    this.context = null;       // the machine + folder the repo was resolved from
    this.kata = {};            // machine ("local" for this one) -> kata on its PATH
    this.sending = new Set();  // "key|id"
    this.errors = new Map();   // "key|id" -> one line
    this.hovered = null;
    this.openId = null;
    this.draft = null;         // { key, id } of the open row
    this.saveTask = null;
    this.hideDone = readHideDone();

    this.add = InputState.new({ placeholder: "Add a todo…" });
    this.add.on("submit", (_e, cx) => { this.addFromInput(); cx.notify(); });
    this.title = InputState.new();
    this.note = TextareaState.new({ placeholder: "Note", rows: 2 });
    this.note.set_auto_grow(2, 8);
    for (const state of [this.title, this.note]) {
      state.on("change", (_e, cx) => this.scheduleSave(cx));
      state.on("blur", () => this.save());
    }
    this.title.on("submit", (_e, cx) => { this.closeRow(); cx.notify(); });

    if (checking()) return;
    cx.timer.every(500, (cx) => this.follow(cx));
    this.follow(cx);
  }

  // Re-resolve the repo when the shown space, its machine or its folder changes.
  follow(cx) {
    const space = spaces().find((s) => s.active);
    if (!space) return;
    const machine = space.machine ?? null;
    const folder = repoFolder(space, panes());
    const context = `${machine ?? ""}\n${folder}`;
    if (context === this.context) return;
    this.context = context;
    cx.spawn(async (cx) => {
      let top = null;
      try {
        top = parseToplevel(await exec("git", ["rev-parse", "--show-toplevel"], { cwd: folder || undefined, on: machine }));
      } catch {}
      if (this.context !== context) return;
      const path = top ?? folder;
      const key = listKey(machine, path);
      if (key !== this.repo?.key) this.closeRow();
      this.repo = { key, path, name: repoName(path), machine };
      cx.notify();
      const m = machine ?? "local";
      if (m in this.kata) return;
      this.kata[m] = false;
      try { this.kata[m] = (await exec("sh", ["-c", "command -v kata"], { on: machine })).code === 0; } catch {}
      cx.notify();
    });
  }

  todos() {
    return this.repo ? listOf(shared(LISTS_KEY), this.repo.key) : [];
  }

  // Re-reads shared state and applies one change, so two copies never clobber.
  write(key, fn) {
    const lists = shared(LISTS_KEY);
    const next = applyToList(lists, key, fn);
    if (next !== lists) setShared(LISTS_KEY, next);
  }

  addFromInput() {
    if (!this.repo) return;
    const todo = newTodo(this.add.value(), { id: makeId(), now: Math.floor(Date.now() / 1000) });
    if (!todo) return;
    this.write(this.repo.key, (list) => addTodo(list, todo));
    this.add.set_value("");
  }

  openRow(todo, cx) {
    this.save();
    this.openId = todo.id;
    this.title.set_value(todo.title);
    this.note.set_value(todo.note ?? "");
    this.draft = { key: this.repo.key, id: todo.id, title: todo.title, note: todo.note ?? "" };
    // The title Input mounts on the next render; focus it after that.
    cx.timer.after(0, () => this.title.focus());
  }

  closeRow() {
    this.save();
    this.openId = null;
    this.draft = null;
  }

  scheduleSave(cx) {
    this.saveTask?.cancel();
    this.saveTask = cx.timer.after(SAVE_AFTER_MS, (cx) => { this.save(); cx.notify(); });
  }

  save() {
    this.saveTask?.cancel();
    this.saveTask = null;
    const draft = this.draft;
    if (!draft) return;
    const title = cleanTitle(this.title.value());
    const note = this.note.value().trim();
    const patch = changedFields({ title: draft.title, note: draft.note }, title ? { title, note } : { note });
    if (!Object.keys(patch).length) return;
    this.write(draft.key, (list) => updateTodo(list, draft.id, patch));
    Object.assign(draft, patch);
  }

  send(id, cx) {
    const repo = this.repo;
    if (!repo) return;
    const slot = `${repo.key}|${id}`;
    if (this.sending.has(slot)) return;
    if (this.openId === id) this.save();
    const todo = this.todos().find((t) => t.id === id);
    if (!todo || todo.kata) return;
    this.sending.add(slot);
    this.errors.delete(slot);
    cx.spawn(async (cx) => {
      let result;
      try {
        result = parseCreate(await exec("kata", createArgs(todo), { cwd: repo.path || undefined, on: repo.machine, timeout: 60000 }));
      } catch (e) {
        result = { error: String(e?.message ?? e).split("\n")[0] };
      }
      this.sending.delete(slot);
      if (result.ref) this.write(repo.key, (list) => updateTodo(list, id, { kata: { ref: result.ref } }));
      else this.errors.set(slot, result.error);
      cx.notify();
    });
  }

  action(id, label, color, run) {
    return div().id(id).flex_none().text_size(11).text_color(color).cursor_pointer()
      .on_click((_e, cx) => { cx.stop_propagation(); run(cx); cx.notify(); })
      .child(label);
  }

  row(todo, t) {
    const repo = this.repo;
    const slot = `${repo.key}|${todo.id}`;
    const open = this.openId === todo.id;
    const hovered = this.hovered === todo.id && !open;
    const sending = this.sending.has(slot);
    const error = this.errors.get(slot);
    const canSend = this.kata[repo.machine ?? "local"] === true && !todo.kata && !todo.done;

    const ring = div().id(`ring-${todo.id}`).size(14).flex_none().rounded_full().border_1()
      .border_color(todo.done ? t.done : t.dim).cursor_pointer()
      .when(todo.done, (el) => el.bg(t.done))
      .on_click((_e, cx) => {
        cx.stop_propagation();
        this.write(repo.key, (list) => updateTodo(list, todo.id, { done: !todo.done }));
        cx.notify();
      });

    let line = h_flex().id(`row-${todo.id}`).px(18).py(8).gap(10).items_center().text_size(13)
      .when(hovered, (el) => el.bg(t.raised))
      .on_hover((on, cx) => {
        const next = on ? todo.id : this.hovered === todo.id ? null : this.hovered;
        if (next !== this.hovered) { this.hovered = next; cx.notify(); }
      })
      .child(ring);

    if (open) {
      line = line.child(div().flex_1().min_w(0).child(Input.new(this.title).w_full().text_size(13).text_color(t.foreground)));
    } else {
      line = line
        .child(div().id(`title-${todo.id}`).flex_1().min_w(0).truncate().cursor_pointer()
          .text_color(todo.done ? t.dim : t.foreground)
          .when(todo.done, (el) => el.line_through())
          .on_click((_e, cx) => { this.openRow(todo, cx); cx.notify(); })
          .child(todo.title))
        .when(Boolean(todo.note), (el) => el.child(div().flex_none().text_size(11).text_color(t.dim).child("¶")))
        .when(Boolean(todo.kata), (el) => el.child(div().flex_none().px(5).rounded(4).border_1().border_color(t.border)
          .text_size(11).text_color(t.dim).child(todo.kata.ref)))
        .when(sending, (el) => el.child(div().flex_none().text_size(11).text_color(t.dim).child("sending…")))
        .when(hovered && !sending && canSend, (el) => el.child(this.action(`send-${todo.id}`, "→ kata", t.accent, (cx) => this.send(todo.id, cx))))
        .when(hovered && !sending, (el) => el.child(this.action(`del-${todo.id}`, "×", t.dim,
          () => this.write(repo.key, (list) => removeTodo(list, todo.id)))));
    }

    return v_flex().id(`item-${todo.id}`)
      .child(line)
      .when(open, (el) => el.child(div().pl(42).pr(18).pb(8)
        .child(Textarea.new(this.note).w_full().text_size(12).text_color(t.muted))))
      .when(Boolean(error) && !open, (el) => el.child(div().pl(42).pr(18).pb(6).text_size(11)
        .text_color(t.ansi1).opacity(0.8).truncate().child(error)));
  }

  render() {
    const t = theme();
    const todos = this.todos();
    const open = openCount(todos);
    const done = todos.length - open;
    const shown = ordered(todos).filter((todo) => !(this.hideDone && todo.done));

    return v_flex().id("kata-todo").size_full().bg(t.chrome).text_color(t.foreground)
      .on_key_down((e, cx) => {
        if (e.key !== "escape") return;
        if (this.openId) this.closeRow();
        else this.add.set_value("");
        cx.stop_propagation();
        cx.notify();
      })
      .child(h_flex().px(18).pt(16).pb(10).items_end().justify_between()
        .child(div().text_size(15).font_semibold().child("Todo"))
        .child(div().text_size(11).text_color(t.dim).child(this.repo ? `${this.repo.name} · ${open} open` : "")))
      .child(div().id("add").mx(14).mb(10).h(36).px(12).flex().items_center().rounded(8)
        .border_1().border_color(t.border).bg(t.background)
        .child(Input.new(this.add).w_full().text_size(13).text_color(t.foreground)))
      .child(shown.length
        ? v_flex().id("todos").flex_1().min_h(0).overflow_y_scrollbar().children(shown.map((todo) => this.row(todo, t)))
        : div().flex_1().flex().items_center().justify_center().text_size(12).text_color(t.dim).child("Nothing to do."))
      .when(done > 0, (el) => el.child(h_flex().px(18).py(10).gap(6).text_size(11).text_color(t.dim)
        .child(`${done} done${this.hideDone ? " hidden" : ""}`)
        .child("·")
        .child(this.action("toggle-done", this.hideDone ? "Show" : "Hide", t.dim, () => {
          this.hideDone = !this.hideDone;
          writeHideDone(this.hideDone);
        }))
        .child("·")
        .child(this.action("clear-done", "Clear", t.dim, () => this.write(this.repo.key, clearDone)))));
  }
}
