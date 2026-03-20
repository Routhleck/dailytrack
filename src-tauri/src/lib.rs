use std::fs;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use notify::{
  event::{DataChange, ModifyKind},
  Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher,
};
use serde::Serialize;
use tauri::Emitter;
mod webdav;

const DEFAULT_DAILY_TEMPLATE: &str = "# {{date}}\n\n## Daily Core\n- [ ] Train / move body\n- [ ] Eat well / protein target\n- [ ] Finish the most important research task\n- [ ] Walk outside / get sunlight\n- [ ] Record one small win / good moment\n\n## Optional\n- [ ] Read / learn something\n- [ ] Tidy room / desk\n- [ ] Social interaction\n- [ ] Capture life note / photo / thought\n\n## One Line\n-\n";

const DEFAULT_WEEKLY_TEMPLATE: &str = "# {{week}}\n\n## Body\n- [ ] 4-5 strength sessions\n- [ ] 2-3 cardio sessions\n- [ ] 3 core sessions\n- [ ] Record weight / waist / progress photo\n- [ ] Eat well >= 5 days\n\n## Research\n- [ ] 3 deep work sessions\n- [ ] Push one key project forward\n- [ ] Plan next week\n\n## Life\n- [ ] 1 outdoor activity\n- [ ] 1 small life-enhancing activity\n- [ ] 1 environment reset / cleanup\n\n## Output\n- [ ] Publish 1 piece of content\n- [ ] Save 3 ideas / materials\n\n## Social\n- [ ] Join 1 social activity / meetup\n- [ ] Reach out to 1 friend\n\n## Reflection\n### 3 good things this week\n1.\n2.\n3.\n\n### 3 most important things next week\n1.\n2.\n3.\n";

