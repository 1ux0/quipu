use crate::config::DEFAULT_DIR_SEGMENTS;
use std::fs;
use std::path::{Path, PathBuf};

pub fn default_target_dir() -> PathBuf {
    let mut dir = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    for segment in DEFAULT_DIR_SEGMENTS {
        dir.push(segment);
    }
    dir
}

pub fn ensure_dir(dir: &Path) -> Result<(), String> {
    fs::create_dir_all(dir).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_target_dir_ends_with_segments() {
        let dir = default_target_dir();
        assert!(dir.ends_with(".quipu"));
    }
}
