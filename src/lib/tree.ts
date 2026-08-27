import type { Note, Folder } from "./types";

export interface TreeNoteNode {
  kind: "note";
  note: Note;
}

export interface TreeFolderNode {
  kind: "folder";
  name: string;
  path: string;
  created: number;
  children: TreeNode[];
}

export type TreeNode = TreeFolderNode | TreeNoteNode;

export type Order = Record<string, number>;

const parentOf = (p: string) => p.slice(0, p.lastIndexOf("/"));

// Positioned items (dragged/created) sort by position; the rest by creation desc.
function compare(
  a: { path: string; created: number },
  b: { path: string; created: number },
  order: Order,
): number {
  const ao = order[a.path];
  const bo = order[b.path];
  const aHas = ao !== undefined;
  const bHas = bo !== undefined;
  if (aHas && bHas) return ao - bo;
  if (aHas) return -1;
  if (bHas) return 1;
  return b.created - a.created;
}

interface Dir {
  folders: Map<string, Dir>;
  notes: Note[];
  path: string;
  created: number;
}

export function buildTree(
  notes: Note[],
  folders: Folder[],
  order: Order,
  rootDir: string,
): TreeNode[] {
  const prefix = rootDir.endsWith("/") ? rootDir : `${rootDir}/`;
  const createdOf: Record<string, number> = {};
  for (const f of folders) createdOf[f.path] = f.created;
  const root: Dir = { folders: new Map(), notes: [], path: rootDir, created: 0 };

  const ensure = (parts: string[]): Dir => {
    let cur = root;
    let path = rootDir;
    for (const seg of parts) {
      if (!seg) continue;
      path = `${path}/${seg}`;
      let next = cur.folders.get(seg);
      if (!next) {
        next = { folders: new Map(), notes: [], path, created: createdOf[path] ?? 0 };
        cur.folders.set(seg, next);
      }
      cur = next;
    }
    return cur;
  };

  for (const f of folders) {
    const rel = f.path.startsWith(prefix) ? f.path.slice(prefix.length) : f.path;
    if (rel) ensure(rel.split("/"));
  }
  for (const note of notes) {
    const rel = note.path.startsWith(prefix) ? note.path.slice(prefix.length) : note.path;
    ensure(rel.split("/").slice(0, -1)).notes.push(note);
  }

  const toNodes = (d: Dir): TreeNode[] => {
    const items: { key: { path: string; created: number }; node: TreeNode }[] = [];
    for (const [name, sub] of d.folders) {
      items.push({
        key: { path: sub.path, created: sub.created },
        node: { kind: "folder", name, path: sub.path, created: sub.created, children: toNodes(sub) },
      });
    }
    for (const note of d.notes) {
      items.push({ key: { path: note.path, created: note.created }, node: { kind: "note", note } });
    }
    items.sort((a, b) => compare(a.key, b.key, order));
    return items.map((i) => i.node);
  };

  return toNodes(root);
}

// Ordered child paths (files + folders) of a directory — used to compute reorders.
export function childPathsOf(
  notes: Note[],
  folders: Folder[],
  order: Order,
  parentDir: string,
): string[] {
  const items: { path: string; created: number }[] = [];
  for (const f of folders) if (parentOf(f.path) === parentDir) items.push({ path: f.path, created: f.created });
  for (const n of notes) if (parentOf(n.path) === parentDir) items.push({ path: n.path, created: n.created });
  items.sort((a, b) => compare(a, b, order));
  return items.map((i) => i.path);
}
