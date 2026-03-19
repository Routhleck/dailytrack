use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

const DEFAULT_DAILY_TEMPLATE: &str = "# {{date}}\n\n## Daily Core\n- [ ] Train / move body\n- [ ] Eat well / protein target\n- [ ] Finish the most important research task\n- [ ] Walk outside / get sunlight\n- [ ] Record one small win / good moment\n\n## Optional\n- [ ] Read / learn something\n- [ ] Tidy room / desk\n- [ ] Social interaction\n- [ ] Capture life note / photo / thought\n\n## One Line\n-\n";

const DEFAULT_WEEKLY_TEMPLATE: &str = "# {{week}}\n\n## Body\n- [ ] 4-5 strength sessions\n- [ ] 2-3 cardio sessions\n- [ ] 3 core sessions\n- [ ] Record weight / waist / progress photo\n- [ ] Eat well >= 5 days\n\n## Research\n- [ ] 3 deep work sessions\n- [ ] Push one key project forward\n- [ ] Plan next week\n\n## Life\n- [ ] 1 outdoor activity\n- [ ] 1 small life-enhancing activity\n- [ ] 1 environment reset / cleanup\n\n## Output\n- [ ] Publish 1 piece of content\n- [ ] Save 3 ideas / materials\n\n## Social\n- [ ] Join 1 social activity / meetup\n- [ ] Reach out to 1 friend\n\n## Reflection\n### 3 good things this week\n1.\n2.\n3.\n\n### 3 most important things next week\n1.\n2.\n3.\n";

const DEFAULT_PROFILE_NAME: &str = "default";

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

fn profiles_root(base_root: &Path) -> PathBuf {
  base_root.join("profiles")
}

fn profile_root(base_root: &Path, profile_name: &str) -> PathBuf {
  profiles_root(base_root).join(profile_name)
}

fn normalize_text(text: &str) -> String {
  if text.ends_with('\n') {
    text.to_string()
  } else {
    format!("{text}\n")
  }
}

fn is_valid_profile_name(profile_name: &str) -> bool {
  !profile_name.is_empty()
    && profile_name.len() <= 64
    && profile_name
      .chars()
      .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
}

fn validate_profile_name(profile_name: &str) -> Result<(), String> {
  if is_valid_profile_name(profile_name) {
    Ok(())
  } else {
    Err(
      "Invalid profile name. Use 1-64 chars with letters, numbers, '-' or '_' only".to_string(),
    )
  }
}

fn ensure_file(path: &Path, default_content: &str) -> Result<(), String> {
  if !path.exists() {
    fs::write(path, default_content)
      .map_err(|err| format!("Failed to write {}: {err}", path.display()))?;
  }

  Ok(())
}

