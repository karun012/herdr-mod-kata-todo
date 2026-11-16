import { test } from "node:test";
import assert from "node:assert/strict";
import { repoFolder, parseToplevel, repoName } from "../mods/kata-todo/repo.js";

const space = (extra = {}) => ({
  folder: "/home/me/start",
  tabs: [{ id: "t2", index: 2 }, { id: "t1", index: 1 }],
  ...extra,
});

test("repoFolder: first terminal of the first tab, by index", () => {
  const panes = [
    { tab: "t2", terminal: "x", cwd: "/elsewhere" },
    { tab: "t1", terminal: null, cwd: null, mod: "files" },
    { tab: "t1", terminal: "a", cwd: "/r/app/src" },
    { tab: "t1", terminal: "b", cwd: "/r/other" },
  ];
  assert.equal(repoFolder(space(), panes), "/r/app/src");
});

test("repoFolder: falls back to the space folder, then home", () => {
  assert.equal(repoFolder(space(), []), "/home/me/start");
  assert.equal(repoFolder(space({ folder: "" }), []), "");
  assert.equal(repoFolder(space({ tabs: [] }), []), "/home/me/start");
});

test("parseToplevel", () => {
  assert.equal(parseToplevel({ code: 0, stdout: "/r/app\n", stderr: "" }), "/r/app");
  assert.equal(parseToplevel({ code: 128, stdout: "", stderr: "fatal: not a git repository" }), null);
  assert.equal(parseToplevel({ code: 0, stdout: "  \n", stderr: "" }), null);
});

test("repoName", () => {
  assert.equal(repoName("/r/app"), "app");
  assert.equal(repoName("/r/app/"), "app");
  assert.equal(repoName("C:\\code\\app"), "app");
  assert.equal(repoName(""), "~");
  assert.equal(repoName("/"), "/");
});

test("repoFolder: only the first terminal counts, even without a cwd", () => {
  const panes = [
    { tab: "t1", terminal: "a", cwd: null },
    { tab: "t1", terminal: "b", cwd: "/r/b" },
  ];
  assert.equal(repoFolder(space(), panes), "/home/me/start");
});
