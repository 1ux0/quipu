import { useNotes } from "../store/notesStore";
import { confirmDelete } from "../lib/commands";
import { INDENT, type TreeUi } from "./treeUi";
import { RenameInput } from "./RenameInput";
import { Menu } from "./Menu";

export function FolderRow({
  node,
  depth,
  ui,
}: {
  node: { name: string; path: string };
  depth: number;
  ui: TreeUi;
}) {
  const remove = useNotes((s) => s.remove);
  const newNote = useNotes((s) => s.newNote);
  const newFolder = useNotes((s) => s.newFolder);
  const open = !ui.collapsed.has(node.path);
  const dt = ui.drag.dropTarget;
  const isTarget = dt?.path === node.path;

  if (ui.editing?.path === node.path) {
    return <RenameInput depth={depth} ui={ui} />;
  }

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", node.path);
        e.dataTransfer.effectAllowed = "move";
        ui.drag.start(node.path);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        ui.drag.over(node.path, true, e.clientY, e.currentTarget.getBoundingClientRect());
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        ui.drag.drop();
      }}
      onDragEnd={ui.drag.end}
      className={`group relative flex items-center py-1.5 pl-3 pr-2 font-ui text-sm ${
        isTarget && dt.place === "into" ? "bg-slate/20" : "hover:bg-slate/10"
      }`}
    >
      {isTarget && dt.place === "before" && (
        <span className="absolute inset-x-0 top-0 h-0.5 bg-blue-700" />
      )}
      {isTarget && dt.place === "after" && (
        <span className="absolute inset-x-0 bottom-0 h-0.5 bg-blue-700" />
      )}
      <button
        onClick={() => ui.toggle(node.path)}
        onDoubleClick={() => ui.startRename(node.path, node.name, true)}
        style={{ paddingLeft: depth * INDENT }}
        className="flex min-w-0 flex-1 items-center overflow-hidden text-left"
      >
        <span className="w-4 shrink-0 text-ink/50">{open ? "▾" : "▸"}</span>
        <span className="truncate">{node.name}</span>
      </button>
      <div className="hidden shrink-0 items-center group-hover:flex">
        <Menu
          trigger="⋮"
          title="Folder actions"
          items={[
            { label: "Add file", onClick: () => newNote(node.path) },
            { label: "Add folder", onClick: () => newFolder(node.path) },
            {
              label: "Delete",
              onClick: async () => {
                if (await confirmDelete(node.name)) await remove(node.path);
              },
            },
          ]}
        />
      </div>
    </div>
  );
}
