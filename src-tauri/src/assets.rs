use crate::config::ASSETS_DIR;
use std::fs;
use std::path::{Path, PathBuf};
use uuid::Uuid;

pub fn assets_path(target_dir: &Path) -> PathBuf {
    target_dir.join(ASSETS_DIR)
}

fn asset_dest(target_dir: &Path, ext: &str) -> Result<(PathBuf, String), String> {
    let assets = assets_path(target_dir);
    fs::create_dir_all(&assets).map_err(|e| e.to_string())?;
    let file_name = format!("{}.{}", Uuid::new_v4(), ext.to_lowercase());
    Ok((assets.join(&file_name), format!("{ASSETS_DIR}/{file_name}")))
}

pub fn import_asset(target_dir: &Path, src: &Path) -> Result<String, String> {
    let ext = src.extension().and_then(|e| e.to_str()).unwrap_or("bin");
    let (dest, rel) = asset_dest(target_dir, ext)?;
    fs::copy(src, dest).map_err(|e| e.to_string())?;
    Ok(rel)
}

pub fn import_asset_bytes(target_dir: &Path, orig_name: &str, data: &[u8]) -> Result<String, String> {
    let ext = Path::new(orig_name)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("bin");
    let (dest, rel) = asset_dest(target_dir, ext)?;
    fs::write(dest, data).map_err(|e| e.to_string())?;
    Ok(rel)
}

// Delete asset files whose filename (a UUID, never percent-encoded) does not
// appear in any note. Matching the bare filename means a referenced image is
// kept regardless of how the note stores the link (relative path or asset URL).
pub fn gc_assets(dir: &Path) -> Result<(), String> {
    let assets = assets_path(dir);
    if !assets.is_dir() {
        return Ok(());
    }
    let mut haystack = String::new();
    for path in crate::notes::markdown_files(dir) {
        if let Ok(contents) = fs::read_to_string(&path) {
            haystack.push_str(&contents);
            haystack.push('\n');
        }
    }
    for entry in fs::read_dir(&assets).map_err(|e| e.to_string())?.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
        if !name.is_empty() && !haystack.contains(name) {
            let _ = fs::remove_file(&path);
        }
    }
    Ok(())
}

pub fn write_note_atomic(path: &Path, contents: &str) -> Result<(), String> {
    let parent = path.parent().ok_or("invalid path")?;
    let tmp = parent.join(format!(".quipu-{}.tmp", Uuid::new_v4()));
    fs::write(&tmp, contents).map_err(|e| e.to_string())?;
    fs::rename(&tmp, path).map_err(|e| {
        let _ = fs::remove_file(&tmp);
        e.to_string()
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn import_copies_with_uuid_name_and_relative_ref() {
        let dir = tempdir().unwrap();
        let src = dir.path().join("photo.PNG");
        fs::write(&src, b"bytes").unwrap();
        let rel = import_asset(dir.path(), &src).unwrap();
        assert!(rel.starts_with(".assets/"));
        assert!(rel.ends_with(".png"));
        assert!(assets_path(dir.path()).join(rel.strip_prefix(".assets/").unwrap()).exists());
    }

    #[test]
    fn gc_removes_unreferenced_keeps_referenced() {
        let dir = tempdir().unwrap();
        let assets = assets_path(dir.path());
        fs::create_dir_all(&assets).unwrap();
        fs::write(assets.join("keep.png"), b"x").unwrap();
        fs::write(assets.join("drop.png"), b"x").unwrap();
        fs::write(dir.path().join("note.md"), "![](assets/keep.png)").unwrap();
        gc_assets(dir.path()).unwrap();
        assert!(assets.join("keep.png").exists());
        assert!(!assets.join("drop.png").exists());
    }

    #[test]
    fn gc_keeps_asset_referenced_by_bare_filename() {
        let dir = tempdir().unwrap();
        let assets = assets_path(dir.path());
        fs::create_dir_all(&assets).unwrap();
        fs::write(assets.join("keep.png"), b"x").unwrap();
        fs::write(assets.join("drop.png"), b"x").unwrap();
        // Referenced via an encoded asset URL that lacks the literal "assets/".
        fs::write(
            dir.path().join("n.md"),
            "![](http://asset.localhost/Users%2Fx%2F.quipu%2Fassets%2Fkeep.png)",
        )
        .unwrap();
        gc_assets(dir.path()).unwrap();
        assert!(assets.join("keep.png").exists());
        assert!(!assets.join("drop.png").exists());
    }

    #[test]
    fn gc_respects_references_from_subfolders() {
        let dir = tempdir().unwrap();
        let assets = assets_path(dir.path());
        fs::create_dir_all(&assets).unwrap();
        fs::write(assets.join("keep.png"), b"x").unwrap();
        fs::create_dir_all(dir.path().join("sub")).unwrap();
        fs::write(dir.path().join("sub/note.md"), "![](assets/keep.png)").unwrap();
        gc_assets(dir.path()).unwrap();
        assert!(assets.join("keep.png").exists());
    }

    #[test]
    fn atomic_write_replaces_contents() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("n.md");
        write_note_atomic(&path, "one").unwrap();
        write_note_atomic(&path, "two").unwrap();
        assert_eq!(fs::read_to_string(&path).unwrap(), "two");
    }
}
