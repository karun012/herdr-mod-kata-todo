import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LISTS_KEY, listKey, makeId, newTodo, addTodo, updateTodo, removeTodo,
  clearDone, markSent, ordered, openCount, applyToList, listOf, cleanTitle, changedFields,
  removal, restoreTodos,
} from "../mods/kata-todo/list.js";

const todo = (id, extra = {}) => ({ id, title: id, note: "", done: false, created: 1, kata: null, ...extra });

test("the shared key is namespaced", () => {
  assert.equal(LISTS_KEY, "kata-todo.lists");
});

test("listKey: local machine and home", () => {
  assert.equal(listKey(null, "/r/app"), "local:/r/app");
  assert.equal(listKey("vps", "/srv/app"), "vps:/srv/app");
  assert.equal(listKey(null, ""), "local:~");
});

test("newTodo trims and refuses blank titles", () => {
  assert.deepEqual(newTodo("  Fix it  ", { id: "a1", now: 7 }),
    { id: "a1", title: "Fix it", note: "", done: false, created: 7, kata: null });
  assert.equal(newTodo("   ", { id: "a1", now: 7 }), null);
  assert.equal(newTodo(undefined, { id: "a1", now: 7 }), null);
});

test("addTodo puts the new one first", () => {
  assert.deepEqual(addTodo([todo("b")], todo("a")).map((t) => t.id), ["a", "b"]);
});

test("updateTodo changes one todo and keeps identity when nothing changed", () => {
  const list = [todo("a"), todo("b")];
  const next = updateTodo(list, "b", { done: true });
  assert.equal(next[1].done, true);
  assert.equal(next[0], list[0]);
  assert.equal(updateTodo(list, "b", { done: false }), list);
  assert.equal(updateTodo(list, "zz", { done: true }), list);
});

test("removeTodo and clearDone keep identity when nothing goes", () => {
  const list = [todo("a"), todo("b", { done: true })];
  assert.deepEqual(removeTodo(list, "a").map((t) => t.id), ["b"]);
  assert.equal(removeTodo(list, "zz"), list);
  assert.deepEqual(clearDone(list).map((t) => t.id), ["a"]);
  const open = [todo("a")];
  assert.equal(clearDone(open), open);
});

test("ordered: open first in stored order, then done", () => {
  const list = [todo("a", { done: true }), todo("b"), todo("c", { done: true }), todo("d")];
  assert.deepEqual(ordered(list).map((t) => t.id), ["b", "d", "a", "c"]);
  assert.equal(openCount(list), 2);
});

test("applyToList changes only its own list", () => {
  const lists = { "local:/a": [todo("x")], "local:/b": [todo("y")] };
  const next = applyToList(lists, "local:/a", (l) => addTodo(l, todo("z")));
  assert.deepEqual(next["local:/a"].map((t) => t.id), ["z", "x"]);
  assert.equal(next["local:/b"], lists["local:/b"]);
});

test("applyToList returns the same object when nothing changed", () => {
  const lists = { "local:/a": [todo("x")] };
  assert.equal(applyToList(lists, "local:/a", (l) => l), lists);
  assert.equal(applyToList(undefined, "local:/a", (l) => l), undefined);
});

test("applyToList starts from nothing and drops emptied lists", () => {
  assert.deepEqual(applyToList(undefined, "local:/a", (l) => addTodo(l, todo("x"))), { "local:/a": [todo("x")] });
  assert.deepEqual(applyToList({ "local:/a": [todo("x")] }, "local:/a", () => []), {});
  assert.deepEqual(applyToList("garbage", "local:/a", (l) => addTodo(l, todo("x"))), { "local:/a": [todo("x")] });
});

test("listOf: the array under a key, else empty", () => {
  const list = [{ id: "a" }];
  assert.equal(listOf({ k: list }, "k"), list);
  assert.deepEqual(listOf({ k: "oops" }, "k"), []);
  assert.deepEqual(listOf(undefined, "k"), []);
  assert.deepEqual(listOf([list], "0"), []);
});

test("cleanTitle: one line, single spaces", () => {
  assert.equal(cleanTitle("  a\n b\t\tc   d "), "a b c d");
  assert.equal(cleanTitle(undefined), "");
  assert.equal(newTodo("a\n b", { id: "a1", now: 7 }).title, "a b");
});

test("changedFields: only the keys whose values differ", () => {
  assert.deepEqual(changedFields({ title: "a", note: "n" }, { title: "b", note: "n" }), { title: "b" });
  assert.deepEqual(changedFields({ title: "a", note: "n" }, { note: "m" }), { note: "m" });
  assert.deepEqual(changedFields({ title: "a", note: "n" }, { title: "a", note: "n" }), {});
});

test("markSent records the issue and marks the todo done", () => {
  const list = [todo("a"), todo("b")];
  const next = markSent(list, "b", "jy3g");
  assert.deepEqual(next[1], { ...list[1], kata: { ref: "jy3g" }, done: true });
  assert.equal(next[0], list[0]);
  assert.equal(markSent(list, "zz", "jy3g"), list);
});

const ids = (list) => list.map((t) => t.id);

test("removal: what went and the order before, else null", () => {
  const list = [todo("a"), todo("b"), todo("c")];
  assert.deepEqual(removal(list, removeTodo(list, "b")), { todos: [list[1]], order: ["a", "b", "c"] });
  assert.equal(removal(list, list), null);
});

test("restoreTodos: × then Undo puts the todo back in place", () => {
  const list = [todo("a"), todo("b"), todo("c")];
  const after = removeTodo(list, "b");
  assert.deepEqual(restoreTodos(after, removal(list, after)), list);
});

test("restoreTodos: Clear then Undo puts every done todo back between the open ones", () => {
  const list = [todo("a"), todo("b", { done: true }), todo("c"), todo("d", { done: true })];
  const after = clearDone(list);
  assert.deepEqual(restoreTodos(after, removal(list, after)), list);
  const all = [todo("x", { done: true }), todo("y", { done: true })];
  assert.deepEqual(ids(restoreTodos(clearDone(all), removal(all, clearDone(all)))), ["x", "y"]);
});

test("restoreTodos: todos added since stay where they are", () => {
  const list = [todo("a"), todo("b"), todo("c")];
  const mid = removal(list, removeTodo(list, "b"));
  assert.deepEqual(ids(restoreTodos([todo("n"), todo("a"), todo("c")], mid)), ["n", "a", "b", "c"]);
  const first = removal(list, removeTodo(list, "a"));
  assert.deepEqual(ids(restoreTodos([todo("n"), todo("b"), todo("c")], first)), ["n", "a", "b", "c"]);
});

test("restoreTodos: neighbours gone since, or nothing left, still restores", () => {
  const list = [todo("a"), todo("b"), todo("c")];
  const gone = removal(list, removeTodo(list, "b"));
  assert.deepEqual(ids(restoreTodos([todo("n")], gone)), ["n", "b"]);
  assert.deepEqual(ids(restoreTodos([], gone)), ["b"]);
});

test("restoreTodos: a todo already back is skipped, keeping identity", () => {
  const list = [todo("a"), todo("b")];
  const removed = removal(list, removeTodo(list, "b"));
  assert.equal(restoreTodos(list, removed), list);
});

test("makeId: always 6 base-36 characters, never one the list already has", () => {
  // The first draw, "000000", is taken, so it draws again.
  const values = [0, 0, 0, 0, 0, 0, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
  const random = () => values.shift();
  assert.equal(makeId([{ id: "000000" }], random), "iiiiii");
  for (let i = 0; i < 200; i++) assert.match(makeId([]), /^[0-9a-z]{6}$/);
});
