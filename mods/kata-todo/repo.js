// Which folder a list belongs to. With no terminal focused, as Herdr's own mods
// name spaces: the first terminal of its first tab, else its folder ("" = home).

export function repoFolder(space, panes) {
  const first = [...(space.tabs ?? [])].sort((a, b) => a.index - b.index)[0];
  const pane = first && panes.find((p) => p.tab === first.id && p.terminal);
  return pane?.cwd ?? space.folder ?? "";
}

// The list follows the focused terminal. null means "keep the current list":
// a non-terminal pane (a diff, a viewer) or a terminal whose folder is unknown.
export function listFolder(focus, space, panes) {
  if (!focus) return repoFolder(space, panes);
  return focus.terminal && focus.cwd ? focus.cwd : null;
}

export function parseToplevel({ code, stdout }) {
  const path = (stdout ?? "").trim();
  return code === 0 && path ? path : null;
}

// Where kata looks for the project binding: .kata.toml in the folder or above.
export function kataConfigPaths(path) {
  if (!path) return [];
  const paths = [];
  let dir = path.replace(/\/+$/, "");
  for (;;) {
    paths.push(`${dir}/.kata.toml`);
    const up = dir.lastIndexOf("/");
    if (up < 0) return paths;
    dir = dir.slice(0, up);
  }
}

export function repoName(path) {
  if (!path) return "~";
  const parts = path.replace(/[\\/]+$/, "").split(/[\\/]/);
  return parts[parts.length - 1] || path;
}
