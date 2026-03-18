use std::fs;
use std::path::{Path, PathBuf};

const DEFAULT_DAILY_TEMPLATE: &str = "# {{date}}\n\n## Daily Core\n- [ ] Train / move body\n- [ ] Eat well / protein target\n- [ ] Finish the most important research task\n- [ ] Walk outside / get sunlight\n- [ ] Record one small win / good moment\n\n## Optional\n- [ ] Read / learn something\n- [ ] Tidy room / desk\n- [ ] Social interaction\n- [ ] Capture life note / photo / thought\n\n## One Line\n-\n";

const DEFAULT_WEEKLY_TEMPLATE: &str = "# {{week}}\n\n## Body\n- [ ] 4-5 strength sessions\n- [ ] 2-3 cardio sessions\n- [ ] 3 core sessions\n- [ ] Record weight / waist / progress photo\n- [ ] Eat well >= 5 days\n\n## Research\n- [ ] 3 deep work sessions\n- [ ] Push one key project forward\n- [ ] Plan next week\n\n## Life\n- [ ] 1 outdoor activity\n- [ ] 1 small life-enhancing activity\n- [ ] 1 environment reset / cleanup\n\n## Output\n- [ ] Publish 1 piece of content\n- [ ] Save 3 ideas / materials\n\n## Social\n- [ ] Join 1 social activity / meetup\n- [ ] Reach out to 1 friend\n\n## Reflection\n### 3 good things this week\n1.\n2.\n3.\n\n### 3 most important things next week\n1.\n2.\n3.\n";

fn default_data_root() -> Result<PathBuf, String> {
  let home = std::env::var("HOME").map_err(|_| "Failed to resolve HOME directory".to_string())?;
  Ok(PathBuf::from(home).join("life-tracker-data"))
}

fn resolve_data_root(data_root: Option<String>) -> Result<PathBuf, String> {
  match data_root {
    Some(path) if !path.trim().is_empty() => Ok(PathBuf::from(path)),
    _ => default_data_root(),
  }
}

fn ensure_file(path: &Path, default_content: &str) -> Result<(), String> {
  if !path.exists() {
    fs::write(path, default_content)
      .map_err(|err| format!("Failed to write {}: {err}", path.display()))?;
  }

  Ok(())
}

#[tauri::command]
fn ensure_data_root(data_root: Option<String>) -> Result<String, String> {
  let root = resolve_data_root(data_root)?;
  fs::create_dir_all(root.join("daily"))
    .map_err(|err| format!("Failed to create daily directory: {err}"))?;
  fs::create_dir_all(root.join("weekly"))
    .map_err(|err| format!("Failed to create weekly directory: {err}"))?;
  fs::create_dir_all(root.join("templates"))
    .map_err(|err| format!("Failed to create templates directory: {err}"))?;

  ensure_file(
    root.join("templates").join("daily.md").as_path(),
    DEFAULT_DAILY_TEMPLATE,
  )?;
  ensure_file(
    root.join("templates").join("weekly.md").as_path(),
    DEFAULT_WEEKLY_TEMPLATE,
  )?;
  ensure_file(root.join("body.csv").as_path(), "date,weight,waist,note\n")?;

  Ok(root.to_string_lossy().to_string())
}

#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
  fs::read_to_string(&path).map_err(|err| format!("Failed to read file {path}: {err}"))
}

#[tauri::command]
fn write_text_file(path: String, content: String) -> Result<(), String> {
  fs::write(&path, content).map_err(|err| format!("Failed to write file {path}: {err}"))
}

#[tauri::command]
fn list_files(dir_path: String, extension: Option<String>) -> Result<Vec<String>, String> {
  let entries =
    fs::read_dir(&dir_path).map_err(|err| format!("Failed to read dir {dir_path}: {err}"))?;
  let mut files: Vec<String> = entries
    .filter_map(Result::ok)
    .filter(|entry| entry.path().is_file())
    .filter(|entry| {
      if let Some(ext) = extension.as_deref() {
        let normalized_ext = ext.trim_start_matches('.');
        return entry
          .path()
          .extension()
          .is_some_and(|entry_ext| entry_ext == normalized_ext);
      }
      true
    })
    .filter_map(|entry| entry.file_name().into_string().ok())
    .collect();

  files.sort_by(|a, b| b.cmp(a));
  Ok(files)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![
      ensure_data_root,
      read_text_file,
      write_text_file,
      list_files
    ])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
