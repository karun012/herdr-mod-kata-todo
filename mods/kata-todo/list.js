// Todos and lists as plain data. No Herdr calls: main.js reads shared state,
// passes it through these, and writes the result back.

export const LISTS_KEY = "kata-todo.lists";

export function listKey(machine, path) {
  return `${machine ?? "local"}:${path || "~"}`;
}

export function cleanTitle(text) {
  return String(text ?? "").replace(/\s+/g, " ").trim();
}

export function newTodo(title, { id, now }) {
  const text = cleanTitle(title);
  if (!text) return null;
  return { id, title: text, note: "", done: false, created: now, kata: null };
}

export function changedFields(before, after) {
  return Object.fromEntries(Object.entries(after).filter(([key, value]) => value !== before[key]));
}

export function addTodo(list, todo) {
  return [todo, ...list];
}

export function updateTodo(list, id, patch) {
  let changed = false;
  const next = list.map((todo) => {
    if (todo.id !== id) return todo;
    const updated = { ...todo, ...patch };
    if (!Object.keys(patch).some((key) => updated[key] !== todo[key])) return todo;
    changed = true;
    return updated;
  });
  return changed ? next : list;
}

export function removeTodo(list, id) {
  const next = list.filter((todo) => todo.id !== id);
  return next.length === list.length ? list : next;
}

// Once it's a kata issue, kata tracks it: the todo is handed off, so done.
export function markSent(list, id, ref) {
  return updateTodo(list, id, { kata: { ref }, done: true });
}

export function clearDone(list) {
  const next = list.filter((todo) => !todo.done);
  return next.length === list.length ? list : next;
}

// What a removal (× or Clear) took, with the order before it, so Undo can put
// it back. null when nothing went.
export function removal(before, after) {
  const kept = new Set(after.map((todo) => todo.id));
  const todos = before.filter((todo) => !kept.has(todo.id));
  return todos.length ? { todos, order: before.map((todo) => todo.id) } : null;
}

// Where a removed todo goes back: after the nearest todo that stood above it
// and is still there, else before the nearest that stood below it, else last.
function slot(list, order, id) {
  const at = (other) => list.findIndex((todo) => todo.id === other);
  const i = order.indexOf(id);
  for (let j = i - 1; j >= 0; j--) if (at(order[j]) >= 0) return at(order[j]) + 1;
  for (let j = i + 1; j < order.length; j++) if (at(order[j]) >= 0) return at(order[j]);
  return list.length;
}

// Undo: puts a removal's todos back in place, skipping any already back.
export function restoreTodos(list, { todos, order }) {
  const present = new Set(list.map((todo) => todo.id));
  let next = list;
  for (const todo of todos) {
    if (present.has(todo.id)) continue;
    const at = slot(next, order, todo.id);
    next = [...next.slice(0, at), todo, ...next.slice(at)];
  }
  return next;
}

export function ordered(list) {
  return [...list.filter((todo) => !todo.done), ...list.filter((todo) => todo.done)];
}

export function openCount(list) {
  return list.filter((todo) => !todo.done).length;
}

export function listOf(lists, key) {
  const all = lists && typeof lists === "object" && !Array.isArray(lists) ? lists : {};
  return Array.isArray(all[key]) ? all[key] : [];
}

// Applies fn to one list inside the shared map. Returns `lists` itself when
// nothing changed, so callers can skip setShared (which re-renders every mod).
export function applyToList(lists, key, fn) {
  const all = lists && typeof lists === "object" && !Array.isArray(lists) ? lists : {};
  const current = listOf(lists, key);
  const next = fn(current);
  if (next === current) return lists;
  const out = { ...all };
  if (next.length) out[key] = next;
  else delete out[key];
  return out;
}
