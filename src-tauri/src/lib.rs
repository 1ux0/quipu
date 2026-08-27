mod assets;
mod config;
mod notes;
mod order;
mod target;
mod watcher;

use notes::{Folder, Note};
use notify::RecommendedWatcher;
use order::OrderDb;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Manager, State};
use watcher::SelfWrites;

#[derive(Default)]
struct AppState {
    watcher: Mutex<Option<RecommendedWatcher>>,
    self_writes: SelfWrites,
    current_dir: Mutex<Option<PathBuf>>,
}

fn current_target(state: &AppState) -> Result<String, String> {
    state
        .current_dir
        .lock()
        .map_err(|e| e.to_string())?
        .as_ref()
        .map(|p| p.to_string_lossy().to_string())
        .ok_or_else(|| "no target set".to_string())
}

fn with_db<T>(
    order: &OrderDb,
    f: impl FnOnce(&rusqlite::Connection) -> Result<T, String>,
) -> Result<T, String> {
    let conn = order.0.lock().map_err(|e| e.to_string())?;
    f(&conn)
}

fn start_watcher(app: &AppHandle, state: &AppState, dir: &Path) -> Result<(), String> {
    let w = watcher::watch_dir(app.clone(), dir, state.self_writes.clone())?;
    *state.watcher.lock().map_err(|e| e.to_string())? = Some(w);
    *state.current_dir.lock().map_err(|e| e.to_string())? = Some(dir.to_path_buf());
    let _ = app
        .asset_protocol_scope()
        .allow_directory(assets::assets_path(dir), true);
    let _ = assets::gc_assets(dir);
    Ok(())
}

#[tauri::command]
fn init_app(app: AppHandle, state: State<AppState>, order: State<OrderDb>) -> Result<String, String> {
    let dir = with_db(&order, |c| order::get_target(c))?
        .map(PathBuf::from)
        .unwrap_or_else(target::default_target_dir);
    target::ensure_dir(&dir)?;
    with_db(&order, |c| order::set_target(c, &dir.to_string_lossy()))?;
    start_watcher(&app, &state, &dir)?;
    Ok(dir.to_string_lossy().to_string())
}

#[tauri::command]
fn set_target_dir(
    app: AppHandle,
    state: State<AppState>,
    order: State<OrderDb>,
    dir: String,
) -> Result<(), String> {
    let path = PathBuf::from(&dir);
    target::ensure_dir(&path)?;
    with_db(&order, |c| order::set_target(c, &dir))?;
    start_watcher(&app, &state, &path)
}

#[tauri::command]
fn list_notes(dir: String) -> Result<Vec<Note>, String> {
    notes::list_notes(Path::new(&dir))
}

#[tauri::command]
fn list_folders(dir: String) -> Vec<Folder> {
    notes::list_folders(Path::new(&dir))
}

#[tauri::command]
fn read_note(path: String) -> Result<String, String> {
    notes::read_note(Path::new(&path))
}

#[tauri::command]
fn save_note(
    state: State<AppState>,
    dir: String,
    path: String,
    contents: String,
) -> Result<(), String> {
    let path = PathBuf::from(path);
    watcher::record_self_write(&state.self_writes, &path);
    assets::write_note_atomic(&path, &contents)?;
    assets::gc_assets(Path::new(&dir))
}

#[tauri::command]
fn import_asset(dir: String, src_path: String) -> Result<String, String> {
    assets::import_asset(Path::new(&dir), Path::new(&src_path))
}

#[tauri::command]
fn import_asset_bytes(dir: String, name: String, data: Vec<u8>) -> Result<String, String> {
    assets::import_asset_bytes(Path::new(&dir), &name, &data)
}

#[tauri::command]
fn create_note(
    state: State<AppState>,
    order: State<OrderDb>,
    dir: String,
    name: String,
) -> Result<String, String> {
    let path = notes::create_note(Path::new(&dir), &name)?
        .to_string_lossy()
        .to_string();
    let target = current_target(&state)?;
    with_db(&order, |c| order::assign_top(c, &target, &path))?;
    Ok(path)
}

