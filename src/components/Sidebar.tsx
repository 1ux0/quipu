import { useNotes } from "../store/notesStore";
import { TargetSelector } from "./TargetSelector";
import { NoteList } from "./NoteList";

export function Sidebar({ width }: { width: number }) {
  const targetDir = useNotes((s) => s.targetDir);
  const newNote = useNotes((s) => s.newNote);
  const toggleSidebar = useNotes((s) => s.toggleSidebar);

  return (
    <aside
      style={{ width }}
      className="relative z-10 flex h-full shrink-0 flex-col border-r border-line bg-paper"
    >
      <div className="flex h-10 items-center justify-between border-b border-line px-3">
        <span
          className="flex h-6 items-center font-ui text-[1.4rem] font-semibold leading-none text-blue-700"
          title="quipu"
        >
          {"❀︎"}
        </span>
        <div className="flex items-center gap-1 text-ink">
          <button
            onClick={() => newNote(targetDir)}
            title="New file"
            className="flex h-6 w-6 items-center justify-center hover:opacity-60"
          >
            <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden>
              <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
          <button
            onClick={toggleSidebar}
            title="Collapse sidebar"
            className="flex h-6 w-6 items-center justify-center hover:opacity-60"
          >
            <svg viewBox="0 0 16 16" width="15" height="15" fill="none" aria-hidden>
              <path
                d="M8 3.5 3.5 8 8 12.5M12.5 3.5 8 8l4.5 4.5"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>
      <TargetSelector />
      <div className="min-h-0 flex-1 overflow-auto">
        <NoteList />
      </div>
    </aside>
  );
}
