import { beforeEach, describe, expect, it } from "vitest";
import { useNotes } from "./notesStore";
import { mock } from "../lib/mockBackend";

beforeEach(() => {
  mock.reset();
  useNotes.setState({
    targetDir: "",
    notes: [],
    openNotePath: null,
    openContent: null,
    loadToken: 0,
    ready: false,
  });
});

describe("notesStore", () => {
  it("init resolves the target dir and lists notes", async () => {
    await useNotes.getState().init();
    expect(useNotes.getState().targetDir).toBe("/quipu");
    expect(useNotes.getState().notes.length).toBeGreaterThan(0);
  });

  it("changing the target dir blanks the open note", async () => {
    await useNotes.getState().init();
    const first = useNotes.getState().notes[0].path;
    await useNotes.getState().openNote(first);
    expect(useNotes.getState().openNotePath).toBe(first);

    await useNotes.getState().changeTargetDir("/elsewhere");
    expect(useNotes.getState().openNotePath).toBeNull();
    expect(useNotes.getState().openContent).toBeNull();
  });

  it("newNote creates a note and opens it", async () => {
    await useNotes.getState().init();
    const before = useNotes.getState().notes.length;
    await useNotes.getState().newNote();
    expect(useNotes.getState().notes.length).toBe(before + 1);
    expect(useNotes.getState().openNotePath).toContain("untitled");
  });

  it("removing the open note clears the panel", async () => {
    await useNotes.getState().init();
    const first = useNotes.getState().notes[0].path;
    await useNotes.getState().openNote(first);
    await useNotes.getState().remove(first);
    expect(useNotes.getState().openNotePath).toBeNull();
  });
});
