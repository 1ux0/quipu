import { crepeAdapter } from "./crepeAdapter";
import type { EditorAdapter } from "./types";

// The active editor implementation. Swap this to change editors app-wide.
export const editorAdapter: EditorAdapter = crepeAdapter;

export type { EditorInstance, CreateEditorOptions, EditorAdapter } from "./types";
