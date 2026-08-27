import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { open, ask } from "@tauri-apps/plugin-dialog";
import { homeDir } from "@tauri-apps/api/path";
import type { Note, Folder } from "./types";
import { ASSETS_DIR } from "./config";
import { mock } from "./mockBackend";

const isTauri =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export const initApp = (): Promise<string> =>
  isTauri ? invoke("init_app") : mock.initApp();

export const getHomeDir = (): Promise<string> =>
  isTauri ? homeDir() : Promise.resolve("");

export const setTargetDir = (dir: string): Promise<void> =>
  isTauri ? invoke("set_target_dir", { dir }) : mock.setTargetDir(dir);

export const listNotes = (dir: string): Promise<Note[]> =>
  isTauri ? invoke("list_notes", { dir }) : mock.listNotes();

export const readNote = (path: string): Promise<string> =>
  isTauri ? invoke("read_note", { path }) : mock.readNote(path);

export const saveNote = (
  dir: string,
  path: string,
  contents: string,
): Promise<void> =>
  isTauri
    ? invoke("save_note", { dir, path, contents })
    : mock.writeNote(path, contents);

export const importAsset = (dir: string, srcPath: string): Promise<string> =>
  isTauri ? invoke("import_asset", { dir, srcPath }) : Promise.resolve(`${ASSETS_DIR}/mock.png`);

export const importAssetBytes = (
  dir: string,
  name: string,
  data: Uint8Array,
): Promise<string> =>
  isTauri
    ? invoke("import_asset_bytes", { dir, name, data })
    : Promise.resolve(`${ASSETS_DIR}/mock.png`);

export const createNote = (dir: string, name: string): Promise<string> =>
  isTauri ? invoke("create_note", { dir, name }) : mock.createNote(dir, name);

export const listFolders = (dir: string): Promise<Folder[]> =>
  isTauri ? invoke("list_folders", { dir }) : mock.listFolders();

export const getOrder = (): Promise<[string, number][]> =>
  isTauri ? invoke("get_order") : mock.getOrder();

export const setOrder = (paths: string[]): Promise<void> =>
  isTauri ? invoke("set_order", { paths }) : mock.setOrder(paths);

export const getTitles = (): Promise<[string, string][]> =>
  isTauri ? invoke("get_titles") : mock.getTitles();

export const freezeTitle = (path: string, title: string): Promise<void> =>
  isTauri ? invoke("freeze_title", { path, title }) : mock.freezeTitle(path, title);

export const createFolder = (dir: string, name: string): Promise<string> =>
  isTauri ? invoke("create_folder", { dir, name }) : mock.createFolder(dir, name);

export const renameFolder = (path: string, newName: string): Promise<string> =>
  isTauri ? invoke("rename_folder", { path, newName }) : mock.renameFolder(path, newName);

export const moveNote = (path: string, destDir: string): Promise<string> =>
  isTauri ? invoke("move_note", { path, destDir }) : mock.moveNote(path, destDir);

export const renameNote = (path: string, newName: string): Promise<string> =>
  isTauri ? invoke("rename_note", { path, newName }) : mock.renameNote(path, newName);

export const deleteNote = (path: string): Promise<void> =>
  isTauri ? invoke("delete_note", { path }) : mock.deleteNote(path);

export const pickDirectory = async (current: string): Promise<string | null> => {
  if (!isTauri) return mock.pickDirectory();
  const chosen = await open({ directory: true, multiple: false, defaultPath: current });
  return (chosen as string | null) ?? null;
};

export const confirmDelete = (name: string): Promise<boolean> =>
  isTauri
    ? ask(`Delete "${name}"? It will be moved to the Trash.`, {
        title: "quipu",
        kind: "warning",
      })
    : Promise.resolve(window.confirm(`Delete "${name}"?`));

export const assetUrlPrefix = (dir: string): string =>
  (isTauri ? convertFileSrc(`${dir}/${ASSETS_DIR}`) : `${dir}/${ASSETS_DIR}`) + "/";

export const onNotesChanged = (
  cb: (paths: string[]) => void,
): Promise<UnlistenFn> =>
  isTauri
    ? listen<string[]>("notes-changed", (e) => cb(e.payload))
    : Promise.resolve(() => {});
