import { useNotes } from "../store/notesStore";
import { confirmDelete } from "../lib/commands";
import type { Note } from "../lib/types";
import { INDENT, type TreeUi } from "./treeUi";
import { RenameInput } from "./RenameInput";

export function NoteRow({
  note,
  depth,
  ui,
}: {
  note: Note;
  depth: number;
  ui: TreeUi;
}) {
  const openNotePath = useNotes((s) => s.openNotePath);
  const openNote = useNotes((s) => s.openNote);
  const remove = useNotes((s) => s.remove);
  const frozen = useNotes((s) => s.titles[note.path]);
  const title = frozen ?? note.title;
  const active = note.path === openNotePath;
  const dt = ui.drag.dropTarget;

  if (ui.editing?.path === note.path) {
    return <RenameInput depth={depth} ui={ui} />;
  }

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", note.path);
        e.dataTransfer.effectAllowed = "move";
        ui.drag.start(note.path);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        ui.drag.over(note.path, false, e.clientY, e.currentTarget.getBoundingClientRect());
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        ui.drag.drop();
      }}
      onDragEnd={ui.drag.end}
      className={`group relative flex items-center py-1.5 pl-3 pr-2 font-ui text-sm ${
        active ? "bg-slate/10" : "hover:bg-slate/10"
      }`}
    >
      {dt?.path === note.path && dt.place === "before" && (
        <span className="absolute inset-x-0 top-0 h-0.5 bg-blue-700" />
      )}
      {dt?.path === note.path && dt.place === "after" && (
        <span className="absolute inset-x-0 bottom-0 h-0.5 bg-blue-700" />
      )}
      <button
        onClick={() => openNote(note.path)}
        onDoubleClick={() => ui.startRename(note.path, title, false)}
        style={{ paddingLeft: depth * INDENT }}
        className="flex min-w-0 flex-1 items-center overflow-hidden text-left"
      >
        <span className="w-4 shrink-0" />
        <span className="truncate">{title}</span>
      </button>
      <button
        onClick={async (e) => {
          e.stopPropagation();
          if (await confirmDelete(title)) await remove(note.path);
        }}
        title="Delete"
        className="hidden shrink-0 px-1 text-xs text-ink hover:text-ink/60 group-hover:block"
      >
        ✕
      </button>
    </div>
  );
}
