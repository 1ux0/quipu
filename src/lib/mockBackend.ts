import type { Note, Folder } from "./types";

const seed: Record<string, string> = {
  "/quipu/welcome.md":
    "# Welcome to quipu\n\nA lightweight, local-first markdown notebook.\n\n- Type markdown and watch it render inline\n- Notes are plain `.md` files on disk\n\n```ts\nconst hello = (name: string) => `hi ${name}`;\n```\n",
  "/quipu/ideas.md": "# Ideas\n\n> capture things here\n\n1. first\n2. second\n",
  "/quipu/projects/roadmap.md": "# Roadmap\n\n- [ ] ship v1\n",
  "/quipu/projects/notes/kickoff.md": "# Kickoff\n\nmeeting notes\n",
};

let store: Record<string, string> = {};
let extraFolders = new Set<string>();
let created: Record<string, number> = {};
let order: Record<string, number> = {};
let titleMap: Record<string, string> = {};
let clock = 1;
let dir = "/quipu";

const reseed = () => {
  store = { ...seed };
  extraFolders = new Set();
  created = {};
  order = {};
  titleMap = {};
  clock = 1;
  dir = "/quipu";
  for (const k of Object.keys(store)) created[k] = clock++;
};
reseed();

const parentOf = (p: string) => p.slice(0, p.lastIndexOf("/"));
const under = (p: string, prefix: string) => p === prefix || p.startsWith(`${prefix}/`);

const titleOf = (contents: string, name: string) => {
  for (const line of contents.split("\n")) {
    const t = line.replace(/^\s*#+/, "").trim();
    if (t) return t;
  }
  return name;
};

const noteOf = (path: string): Note => {
  const name = path.split("/").pop()!.replace(/\.md$/, "");
  return { path, name, title: titleOf(store[path] ?? "", name), modified: 0, created: created[path] ?? 0 };
};

const assignTop = (path: string) => {
  const parent = parentOf(path);
  const sibs = Object.keys(order)
    .filter((p) => parentOf(p) === parent)
    .map((p) => order[p]);
  order[path] = (sibs.length ? Math.min(...sibs) : 0) - 1;
};

const renameOrder = (oldP: string, newP: string) => {
  for (const p of Object.keys(order)) {
    if (under(p, oldP)) {
      order[newP + p.slice(oldP.length)] = order[p];
      delete order[p];
    }
  }
};

const removeOrder = (path: string) => {
  for (const p of Object.keys(order)) if (under(p, path)) delete order[p];
};

export const mock = {
  reset: reseed,
  initApp: async () => dir,
  setTargetDir: async (d: string) => {
    dir = d;
  },
  listNotes: async () =>
    Object.keys(store)
      .filter((p) => p.startsWith(`${dir}/`))
      .map(noteOf),
  listFolders: async (): Promise<Folder[]> => {
    const set = new Set<string>(extraFolders);
    for (const p of Object.keys(store)) {
      if (!p.startsWith(`${dir}/`)) continue;
      const parts = p.slice(dir.length + 1).split("/");
      let cur = dir;
      for (let i = 0; i < parts.length - 1; i++) {
        cur = `${cur}/${parts[i]}`;
        set.add(cur);
      }
    }
    return [...set]
      .filter((f) => f.startsWith(`${dir}/`))
      .map((path) => ({ path, name: path.split("/").pop()!, created: created[path] ?? 0 }));
  },
  getOrder: async (): Promise<[string, number][]> => Object.entries(order),
  setOrder: async (paths: string[]) => {
    paths.forEach((p, i) => {
      order[p] = i;
    });
  },
  getTitles: async (): Promise<[string, string][]> => Object.entries(titleMap),
  freezeTitle: async (path: string, title: string) => {
    if (!(path in titleMap)) titleMap[path] = title;
  },
  readNote: async (path: string) => store[path] ?? "",
  writeNote: async (path: string, contents: string) => {
    store[path] = contents;
  },
  createNote: async (d: string, name: string) => {
    let path = `${d}/${name}.md`;
    let n = 2;
    while (path in store) path = `${d}/${name} ${n++}.md`;
    store[path] = "";
    created[path] = clock++;
    assignTop(path);
    return path;
  },
  createFolder: async (d: string, name: string) => {
    let path = `${d}/${name}`;
    let n = 2;
    while (extraFolders.has(path) || Object.keys(store).some((k) => k.startsWith(`${path}/`))) {
      path = `${d}/${name} ${n++}`;
    }
    extraFolders.add(path);
    created[path] = clock++;
    assignTop(path);
    return path;
  },
  renameNote: async (path: string, newName: string) => {
    const next = `${parentOf(path)}/${newName}.md`;
    store[next] = store[path];
    created[next] = created[path];
    delete store[path];
    delete created[path];
    renameOrder(path, next);
    delete titleMap[path];
    titleMap[next] = newName;
    return next;
  },
  renameFolder: async (path: string, newName: string) => {
    const next = `${parentOf(path)}/${newName}`;
    for (const k of Object.keys(store)) {
      if (under(k, path)) {
        store[next + k.slice(path.length)] = store[k];
        created[next + k.slice(path.length)] = created[k];
        delete store[k];
        delete created[k];
      }
    }
    for (const k of Object.keys(titleMap)) {
      if (under(k, path)) {
        titleMap[next + k.slice(path.length)] = titleMap[k];
        delete titleMap[k];
      }
    }
    if (extraFolders.delete(path)) extraFolders.add(next);
    renameOrder(path, next);
    return next;
  },
  moveNote: async (path: string, destDir: string) => {
    const next = `${destDir}/${path.split("/").pop()}`;
    store[next] = store[path];
    created[next] = created[path];
    delete store[path];
    delete created[path];
    removeOrder(path);
    if (path in titleMap) {
      titleMap[next] = titleMap[path];
      delete titleMap[path];
    }
    assignTop(next);
    return next;
  },
  deleteNote: async (path: string) => {
    for (const k of Object.keys(store)) if (under(k, path)) delete store[k];
    for (const k of Object.keys(titleMap)) if (under(k, path)) delete titleMap[k];
    for (const f of [...extraFolders]) if (under(f, path)) extraFolders.delete(f);
    for (const k of Object.keys(created)) if (under(k, path)) delete created[k];
    removeOrder(path);
  },
  pickDirectory: async () => window.prompt("Target directory", dir),
};
