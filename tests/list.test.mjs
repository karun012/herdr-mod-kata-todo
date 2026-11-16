import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LISTS_KEY, listKey, newTodo, addTodo, updateTodo, removeTodo,
  clearDone, ordered, openCount, applyToList,
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
