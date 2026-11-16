import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { idempotencyKey, createArgs, parseCreate } from "../mods/kata-todo/kata.js";

const fixture = (name) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
const todo = (extra = {}) => ({ id: "k3f9ab", title: "Pin the image tag", note: "", done: false, created: 1, kata: null, ...extra });

test("idempotency key: stable for the same text, new when the text changes", () => {
  const key = idempotencyKey(todo());
  assert.match(key, /^todo-k3f9ab-[0-9a-z]+$/);
  assert.equal(idempotencyKey(todo({ done: true, created: 99 })), key);
  assert.notEqual(idempotencyKey(todo({ title: "Pin the image tag!" })), key);
  assert.notEqual(idempotencyKey(todo({ note: "why" })), key);
});

test("createArgs: flags first, then -- and the title", () => {
  const t = todo();
  assert.deepEqual(createArgs(t),
    ["create", "--idempotency-key", idempotencyKey(t), "--json", "--", "Pin the image tag"]);
});

test("createArgs: the note becomes --body, trimmed", () => {
  const t = todo({ note: "  floating tag  " });
  assert.deepEqual(createArgs(t),
    ["create", "--idempotency-key", idempotencyKey(t), "--body", "floating tag", "--json", "--", "Pin the image tag"]);
});

test("createArgs: quotes pass through untouched (exec takes an argument array)", () => {
  assert.equal(createArgs(todo({ title: `Say "hi" & 'bye'` })).at(-1), `Say "hi" & 'bye'`);
});

test("createArgs: a title starting with a dash stays the title", () => {
  const args = createArgs(todo({ title: "-x starts with dash" }));
  assert.equal(args.at(-2), "--");
  assert.equal(args.at(-1), "-x starts with dash");
});

test("parseCreate: success reads .issue.short_id", () => {
  assert.deepEqual(parseCreate({ code: 0, stdout: fixture("create-created.json"), stderr: "" }), { ref: "jy3g" });
});

test("parseCreate: success JSON after noise a wrapper printed", () => {
  const stdout = `Update available\n${fixture("create-created.json").trim()}\n`;
  assert.deepEqual(parseCreate({ code: 0, stdout, stderr: "" }), { ref: "jy3g" });
});

test("parseCreate: duplicate refusal names the look-alikes", () => {
  assert.deepEqual(parseCreate({ code: 5, stdout: "", stderr: fixture("create-duplicate.json") }), { error: "looks like jy3g" });
});

test("parseCreate: key mismatch falls through to kata's message", () => {
  assert.deepEqual(parseCreate({ code: 5, stdout: "", stderr: fixture("create-mismatch.json") }),
    { error: "idempotency key matched a prior issue with a different fingerprint" });
});

test("parseCreate: usage error message", () => {
  assert.deepEqual(parseCreate({ code: 2, stdout: "", stderr: fixture("create-usage.json") }),
    { error: "unknown shorthand flag: 'x' in -x starts with dash" });
});

test("parseCreate: plain-text failures use the first line", () => {
  assert.deepEqual(parseCreate({ code: 1, stdout: "", stderr: "\n  daemon not running  \nmore\n" }), { error: "daemon not running" });
  assert.deepEqual(parseCreate({ code: 7, stdout: "", stderr: "" }), { error: "kata exited with 7" });
});

test("parseCreate: exit 0 without an id is an error", () => {
  assert.deepEqual(parseCreate({ code: 0, stdout: "{}", stderr: "" }), { error: "kata replied without an issue id" });
});
