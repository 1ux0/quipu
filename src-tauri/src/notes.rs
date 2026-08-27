use crate::config::ASSETS_DIR;
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

#[derive(Debug, Serialize, PartialEq)]
pub struct Note {
    pub path: String,
    pub name: String,
    pub title: String,
    pub modified: u64,
    pub created: u64,
}

#[derive(Debug, Serialize, PartialEq)]
pub struct Folder {
    pub path: String,
    pub name: String,
    pub created: u64,
}

fn secs(time: Option<std::time::SystemTime>) -> u64 {
    time.and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

fn is_markdown(path: &Path) -> bool {
    matches!(
        path.extension().and_then(|e| e.to_str()),
        Some("md") | Some("markdown")
    )
}

fn title_from_contents(contents: &str, fallback: &str) -> String {
    for line in contents.lines() {
        let title = line.trim_start().trim_start_matches('#').trim();
        if !title.is_empty() {
            return title.to_string();
        }
    }
    fallback.to_string()
}

fn collect_markdown(dir: &Path, out: &mut Vec<PathBuf>) {
    let Ok(entries) = fs::read_dir(dir) else { return };
    for entry in entries.flatten() {
        let path = entry.path();
        let name = entry.file_name();
        let name = name.to_string_lossy();
        if name.starts_with('.') {
            continue;
        }
        if path.is_dir() {
            if name != ASSETS_DIR {
                collect_markdown(&path, out);
            }
        } else if is_markdown(&path) {
            out.push(path);
        }
    }
}

pub fn markdown_files(root: &Path) -> Vec<PathBuf> {
    let mut out = Vec::new();
    collect_markdown(root, &mut out);
    out
}

fn note_from_path(path: &Path) -> Note {
    let name = path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("untitled")
        .to_string();
    let contents = fs::read_to_string(path).unwrap_or_default();
    let meta = fs::metadata(path).ok();
    let modified = secs(meta.as_ref().and_then(|m| m.modified().ok()));
    let created = secs(meta.as_ref().and_then(|m| m.created().ok()));
    Note {
        path: path.to_string_lossy().to_string(),
        title: title_from_contents(&contents, &name),
        name,
        modified,
        created,
    }
}

pub fn list_notes(dir: &Path) -> Result<Vec<Note>, String> {
    fs::read_dir(dir).map_err(|e| e.to_string())?;
    let mut notes: Vec<Note> = markdown_files(dir).iter().map(|p| note_from_path(p)).collect();
    notes.sort_by(|a, b| b.modified.cmp(&a.modified).then(a.name.cmp(&b.name)));
    Ok(notes)
}

pub fn read_note(path: &Path) -> Result<String, String> {
    fs::read_to_string(path).map_err(|e| e.to_string())
}

pub fn create_note(dir: &Path, name: &str) -> Result<PathBuf, String> {
    let base = if name.trim().is_empty() { "untitled" } else { name.trim() };
    let mut candidate = dir.join(format!("{base}.md"));
    let mut n = 2;
    while candidate.exists() {
        candidate = dir.join(format!("{base} {n}.md"));
        n += 1;
    }
    fs::write(&candidate, "").map_err(|e| e.to_string())?;
    Ok(candidate)
}

pub fn rename_note(path: &Path, new_name: &str) -> Result<PathBuf, String> {
    let name = new_name.trim();
    if name.is_empty() {
        return Err("name cannot be empty".into());
    }
    let parent = path.parent().ok_or("invalid path")?;
    let target = parent.join(format!("{name}.md"));
    if target.exists() && target != path {
        return Err("a note with that name already exists".into());
    }
    fs::rename(path, &target).map_err(|e| e.to_string())?;
    Ok(target)
}

fn collect_dirs(dir: &Path, out: &mut Vec<PathBuf>) {
    let Ok(entries) = fs::read_dir(dir) else { return };
    for entry in entries.flatten() {
        let path = entry.path();
        let name = entry.file_name();
        let name = name.to_string_lossy();
        if name.starts_with('.') || !path.is_dir() || name == ASSETS_DIR {
            continue;
        }
        out.push(path.clone());
        collect_dirs(&path, out);
    }
}

pub fn list_folders(root: &Path) -> Vec<Folder> {
    let mut out = Vec::new();
    collect_dirs(root, &mut out);
    out.into_iter()
        .map(|p| {
            let name = p.file_name().and_then(|s| s.to_str()).unwrap_or("").to_string();
            let created = secs(fs::metadata(&p).ok().and_then(|m| m.created().ok()));
            Folder {
                path: p.to_string_lossy().to_string(),
                name,
                created,
            }
        })
        .collect()
}

pub fn create_folder(parent: &Path, name: &str) -> Result<PathBuf, String> {
    let base = if name.trim().is_empty() { "untitled" } else { name.trim() };
    let mut candidate = parent.join(base);
    let mut n = 2;
    while candidate.exists() {
        candidate = parent.join(format!("{base} {n}"));
        n += 1;
    }
    fs::create_dir(&candidate).map_err(|e| e.to_string())?;
    Ok(candidate)
}

pub fn rename_folder(path: &Path, new_name: &str) -> Result<PathBuf, String> {
    let name = new_name.trim();
    if name.is_empty() {
        return Err("name cannot be empty".into());
    }
    let parent = path.parent().ok_or("invalid path")?;
    let target = parent.join(name);
    if target.exists() && target != path {
        return Err("a folder with that name already exists".into());
    }
    fs::rename(path, &target).map_err(|e| e.to_string())?;
    Ok(target)
}

pub fn move_note(path: &Path, dest_dir: &Path) -> Result<PathBuf, String> {
    let file_name = path.file_name().ok_or("invalid path")?;
    let mut target = dest_dir.join(file_name);
    if target == path {
        return Ok(target);
    }
    let stem = path.file_stem().and_then(|s| s.to_str()).unwrap_or("untitled").to_string();
    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("md").to_string();
    let mut n = 2;
    while target.exists() {
        target = dest_dir.join(format!("{stem} {n}.{ext}"));
        n += 1;
    }
    fs::create_dir_all(dest_dir).map_err(|e| e.to_string())?;
    fs::rename(path, &target).map_err(|e| e.to_string())?;
    Ok(target)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn lists_only_markdown_files() {
        let dir = tempdir().unwrap();
        fs::write(dir.path().join("a.md"), "# Alpha").unwrap();
        fs::write(dir.path().join("b.txt"), "ignore me").unwrap();
        let notes = list_notes(dir.path()).unwrap();
        assert_eq!(notes.len(), 1);
        assert_eq!(notes[0].title, "Alpha");
    }

    #[test]
    fn first_line_becomes_title() {
        let dir = tempdir().unwrap();
        fs::write(dir.path().join("n.md"), "just body text\nmore").unwrap();
        let notes = list_notes(dir.path()).unwrap();
        assert_eq!(notes[0].title, "just body text");
    }

    #[test]
    fn heading_markers_are_stripped_from_title() {
        let dir = tempdir().unwrap();
        fs::write(dir.path().join("n.md"), "## Heading Note\nbody").unwrap();
        let notes = list_notes(dir.path()).unwrap();
        assert_eq!(notes[0].title, "Heading Note");
    }

    #[test]
    fn lists_notes_in_subfolders_but_not_assets() {
        let dir = tempdir().unwrap();
        fs::write(dir.path().join("root.md"), "# Root").unwrap();
        fs::create_dir_all(dir.path().join("sub/deep")).unwrap();
        fs::write(dir.path().join("sub/child.md"), "# Child").unwrap();
        fs::write(dir.path().join("sub/deep/grand.md"), "# Grand").unwrap();
        fs::create_dir_all(dir.path().join(".assets")).unwrap();
        fs::write(dir.path().join(".assets/note.md"), "# Hidden").unwrap();

        let titles: Vec<_> = list_notes(dir.path())
            .unwrap()
            .into_iter()
            .map(|n| n.title)
            .collect();
        assert!(titles.contains(&"Root".to_string()));
        assert!(titles.contains(&"Child".to_string()));
        assert!(titles.contains(&"Grand".to_string()));
        assert!(!titles.contains(&"Hidden".to_string()));
    }

    #[test]
    fn lists_folders_excluding_assets_and_hidden() {
        let dir = tempdir().unwrap();
        fs::create_dir_all(dir.path().join("a/b")).unwrap();
        fs::create_dir_all(dir.path().join(".assets")).unwrap();
        fs::create_dir_all(dir.path().join(".hidden")).unwrap();
        let folders = list_folders(dir.path());
        assert!(folders.iter().any(|f| f.path.ends_with("/a")));
        assert!(folders.iter().any(|f| f.path.ends_with("/a/b")));
        assert!(!folders.iter().any(|f| f.path.ends_with("/.assets")));
        assert!(!folders.iter().any(|f| f.path.ends_with("/.hidden")));
    }

    #[test]
    fn create_folder_avoids_collision() {
        let dir = tempdir().unwrap();
        let a = create_folder(dir.path(), "notes").unwrap();
        let b = create_folder(dir.path(), "notes").unwrap();
        assert_ne!(a, b);
        assert!(a.is_dir() && b.is_dir());
    }

    #[test]
    fn move_note_into_subfolder() {
        let dir = tempdir().unwrap();
        let note = create_note(dir.path(), "n").unwrap();
        let sub = create_folder(dir.path(), "sub").unwrap();
        let moved = move_note(&note, &sub).unwrap();
        assert!(moved.exists() && !note.exists());
        assert!(moved.starts_with(&sub));
    }

    #[test]
    fn empty_note_falls_back_to_filename() {
        let dir = tempdir().unwrap();
        fs::write(dir.path().join("blank.md"), "\n\n").unwrap();
        let notes = list_notes(dir.path()).unwrap();
        assert_eq!(notes[0].title, "blank");
    }

    #[test]
    fn create_avoids_overwriting() {
        let dir = tempdir().unwrap();
        let first = create_note(dir.path(), "note").unwrap();
        let second = create_note(dir.path(), "note").unwrap();
        assert_ne!(first, second);
        assert!(first.exists() && second.exists());
    }

    #[test]
    fn read_note_returns_contents() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("x.md");
        fs::write(&path, "# Hi\n\nbody").unwrap();
        assert_eq!(read_note(&path).unwrap(), "# Hi\n\nbody");
    }

    #[test]
    fn rename_moves_file_and_rejects_collision() {
        let dir = tempdir().unwrap();
        let a = create_note(dir.path(), "a").unwrap();
        let b = create_note(dir.path(), "b").unwrap();
        assert!(rename_note(&a, "b").is_err());
        let renamed = rename_note(&a, "c").unwrap();
        assert!(renamed.exists() && !a.exists());
        drop(b);
    }
}
