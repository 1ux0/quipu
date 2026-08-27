export function abbreviateHome(path: string, home: string): string {
  const h = home.replace(/\/+$/, "");
  if (h && (path === h || path.startsWith(`${h}/`))) {
    return `~${path.slice(h.length)}`;
  }
  return path;
}
