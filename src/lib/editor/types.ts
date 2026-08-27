// Framework-agnostic editor contract. Swapping the underlying editor means
// providing a new EditorAdapter; nothing else in the app depends on Crepe.

export interface EditorInstance {
  /** Current document as markdown (display form — asset URLs, not relative paths). */
  getMarkdown(): string;
  /** Insert an image at the current selection. */
  insertImage(url: string): void;
  /** Tear down and release resources. */
  destroy(): void;
}

export interface CreateEditorOptions {
  root: HTMLElement;
  /** Initial markdown (display form). */
  defaultValue: string;
  placeholder?: string;
  /** Fired whenever the document changes; receives display-form markdown. */
  onChange: (markdown: string) => void;
  /** Persist a dropped/pasted image and return the URL to render it by. */
  onUploadImage: (file: File) => Promise<string>;
}

export interface EditorAdapter {
  create(options: CreateEditorOptions): Promise<EditorInstance>;
}
