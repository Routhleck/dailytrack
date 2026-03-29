use std::fs;
use std::collections::HashMap;
use std::io::{Cursor, Write};
use std::path::{Component, Path, PathBuf};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use notify::{
  event::{DataChange, ModifyKind},
  Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher,
};
use serde::Serialize;
use tauri::Emitter;
use tauri::Manager;
use zip::write::FileOptions;
use zip::CompressionMethod;
mod webdav;

const DEFAULT_DAILY_TEMPLATE: &str = include_str!("templates/daily_default.md");

const DEFAULT_WEEKLY_TEMPLATE: &str = include_str!("templates/weekly_default.md");

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
struct TrashProfileResult {
  trash_path: String,
  fallback_profile: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct PurgeTrashResult {
  removed: u64,
  kept: u64,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct GenerateLlmReportResult {
  content: String,
}

fn default_data_root(app: Option<&tauri::AppHandle>) -> Result<PathBuf, String> {
  let home = std::env::var("HOME")
    .or_else(|_| std::env::var("USERPROFILE"))
    .ok();

  let Some(home) = home else {
    if let Some(app_handle) = app {
      if let Ok(app_data_dir) = app_handle.path().app_data_dir() {
        return Ok(app_data_dir.join(DEFAULT_DATA_ROOT_DIR));
      }
    }
    let fallback = std::env::current_dir()
      .unwrap_or_else(|_| std::env::temp_dir())
      .join(DEFAULT_DATA_ROOT_DIR);
    return Ok(fallback);
  };

  let preferred = PathBuf::from(&home).join(DEFAULT_DATA_ROOT_DIR);
  let legacy = PathBuf::from(home).join(LEGACY_DATA_ROOT_DIR);

  if preferred.exists() {
    return Ok(preferred);
  }

  if legacy.exists() {
    return Ok(legacy);
  }

  if (cfg!(target_os = "android") || cfg!(target_os = "ios")) && app.is_some() {
    if let Some(app_handle) = app {
      if let Ok(app_data_dir) = app_handle.path().app_data_dir() {
        return Ok(app_data_dir.join(DEFAULT_DATA_ROOT_DIR));
      }
    }
  }

  Ok(preferred)
}

fn resolve_data_root(data_root: Option<String>) -> Result<PathBuf, String> {
  match data_root {
    Some(path) if !path.trim().is_empty() => Ok(PathBuf::from(path)),
    _ => default_data_root(None),
  }
}

fn resolve_data_root_with_app(
  data_root: Option<String>,
  app: &tauri::AppHandle,
) -> Result<PathBuf, String> {
  match data_root {
    Some(path) if !path.trim().is_empty() => Ok(PathBuf::from(path)),
    _ => default_data_root(Some(app)),
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

fn canonicalize_nearest_existing_ancestor(path: &Path) -> Result<(PathBuf, PathBuf), String> {
  let mut cursor = Some(path);
  while let Some(current) = cursor {
    if current.exists() {
      let canonical = fs::canonicalize(current)
        .map_err(|err| format!("Failed to resolve existing path {}: {err}", current.display()))?;
      return Ok((current.to_path_buf(), canonical));
    }
    cursor = current.parent();
  }

  Err(format!("Path {} has no existing ancestor", path.display()))
}

fn validate_relative_path_components(path: &Path) -> Result<(), String> {
  for component in path.components() {
    if matches!(component, Component::ParentDir | Component::RootDir | Component::Prefix(_)) {
      return Err(format!(
        "Path contains disallowed component for writable target: {}",
        path.display()
      ));
    }
  }
  Ok(())
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
  let (existing_ancestor_raw, canonical_ancestor) = canonicalize_nearest_existing_ancestor(parent)?;
  ensure_path_within_root(root, canonical_ancestor.as_path())?;

  // Keep relative computation based on the original (possibly symlinked) ancestor path.
  // On Android, `/data/data/...` and `/data/user/0/...` can refer to the same location,
  // and mixing canonical + raw prefixes would incorrectly reject writable in-root paths.
  let relative_target = raw
    .strip_prefix(existing_ancestor_raw.as_path())
    .map_err(|err| {
      format!(
        "Path {} is not under writable ancestor {} (canonical {}): {err}",
        raw.display(),
        existing_ancestor_raw.display(),
        canonical_ancestor.display()
      )
    })?;
  if relative_target.as_os_str().is_empty() {
    return Err(format!("Path {} has no writable target", raw.display()));
  }
  validate_relative_path_components(relative_target)?;

  let target = canonical_ancestor.join(relative_target);
  ensure_path_within_root(root, target.as_path())?;

  if target.file_name().is_none() {
    return Err(format!("Path {} has no file name", target.display()));
  }

  Ok(target)
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

fn trash_root(base_root: &Path) -> PathBuf {
  base_root.join(".trash")
}

fn move_profile_to_trash(
  base_root: &Path,
  profile_name: &str,
) -> Result<(PathBuf, String), String> {
  let source = profile_root(base_root, profile_name);
  if !source.exists() {
    return Err(format!("Profile {} does not exist", profile_name));
  }

  let profiles = list_profile_names(base_root)?;
  if profiles.len() <= 1 {
    return Err("Cannot delete the last remaining profile".to_string());
  }

  let trash_dir = trash_root(base_root);
  fs::create_dir_all(trash_dir.as_path())
    .map_err(|err| format!("Failed to create trash directory: {err}"))?;

  let timestamp = now_unix_millis();
  let trash_entry_name = format!("{}-{}", profile_name, timestamp);
  let destination = trash_dir.join(trash_entry_name.as_str());

  fs::rename(source.as_path(), destination.as_path()).map_err(|err| {
    format!(
      "Failed to move profile {} to trash: {err}",
      profile_name
    )
  })?;

  let remaining = list_profile_names(base_root)?;
  let fallback = if remaining.iter().any(|name| name == DEFAULT_PROFILE_NAME) {
    DEFAULT_PROFILE_NAME.to_string()
  } else {
    remaining
      .first()
      .cloned()
      .ok_or_else(|| "No remaining profile after trash".to_string())?
  };

  Ok((destination, fallback))
}

fn restore_profile_from_trash(
  base_root: &Path,
  trash_entry: &str,
  profile_name: &str,
) -> Result<(), String> {
  let trash_dir = trash_root(base_root);
  let source = trash_dir.join(trash_entry);
  if !source.exists() || !source.is_dir() {
    return Err(format!("Trash entry {} does not exist", trash_entry));
  }

  let destination = profile_root(base_root, profile_name);
  if destination.exists() {
    return Err(format!(
      "Profile {} already exists, cannot restore over it",
      profile_name
    ));
  }

  fs::rename(source.as_path(), destination.as_path()).map_err(|err| {
    format!(
      "Failed to restore profile {} from trash: {err}",
      profile_name
    )
  })?;

  Ok(())
}

const TRASH_MAX_AGE_MS: u64 = 7 * 24 * 60 * 60 * 1000;

fn parse_trash_entry_timestamp_ms(entry_name: &str) -> Option<u64> {
  entry_name.rsplit('-').next().and_then(|s| s.parse().ok())
}

fn purge_old_trash_entries(base_root: &Path) -> Result<(u64, u64), String> {
  let trash_dir = trash_root(base_root);
  if !trash_dir.exists() {
    return Ok((0, 0));
  }

  let now = now_unix_millis();
  let mut removed: u64 = 0;
  let mut kept: u64 = 0;

  let entries = fs::read_dir(trash_dir.as_path())
    .map_err(|err| format!("Failed to read trash directory: {err}"))?;

  for entry in entries {
    let entry = entry.map_err(|err| format!("Failed to read trash entry: {err}"))?;
    let path = entry.path();
    if !path.is_dir() {
      continue;
    }

    let name = match entry.file_name().into_string() {
      Ok(name) => name,
      Err(_) => continue,
    };

    // Entry format: <profile_name>-<timestamp_ms>
    let timestamp = parse_trash_entry_timestamp_ms(name.as_str()).unwrap_or(0);

    if timestamp > 0 && now.saturating_sub(timestamp) > TRASH_MAX_AGE_MS {
      if fs::remove_dir_all(path.as_path()).is_ok() {
        removed += 1;
      }
    } else {
      kept += 1;
    }
  }

  Ok((removed, kept))
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

fn build_export_zip(source_root: &Path, zip_path: &Path) -> Result<CopySummary, String> {
  let zip_file = fs::File::create(zip_path)
    .map_err(|err| format!("Failed to create export zip {}: {err}", zip_path.display()))?;
  let mut writer = zip::ZipWriter::new(zip_file);
  let mut summary = CopySummary::default();
  let file_options = FileOptions::default()
    .compression_method(CompressionMethod::Deflated)
    .unix_permissions(0o644);
  let dir_options = FileOptions::default()
    .compression_method(CompressionMethod::Deflated)
    .unix_permissions(0o755);

  for entry in walkdir::WalkDir::new(source_root).min_depth(1).into_iter() {
    let entry = entry.map_err(|err| format!("Failed to walk source {}: {err}", source_root.display()))?;
    let path = entry.path();
    let relative = path.strip_prefix(source_root).map_err(|err| {
      format!(
        "Failed to resolve export relative path {} from {}: {err}",
        path.display(),
        source_root.display()
      )
    })?;
    let normalized = relative.to_string_lossy().replace('\\', "/");
    if normalized.is_empty() {
      continue;
    }

    if entry.file_type().is_dir() {
      writer
        .add_directory(format!("{normalized}/"), dir_options)
        .map_err(|err| format!("Failed to add directory {normalized} to zip: {err}"))?;
      summary.created_dirs += 1;
      continue;
    }

    if entry.file_type().is_file() {
      writer
        .start_file(normalized.as_str(), file_options)
        .map_err(|err| format!("Failed to add file {normalized} to zip: {err}"))?;
      let mut input = fs::File::open(path)
        .map_err(|err| format!("Failed to read export file {}: {err}", path.display()))?;
      std::io::copy(&mut input, &mut writer)
        .map_err(|err| format!("Failed to write file {normalized} to zip: {err}"))?;
      summary.copied_files += 1;
    }
  }

  writer
    .finish()
    .map_err(|err| format!("Failed to finalize export zip {}: {err}", zip_path.display()))?;

  Ok(summary)
}

fn import_bundle_from_directory(
  source_root: &Path,
  data_root: &Path,
  overwrite: bool,
) -> Result<ImportDataBundleResult, String> {
  validate_bundle_root(source_root)?;
  ensure_tracker_layout(data_root)?;

  let source_canonical = fs::canonicalize(source_root).map_err(|err| {
    format!(
      "Failed to resolve import source {}: {err}",
      source_root.to_string_lossy()
    )
  })?;
  let target_canonical = fs::canonicalize(data_root).map_err(|err| {
    format!(
      "Failed to resolve data root {}: {err}",
      data_root.to_string_lossy()
    )
  })?;

  if source_canonical == target_canonical {
    return Err("Import source cannot be the same as current data root".to_string());
  }

  let summary = copy_dir_recursive(
    source_canonical.as_path(),
    target_canonical.as_path(),
    overwrite,
  )?;
  Ok(ImportDataBundleResult {
    data_root: target_canonical.to_string_lossy().to_string(),
    summary,
  })
}

fn extract_zip_to_temp_dir(zip_bytes: &[u8], temp_dir: &Path) -> Result<PathBuf, String> {
  fs::create_dir_all(temp_dir)
    .map_err(|err| format!("Failed to create temp import directory {}: {err}", temp_dir.display()))?;

  let cursor = Cursor::new(zip_bytes.to_vec());
  let mut archive = zip::ZipArchive::new(cursor)
    .map_err(|err| format!("Failed to open zip archive: {err}"))?;

  for index in 0..archive.len() {
    let mut entry = archive
      .by_index(index)
      .map_err(|err| format!("Failed to read zip entry #{index}: {err}"))?;
    let enclosed = entry
      .enclosed_name()
      .ok_or_else(|| format!("Invalid zip entry path: {}", entry.name()))?;
    let out_path = temp_dir.join(enclosed);

    if entry.name().ends_with('/') {
      fs::create_dir_all(out_path.as_path())
        .map_err(|err| format!("Failed to create directory {}: {err}", out_path.display()))?;
      continue;
    }

    if let Some(parent) = out_path.parent() {
      fs::create_dir_all(parent)
        .map_err(|err| format!("Failed to create directory {}: {err}", parent.display()))?;
    }

    let mut output = fs::File::create(out_path.as_path())
      .map_err(|err| format!("Failed to create file {}: {err}", out_path.display()))?;
    std::io::copy(&mut entry, &mut output)
      .map_err(|err| format!("Failed to extract file {}: {err}", out_path.display()))?;
    output
      .flush()
      .map_err(|err| format!("Failed to flush file {}: {err}", out_path.display()))?;
  }

  let entries: Vec<PathBuf> = fs::read_dir(temp_dir)
    .map_err(|err| format!("Failed to read extracted import directory {}: {err}", temp_dir.display()))?
    .filter_map(Result::ok)
    .map(|entry| entry.path())
    .collect();

  if entries.len() == 1 && entries[0].is_dir() {
    return Ok(entries[0].clone());
  }

  Ok(temp_dir.to_path_buf())
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
fn updater_is_supported() -> bool {
  cfg!(desktop)
}

#[tauri::command]
fn updater_is_configured(app: tauri::AppHandle) -> bool {
  if !cfg!(desktop) {
    return false;
  }

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
fn ensure_data_root(app: tauri::AppHandle, data_root: Option<String>) -> Result<EnsureDataRootResult, String> {
  let root = resolve_data_root_with_app(data_root, &app)?;
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
fn trash_profile(data_root: String, profile_name: String) -> Result<TrashProfileResult, String> {
  validate_profile_name(profile_name.as_str())?;
  let base_root = resolve_data_root(Some(data_root))?;
  let (trash_path, fallback) = move_profile_to_trash(base_root.as_path(), profile_name.as_str())?;
  Ok(TrashProfileResult {
    trash_path: trash_path.to_string_lossy().to_string(),
    fallback_profile: fallback,
  })
}

#[tauri::command]
fn restore_profile(data_root: String, trash_entry: String, profile_name: String) -> Result<(), String> {
  validate_profile_name(profile_name.as_str())?;
  let base_root = resolve_data_root(Some(data_root))?;
  restore_profile_from_trash(base_root.as_path(), trash_entry.as_str(), profile_name.as_str())
}

#[tauri::command]
fn purge_trash(data_root: String) -> Result<PurgeTrashResult, String> {
  let base_root = resolve_data_root(Some(data_root))?;
  let (removed, kept) = purge_old_trash_entries(base_root.as_path())?;
  Ok(PurgeTrashResult { removed, kept })
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
async fn generate_llm_report(
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

  let client = reqwest::Client::builder()
    .timeout(std::time::Duration::from_secs(90))
    .build()
    .map_err(|err| format!("Failed to build HTTP client: {err}"))?;

  let response = client
    .post(endpoint.as_str())
    .header(reqwest::header::AUTHORIZATION, format!("Bearer {}", api_key.trim()))
    .header(reqwest::header::CONTENT_TYPE, "application/json")
    .json(&payload)
    .send()
    .await
    .map_err(|err| format!("Failed to call LLM provider: {err}"))?;

  if !response.status().is_success() {
    let status = response.status();
    let body = response
      .text()
      .await
      .unwrap_or_else(|_| "Failed to read error response body".to_string());
    return Err(format!("LLM provider returned {status}: {body}"));
  }

  let body: serde_json::Value = response
    .json()
    .await
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

  let mut bundle_path = destination_base.join(format!("dailytrack-export-{timestamp}.zip"));
  let mut suffix = 1;
  while bundle_path.exists() {
    bundle_path = destination_base.join(format!("dailytrack-export-{timestamp}-{suffix}.zip"));
    suffix += 1;
  }

  if bundle_path.starts_with(source_root.as_path()) {
    return Err(format!(
      "Export destination {} cannot be inside current data root {}",
      bundle_path.display(),
      source_root.display()
    ));
  }

  let summary = build_export_zip(source_root.as_path(), bundle_path.as_path())?;
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
  let target_root = PathBuf::from(data_root);
  import_bundle_from_directory(
    source_root.as_path(),
    target_root.as_path(),
    overwrite.unwrap_or(true),
  )
}

#[tauri::command]
fn import_data_bundle_zip(
  zip_bytes: Vec<u8>,
  data_root: String,
  overwrite: Option<bool>,
) -> Result<ImportDataBundleResult, String> {
  if zip_bytes.is_empty() {
    return Err("Import zip is empty".to_string());
  }

  let target_root = PathBuf::from(data_root);
  let temp_dir = std::env::temp_dir().join(format!("dailytrack-import-{}", now_unix_millis()));
  let result = (|| {
    let extracted_source = extract_zip_to_temp_dir(zip_bytes.as_slice(), temp_dir.as_path())?;
    import_bundle_from_directory(
      extracted_source.as_path(),
      target_root.as_path(),
      overwrite.unwrap_or(true),
    )
  })();

  let _ = fs::remove_dir_all(temp_dir.as_path());
  result
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

#[cfg(test)]
mod tests {
  use super::*;
  use uuid::Uuid;

  struct TempRoot {
    path: PathBuf,
  }

  impl TempRoot {
    fn new() -> Self {
      let path = std::env::temp_dir().join(format!("dailytrack-trash-test-{}", Uuid::new_v4()));
      fs::create_dir_all(path.as_path()).expect("failed to create temp root");
      Self { path }
    }
  }

  impl Drop for TempRoot {
    fn drop(&mut self) {
      let _ = fs::remove_dir_all(self.path.as_path());
    }
  }

  #[test]
  fn trash_and_restore_profile_roundtrip() {
    let root = TempRoot::new();
    let default_profile = profile_root(root.path.as_path(), "default");
    let work_profile = profile_root(root.path.as_path(), "work");
    ensure_tracker_layout(default_profile.as_path()).expect("failed to create default profile layout");
    ensure_tracker_layout(work_profile.as_path()).expect("failed to create work profile layout");

    let (trash_path, fallback) =
      move_profile_to_trash(root.path.as_path(), "work").expect("failed to move profile to trash");
    assert_eq!(fallback, "default");
    assert!(!work_profile.exists());
    assert!(trash_path.exists());

    let trash_entry = trash_path
      .file_name()
      .and_then(|name| name.to_str())
      .expect("missing trash entry name")
      .to_string();
    restore_profile_from_trash(root.path.as_path(), trash_entry.as_str(), "work")
      .expect("failed to restore profile");
    assert!(work_profile.exists());
    assert!(!trash_path.exists());
  }

  #[test]
  fn purge_old_trash_entries_removes_only_expired_entries() {
    let root = TempRoot::new();
    let trash_dir = trash_root(root.path.as_path());
    fs::create_dir_all(trash_dir.as_path()).expect("failed to create trash dir");

    let now = now_unix_millis();
    let old_entry = trash_dir.join(format!("old-{}", now.saturating_sub(TRASH_MAX_AGE_MS + 5_000)));
    let recent_entry = trash_dir.join(format!("recent-{}", now.saturating_sub(5_000)));
    let invalid_entry = trash_dir.join("no-timestamp");

    fs::create_dir_all(old_entry.as_path()).expect("failed to create old entry");
    fs::create_dir_all(recent_entry.as_path()).expect("failed to create recent entry");
    fs::create_dir_all(invalid_entry.as_path()).expect("failed to create invalid entry");

    let (removed, kept) = purge_old_trash_entries(root.path.as_path()).expect("failed to purge trash");

    assert_eq!(removed, 1);
    assert_eq!(kept, 2);
    assert!(!old_entry.exists());
    assert!(recent_entry.exists());
    assert!(invalid_entry.exists());
  }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .manage(FsWatchState::default())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_process::init())
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_http::init())
    .invoke_handler(tauri::generate_handler![
      updater_is_supported,
      updater_is_configured,
      ensure_data_root,
      list_profiles,
      ensure_profile,
      create_profile,
      delete_profile,
      trash_profile,
      restore_profile,
      purge_trash,
      read_text_file,
      write_text_file,
      list_files,
      start_data_root_watch,
      stop_data_root_watch,
      generate_llm_report,
      export_data_bundle,
      import_data_bundle,
      import_data_bundle_zip,
      migrate_data_root,
      reset_tracker_data,
      webdav::get_webdav_config,
      webdav::save_webdav_config,
      webdav::test_webdav_connection,
      webdav::webdav_list_snapshots,
      webdav::webdav_push_snapshot,
      webdav::webdav_pull_snapshot,
      webdav::webdav_delete_snapshot,
      webdav::webdav_realtime_status,
      webdav::webdav_realtime_sync_now,
      webdav::webdav_realtime_conflicts_list,
      webdav::webdav_realtime_conflict_resolve,
      webdav::webdav_realtime_conflicts_resolve_batch
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

      #[cfg(debug_assertions)]
      {
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
