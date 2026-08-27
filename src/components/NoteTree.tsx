import type { TreeNode } from "../lib/tree";
import type { TreeUi } from "./treeUi";
import { NoteRow } from "./NoteRow";
import { FolderRow } from "./FolderRow";

export function NoteTree({
  nodes,
  depth,
  ui,
}: {
  nodes: TreeNode[];
  depth: number;
  ui: TreeUi;
}) {
  return (
    <ul>
      {nodes.map((node) => {
        if (node.kind === "note") {
          return (
            <li key={node.note.path}>
              <NoteRow note={node.note} depth={depth} ui={ui} />
            </li>
          );
        }
        const open = !ui.collapsed.has(node.path);
        return (
          <li key={`d:${node.path}`}>
            <FolderRow node={node} depth={depth} ui={ui} />
            {open && <NoteTree nodes={node.children} depth={depth + 1} ui={ui} />}
          </li>
        );
      })}
    </ul>
  );
}
