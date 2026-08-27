import { useNotes } from "../store/notesStore";
import { abbreviateHome } from "../lib/path";

export function TargetSelector() {
  const targetDir = useNotes((s) => s.targetDir);
  const homeDir = useNotes((s) => s.homeDir);
  const pickTargetDir = useNotes((s) => s.pickTargetDir);
  const newFolder = useNotes((s) => s.newFolder);

  const display = targetDir ? abbreviateHome(targetDir, homeDir) : "…";

  return (
    <div className="group relative border-b border-line">
      <button
        onClick={pickTargetDir}
        title={targetDir}
        className="block w-full px-3 py-2 text-left group-hover:bg-slate/10"
      >
        <span className="block font-ui text-[10px] uppercase tracking-widest opacity-50">
          target
        </span>
        <span className="block break-all pr-5 font-ui text-sm">{display}</span>
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          newFolder(targetDir);
        }}
        title="New folder"
        className="absolute right-3 top-1/2 z-10 hidden -translate-y-1/2 font-ui text-base leading-none text-ink hover:text-ink/60 group-hover:block"
      >
        +
      </button>
    </div>
  );
}
