use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

const DEFAULT_DAILY_TEMPLATE: &str = "# {{date}}\n\n## Daily Core\n- [ ] Train / move body\n- [ ] Eat well / protein target\n- [ ] Finish the most important research task\n- [ ] Walk outside / get sunlight\n- [ ] Record one small win / good moment\n\n## Optional\n- [ ] Read / learn something\n- [ ] Tidy room / desk\n- [ ] Social interaction\n- [ ] Capture life note / photo / thought\n\n## One Line\n-\n";

const DEFAULT_WEEKLY_TEMPLATE: &str = "# {{week}}\n\n## Body\n- [ ] 4-5 strength sessions\n- [ ] 2-3 cardio sessions\n- [ ] 3 core sessions\n- [ ] Record weight / waist / progress photo\n- [ ] Eat well >= 5 days\n\n## Research\n- [ ] 3 deep work sessions\n- [ ] Push one key project forward\n- [ ] Plan next week\n\n## Life\n- [ ] 1 outdoor activity\n- [ ] 1 small life-enhancing activity\n- [ ] 1 environment reset / cleanup\n\n## Output\n- [ ] Publish 1 piece of content\n- [ ] Save 3 ideas / materials\n\n## Social\n- [ ] Join 1 social activity / meetup\n- [ ] Reach out to 1 friend\n\n## Reflection\n### 3 good things this week\n1.\n2.\n3.\n\n### 3 most important things next week\n1.\n2.\n3.\n";

fn default_data_root() -> Result<PathBuf, String> {
  let home = std::env::var("HOME")
    .or_else(|_| std::env::var("USERPROFILE"))
    .map_err(|_| "Failed to resolve user home directory".to_string())?;
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

fn ensure_data_root_layout(root: &Path) -> Result<(), String> {
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

  Ok(())
}

fn copy_dir_recursive(source: &Path, destination: &Path, overwrite: bool) -> Result<(), String> {
  fs::create_dir_all(destination)
    .map_err(|err| format!("Failed to create {}: {err}", destination.display()))?;

  for entry in fs::read_dir(source)
    .map_err(|err| format!("Failed to read {}: {err}", source.display()))?
  {
    let entry = entry.map_err(|err| format!("Failed to read directory entry: {err}"))?;
    let source_path = entry.path();
    let destination_path = destination.join(entry.file_name());

    if source_path.is_dir() {
      copy_dir_recursive(source_path.as_path(), destination_path.as_path(), overwrite)?;
      continue;
    }

    if source_path.is_file() {
      if destination_path.exists() && !overwrite {
        continue;
      }

      fs::copy(source_path.as_path(), destination_path.as_path()).map_err(|err| {
        format!(
          "Failed to copy {} to {}: {err}",
          source_path.display(),
          destination_path.display()
        )
      })?;
    }
  }

  Ok(())
}

fn validate_bundle_root(path: &Path) -> Result<(), String> {
  let required = [path.join("daily"), path.join("weekly"), path.join("body.csv")];
  if !required[0].is_dir() || !required[1].is_dir() || !required[2].is_file() {
    return Err(format!(
      "Invalid import source at {}. Expected daily/, weekly/, and body.csv",
      path.display()
    ));
  }

  Ok(())
}

#[tauri::command]
fn ensure_data_root(data_root: Option<String>) -> Result<String, String> {
  let root = resolve_data_root(data_root)?;
  ensure_data_root_layout(root.as_path())?;

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

#[tauri::command]
fn export_data_bundle(data_root: String, destination_dir: String) -> Result<String, String> {
  let source_root = PathBuf::from(data_root);
  if !source_root.exists() {
    return Err(format!(
      "Data root {} does not exist",
      source_root.to_string_lossy()
    ));
  }

  let destination_base = PathBuf::from(destination_dir);
  fs::create_dir_all(destination_base.as_path()).map_err(|err| {
    format!(
      "Failed to create export destination {}: {err}",
      destination_base.display()
    )
  })?;

  let timestamp = SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .map_err(|err| format!("Failed to get current time: {err}"))?
    .as_secs();

  let mut bundle_path = destination_base.join(format!("dailytrack-export-{timestamp}"));
  let mut suffix = 1;
  while bundle_path.exists() {
    bundle_path = destination_base.join(format!("dailytrack-export-{timestamp}-{suffix}"));
    suffix += 1;
  }

  if bundle_path.starts_with(source_root.as_path()) {
    return Err(format!(
      "Export destination {} cannot be inside current data root {}",
      bundle_path.display(),
      source_root.display()
    ));
  }

  copy_dir_recursive(source_root.as_path(), bundle_path.as_path(), false)?;
  Ok(bundle_path.to_string_lossy().to_string())
}

#[tauri::command]
fn import_data_bundle(
  source_dir: String,
  data_root: String,
  overwrite: Option<bool>,
) -> Result<String, String> {
  let source_root = PathBuf::from(source_dir);
  validate_bundle_root(source_root.as_path())?;

  let target_root = resolve_data_root(Some(data_root))?;
  ensure_data_root_layout(target_root.as_path())?;

  let source_canonical = fs::canonicalize(source_root.as_path()).map_err(|err| {
    format!(
      "Failed to resolve import source {}: {err}",
      source_root.to_string_lossy()
    )
  })?;
  let target_canonical = fs::canonicalize(target_root.as_path()).map_err(|err| {
    format!(
      "Failed to resolve data root {}: {err}",
      target_root.to_string_lossy()
    )
  })?;

  if source_canonical == target_canonical {
    return Err("Import source cannot be the same as current data root".to_string());
  }

  copy_dir_recursive(
    source_canonical.as_path(),
    target_canonical.as_path(),
    overwrite.unwrap_or(true),
  )?;
  Ok(target_canonical.to_string_lossy().to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![
      ensure_data_root,
      read_text_file,
      write_text_file,
      list_files,
      export_data_bundle,
      import_data_bundle
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
