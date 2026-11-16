// Which folder a space's list belongs to, as Herdr's own mods name spaces:
// the first terminal of its first tab, else the space's folder ("" = home).

export function repoFolder(space, panes) {
  const first = [...(space.tabs ?? [])].sort((a, b) => a.index - b.index)[0];
  const pane = first && panes.find((p) => p.tab === first.id && p.terminal);
  return pane?.cwd ?? space.folder ?? "";
}

export function parseToplevel({ code, stdout }) {
  const path = (stdout ?? "").trim();
  return code === 0 && path ? path : null;
}

export function repoName(path) {
  if (!path) return "~";
  const parts = path.replace(/[\\/]+$/, "").split(/[\\/]/);
  return parts[parts.length - 1] || path;
}
