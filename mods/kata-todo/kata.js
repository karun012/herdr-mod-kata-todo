// Building `kata create` and reading its reply. Shapes come from real kata
// replies (tests/fixtures): success JSON on stdout, error JSON on stderr.

export function hash(text) {
  let h = 0x811c9dc5;
  for (const ch of text) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

// kata returns the original issue for a repeated key but refuses the same key
// with different fields, so the key carries a hash of the text.
export function idempotencyKey(todo) {
  return `todo-${todo.id}-${hash(`${todo.title}\0${todo.note ?? ""}`)}`;
}

export function createArgs(todo) {
  const note = (todo.note ?? "").trim();
  return [
    "create",
    "--idempotency-key", idempotencyKey(todo),
    ...(note ? ["--body", note] : []),
    "--json",
    // Without "--" a title like "-x …" is parsed as a flag.
    "--", todo.title,
  ];
}

// The whole text, else its last line that parses: a wrapper may print first.
function readJson(text) {
  const parse = (s) => { try { return JSON.parse(s); } catch { return null; } };
  const whole = parse(text ?? "");
  if (whole) return whole;
  const lines = (text ?? "").split("\n").map((l) => l.trim()).filter((l) => l.startsWith("{"));
  return lines.length ? parse(lines[lines.length - 1]) : null;
}

const firstLine = (text) => (text ?? "").split("\n").map((l) => l.trim()).find(Boolean) ?? "";

export function parseCreate({ code, stdout, stderr }) {
  if (code === 0) {
    const ref = readJson(stdout)?.issue?.short_id;
    return ref ? { ref } : { error: "kata replied without an issue id" };
  }
  const error = readJson(stderr)?.error;
  if (error?.code === "duplicate_candidates") {
    const refs = (error.data?.candidates ?? []).map((c) => c.short_id).filter(Boolean);
    if (refs.length) return { error: `looks like ${refs.join(", ")}` };
  }
  if (error?.message) return { error: error.message };
  return { error: firstLine(stderr) || firstLine(stdout) || `kata exited with ${code}` };
}
