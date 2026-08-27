import { INDENT, type TreeUi } from "./treeUi";

export function RenameInput({ depth, ui }: { depth: number; ui: TreeUi }) {
  return (
    <div className="flex items-center py-1.5 pl-3 pr-2 font-ui text-sm">
      <span style={{ paddingLeft: depth * INDENT }} />
      <span className="w-4 shrink-0" />
      <input
        autoFocus
        value={ui.draft}
        onChange={(e) => ui.setDraft(e.target.value)}
        onBlur={ui.commitRename}
        onKeyDown={(e) => {
          if (e.key === "Enter") ui.commitRename();
          if (e.key === "Escape") ui.cancelRename();
        }}
        className="min-w-0 flex-1 bg-paper outline-none"
      />
    </div>
  );
}