fn ensure_tracker_layout(root: &Path) -> Result<(), String> {
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

fn copy_if_exists_file(source: &Path, destination: &Path, overwrite: bool) -> Result<(), String> {
  if !source.is_file() {
    return Ok(());
  }

  if destination.exists() && !overwrite {
    return Ok(());
  }

  if let Some(parent) = destination.parent() {
    fs::create_dir_all(parent)
      .map_err(|err| format!("Failed to create {}: {err}", parent.display()))?;
  }

  fs::copy(source, destination).map_err(|err| {
    format!(
      "Failed to copy {} to {}: {err}",
      source.display(),
      destination.display()
    )
  })?;

  Ok(())
}

fn copy_legacy_data_into_profile(base_root: &Path, profile_root_path: &Path) -> Result<(), String> {
  let daily_source = base_root.join("daily");
  let weekly_source = base_root.join("weekly");
  let templates_source = base_root.join("templates");
  let body_source = base_root.join("body.csv");

  if daily_source.is_dir() {
    copy_dir_recursive(
      daily_source.as_path(),
      profile_root_path.join("daily").as_path(),
      true,
    )?;
  }

  if weekly_source.is_dir() {
    copy_dir_recursive(
      weekly_source.as_path(),
      profile_root_path.join("weekly").as_path(),
      true,
    )?;
  }

  if templates_source.is_dir() {
    copy_dir_recursive(
      templates_source.as_path(),
      profile_root_path.join("templates").as_path(),
      true,
    )?;
  }

  copy_if_exists_file(
    body_source.as_path(),
    profile_root_path.join("body.csv").as_path(),
    true,
  )?;

  Ok(())
}

fn list_profile_names(base_root: &Path) -> Result<Vec<String>, String> {
  let profiles_dir = profiles_root(base_root);
  fs::create_dir_all(profiles_dir.as_path())
    .map_err(|err| format!("Failed to create profiles directory: {err}"))?;

  let mut profiles: Vec<String> = fs::read_dir(profiles_dir.as_path())
    .map_err(|err| format!("Failed to read profiles directory: {err}"))?
    .filter_map(Result::ok)
    .filter(|entry| entry.path().is_dir())
    .filter_map(|entry| entry.file_name().into_string().ok())
    .collect();

  profiles.sort();
  Ok(profiles)
}

fn ensure_default_profile(base_root: &Path) -> Result<(), String> {
  let default_profile_root = profile_root(base_root, DEFAULT_PROFILE_NAME);
  if default_profile_root.exists() {
    ensure_tracker_layout(default_profile_root.as_path())?;
    return Ok(());
  }

  ensure_tracker_layout(default_profile_root.as_path())?;
  copy_legacy_data_into_profile(base_root, default_profile_root.as_path())?;

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
  fs::create_dir_all(root.as_path())
    .map_err(|err| format!("Failed to create data root {}: {err}", root.display()))?;

  ensure_default_profile(root.as_path())?;

  Ok(root.to_string_lossy().to_string())
}

#[tauri::command]
fn list_profiles(data_root: String) -> Result<Vec<String>, String> {
  let root = resolve_data_root(Some(data_root))?;
  fs::create_dir_all(root.as_path())
    .map_err(|err| format!("Failed to create data root {}: {err}", root.display()))?;

  ensure_default_profile(root.as_path())?;
  list_profile_names(root.as_path())
}

#[tauri::command]
fn ensure_profile(data_root: String, profile_name: String) -> Result<String, String> {
  validate_profile_name(profile_name.as_str())?;

  let base_root = resolve_data_root(Some(data_root))?;
  let target_profile_root = profile_root(base_root.as_path(), profile_name.as_str());
  ensure_tracker_layout(target_profile_root.as_path())?;

  Ok(target_profile_root.to_string_lossy().to_string())
}

#[tauri::command]
fn create_profile(
  data_root: String,
  profile_name: String,
  daily_template: Option<String>,
  weekly_template: Option<String>,
) -> Result<String, String> {
  validate_profile_name(profile_name.as_str())?;

  let base_root = resolve_data_root(Some(data_root))?;
  let profiles_dir = profiles_root(base_root.as_path());
  fs::create_dir_all(profiles_dir.as_path())
    .map_err(|err| format!("Failed to create profiles directory: {err}"))?;

  let target_profile_root = profile_root(base_root.as_path(), profile_name.as_str());
  if target_profile_root.exists() {
    return Err(format!("Profile {} already exists", profile_name));
  }

  ensure_tracker_layout(target_profile_root.as_path())?;

  if let Some(content) = daily_template {
    fs::write(
      target_profile_root.join("templates").join("daily.md"),
      normalize_text(content.as_str()),
    )
    .map_err(|err| format!("Failed to write daily template: {err}"))?;
  }

  if let Some(content) = weekly_template {
    fs::write(
      target_profile_root.join("templates").join("weekly.md"),
      normalize_text(content.as_str()),
    )
    .map_err(|err| format!("Failed to write weekly template: {err}"))?;
  }

  Ok(target_profile_root.to_string_lossy().to_string())
}

#[tauri::command]
fn delete_profile(data_root: String, profile_name: String) -> Result<String, String> {
  validate_profile_name(profile_name.as_str())?;

  let base_root = resolve_data_root(Some(data_root))?;
  let target_profile_root = profile_root(base_root.as_path(), profile_name.as_str());
  if !target_profile_root.exists() {
    return Err(format!("Profile {} does not exist", profile_name));
  }

  let profiles = list_profile_names(base_root.as_path())?;
  if profiles.len() <= 1 {
    return Err("Cannot delete the last remaining profile".to_string());
  }

  fs::remove_dir_all(target_profile_root.as_path()).map_err(|err| {
    format!(
      "Failed to delete profile {} at {}: {err}",
      profile_name,
      target_profile_root.display()
    )
  })?;

  let remaining = list_profile_names(base_root.as_path())?;
  let fallback = if remaining.iter().any(|name| name == DEFAULT_PROFILE_NAME) {
    DEFAULT_PROFILE_NAME.to_string()
  } else {
    remaining
      .first()
      .cloned()
      .ok_or_else(|| "No remaining profile after delete".to_string())?
  };

  Ok(fallback)
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

  let target_root = PathBuf::from(data_root);
  ensure_tracker_layout(target_root.as_path())?;

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
      list_profiles,
      ensure_profile,
      create_profile,
      delete_profile,
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
