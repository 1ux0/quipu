import { create } from "zustand";
import type { Note, Folder } from "../lib/types";
import { childPathsOf, type Order } from "../lib/tree";
import * as api from "../lib/commands";

const parentOf = (p: string) => p.slice(0, p.lastIndexOf("/"));
const stemOf = (p: string) => p.split("/").pop()!.replace(/\.md$/, "");
const deriveTitle = (content: string) => {
  for (const line of content.split("\n")) {
    const t = line.replace(/^\s*#+/, "").trim();
    if (t) return t;
  }
  return "";
};

interface NotesState {
  targetDir: string;
  homeDir: string;
  notes: Note[];
  folders: Folder[];
  order: Order;
  titles: Record<string, string>;
  openNotePath: string | null;
  openContent: string | null;
  loadToken: number;
  sidebarCollapsed: boolean;
  ready: boolean;

  init: () => Promise<void>;
  refresh: () => Promise<void>;
  freezeCurrent: (path: string) => Promise<void>;
  changeTargetDir: (dir: string) => Promise<void>;
  pickTargetDir: () => Promise<void>;
  openNote: (path: string) => Promise<void>;
  savePath: (path: string, contents: string) => Promise<void>;
  newNote: (dir?: string) => Promise<void>;
  newFolder: (dir?: string) => Promise<void>;
  rename: (path: string, newName: string) => Promise<void>;
  renameFolder: (path: string, newName: string) => Promise<void>;
  moveNote: (path: string, destDir: string) => Promise<void>;
  reorder: (draggedPath: string, targetPath: string, place: "before" | "after") => Promise<void>;
  remove: (path: string) => Promise<void>;
  toggleSidebar: () => void;
  handleExternalChange: (paths: string[]) => Promise<void>;
}

export const useNotes = create<NotesState>((set, get) => ({
  targetDir: "",
  homeDir: "",
  notes: [],
  folders: [],
  order: {},
  titles: {},
  openNotePath: null,
  openContent: null,
  loadToken: 0,
  sidebarCollapsed: false,
  ready: false,

  init: async () => {
    const [dir, home] = await Promise.all([api.initApp(), api.getHomeDir()]);
    set({ targetDir: dir, homeDir: home, ready: true });
    await get().refresh();
  },

  refresh: async () => {
    const dir = get().targetDir;
    const [notes, folders, orderPairs, titlePairs] = await Promise.all([
      api.listNotes(dir),
      api.listFolders(dir),
      api.getOrder(),
      api.getTitles(),
    ]);
    const titles = Object.fromEntries(titlePairs);
    set({ notes, folders, order: Object.fromEntries(orderPairs), titles });

    // Freeze the title of any untitled note that isn't currently being edited.
    const open = get().openNotePath;
    const toFreeze = notes.filter(
      (n) =>
        n.path !== open &&
        !titles[n.path] &&
        n.title &&
        n.title !== stemOf(n.path),
    );
    if (toFreeze.length) {
      for (const n of toFreeze) await api.freezeTitle(n.path, n.title);
      set((s) => {
        const merged = { ...s.titles };
        toFreeze.forEach((n) => (merged[n.path] = n.title));
        return { titles: merged };
      });
    }
  },

  freezeCurrent: async (path) => {
    if (get().titles[path]) return;
    const title = deriveTitle(await api.readNote(path));
    if (title && title !== stemOf(path)) {
      await api.freezeTitle(path, title);
      set((s) => ({ titles: { ...s.titles, [path]: title } }));
    }
  },

  changeTargetDir: async (dir) => {
    const prev = get().openNotePath;
    if (prev) await get().freezeCurrent(prev);
    await api.setTargetDir(dir);
    set({ targetDir: dir, openNotePath: null, openContent: null });
    await get().refresh();
  },

  pickTargetDir: async () => {
    const chosen = await api.pickDirectory(get().targetDir);
    if (chosen) await get().changeTargetDir(chosen);
  },

  openNote: async (path) => {
    const prev = get().openNotePath;
    if (prev && prev !== path) await get().freezeCurrent(prev);
    const content = await api.readNote(path);
    set((s) => ({
      openNotePath: path,
      openContent: content,
      loadToken: s.loadToken + 1,
    }));
  },

  savePath: async (path, contents) => {
    await api.saveNote(get().targetDir, path, contents);
    await get().refresh();
  },

  newNote: async (dir) => {
    const path = await api.createNote(dir ?? get().targetDir, "untitled");
    await get().refresh();
    await get().openNote(path);
  },

  newFolder: async (dir) => {
    await api.createFolder(dir ?? get().targetDir, "untitled");
    await get().refresh();
  },

  rename: async (path, newName) => {
    const next = await api.renameNote(path, newName);
    set((s) => ({ openNotePath: s.openNotePath === path ? next : s.openNotePath }));
    await get().refresh();
  },

  renameFolder: async (path, newName) => {
    const next = await api.renameFolder(path, newName);
    set((s) => ({
      openNotePath: s.openNotePath?.startsWith(`${path}/`)
        ? next + s.openNotePath.slice(path.length)
        : s.openNotePath,
    }));
    await get().refresh();
  },

  moveNote: async (path, destDir) => {
    const next = await api.moveNote(path, destDir);
    set((s) => ({ openNotePath: s.openNotePath === path ? next : s.openNotePath }));
    await get().refresh();
  },

  reorder: async (draggedPath, targetPath, place) => {
    if (draggedPath === targetPath) return;
    const targetParent = parentOf(targetPath);
    if (parentOf(draggedPath) !== targetParent) {
      await get().moveNote(draggedPath, targetParent);
      return;
    }
    const { notes, folders, order } = get();
    const siblings = childPathsOf(notes, folders, order, targetParent).filter(
      (p) => p !== draggedPath,
    );
    const idx = siblings.indexOf(targetPath);
    if (idx === -1) return;
    siblings.splice(place === "after" ? idx + 1 : idx, 0, draggedPath);
    await api.setOrder(siblings);
    await get().refresh();
  },

  remove: async (path) => {
    await api.deleteNote(path);
    if (get().openNotePath === path) {
      set({ openNotePath: null, openContent: null });
    }
    await get().refresh();
  },

  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  handleExternalChange: async (paths) => {
    await get().refresh();
    const { openNotePath } = get();
    if (openNotePath && paths.includes(openNotePath)) {
      await get().openNote(openNotePath);
    }
  },
}));
