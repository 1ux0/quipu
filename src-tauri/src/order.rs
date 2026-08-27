use rusqlite::{params, Connection, OptionalExtension};
use std::path::Path;
use std::sync::Mutex;
use uuid::Uuid;

pub struct OrderDb(pub Mutex<Connection>);

const SCHEMA: &str = "
    CREATE TABLE IF NOT EXISTS settings (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS targets (
        id   INTEGER PRIMARY KEY AUTOINCREMENT,
        uuid TEXT NOT NULL,
        path TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_targets_path ON targets(path);

    CREATE TABLE IF NOT EXISTS ordering (
        id        INTEGER PRIMARY KEY AUTOINCREMENT,
        uuid      TEXT NOT NULL,
        target_id INTEGER NOT NULL REFERENCES targets(id) ON DELETE CASCADE,
        path      TEXT NOT NULL,
        parent_id INTEGER REFERENCES ordering(id) ON DELETE CASCADE,
        position  REAL NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_ordering_path ON ordering(path);
    CREATE INDEX IF NOT EXISTS idx_ordering_parent ON ordering(parent_id);
    CREATE INDEX IF NOT EXISTS idx_ordering_target ON ordering(target_id);

    CREATE TABLE IF NOT EXISTS note_titles (
        path      TEXT PRIMARY KEY,
        target_id INTEGER NOT NULL REFERENCES targets(id) ON DELETE CASCADE,
        title     TEXT NOT NULL
    );
";

pub fn open(db_path: &Path) -> Result<Connection, String> {
    let conn = Connection::open(db_path).map_err(|e| e.to_string())?;
    conn.execute_batch("PRAGMA foreign_keys = ON;").map_err(|e| e.to_string())?;
    conn.execute_batch(SCHEMA).map_err(|e| e.to_string())?;
    Ok(conn)
}

fn parent_dir(path: &str) -> String {
    Path::new(path)
        .parent()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default()
}

pub fn get_target(conn: &Connection) -> Result<Option<String>, String> {
    conn.query_row("SELECT value FROM settings WHERE key = 'target_dir'", [], |r| r.get(0))
        .optional()
        .map_err(|e| e.to_string())
}

pub fn set_target(conn: &Connection, path: &str) -> Result<(), String> {
    conn.execute(
        "INSERT INTO settings(key, value) VALUES('target_dir', ?1)
         ON CONFLICT(key) DO UPDATE SET value = ?1",
        params![path],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

fn ensure_target(conn: &Connection, target: &str) -> Result<i64, String> {
    conn.execute(
        "INSERT OR IGNORE INTO targets(uuid, path) VALUES(?1, ?2)",
        params![Uuid::new_v4().to_string(), target],
    )
    .map_err(|e| e.to_string())?;
    conn.query_row("SELECT id FROM targets WHERE path = ?1", params![target], |r| r.get(0))
        .map_err(|e| e.to_string())
}

fn target_id(conn: &Connection, target: &str) -> Result<Option<i64>, String> {
    conn.query_row("SELECT id FROM targets WHERE path = ?1", params![target], |r| r.get(0))
        .optional()
        .map_err(|e| e.to_string())
}

fn lookup_id(conn: &Connection, path: &str) -> Result<Option<i64>, String> {
    conn.query_row("SELECT id FROM ordering WHERE path = ?1", params![path], |r| r.get(0))
        .optional()
        .map_err(|e| e.to_string())
}

fn upsert(conn: &Connection, tid: i64, path: &str, position: f64) -> Result<(), String> {
    let parent_id = lookup_id(conn, &parent_dir(path))?;
    conn.execute(
        "INSERT INTO ordering(uuid, target_id, path, parent_id, position) VALUES(?1, ?2, ?3, ?4, ?5)
         ON CONFLICT(path) DO UPDATE SET target_id = ?2, parent_id = ?4, position = ?5",
        params![Uuid::new_v4().to_string(), tid, path, parent_id, position],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn assign_top(conn: &Connection, target: &str, path: &str) -> Result<(), String> {
    let tid = ensure_target(conn, target)?;
    let parent_id = lookup_id(conn, &parent_dir(path))?;
    let min: Option<f64> = conn
        .query_row(
            "SELECT MIN(position) FROM ordering WHERE target_id = ?1 AND parent_id IS ?2",
            params![tid, parent_id],
            |r| r.get::<_, Option<f64>>(0),
        )
        .optional()
        .map_err(|e| e.to_string())?
        .flatten();
    upsert(conn, tid, path, min.unwrap_or(0.0) - 1.0)
}

pub fn set_order(conn: &Connection, target: &str, paths: &[String]) -> Result<(), String> {
    let tid = ensure_target(conn, target)?;
    for (i, path) in paths.iter().enumerate() {
        upsert(conn, tid, path, i as f64)?;
    }
    Ok(())
}

pub fn rename_path(conn: &Connection, old: &str, new: &str) -> Result<(), String> {
    for table in ["ordering", "note_titles"] {
        conn.execute(
            &format!("UPDATE {table} SET path = ?2 WHERE path = ?1"),
            params![old, new],
        )
        .map_err(|e| e.to_string())?;
        conn.execute(
            &format!(
                "UPDATE {table} SET path = ?2 || substr(path, length(?1) + 1) WHERE path LIKE ?1 || '/%'"
            ),
            params![old, new],
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub fn remove_path(conn: &Connection, path: &str) -> Result<(), String> {
    for table in ["ordering", "note_titles"] {
        conn.execute(
            &format!("DELETE FROM {table} WHERE path = ?1 OR path LIKE ?1 || '/%'"),
            params![path],
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub fn freeze_title(conn: &Connection, target: &str, path: &str, title: &str) -> Result<(), String> {
    let tid = ensure_target(conn, target)?;
    conn.execute(
        "INSERT INTO note_titles(path, target_id, title) VALUES(?1, ?2, ?3)
         ON CONFLICT(path) DO NOTHING",
        params![path, tid, title],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn set_title(conn: &Connection, target: &str, path: &str, title: &str) -> Result<(), String> {
    let tid = ensure_target(conn, target)?;
    conn.execute(
        "INSERT INTO note_titles(path, target_id, title) VALUES(?1, ?2, ?3)
         ON CONFLICT(path) DO UPDATE SET title = ?3",
        params![path, tid, title],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn get_titles(conn: &Connection, target: &str) -> Result<Vec<(String, String)>, String> {
    let Some(tid) = target_id(conn, target)? else {
        return Ok(Vec::new());
    };
    let mut stmt = conn
        .prepare("SELECT path, title FROM note_titles WHERE target_id = ?1")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![tid], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<_, _>>().map_err(|e| e.to_string())
}

pub fn get_all(conn: &Connection, target: &str) -> Result<Vec<(String, f64)>, String> {
    let Some(tid) = target_id(conn, target)? else {
        return Ok(Vec::new());
    };
    let mut stmt = conn
        .prepare("SELECT path, position FROM ordering WHERE target_id = ?1")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![tid], |r| Ok((r.get::<_, String>(0)?, r.get::<_, f64>(1)?)))
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<_, _>>().map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn mem() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
        conn.execute_batch(SCHEMA).unwrap();
        conn
    }

    #[test]
    fn settings_roundtrip_target() {
        let conn = mem();
        assert_eq!(get_target(&conn).unwrap(), None);
        set_target(&conn, "/Users/x/Desktop/quipu").unwrap();
        assert_eq!(get_target(&conn).unwrap(), Some("/Users/x/Desktop/quipu".into()));
        set_target(&conn, "/Users/x/Notes").unwrap();
        assert_eq!(get_target(&conn).unwrap(), Some("/Users/x/Notes".into()));
    }

    #[test]
    fn freeze_title_only_sets_once_but_set_title_overwrites() {
        let conn = mem();
        freeze_title(&conn, "/d", "/d/n.md", "First Title").unwrap();
        freeze_title(&conn, "/d", "/d/n.md", "Changed").unwrap();
        let map: std::collections::HashMap<_, _> = get_titles(&conn, "/d").unwrap().into_iter().collect();
        assert_eq!(map["/d/n.md"], "First Title");
        set_title(&conn, "/d", "/d/n.md", "Renamed").unwrap();
        let map2: std::collections::HashMap<_, _> = get_titles(&conn, "/d").unwrap().into_iter().collect();
        assert_eq!(map2["/d/n.md"], "Renamed");
    }

    #[test]
    fn rename_and_remove_maintain_titles() {
        let conn = mem();
        freeze_title(&conn, "/d", "/d/a.md", "A").unwrap();
        rename_path(&conn, "/d/a.md", "/d/b.md").unwrap();
        let map: std::collections::HashMap<_, _> = get_titles(&conn, "/d").unwrap().into_iter().collect();
        assert_eq!(map.get("/d/b.md").map(String::as_str), Some("A"));
        remove_path(&conn, "/d/b.md").unwrap();
        assert!(get_titles(&conn, "/d").unwrap().is_empty());
    }

    #[test]
    fn moving_a_note_preserves_its_title() {
        let conn = mem();
        freeze_title(&conn, "/t", "/t/myFile.md", "myFile").unwrap();
        set_order(&conn, "/t", &["/t/Folder".into(), "/t/myFile.md".into()]).unwrap();
        // Move = rename_path + assign_top (mirrors the move_note command).
        rename_path(&conn, "/t/myFile.md", "/t/Folder/myFile.md").unwrap();
        assign_top(&conn, "/t", "/t/Folder/myFile.md").unwrap();
        let titles: std::collections::HashMap<_, _> =
            get_titles(&conn, "/t").unwrap().into_iter().collect();
        assert_eq!(titles.get("/t/Folder/myFile.md").map(String::as_str), Some("myFile"));
        assert!(!titles.contains_key("/t/myFile.md"));
    }

    #[test]
    fn orderings_are_scoped_per_target() {
        let conn = mem();
        set_order(&conn, "/t1", &["/t1/a.md".into()]).unwrap();
        set_order(&conn, "/t2", &["/t2/b.md".into()]).unwrap();
        let t1: std::collections::HashMap<_, _> = get_all(&conn, "/t1").unwrap().into_iter().collect();
        assert!(t1.contains_key("/t1/a.md"));
        assert!(!t1.contains_key("/t2/b.md"));
    }

    #[test]
    fn assign_top_places_new_items_above_existing() {
        let conn = mem();
        set_order(&conn, "/d", &["/d/a.md".into(), "/d/b.md".into()]).unwrap();
        assign_top(&conn, "/d", "/d/c.md").unwrap();
        let map: std::collections::HashMap<_, _> = get_all(&conn, "/d").unwrap().into_iter().collect();
        assert!(map["/d/c.md"] < map["/d/a.md"]);
    }

    #[test]
    fn set_order_normalizes_positions() {
        let conn = mem();
        set_order(&conn, "/d", &["/d/x.md".into(), "/d/y.md".into()]).unwrap();
        let map: std::collections::HashMap<_, _> = get_all(&conn, "/d").unwrap().into_iter().collect();
        assert_eq!(map["/d/x.md"], 0.0);
        assert_eq!(map["/d/y.md"], 1.0);
    }

    #[test]
    fn parent_id_links_child_to_folder_row() {
        let conn = mem();
        set_order(&conn, "/d", &["/d/sub".into()]).unwrap();
        assign_top(&conn, "/d", "/d/sub/a.md").unwrap();
        let child_parent: Option<i64> = conn
            .query_row("SELECT parent_id FROM ordering WHERE path = '/d/sub/a.md'", [], |r| r.get(0))
            .unwrap();
        let folder_id: i64 = conn
            .query_row("SELECT id FROM ordering WHERE path = '/d/sub'", [], |r| r.get(0))
            .unwrap();
        assert_eq!(child_parent, Some(folder_id));
    }

    #[test]
    fn remove_path_deletes_folder_descendants() {
        let conn = mem();
        set_order(&conn, "/d", &["/d/sub".into()]).unwrap();
        assign_top(&conn, "/d", "/d/sub/a.md").unwrap();
        remove_path(&conn, "/d/sub").unwrap();
        assert!(get_all(&conn, "/d").unwrap().is_empty());
    }

    #[test]
    fn rename_path_updates_self_and_descendants() {
        let conn = mem();
        set_order(&conn, "/d", &["/d/old".into()]).unwrap();
        assign_top(&conn, "/d", "/d/old/a.md").unwrap();
        rename_path(&conn, "/d/old", "/d/new").unwrap();
        let map: std::collections::HashMap<_, _> = get_all(&conn, "/d").unwrap().into_iter().collect();
        assert!(map.contains_key("/d/new"));
        assert!(map.contains_key("/d/new/a.md"));
        assert!(!map.contains_key("/d/old/a.md"));
    }
}
