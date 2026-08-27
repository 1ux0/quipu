import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { toDisplay, toStorage } from "../lib/assetsMarkdown";
import { editorAdapter, type EditorInstance } from "../lib/editor";
import { useCopyFeedback } from "../hooks/useCopyFeedback";

export interface EditorHandle {
  insertImage: (displayUrl: string) => void;
  getMarkdown: () => string;
}

interface Props {
  notePath: string;
  content: string;
  token: number;
  assetPrefix: string;
  onSave: (path: string, markdown: string) => void;
  onUpload: (file: File) => Promise<string>;
}

const DEBOUNCE_MS = 500;

export const Editor = forwardRef<EditorHandle, Props>(function Editor(
  { notePath, content, token, assetPrefix, onSave, onUpload },
  ref,
) {
  const rootRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<EditorInstance | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<string | null>(null);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;
  const onUploadRef = useRef(onUpload);
  onUploadRef.current = onUpload;

  useCopyFeedback(rootRef);

  useImperativeHandle(ref, () => ({
    insertImage: (displayUrl) => instanceRef.current?.insertImage(displayUrl),
    getMarkdown: () => toStorage(instanceRef.current?.getMarkdown() ?? "", assetPrefix),
  }));

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const path = notePath;
    const prefix = assetPrefix;
    const initial = content;
    let disposed = false;

    const flush = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      if (pending.current !== null) {
        onSaveRef.current(path, pending.current);
        pending.current = null;
      }
    };

    editorAdapter
      .create({
        root,
        defaultValue: toDisplay(initial, prefix),
        placeholder: "Type anything",
        onUploadImage: (file) => onUploadRef.current(file),
        onChange: (markdown) => {
          const stored = toStorage(markdown, prefix);
          if (stored === initial) return;
          pending.current = stored;
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(flush, DEBOUNCE_MS);
        },
      })
      .then((instance) => {
        if (disposed) {
          instance.destroy();
          return;
        }
        instanceRef.current = instance;
      });

    return () => {
      disposed = true;
      flush();
      const instance = instanceRef.current;
      instanceRef.current = null;
      instance?.destroy();
    };
  }, [token]);

  return <div ref={rootRef} className="quipu-editor h-full overflow-auto" />;
});
