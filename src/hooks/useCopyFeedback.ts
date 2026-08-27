import { useEffect, type RefObject } from "react";

const FEEDBACK_MS = 2000;

export function useCopyFeedback(rootRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const onClick = (e: MouseEvent) => {
      const btn = (e.target as HTMLElement).closest(".copy-button");
      if (!btn) return;
      btn.classList.add("quipu-copied");
      window.setTimeout(() => btn.classList.remove("quipu-copied"), FEEDBACK_MS);
    };
    root.addEventListener("click", onClick);
    return () => root.removeEventListener("click", onClick);
  }, [rootRef]);
}