#[tauri::command]
fn create_folder(
    state: State<AppState>,
    order: State<OrderDb>,
    dir: String,
    name: String,
) -> Result<String, String> {
    let path = notes::create_folder(Path::new(&dir), &name)?
        .to_string_lossy()
        .to_string();
    let target = current_target(&state)?;
    with_db(&order, |c| order::assign_top(c, &target, &path))?;
    Ok(path)
}

#[tauri::command]
fn rename_note(
    state: State<AppState>,
    order: State<OrderDb>,
    path: String,
    new_name: String,
) -> Result<String, String> {
    let new_path = notes::rename_note(Path::new(&path), &new_name)?
        .to_string_lossy()
        .to_string();
    let target = current_target(&state)?;
    with_db(&order, |c| {
        order::rename_path(c, &path, &new_path)?;
        order::set_title(c, &target, &new_path, &new_name)
    })?;
    Ok(new_path)
}

#[tauri::command]
fn rename_folder(order: State<OrderDb>, path: String, new_name: String) -> Result<String, String> {
    let new_path = notes::rename_folder(Path::new(&path), &new_name)?
        .to_string_lossy()
        .to_string();
    with_db(&order, |c| order::rename_path(c, &path, &new_path))?;
    Ok(new_path)
}

#[tauri::command]
fn move_note(
    state: State<AppState>,
    order: State<OrderDb>,
    path: String,
    dest_dir: String,
) -> Result<String, String> {
    let new_path = notes::move_note(Path::new(&path), Path::new(&dest_dir))?
        .to_string_lossy()
        .to_string();
    let target = current_target(&state)?;
    with_db(&order, |c| {
        // Move (not remove) the order + title rows so the title is preserved,
        // then re-top the item within its new parent.
        order::rename_path(c, &path, &new_path)?;
        order::assign_top(c, &target, &new_path)
    })?;
    Ok(new_path)
}

#[tauri::command]
fn delete_note(state: State<AppState>, order: State<OrderDb>, path: String) -> Result<(), String> {
    trash::delete(&path).map_err(|e| e.to_string())?;
    with_db(&order, |c| order::remove_path(c, &path))?;
    if let Ok(target) = current_target(&state) {
        assets::gc_assets(Path::new(&target))?;
    }
    Ok(())
}

#[tauri::command]
fn get_order(state: State<AppState>, order: State<OrderDb>) -> Result<Vec<(String, f64)>, String> {
    let target = current_target(&state)?;
    with_db(&order, |c| order::get_all(c, &target))
}

#[tauri::command]
fn set_order(
    state: State<AppState>,
    order: State<OrderDb>,
    paths: Vec<String>,
) -> Result<(), String> {
    let target = current_target(&state)?;
    with_db(&order, |c| order::set_order(c, &target, &paths))
}

#[tauri::command]
fn get_titles(state: State<AppState>, order: State<OrderDb>) -> Result<Vec<(String, String)>, String> {
    let target = current_target(&state)?;
    with_db(&order, |c| order::get_titles(c, &target))
}

#[tauri::command]
fn freeze_title(
    state: State<AppState>,
    order: State<OrderDb>,
    path: String,
    title: String,
) -> Result<(), String> {
    let target = current_target(&state)?;
    with_db(&order, |c| order::freeze_title(c, &target, &path, &title))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState {
            self_writes: Arc::new(Mutex::new(HashMap::new())),
            ..Default::default()
        })
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&data_dir)?;
            let conn = order::open(&data_dir.join("order.db"))
                .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;
            app.manage(OrderDb(Mutex::new(conn)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            init_app,
            set_target_dir,
            list_notes,
            list_folders,
            read_note,
            save_note,
            import_asset,
            import_asset_bytes,
            create_note,
            create_folder,
            rename_note,
            rename_folder,
            move_note,
            delete_note,
            get_order,
            set_order,
            get_titles,
            freeze_title
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
