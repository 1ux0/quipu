import { useEffect, useRef, useState } from "react";
import { useNotes } from "./store/notesStore";
import { Sidebar } from "./components/Sidebar";
import { Editor, type EditorHandle } from "./components/Editor";
import { MarkdownView } from "./components/MarkdownView";
import { BlankPanel } from "./components/BlankPanel";
import { onNotesChanged, importAssetBytes, assetUrlPrefix } from "./lib/commands";
import { ASSETS_DIR } from "./lib/config";

function App() {
  const ready = useNotes((s) => s.ready);
  const init = useNotes((s) => s.init);
  const handleExternalChange = useNotes((s) => s.handleExternalChange);
  const collapsed = useNotes((s) => s.sidebarCollapsed);
  const toggleSidebar = useNotes((s) => s.toggleSidebar);
  const openNotePath = useNotes((s) => s.openNotePath);
  const openContent = useNotes((s) => s.openContent);
  const loadToken = useNotes((s) => s.loadToken);
  const targetDir = useNotes((s) => s.targetDir);
  const savePath = useNotes((s) => s.savePath);
  const openNote = useNotes((s) => s.openNote);

  const editorRef = useRef<EditorHandle>(null);
  const [showMarkdown, setShowMarkdown] = useState(false);
  const [markdownSource, setMarkdownSource] = useState("");
  const markdownRef = useRef("");
  const mdSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const SIDEBAR_DEFAULT = 256;
  const SIDEBAR_MIN = 170;
  const SIDEBAR_MAX = 420;
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT);
  const resizing = useRef(false);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!resizing.current) return;
      setSidebarWidth(Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, e.clientX)));
    };
    const onUp = () => {
      resizing.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    setShowMarkdown(false);
  }, [openNotePath]);

  const setMode = async (markdown: boolean) => {
    if (markdown === showMarkdown) return;
    if (markdown) {
      const md = editorRef.current?.getMarkdown() ?? openContent ?? "";
      markdownRef.current = md;
      setMarkdownSource(md);
      setShowMarkdown(true);
    } else {
      if (mdSaveTimer.current) clearTimeout(mdSaveTimer.current);
      if (openNotePath) {
        await savePath(openNotePath, markdownRef.current);
        await openNote(openNotePath);
      }
      setShowMarkdown(false);
    }
  };

  const handleMarkdownChange = (v: string) => {
    markdownRef.current = v;
    setMarkdownSource(v);
    if (mdSaveTimer.current) clearTimeout(mdSaveTimer.current);
    const path = openNotePath;
    mdSaveTimer.current = setTimeout(() => {
      if (path) savePath(path, v);
    }, 500);
  };

  useEffect(() => {
    const unlisten = onNotesChanged((paths) => handleExternalChange(paths));
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [handleExternalChange]);

  const uploadImage = async (file: File) => {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const rel = await importAssetBytes(targetDir, file.name, bytes);
    return assetUrlPrefix(targetDir) + rel.slice(`${ASSETS_DIR}/`.length);
  };

  if (!ready) return null;

  return (
    <div className="relative flex h-screen bg-paper font-mono text-ink">
      {!collapsed && <Sidebar width={sidebarWidth} />}
      {!collapsed && (
        <div
          onMouseDown={() => {
            resizing.current = true;
            document.body.style.cursor = "col-resize";
            document.body.style.userSelect = "none";
          }}
          title="Drag to resize"
          style={{ left: sidebarWidth }}
          className="absolute top-0 z-30 h-full w-2 -translate-x-1/2 cursor-col-resize hover:bg-slate/20"
        />
      )}
      <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-paper">
        <div className="flex h-10 items-center justify-between border-b border-line px-3">
          <div>
            {collapsed && (
              <button
                onClick={toggleSidebar}
                title="Show sidebar"
                className="flex h-6 w-6 items-center justify-center text-ink hover:opacity-60"
              >
                <svg viewBox="0 0 16 16" width="15" height="15" fill="none" aria-hidden>
                  <path
                    d="M8 3.5 12.5 8 8 12.5M3.5 3.5 8 8 3.5 12.5"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            )}
          </div>
          {openNotePath && openContent !== null && (
            <button
              onClick={() => setMode(!showMarkdown)}
              title={showMarkdown ? "Markdown source" : "Formatted preview"}
              className={`relative h-5 w-9 rounded-full transition-colors ${
                showMarkdown ? "bg-slate" : "bg-slate/25"
              }`}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-paper transition-all ${
                  showMarkdown ? "left-[18px]" : "left-0.5"
                }`}
              />
            </button>
          )}
        </div>
        <div className="min-h-0 flex-1">
          {openNotePath && openContent !== null ? (
            <>
              <div className={showMarkdown ? "hidden" : "h-full"}>
                <Editor
                  ref={editorRef}
                  notePath={openNotePath}
                  content={openContent}
                  token={loadToken}
                  assetPrefix={assetUrlPrefix(targetDir)}
                  onSave={savePath}
                  onUpload={uploadImage}
                />
              </div>
              {showMarkdown && (
                <MarkdownView value={markdownSource} onChange={handleMarkdownChange} />
              )}
            </>
          ) : (
            <BlankPanel />
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
