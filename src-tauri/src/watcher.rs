use notify::{EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};

pub type SelfWrites = Arc<Mutex<HashMap<PathBuf, Instant>>>;

const SELF_WRITE_WINDOW: Duration = Duration::from_millis(1500);

pub fn record_self_write(self_writes: &SelfWrites, path: &Path) {
    if let Ok(mut map) = self_writes.lock() {
        map.insert(path.to_path_buf(), Instant::now());
    }
}

fn is_recent_self_write(self_writes: &SelfWrites, path: &Path) -> bool {
    if let Ok(mut map) = self_writes.lock() {
        if let Some(t) = map.get(path).copied() {
            if t.elapsed() < SELF_WRITE_WINDOW {
                return true;
            }
            map.remove(path);
        }
    }
    false
}

fn is_markdownish(path: &Path) -> bool {
    matches!(
        path.extension().and_then(|e| e.to_str()),
        Some("md") | Some("markdown")
    )
}

pub fn watch_dir(
    app: AppHandle,
    dir: &Path,
    self_writes: SelfWrites,
) -> Result<RecommendedWatcher, String> {
    let sw = self_writes.clone();
    let mut watcher =
        notify::recommended_watcher(move |res: notify::Result<notify::Event>| {
            let Ok(event) = res else { return };
            if !matches!(
                event.kind,
                EventKind::Create(_) | EventKind::Modify(_) | EventKind::Remove(_)
            ) {
                return;
            }
            let changed: Vec<String> = event
                .paths
                .iter()
                .filter(|p| is_markdownish(p))
                .filter(|p| !is_recent_self_write(&sw, p))
                .map(|p| p.to_string_lossy().to_string())
                .collect();
            if !changed.is_empty() {
                let _ = app.emit("notes-changed", changed);
            }
        })
        .map_err(|e| e.to_string())?;
    watcher
        .watch(dir, RecursiveMode::NonRecursive)
        .map_err(|e| e.to_string())?;
    Ok(watcher)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn self_writes_are_filtered_within_window() {
        let sw: SelfWrites = Arc::new(Mutex::new(HashMap::new()));
        let path = PathBuf::from("/tmp/quipu/a.md");
        record_self_write(&sw, &path);
        assert!(is_recent_self_write(&sw, &path));
        assert!(!is_recent_self_write(&sw, &PathBuf::from("/tmp/quipu/b.md")));
    }
}