const DEFAULT_PROFILE_NAME: &str = "default";
const DEFAULT_DATA_ROOT_DIR: &str = "dailytrack-data";
const LEGACY_DATA_ROOT_DIR: &str = "life-tracker-data";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct EnsureDataRootResult {
  root: String,
  is_first_run: bool,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct FsChangedEvent {
  scope: String,
  path: String,
  at: u64,
}

#[derive(Default)]
struct FsWatchState {
  watchers: Mutex<HashMap<String, RecommendedWatcher>>,
}

#[derive(Serialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
struct CopySummary {
  copied_files: u64,
  skipped_files: u64,
  overwritten_files: u64,
  created_dirs: u64,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ExportDataBundleResult {
  bundle_path: String,
  summary: CopySummary,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ImportDataBundleResult {
  data_root: String,
  summary: CopySummary,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct MigrateDataRootResult {
  data_root: String,
  summary: CopySummary,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct GenerateLlmReportResult {
  content: String,
}

fn default_data_root() -> Result<PathBuf, String> {
  let home = std::env::var("HOME")
    .or_else(|_| std::env::var("USERPROFILE"))
    .map_err(|_| "Failed to resolve user home directory".to_string())?;

  let preferred = PathBuf::from(&home).join(DEFAULT_DATA_ROOT_DIR);
  let legacy = PathBuf::from(home).join(LEGACY_DATA_ROOT_DIR);

  if preferred.exists() {
    return Ok(preferred);
  }

  if legacy.exists() {
    return Ok(legacy);
  }

  Ok(preferred)
}

fn resolve_data_root(data_root: Option<String>) -> Result<PathBuf, String> {
  match data_root {
    Some(path) if !path.trim().is_empty() => Ok(PathBuf::from(path)),
    _ => default_data_root(),
  }
}

fn canonicalize_data_root_path(data_root: &str) -> Result<PathBuf, String> {
  if data_root.trim().is_empty() {
    return Err("Data root path is empty".to_string());
  }

  let root = PathBuf::from(data_root);
  let canonical = fs::canonicalize(root.as_path())
    .map_err(|err| format!("Failed to resolve data root {}: {err}", root.display()))?;

  if !canonical.is_dir() {
    return Err(format!("Data root {} is not a directory", canonical.display()));
  }

  Ok(canonical)
}

fn ensure_path_within_root(root: &Path, candidate: &Path) -> Result<(), String> {
  if candidate.starts_with(root) {
    Ok(())
  } else {
    Err(format!(
      "Path {} is outside data root {}",
      candidate.display(),
      root.display()
    ))
  }
}

fn validate_existing_file_under_root(root: &Path, path: &str) -> Result<PathBuf, String> {
  let raw = PathBuf::from(path);
  let canonical = fs::canonicalize(raw.as_path())
    .map_err(|err| format!("Failed to resolve file path {}: {err}", raw.display()))?;
  ensure_path_within_root(root, canonical.as_path())?;

  if !canonical.is_file() {
    return Err(format!("Path {} is not a file", canonical.display()));
  }

  Ok(canonical)
}

fn validate_existing_dir_under_root(root: &Path, path: &str) -> Result<PathBuf, String> {
  let raw = PathBuf::from(path);
  let canonical = fs::canonicalize(raw.as_path())
    .map_err(|err| format!("Failed to resolve directory path {}: {err}", raw.display()))?;
  ensure_path_within_root(root, canonical.as_path())?;

  if !canonical.is_dir() {
    return Err(format!("Path {} is not a directory", canonical.display()));
  }

  Ok(canonical)
}

fn validate_writable_file_under_root(root: &Path, path: &str) -> Result<PathBuf, String> {
  let raw = PathBuf::from(path);
  if raw.exists() {
    let canonical = fs::canonicalize(raw.as_path())
      .map_err(|err| format!("Failed to resolve file path {}: {err}", raw.display()))?;
    ensure_path_within_root(root, canonical.as_path())?;
    if canonical.is_dir() {
      return Err(format!("Path {} is a directory", canonical.display()));
    }
    return Ok(canonical);
  }

  let parent = raw
    .parent()
    .ok_or_else(|| format!("Path {} has no parent directory", raw.display()))?;
  let canonical_parent = fs::canonicalize(parent)
    .map_err(|err| format!("Failed to resolve parent path {}: {err}", parent.display()))?;
  ensure_path_within_root(root, canonical_parent.as_path())?;

  let file_name = raw
    .file_name()
    .ok_or_else(|| format!("Path {} has no file name", raw.display()))?;
  Ok(canonical_parent.join(file_name))
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

fn write_text_atomic(path: &Path, content: &str) -> Result<(), String> {
  let parent = path
    .parent()
    .ok_or_else(|| format!("Path {} has no parent directory", path.display()))?;
  fs::create_dir_all(parent)
    .map_err(|err| format!("Failed to create directory {}: {err}", parent.display()))?;

  let nanos = SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .map_err(|err| format!("Failed to get timestamp for atomic write: {err}"))?
    .as_nanos();
  let file_name = path
    .file_name()
    .and_then(|name| name.to_str())
    .unwrap_or("dailytrack-temp");
  let temp_path = parent.join(format!(".{}.tmp-{}-{}", file_name, std::process::id(), nanos));

  fs::write(temp_path.as_path(), content).map_err(|err| {
    format!(
      "Failed to write temporary file {}: {err}",
      temp_path.display()
    )
  })?;

  if let Err(rename_err) = fs::rename(temp_path.as_path(), path) {
    if path.exists() {
      fs::remove_file(path)
        .map_err(|err| format!("Failed to replace existing file {}: {err}", path.display()))?;
      fs::rename(temp_path.as_path(), path).map_err(|err| {
        format!(
          "Failed to atomically replace file {} after remove: {err}",
          path.display()
        )
      })?;
    } else {
      let _ = fs::remove_file(temp_path.as_path());
      return Err(format!(
        "Failed to atomically write file {}: {rename_err}",
        path.display()
      ));
    }
  }

  Ok(())
}

fn ensure_file(path: &Path, default_content: &str) -> Result<(), String> {
  if !path.exists() {
    write_text_atomic(path, default_content)?;
  }

  Ok(())
}

fn ensure_tracker_layout(root: &Path) -> Result<(), String> {
  fs::create_dir_all(root.join("daily"))
    .map_err(|err| format!("Failed to create daily directory: {err}"))?;
  fs::create_dir_all(root.join("weekly"))
    .map_err(|err| format!("Failed to create weekly directory: {err}"))?;
  fs::create_dir_all(root.join("reports").join("weekly"))
    .map_err(|err| format!("Failed to create reports/weekly directory: {err}"))?;
  fs::create_dir_all(root.join("reports").join("monthly"))
    .map_err(|err| format!("Failed to create reports/monthly directory: {err}"))?;
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
  ensure_file(
    root.join("body.csv").as_path(),
    "date,weight,waist,bodyFat,muscleMass,chest,hip,note\n",
  )?;

  Ok(())
}

fn copy_dir_recursive_with_summary(
  source: &Path,
  destination: &Path,
  overwrite: bool,
  summary: &mut CopySummary,
) -> Result<(), String> {
  if !destination.exists() {
    summary.created_dirs += 1;
  }
  fs::create_dir_all(destination)
    .map_err(|err| format!("Failed to create {}: {err}", destination.display()))?;

  for entry in fs::read_dir(source)
    .map_err(|err| format!("Failed to read {}: {err}", source.display()))?
  {
    let entry = entry.map_err(|err| format!("Failed to read directory entry: {err}"))?;
    let source_path = entry.path();
    let destination_path = destination.join(entry.file_name());

    if source_path.is_dir() {
      copy_dir_recursive_with_summary(
        source_path.as_path(),
        destination_path.as_path(),
        overwrite,
        summary,
      )?;
      continue;
    }

    if source_path.is_file() {
      let destination_exists = destination_path.exists();
      if destination_exists && !overwrite {
        summary.skipped_files += 1;
        continue;
      }

      fs::copy(source_path.as_path(), destination_path.as_path()).map_err(|err| {
        format!(
          "Failed to copy {} to {}: {err}",
          source_path.display(),
          destination_path.display()
        )
      })?;
      summary.copied_files += 1;
      if destination_exists {
        summary.overwritten_files += 1;
      }
    }
  }

  Ok(())
}

fn copy_dir_recursive(source: &Path, destination: &Path, overwrite: bool) -> Result<CopySummary, String> {
  let mut summary = CopySummary::default();
  copy_dir_recursive_with_summary(source, destination, overwrite, &mut summary)?;
  Ok(summary)
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

fn remove_path_if_exists(path: &Path) -> Result<(), String> {
  if !path.exists() {
    return Ok(());
  }

  if path.is_dir() {
    fs::remove_dir_all(path)
      .map_err(|err| format!("Failed to remove directory {}: {err}", path.display()))?;
    return Ok(());
  }

  fs::remove_file(path).map_err(|err| format!("Failed to remove file {}: {err}", path.display()))?;
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

fn now_unix_millis() -> u64 {
  match SystemTime::now().duration_since(UNIX_EPOCH) {
    Ok(duration) => duration.as_millis() as u64,
    Err(_) => 0,
  }
}

fn normalize_path_for_scope(path: &Path) -> String {
  path.to_string_lossy().replace('\\', "/")
}

fn scope_for_changed_path(path: &Path) -> Option<&'static str> {
  let normalized = normalize_path_for_scope(path);

  if normalized.ends_with("/body.csv") {
    return Some("body");
  }
  if normalized.ends_with("/preferences.json") {
    return Some("preferences");
  }
  if normalized.contains("/daily/") && normalized.ends_with(".md") {
    return Some("daily");
  }
  if normalized.contains("/weekly/") && normalized.ends_with(".md") {
    return Some("weekly");
  }
  if normalized.contains("/templates/") {
    return Some("settings");
  }

  None
}

fn is_relevant_fs_event(event: &Event) -> bool {
  match event.kind {
    EventKind::Create(_) => true,
    EventKind::Remove(_) => true,
    EventKind::Modify(ModifyKind::Data(DataChange::Any))
    | EventKind::Modify(ModifyKind::Data(DataChange::Content))
    | EventKind::Modify(ModifyKind::Data(DataChange::Size))
    | EventKind::Modify(ModifyKind::Name(_))
    | EventKind::Modify(ModifyKind::Any) => true,
    _ => false,
  }
}

fn updater_configured_from_app(app: &tauri::AppHandle) -> bool {
  let plugins = &app.config().plugins.0;
  let updater = match plugins.get("updater") {
    Some(value) => value,
    None => return false,
  };

  let has_endpoints = updater
    .get("endpoints")
    .and_then(|value| value.as_array())
    .is_some_and(|items| !items.is_empty());
  let has_pubkey = updater
    .get("pubkey")
    .and_then(|value| value.as_str())
    .is_some_and(|value| !value.trim().is_empty());

  has_endpoints && has_pubkey
}

fn updater_pubkey() -> Option<String> {
  option_env!("DAILYTRACK_UPDATER_PUBKEY")
    .map(str::trim)
    .filter(|value| !value.is_empty())
    .map(ToOwned::to_owned)
}

#[tauri::command]
fn updater_is_configured(app: tauri::AppHandle) -> bool {
  if updater_pubkey().is_some() {
    return true;
  }

  updater_configured_from_app(&app)
}

fn is_data_root_empty(root: &Path) -> Result<bool, String> {
  if !root.exists() {
    return Ok(true);
  }

  if !root.is_dir() {
    return Err(format!("Data root {} is not a directory", root.display()));
  }

  let mut entries =
    fs::read_dir(root).map_err(|err| format!("Failed to read data root {}: {err}", root.display()))?;
  Ok(entries.next().is_none())
}

#[tauri::command]
fn ensure_data_root(data_root: Option<String>) -> Result<EnsureDataRootResult, String> {
  let root = resolve_data_root(data_root)?;
  let is_first_run = is_data_root_empty(root.as_path())?;
  fs::create_dir_all(root.as_path())
    .map_err(|err| format!("Failed to create data root {}: {err}", root.display()))?;

  ensure_default_profile(root.as_path())?;

  Ok(EnsureDataRootResult {
    root: root.to_string_lossy().to_string(),
    is_first_run,
  })
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
    write_text_atomic(
      target_profile_root.join("templates").join("daily.md").as_path(),
      normalize_text(content.as_str()).as_str(),
    )
    .map_err(|err| format!("Failed to write daily template: {err}"))?;
  }

  if let Some(content) = weekly_template {
    write_text_atomic(
      target_profile_root.join("templates").join("weekly.md").as_path(),
      normalize_text(content.as_str()).as_str(),
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
fn read_text_file(path: String, data_root: String) -> Result<String, String> {
  let root = canonicalize_data_root_path(data_root.as_str())?;
  let target = validate_existing_file_under_root(root.as_path(), path.as_str())?;
  fs::read_to_string(target.as_path())
    .map_err(|err| format!("Failed to read file {}: {err}", target.display()))
}

#[tauri::command]
fn write_text_file(path: String, content: String, data_root: String) -> Result<(), String> {
  let root = canonicalize_data_root_path(data_root.as_str())?;
  let target = validate_writable_file_under_root(root.as_path(), path.as_str())?;
  write_text_atomic(target.as_path(), content.as_str())
    .map_err(|err| format!("Failed to write file {}: {err}", target.display()))
}

#[tauri::command]
fn list_files(
  dir_path: String,
  extension: Option<String>,
  data_root: String,
) -> Result<Vec<String>, String> {
  let root = canonicalize_data_root_path(data_root.as_str())?;
  let target_dir = validate_existing_dir_under_root(root.as_path(), dir_path.as_str())?;
  let entries = fs::read_dir(target_dir.as_path())
    .map_err(|err| format!("Failed to read dir {}: {err}", target_dir.display()))?;
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
fn start_data_root_watch(
  app: tauri::AppHandle,
  state: tauri::State<FsWatchState>,
  data_root: String,
) -> Result<(), String> {
  let root = canonicalize_data_root_path(data_root.as_str())?;
  let key = root.to_string_lossy().to_string();
  let mut watchers = state
    .watchers
    .lock()
    .map_err(|_| "Failed to acquire filesystem watch state lock".to_string())?;

  if watchers.contains_key(key.as_str()) {
    return Ok(());
  }

  let app_handle = app.clone();
  let mut watcher = notify::recommended_watcher(move |result| {
    let event = match result {
      Ok(event) => event,
      Err(err) => {
        log::warn!("filesystem watch callback error: {err}");
        return;
      }
    };

    if !is_relevant_fs_event(&event) {
      return;
    }

    let changed_at = now_unix_millis();
    for path in event.paths {
      let scope = match scope_for_changed_path(path.as_path()) {
        Some(scope) => scope,
        None => continue,
      };

      let payload = FsChangedEvent {
        scope: scope.to_string(),
        path: path.to_string_lossy().to_string(),
        at: changed_at,
      };

      if let Err(err) = app_handle.emit("dailytrack://fs-changed", payload) {
        log::warn!("failed to emit fs-changed event: {err}");
      }
    }
  })
  .map_err(|err| format!("Failed to create filesystem watcher: {err}"))?;

  watcher
    .watch(root.as_path(), RecursiveMode::Recursive)
    .map_err(|err| format!("Failed to watch data root {}: {err}", root.display()))?;

  watchers.insert(key, watcher);
  Ok(())
}

#[tauri::command]
fn stop_data_root_watch(state: tauri::State<FsWatchState>, data_root: String) -> Result<(), String> {
  let root = canonicalize_data_root_path(data_root.as_str())?;
  let key = root.to_string_lossy().to_string();
  let mut watchers = state
    .watchers
    .lock()
    .map_err(|_| "Failed to acquire filesystem watch state lock".to_string())?;
  watchers.remove(key.as_str());
  Ok(())
}

fn resolve_chat_completions_endpoint(base_url: &str) -> String {
  let trimmed = base_url.trim().trim_end_matches('/');
  if trimmed.ends_with("/chat/completions") {
    return trimmed.to_string();
  }
  format!("{trimmed}/chat/completions")
}

#[tauri::command]
fn generate_llm_report(
  base_url: String,
  api_key: String,
  model: String,
  system_prompt: String,
  user_prompt: String,
  temperature: Option<f32>,
) -> Result<GenerateLlmReportResult, String> {
  if base_url.trim().is_empty() {
    return Err("Base URL is required".to_string());
  }
  if api_key.trim().is_empty() {
    return Err("API key is required".to_string());
  }
  if model.trim().is_empty() {
    return Err("Model is required".to_string());
  }

  let endpoint = resolve_chat_completions_endpoint(base_url.as_str());
  let mut payload = serde_json::json!({
    "model": model.trim(),
    "messages": [
      { "role": "system", "content": system_prompt },
      { "role": "user", "content": user_prompt }
    ]
  });

  if let Some(value) = temperature {
    if value.is_finite() {
      payload["temperature"] = serde_json::json!(value.clamp(0.0, 2.0));
    }
  }

  let client = reqwest::blocking::Client::builder()
    .timeout(std::time::Duration::from_secs(90))
    .build()
    .map_err(|err| format!("Failed to build HTTP client: {err}"))?;

  let response = client
    .post(endpoint.as_str())
    .header(reqwest::header::AUTHORIZATION, format!("Bearer {}", api_key.trim()))
    .header(reqwest::header::CONTENT_TYPE, "application/json")
    .json(&payload)
    .send()
    .map_err(|err| format!("Failed to call LLM provider: {err}"))?;

  if !response.status().is_success() {
    let status = response.status();
    let body = response
      .text()
      .unwrap_or_else(|_| "Failed to read error response body".to_string());
    return Err(format!("LLM provider returned {status}: {body}"));
  }

  let body: serde_json::Value = response
    .json()
    .map_err(|err| format!("Failed to parse provider response: {err}"))?;
  let content = body
    .get("choices")
    .and_then(|choices| choices.as_array())
    .and_then(|choices| choices.first())
    .and_then(|choice| choice.get("message"))
    .and_then(|message| message.get("content"))
    .and_then(|content| content.as_str())
    .map(str::trim)
    .filter(|text| !text.is_empty())
    .ok_or_else(|| "Provider response has no message content".to_string())?
    .to_string();

  Ok(GenerateLlmReportResult { content })
}

#[tauri::command]
fn export_data_bundle(
  data_root: String,
  destination_dir: String,
) -> Result<ExportDataBundleResult, String> {
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

  let summary = copy_dir_recursive(source_root.as_path(), bundle_path.as_path(), false)?;
  Ok(ExportDataBundleResult {
    bundle_path: bundle_path.to_string_lossy().to_string(),
    summary,
  })
}

#[tauri::command]
fn import_data_bundle(
  source_dir: String,
  data_root: String,
  overwrite: Option<bool>,
) -> Result<ImportDataBundleResult, String> {
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

  let summary = copy_dir_recursive(
    source_canonical.as_path(),
    target_canonical.as_path(),
    overwrite.unwrap_or(true),
  )?;
  Ok(ImportDataBundleResult {
    data_root: target_canonical.to_string_lossy().to_string(),
    summary,
  })
}

#[tauri::command]
fn migrate_data_root(
  source_root: String,
  destination_root: String,
  overwrite: Option<bool>,
) -> Result<MigrateDataRootResult, String> {
  let source_path = PathBuf::from(source_root);
  if !source_path.exists() || !source_path.is_dir() {
    return Err(format!(
      "Source data root {} does not exist or is not a directory",
      source_path.display()
    ));
  }

  let destination_path = PathBuf::from(destination_root);
  fs::create_dir_all(destination_path.as_path()).map_err(|err| {
    format!(
      "Failed to create destination data root {}: {err}",
      destination_path.display()
    )
  })?;

  let source_canonical = fs::canonicalize(source_path.as_path()).map_err(|err| {
    format!(
      "Failed to resolve source data root {}: {err}",
      source_path.display()
    )
  })?;
  let destination_canonical = fs::canonicalize(destination_path.as_path()).map_err(|err| {
    format!(
      "Failed to resolve destination data root {}: {err}",
      destination_path.display()
    )
  })?;

  if source_canonical == destination_canonical {
    return Err("Destination data root cannot be the same as source data root".to_string());
  }

  if destination_canonical.starts_with(source_canonical.as_path())
    || source_canonical.starts_with(destination_canonical.as_path())
  {
    return Err("Source and destination data roots cannot be nested".to_string());
  }

  let summary = copy_dir_recursive(
    source_canonical.as_path(),
    destination_canonical.as_path(),
    overwrite.unwrap_or(false),
  )?;

  ensure_default_profile(destination_canonical.as_path())?;

  Ok(MigrateDataRootResult {
    data_root: destination_canonical.to_string_lossy().to_string(),
    summary,
  })
}

#[tauri::command]
fn reset_tracker_data(data_root: String) -> Result<String, String> {
  let root = resolve_data_root(Some(data_root))?;
  fs::create_dir_all(root.as_path())
    .map_err(|err| format!("Failed to create data root {}: {err}", root.display()))?;

  remove_path_if_exists(root.join("profiles").as_path())?;
  remove_path_if_exists(root.join("daily").as_path())?;
  remove_path_if_exists(root.join("weekly").as_path())?;
  remove_path_if_exists(root.join("templates").as_path())?;
  remove_path_if_exists(root.join("body.csv").as_path())?;

  Ok(root.to_string_lossy().to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .manage(FsWatchState::default())
    .plugin(tauri_plugin_process::init())
    .invoke_handler(tauri::generate_handler![
      updater_is_configured,
      ensure_data_root,
      list_profiles,
      ensure_profile,
      create_profile,
      delete_profile,
      read_text_file,
      write_text_file,
      list_files,
      start_data_root_watch,
      stop_data_root_watch,
      generate_llm_report,
      export_data_bundle,
      import_data_bundle,
      migrate_data_root,
      reset_tracker_data,
      webdav::get_webdav_config,
      webdav::save_webdav_config,
      webdav::test_webdav_connection,
      webdav::webdav_list_snapshots,
      webdav::webdav_push_snapshot,
      webdav::webdav_pull_snapshot,
      webdav::webdav_delete_snapshot
    ])
    .setup(|app| {
      #[cfg(desktop)]
      {
        let mut updater = tauri_plugin_updater::Builder::new();
        if let Some(pubkey) = updater_pubkey() {
          updater = updater.pubkey(pubkey);
        }
        app.handle().plugin(updater.build())?;
      }

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
