// Todos and lists as plain data. No Herdr calls: main.js reads shared state,
// passes it through these, and writes the result back.

export const LISTS_KEY = "kata-todo.lists";

export function listKey(machine, path) {
  return `${machine ?? "local"}:${path || "~"}`;
}

export function newTodo(title, { id, now }) {
  const text = String(title ?? "").trim();
  if (!text) return null;
  return { id, title: text, note: "", done: false, created: now, kata: null };
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

export function clearDone(list) {
  const next = list.filter((todo) => !todo.done);
  return next.length === list.length ? list : next;
}

export function ordered(list) {
  return [...list.filter((todo) => !todo.done), ...list.filter((todo) => todo.done)];
}

export function openCount(list) {
  return list.filter((todo) => !todo.done).length;
}

// Applies fn to one list inside the shared map. Returns `lists` itself when
// nothing changed, so callers can skip setShared (which re-renders every mod).
export function applyToList(lists, key, fn) {
  const all = lists && typeof lists === "object" && !Array.isArray(lists) ? lists : {};
  const current = Array.isArray(all[key]) ? all[key] : [];
  const next = fn(current);
  if (next === current) return lists;
  const out = { ...all };
  if (next.length) out[key] = next;
  else delete out[key];
  return out;
}
