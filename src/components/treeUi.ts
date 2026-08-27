export type DropPlace = "before" | "after" | "into";

export interface DragState {
  dragging: string | null;
  dropTarget: { path: string; place: DropPlace } | null;
  start: (path: string) => void;
  over: (path: string, isFolder: boolean, clientY: number, rect: DOMRect) => void;
  end: () => void;
  drop: () => void;
}

export interface TreeUi {
  collapsed: Set<string>;
  toggle: (path: string) => void;
  editing: { path: string; isDir: boolean } | null;
  draft: string;
  startRename: (path: string, title: string, isDir: boolean) => void;
  setDraft: (v: string) => void;
  commitRename: () => void;
  cancelRename: () => void;
  drag: DragState;
}

export const INDENT = 10;

export function dropPlace(isFolder: boolean, clientY: number, rect: DOMRect): DropPlace {
  const rel = (clientY - rect.top) / rect.height;
  if (isFolder && rel > 0.25 && rel < 0.75) return "into";
  return rel < 0.5 ? "before" : "after";
}
