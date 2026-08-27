import { useMemo, useState } from "react";
import { useNotes } from "../store/notesStore";
import { buildTree } from "../lib/tree";
import { NoteTree } from "./NoteTree";
import { dropPlace, type DropPlace, type TreeUi } from "./treeUi";

export function NoteList() {
  const notes = useNotes((s) => s.notes);
  const folders = useNotes((s) => s.folders);
  const order = useNotes((s) => s.order);
  const targetDir = useNotes((s) => s.targetDir);
  const rename = useNotes((s) => s.rename);
  const renameFolder = useNotes((s) => s.renameFolder);
  const moveNote = useNotes((s) => s.moveNote);
  const reorder = useNotes((s) => s.reorder);

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<{ path: string; isDir: boolean } | null>(null);
  const [draft, setDraft] = useState("");
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ path: string; place: DropPlace } | null>(null);

  const tree = useMemo(() => buildTree(notes, folders, order, targetDir), [notes, folders, order, targetDir]);

  const ui: TreeUi = {
    collapsed,
    toggle: (path) =>
      setCollapsed((prev) => {
        const next = new Set(prev);
        next.has(path) ? next.delete(path) : next.add(path);
        return next;
      }),
    editing,
    draft,
    startRename: (path, title, isDir) => {
      setEditing({ path, isDir });
      setDraft(title);
    },
    setDraft,
    commitRename: () => {
      const current = editing;
      const name = draft.trim();
      setEditing(null);
      if (current && name) {
        current.isDir ? renameFolder(current.path, name) : rename(current.path, name);
      }
    },
    cancelRename: () => setEditing(null),
    drag: {
      dragging,
      dropTarget,
      start: (path) => setDragging(path),
      over: (path, isFolder, clientY, rect) => {
        if (dragging && dragging !== path) {
          setDropTarget({ path, place: dropPlace(isFolder, clientY, rect) });
        }
      },
      end: () => {
        setDragging(null);
        setDropTarget(null);
      },
      drop: () => {
        const dragged = dragging;
        const target = dropTarget;
        setDragging(null);
        setDropTarget(null);
        if (!dragged || !target || dragged === target.path) return;
        if (target.place === "into") moveNote(dragged, target.path);
        else reorder(dragged, target.path, target.place);
      },
    },
  };

  return (
    <div
      className="min-h-full py-1"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        const p = e.dataTransfer.getData("text/plain");
        if (p && !dropTarget) moveNote(p, targetDir);
        ui.drag.end();
      }}
    >
      <NoteTree nodes={tree} depth={0} ui={ui} />
    </div>
  );
}
