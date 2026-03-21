use std::fs;
use std::fs::File;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use reqwest::blocking::Client;
use reqwest::header::{ETAG, IF_MATCH, IF_NONE_MATCH};
use reqwest::StatusCode;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Manager};
use url::Url;
use uuid::Uuid;
use walkdir::WalkDir;
use zip::write::FileOptions;

const WEBDAV_CONFIG_FILE_NAME: &str = "webdav.config.json";
const WEBDAV_META_FILE_NAME: &str = "meta.json";
const WEBDAV_SNAPSHOTS_DIR: &str = "snapshots";
const WEBDAV_SCHEMA_VERSION: u32 = 1;
const WEBDAV_REALTIME_DIR: &str = "realtime";
const WEBDAV_REALTIME_FILES_DIR: &str = "realtime/files";
const WEBDAV_REALTIME_MANIFEST_FILE: &str = "realtime/manifest.json";
const WEBDAV_REALTIME_STATE_SCHEMA_VERSION: u32 = 1;

#[derive(Serialize, Deserialize, Clone)]
#[serde(default)]
#[serde(rename_all = "camelCase")]
pub struct WebdavConfig {
  pub enabled: bool,
  pub auto_pull_enabled: bool,
  pub remote_base_url: String,
  pub username: String,
  pub password: String,
  pub auto_push_interval_min: u32,
  pub request_timeout_sec: u32,
  pub max_snapshots: u32,
  pub verify_tls: bool,
  pub device_id: String,
}

impl Default for WebdavConfig {
  fn default() -> Self {
    WebdavConfig {
      enabled: false,
      auto_pull_enabled: false,
      remote_base_url: String::new(),
      username: String::new(),
      password: String::new(),
      auto_push_interval_min: 0,
      request_timeout_sec: 90,
      max_snapshots: 30,
      verify_tls: true,
      device_id: format!("device-{}", Uuid::new_v4()),
    }
  }
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WebdavSnapshot {
  pub id: String,
  pub created_at: u64,
  pub device_id: String,
  pub app_version: String,
  pub file_name: String,
  pub size_bytes: u64,
  pub sha256: String,
  pub note: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WebdavTestResult {
  pub ok: bool,
  pub message: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WebdavPushResult {
  pub snapshot: WebdavSnapshot,
  pub pruned_snapshot_ids: Vec<String>,
}

#[derive(Serialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct WebdavCopySummary {
  pub copied_files: u64,
  pub overwritten_files: u64,
  pub skipped_files: u64,
  pub created_dirs: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WebdavPullResult {
  pub snapshot: WebdavSnapshot,
  pub summary: WebdavCopySummary,
  pub backup_path: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WebdavDeleteSnapshotResult {
  pub deleted: bool,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RealtimeFileEntry {
  pub path: String,
  pub sha256: String,
  pub size: u64,
  pub mtime_ms: u64,
  pub updated_by: String,
  pub updated_at: u64,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RealtimeManifest {
  pub schema_version: u32,
  pub revision: u64,
  pub updated_at: u64,
  pub updated_by: String,
  pub files: Vec<RealtimeFileEntry>,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RealtimeConflict {
  pub id: String,
  pub path: String,
  pub local_sha: String,
  pub remote_sha: String,
  pub conflict_copy_path: Option<String>,
  pub created_at: u64,
  pub status: String,
  pub remote_present: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RealtimeSyncStatus {
  pub running: bool,
  pub last_push_at: Option<u64>,
  pub last_pull_at: Option<u64>,
  pub last_error: Option<String>,
  pub pending_changes: u64,
  pub conflicts_count: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RealtimeSyncResult {
  pub pushed: u64,
  pub pulled: u64,
  pub conflicts: u64,
  pub skipped_conflicts: u64,
  pub revision: u64,
  pub status: RealtimeSyncStatus,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RealtimeConflictResolveResult {
  pub resolved: bool,
  pub strategy: String,
  pub conflict: Option<RealtimeConflict>,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WebdavMeta {
  schema_version: u32,
  updated_at: u64,
  device_id: String,
  snapshots: Vec<WebdavSnapshot>,
}

struct WebdavClient {
  client: Client,
  base_url: Url,
  username: String,
  password: String,
}

struct MetaWithEtag {
  meta: WebdavMeta,
  etag: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct RealtimeState {
  schema_version: u32,
  data_root: String,
  base_revision: u64,
  base_files: Vec<RealtimeFileEntry>,
  conflicts: Vec<RealtimeConflict>,
  last_push_at: Option<u64>,
  last_pull_at: Option<u64>,
  last_error: Option<String>,
}

struct ManifestWithEtag {
  manifest: RealtimeManifest,
  etag: Option<String>,
}

#[derive(Clone)]
struct LocalFileMeta {
  sha256: String,
  size: u64,
  mtime_ms: u64,
}

fn now_unix_millis() -> u64 {
  match SystemTime::now().duration_since(UNIX_EPOCH) {
    Ok(duration) => duration.as_millis() as u64,
    Err(_) => 0,
  }
}

fn now_unix_seconds() -> u64 {
  match SystemTime::now().duration_since(UNIX_EPOCH) {
    Ok(duration) => duration.as_secs(),
    Err(_) => 0,
  }
}

fn default_webdav_config() -> WebdavConfig {
  WebdavConfig::default()
}

fn normalize_webdav_config(mut config: WebdavConfig) -> WebdavConfig {
  config.remote_base_url = config.remote_base_url.trim().to_string();
  config.username = config.username.trim().to_string();
  config.password = config.password.trim().to_string();
  config.auto_push_interval_min = config.auto_push_interval_min.min(24 * 60);
  config.request_timeout_sec = config.request_timeout_sec.clamp(10, 600);
  config.max_snapshots = config.max_snapshots.clamp(1, 365);
  config.device_id = config.device_id.trim().to_string();
  if config.device_id.is_empty() {
    config.device_id = format!("device-{}", Uuid::new_v4());
  }
  config
}

fn webdav_config_path(app: &AppHandle) -> Result<PathBuf, String> {
  let config_dir = app
    .path()
    .app_config_dir()
    .map_err(|err| format!("Failed to resolve app config directory: {err}"))?;

  fs::create_dir_all(config_dir.as_path())
    .map_err(|err| format!("Failed to create app config directory {}: {err}", config_dir.display()))?;
  Ok(config_dir.join(WEBDAV_CONFIG_FILE_NAME))
}

fn write_text_atomic(path: &Path, content: &str) -> Result<(), String> {
  let parent = path
    .parent()
    .ok_or_else(|| format!("Path {} has no parent directory", path.display()))?;
  fs::create_dir_all(parent)
    .map_err(|err| format!("Failed to create directory {}: {err}", parent.display()))?;

  let temp_path = parent.join(format!(
    ".{}.tmp-{}-{}",
    path.file_name().and_then(|name| name.to_str()).unwrap_or("dailytrack-temp"),
    std::process::id(),
    now_unix_millis()
  ));

  fs::write(temp_path.as_path(), content)
    .map_err(|err| format!("Failed to write temporary file {}: {err}", temp_path.display()))?;

  if let Err(rename_err) = fs::rename(temp_path.as_path(), path) {
    if path.exists() {
      fs::remove_file(path)
        .map_err(|err| format!("Failed to replace existing file {}: {err}", path.display()))?;
      fs::rename(temp_path.as_path(), path)
        .map_err(|err| format!("Failed to atomically replace file {} after remove: {err}", path.display()))?;
    } else {
      let _ = fs::remove_file(temp_path.as_path());
      return Err(format!("Failed to atomically write file {}: {rename_err}", path.display()));
    }
  }

  Ok(())
}

fn load_webdav_config(app: &AppHandle) -> Result<WebdavConfig, String> {
  let path = webdav_config_path(app)?;
  if !path.exists() {
    let config = default_webdav_config();
    let text = serde_json::to_string_pretty(&config)
      .map_err(|err| format!("Failed to serialize WebDAV config: {err}"))?;
    write_text_atomic(path.as_path(), format!("{text}\n").as_str())?;
    return Ok(config);
  }

  let raw = fs::read_to_string(path.as_path())
    .map_err(|err| format!("Failed to read WebDAV config {}: {err}", path.display()))?;
  let parsed: WebdavConfig = serde_json::from_str(raw.as_str())
    .map_err(|err| format!("Failed to parse WebDAV config {}: {err}", path.display()))?;
  let normalized = normalize_webdav_config(parsed);
  let normalized_text = serde_json::to_string_pretty(&normalized)
    .map_err(|err| format!("Failed to serialize normalized WebDAV config: {err}"))?;
  write_text_atomic(path.as_path(), format!("{normalized_text}\n").as_str())?;
  Ok(normalized)
}

fn save_webdav_config_internal(app: &AppHandle, config: WebdavConfig) -> Result<WebdavConfig, String> {
  let normalized = normalize_webdav_config(config);
  let path = webdav_config_path(app)?;
  let text = serde_json::to_string_pretty(&normalized)
    .map_err(|err| format!("Failed to serialize WebDAV config: {err}"))?;
  write_text_atomic(path.as_path(), format!("{text}\n").as_str())?;
  Ok(normalized)
}

fn default_realtime_manifest(device_id: String) -> RealtimeManifest {
  RealtimeManifest {
    schema_version: WEBDAV_SCHEMA_VERSION,
    revision: 0,
    updated_at: now_unix_millis(),
    updated_by: device_id,
    files: Vec::new(),
  }
}

fn default_realtime_state(data_root: String) -> RealtimeState {
  RealtimeState {
    schema_version: WEBDAV_REALTIME_STATE_SCHEMA_VERSION,
    data_root,
    base_revision: 0,
    base_files: Vec::new(),
    conflicts: Vec::new(),
    last_push_at: None,
    last_pull_at: None,
    last_error: None,
  }
}

fn write_bytes_atomic(path: &Path, content: &[u8]) -> Result<(), String> {
  let parent = path
    .parent()
    .ok_or_else(|| format!("Path {} has no parent directory", path.display()))?;
  fs::create_dir_all(parent)
    .map_err(|err| format!("Failed to create directory {}: {err}", parent.display()))?;

  let temp_path = parent.join(format!(
    ".{}.tmp-{}-{}",
    path.file_name().and_then(|name| name.to_str()).unwrap_or("dailytrack-temp"),
    std::process::id(),
    now_unix_millis()
  ));

  fs::write(temp_path.as_path(), content)
    .map_err(|err| format!("Failed to write temporary file {}: {err}", temp_path.display()))?;

  if let Err(rename_err) = fs::rename(temp_path.as_path(), path) {
    if path.exists() {
      fs::remove_file(path)
        .map_err(|err| format!("Failed to replace existing file {}: {err}", path.display()))?;
      fs::rename(temp_path.as_path(), path)
        .map_err(|err| format!("Failed to atomically replace file {} after remove: {err}", path.display()))?;
    } else {
      let _ = fs::remove_file(temp_path.as_path());
      return Err(format!("Failed to atomically write file {}: {rename_err}", path.display()));
    }
  }

  Ok(())
}

fn realtime_state_path(app: &AppHandle, data_root: &Path) -> Result<PathBuf, String> {
  let config_dir = app
    .path()
    .app_config_dir()
    .map_err(|err| format!("Failed to resolve app config directory: {err}"))?;
  fs::create_dir_all(config_dir.as_path())
    .map_err(|err| format!("Failed to create app config directory {}: {err}", config_dir.display()))?;

  let root_key = data_root.to_string_lossy().to_string();
  let digest = sha256_hex(root_key.as_bytes());
  let suffix = digest.chars().take(16).collect::<String>();
  Ok(config_dir.join(format!("webdav.realtime.state.{suffix}.json")))
}

fn load_realtime_state(app: &AppHandle, data_root: &Path) -> Result<RealtimeState, String> {
  let state_path = realtime_state_path(app, data_root)?;
  let root = data_root.to_string_lossy().to_string();

  if !state_path.exists() {
    let state = default_realtime_state(root);
    let text = serde_json::to_string_pretty(&state)
      .map_err(|err| format!("Failed to serialize default realtime state: {err}"))?;
    write_text_atomic(state_path.as_path(), format!("{text}\n").as_str())?;
    return Ok(state);
  }

  let raw = fs::read_to_string(state_path.as_path())
    .map_err(|err| format!("Failed to read realtime state {}: {err}", state_path.display()))?;
  let mut state: RealtimeState = serde_json::from_str(raw.as_str())
    .map_err(|err| format!("Failed to parse realtime state {}: {err}", state_path.display()))?;
  state.data_root = root;
  if state.schema_version != WEBDAV_REALTIME_STATE_SCHEMA_VERSION {
    state.schema_version = WEBDAV_REALTIME_STATE_SCHEMA_VERSION;
  }
  Ok(state)
}

fn save_realtime_state(app: &AppHandle, data_root: &Path, state: &RealtimeState) -> Result<(), String> {
  let state_path = realtime_state_path(app, data_root)?;
  let text = serde_json::to_string_pretty(state)
    .map_err(|err| format!("Failed to serialize realtime state: {err}"))?;
  write_text_atomic(state_path.as_path(), format!("{text}\n").as_str())
}

fn normalize_relative_path(value: &str) -> String {
  value.trim_start_matches('/').replace('\\', "/")
}

fn relative_path_from_absolute(root: &Path, absolute: &Path) -> Result<String, String> {
  let relative = absolute
    .strip_prefix(root)
    .map_err(|err| format!("Failed to strip data root prefix for {}: {err}", absolute.display()))?;
  let value = normalize_relative_path(relative.to_string_lossy().as_ref());
  Ok(value)
}

fn manifest_to_map(
  entries: &[RealtimeFileEntry],
) -> std::collections::HashMap<String, RealtimeFileEntry> {
  entries
    .iter()
    .cloned()
    .map(|entry| (entry.path.clone(), entry))
    .collect()
}

fn scan_local_files(root: &Path) -> Result<std::collections::HashMap<String, LocalFileMeta>, String> {
  let mut files = std::collections::HashMap::new();

  for entry in WalkDir::new(root).min_depth(1) {
    let entry = entry.map_err(|err| format!("Failed to walk {}: {err}", root.display()))?;
    if !entry.file_type().is_file() {
      continue;
    }

    let absolute = entry.path().to_path_buf();
    let relative = relative_path_from_absolute(root, absolute.as_path())?;
    if relative.starts_with("conflicts/") || relative.ends_with(".DS_Store") {
      continue;
    }

    let bytes = fs::read(absolute.as_path())
      .map_err(|err| format!("Failed to read local file {}: {err}", absolute.display()))?;
    let sha256 = sha256_hex(bytes.as_slice());
    let metadata = fs::metadata(absolute.as_path())
      .map_err(|err| format!("Failed to read metadata {}: {err}", absolute.display()))?;
    let mtime_ms = metadata
      .modified()
      .ok()
      .and_then(|value| value.duration_since(UNIX_EPOCH).ok())
      .map(|value| value.as_millis() as u64)
      .unwrap_or(0);

    files.insert(
      relative,
      LocalFileMeta {
        sha256,
        size: metadata.len(),
        mtime_ms,
      },
    );
  }

  Ok(files)
}

fn unresolved_conflict_paths(conflicts: &[RealtimeConflict]) -> std::collections::HashSet<String> {
  conflicts
    .iter()
    .filter(|item| item.status == "unresolved")
    .map(|item| item.path.clone())
    .collect()
}

fn calculate_pending_changes(
  base_map: &std::collections::HashMap<String, RealtimeFileEntry>,
  local_map: &std::collections::HashMap<String, LocalFileMeta>,
  unresolved_paths: &std::collections::HashSet<String>,
) -> u64 {
  let mut all_paths = std::collections::HashSet::new();
  all_paths.extend(base_map.keys().cloned());
  all_paths.extend(local_map.keys().cloned());

  let mut changed: u64 = 0;
  for path in all_paths {
    if unresolved_paths.contains(path.as_str()) {
      continue;
    }
    let base_sha = base_map.get(path.as_str()).map(|entry| entry.sha256.as_str());
    let local_sha = local_map.get(path.as_str()).map(|entry| entry.sha256.as_str());
    if base_sha != local_sha {
      changed += 1;
    }
  }

  changed + unresolved_paths.len() as u64
}

fn sanitize_conflict_file_name(path: &str) -> String {
  path
    .replace('/', "__")
    .replace('\\', "__")
    .replace(':', "_")
}

fn build_conflict_copy_relative_path(path: &str, device_id: &str) -> String {
  let name = sanitize_conflict_file_name(path);
  format!(
    "conflicts/{}.conflict-{}-{}",
    name,
    now_unix_seconds(),
    sanitize_conflict_file_name(device_id)
  )
}

fn list_sorted_union_paths(
  base_map: &std::collections::HashMap<String, RealtimeFileEntry>,
  local_map: &std::collections::HashMap<String, LocalFileMeta>,
  remote_map: &std::collections::HashMap<String, RealtimeFileEntry>,
) -> Vec<String> {
  let mut all_paths = std::collections::HashSet::new();
  all_paths.extend(base_map.keys().cloned());
  all_paths.extend(local_map.keys().cloned());
  all_paths.extend(remote_map.keys().cloned());
  let mut sorted = all_paths.into_iter().collect::<Vec<_>>();
  sorted.sort();
  sorted
}

fn upsert_unresolved_conflict(
  state: &mut RealtimeState,
  path: &str,
  local_sha: Option<&str>,
  remote_sha: Option<&str>,
  conflict_copy_path: Option<String>,
  remote_present: bool,
) {
  if state
    .conflicts
    .iter()
    .any(|item| item.path == path && item.status == "unresolved")
  {
    return;
  }

  state.conflicts.push(RealtimeConflict {
    id: Uuid::new_v4().to_string(),
    path: path.to_string(),
    local_sha: local_sha.unwrap_or("").to_string(),
    remote_sha: remote_sha.unwrap_or("").to_string(),
    conflict_copy_path,
    created_at: now_unix_millis(),
    status: "unresolved".to_string(),
    remote_present,
  });
}

fn summarize_realtime_status(
  state: &RealtimeState,
  local_map: &std::collections::HashMap<String, LocalFileMeta>,
) -> RealtimeSyncStatus {
  let base_map = manifest_to_map(state.base_files.as_slice());
  let unresolved = unresolved_conflict_paths(state.conflicts.as_slice());
  let pending_changes = calculate_pending_changes(&base_map, local_map, &unresolved);
  RealtimeSyncStatus {
    running: false,
    last_push_at: state.last_push_at,
    last_pull_at: state.last_pull_at,
    last_error: state.last_error.clone(),
    pending_changes,
    conflicts_count: unresolved.len() as u64,
  }
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum RealtimeSyncDirection {
  Push,
  Pull,
  Both,
}

impl RealtimeSyncDirection {
  fn allows_push(self) -> bool {
    matches!(self, RealtimeSyncDirection::Push | RealtimeSyncDirection::Both)
  }

  fn allows_pull(self) -> bool {
    matches!(self, RealtimeSyncDirection::Pull | RealtimeSyncDirection::Both)
  }
}

fn parse_realtime_sync_direction(value: Option<String>) -> Result<RealtimeSyncDirection, String> {
  let normalized = value
    .unwrap_or_else(|| "both".to_string())
    .trim()
    .to_ascii_lowercase();
  match normalized.as_str() {
    "push" => Ok(RealtimeSyncDirection::Push),
    "pull" => Ok(RealtimeSyncDirection::Pull),
    "both" => Ok(RealtimeSyncDirection::Both),
    _ => Err("Invalid sync direction. Use push, pull, or both".to_string()),
  }
}

fn save_state_error(
  app: &AppHandle,
  data_root: &Path,
  mut state: RealtimeState,
  error: String,
) -> Result<(), String> {
  state.last_error = Some(error);
  save_realtime_state(app, data_root, &state)
}

fn realtime_sync_once(
  app: &AppHandle,
  data_root: &Path,
  direction: RealtimeSyncDirection,
) -> Result<RealtimeSyncResult, String> {
  let config = load_webdav_config(app)?;
  let client = WebdavClient::new(&config)?;
  client.ensure_remote_layout()?;
  client.ensure_realtime_layout()?;

  let mut state = load_realtime_state(app, data_root)?;
  let manifest_with_etag = client.get_realtime_manifest(config.device_id.as_str())?;
  let mut remote_manifest = manifest_with_etag.manifest.clone();
  let mut remote_map = manifest_to_map(remote_manifest.files.as_slice());
  let base_map = manifest_to_map(state.base_files.as_slice());
  let local_map = scan_local_files(data_root)?;
  let unresolved = unresolved_conflict_paths(state.conflicts.as_slice());
  let mut pushed: u64 = 0;
  let mut pulled: u64 = 0;
  let mut conflicts: u64 = 0;
  let mut skipped_conflicts: u64 = 0;
  let mut remote_touched = false;
  let now_ms = now_unix_millis();

  for path in list_sorted_union_paths(&base_map, &local_map, &remote_map) {
    if unresolved.contains(path.as_str()) {
      skipped_conflicts += 1;
      continue;
    }

    let base_sha = base_map.get(path.as_str()).map(|entry| entry.sha256.as_str());
    let local_sha = local_map.get(path.as_str()).map(|entry| entry.sha256.as_str());
    let remote_sha = remote_map.get(path.as_str()).map(|entry| entry.sha256.as_str());

    let local_changed = local_sha != base_sha;
    let remote_changed = remote_sha != base_sha;

    if local_changed && remote_changed {
      if local_sha == remote_sha {
        continue;
      }

      let conflict_copy_path = if remote_map.contains_key(path.as_str()) {
        let bytes = client.download_realtime_file(path.as_str())?;
        let relative_conflict_path = build_conflict_copy_relative_path(path.as_str(), config.device_id.as_str());
        let absolute = data_root.join(relative_conflict_path.as_str());
        write_bytes_atomic(absolute.as_path(), bytes.as_slice())?;
        Some(relative_conflict_path)
      } else {
        None
      };

      upsert_unresolved_conflict(
        &mut state,
        path.as_str(),
        local_sha,
        remote_sha,
        conflict_copy_path,
        remote_map.contains_key(path.as_str()),
      );
      conflicts += 1;
      continue;
    }

    if local_changed && direction.allows_push() {
      if let Some(local_meta) = local_map.get(path.as_str()) {
        let bytes = fs::read(data_root.join(path.as_str()).as_path())
          .map_err(|err| format!("Failed to read local file {} for push: {err}", path))?;
        client.upload_realtime_file(path.as_str(), bytes)?;
        remote_map.insert(
          path.clone(),
          RealtimeFileEntry {
            path: path.clone(),
            sha256: local_meta.sha256.clone(),
            size: local_meta.size,
            mtime_ms: local_meta.mtime_ms,
            updated_by: config.device_id.clone(),
            updated_at: now_ms,
          },
        );
      } else {
        let _ = client.delete_realtime_file(path.as_str())?;
        remote_map.remove(path.as_str());
      }
      pushed += 1;
      remote_touched = true;
      continue;
    }

    if remote_changed && direction.allows_pull() {
      if remote_map.contains_key(path.as_str()) {
        let bytes = client.download_realtime_file(path.as_str())?;
        let absolute = data_root.join(path.as_str());
        write_bytes_atomic(absolute.as_path(), bytes.as_slice())?;
      } else {
        let absolute = data_root.join(path.as_str());
        if absolute.exists() {
          fs::remove_file(absolute.as_path())
            .map_err(|err| format!("Failed to remove local file {}: {err}", absolute.display()))?;
        }
      }
      pulled += 1;
    }
  }

  if remote_touched {
    let mut updated_files = remote_map.into_values().collect::<Vec<_>>();
    updated_files.sort_by(|a, b| a.path.cmp(&b.path));
    remote_manifest.files = updated_files;
    remote_manifest.revision = remote_manifest.revision.saturating_add(1);
    remote_manifest.updated_at = now_ms;
    remote_manifest.updated_by = config.device_id.clone();

    client.put_realtime_manifest(&remote_manifest, manifest_with_etag.etag.as_deref())?;
  }

  let latest_manifest = if remote_touched {
    remote_manifest
  } else {
    manifest_with_etag.manifest
  };
  let latest_local = scan_local_files(data_root)?;

  state.base_revision = latest_manifest.revision;
  state.base_files = latest_manifest.files.clone();
  state.schema_version = WEBDAV_REALTIME_STATE_SCHEMA_VERSION;
  state.data_root = data_root.to_string_lossy().to_string();
  if pushed > 0 {
    state.last_push_at = Some(now_ms);
  }
  if pulled > 0 {
    state.last_pull_at = Some(now_ms);
  }
  state.last_error = None;
  save_realtime_state(app, data_root, &state)?;

  let status = summarize_realtime_status(&state, &latest_local);

  Ok(RealtimeSyncResult {
    pushed,
    pulled,
    conflicts,
    skipped_conflicts,
    revision: state.base_revision,
    status,
  })
}

fn ensure_config_ready(config: &WebdavConfig) -> Result<(), String> {
  if !config.enabled {
    return Err("WebDAV sync is disabled. Enable it in Settings first.".to_string());
  }
  if config.remote_base_url.trim().is_empty() {
    return Err("WebDAV remote base URL is required".to_string());
  }
  if config.username.trim().is_empty() {
    return Err("WebDAV username is required".to_string());
  }
  if config.password.trim().is_empty() {
    return Err("WebDAV password is required".to_string());
  }
  Ok(())
}

fn normalize_remote_base_url(raw: &str) -> Result<Url, String> {
  let trimmed = raw.trim();
  if trimmed.is_empty() {
    return Err("WebDAV remote base URL is required".to_string());
  }

  let mut url = Url::parse(trimmed)
    .map_err(|err| format!("Invalid WebDAV remote URL {trimmed}: {err}"))?;
  let scheme = url.scheme().to_ascii_lowercase();
  if scheme != "http" && scheme != "https" {
    return Err("WebDAV remote URL must use http or https".to_string());
  }

  if url.query().is_some() || url.fragment().is_some() {
    return Err("WebDAV remote URL must not include query or fragment".to_string());
  }

  if !url.path().ends_with('/') {
    let next_path = format!("{}/", url.path());
    url.set_path(next_path.as_str());
  }

  Ok(url)
}

impl WebdavClient {
  fn new(config: &WebdavConfig) -> Result<Self, String> {
    ensure_config_ready(config)?;
    let base_url = normalize_remote_base_url(config.remote_base_url.as_str())?;
    let client = Client::builder()
      .timeout(Duration::from_secs(config.request_timeout_sec as u64))
      .danger_accept_invalid_certs(!config.verify_tls)
      .build()
      .map_err(|err| format!("Failed to create WebDAV HTTP client: {err}"))?;

    Ok(Self {
      client,
      base_url,
      username: config.username.clone(),
      password: config.password.clone(),
    })
  }

  fn url_for(&self, relative: &str) -> Result<Url, String> {
    if relative.is_empty() {
      return Ok(self.base_url.clone());
    }
    self
      .base_url
      .join(relative)
      .map_err(|err| format!("Failed to resolve WebDAV URL for {relative}: {err}"))
  }

  fn request(&self, method: reqwest::Method, relative: &str) -> Result<reqwest::blocking::RequestBuilder, String> {
    let url = self.url_for(relative)?;
    Ok(
      self
        .client
        .request(method, url)
        .basic_auth(self.username.as_str(), Some(self.password.as_str()))
        .header(reqwest::header::USER_AGENT, "dailytrack-webdav"),
    )
  }

  fn mkcol(&self, relative: &str) -> Result<(), String> {
    let method = reqwest::Method::from_bytes(b"MKCOL")
      .map_err(|err| format!("Failed to build MKCOL method: {err}"))?;
    let response = self
      .request(method, relative)?
      .send()
      .map_err(|err| format!("Failed to MKCOL {relative}: {err}"))?;

    let status = response.status();
    if status == StatusCode::CREATED
      || status == StatusCode::METHOD_NOT_ALLOWED
      || status == StatusCode::OK
      || status == StatusCode::NO_CONTENT
    {
      return Ok(());
    }

    let body = response.text().unwrap_or_else(|_| "".to_string());
    Err(format!("WebDAV MKCOL failed for {relative}: {status} {body}"))
  }

  fn ensure_remote_layout(&self) -> Result<(), String> {
    self.mkcol("")?;
    self.mkcol("snapshots/")?;
    Ok(())
  }

  fn get_meta(&self) -> Result<MetaWithEtag, String> {
    let response = self
      .request(reqwest::Method::GET, WEBDAV_META_FILE_NAME)?
      .send()
      .map_err(|err| format!("Failed to GET WebDAV meta.json: {err}"))?;

    if response.status() == StatusCode::NOT_FOUND {
      return Ok(MetaWithEtag {
        meta: WebdavMeta {
          schema_version: WEBDAV_SCHEMA_VERSION,
          updated_at: now_unix_millis(),
          device_id: String::new(),
          snapshots: Vec::new(),
        },
        etag: None,
      });
    }

    if !response.status().is_success() {
      let status = response.status();
      let body = response.text().unwrap_or_else(|_| "".to_string());
      return Err(format!("WebDAV GET meta.json failed: {status} {body}"));
    }

    let etag = response
      .headers()
      .get(ETAG)
      .and_then(|value| value.to_str().ok())
      .map(|value| value.to_string());

    let meta: WebdavMeta = response
      .json()
      .map_err(|err| format!("Failed to parse WebDAV meta.json: {err}"))?;

    Ok(MetaWithEtag { meta, etag })
  }

  fn put_meta(&self, meta: &WebdavMeta, etag: Option<&str>) -> Result<(), String> {
    let payload = serde_json::to_vec_pretty(meta)
      .map_err(|err| format!("Failed to serialize WebDAV meta.json: {err}"))?;
    let mut request = self
      .request(reqwest::Method::PUT, WEBDAV_META_FILE_NAME)?
      .header(reqwest::header::CONTENT_TYPE, "application/json")
      .body(payload);

    request = if let Some(value) = etag {
      request.header(IF_MATCH, value)
    } else {
      request.header(IF_NONE_MATCH, "*")
    };

    let response = request
      .send()
      .map_err(|err| format!("Failed to PUT WebDAV meta.json: {err}"))?;

    if response.status() == StatusCode::PRECONDITION_FAILED {
      return Err("WEBDAV_META_ETAG_CONFLICT".to_string());
    }

    if !response.status().is_success() {
      let status = response.status();
      let body = response.text().unwrap_or_else(|_| "".to_string());
      return Err(format!("WebDAV PUT meta.json failed: {status} {body}"));
    }

    Ok(())
  }

  fn upload_snapshot(&self, file_name: &str, bytes: Vec<u8>) -> Result<(), String> {
    let relative = format!("{WEBDAV_SNAPSHOTS_DIR}/{file_name}");
    let response = self
      .request(reqwest::Method::PUT, relative.as_str())?
      .header(reqwest::header::CONTENT_TYPE, "application/zip")
      .body(bytes)
      .send()
      .map_err(|err| format!("Failed to upload WebDAV snapshot {file_name}: {err}"))?;

    if !response.status().is_success() {
      let status = response.status();
      let body = response.text().unwrap_or_else(|_| "".to_string());
      return Err(format!("WebDAV upload failed for {file_name}: {status} {body}"));
    }

    Ok(())
  }

  fn download_snapshot(&self, file_name: &str) -> Result<Vec<u8>, String> {
    let relative = format!("{WEBDAV_SNAPSHOTS_DIR}/{file_name}");
    let response = self
      .request(reqwest::Method::GET, relative.as_str())?
      .send()
      .map_err(|err| format!("Failed to download WebDAV snapshot {file_name}: {err}"))?;

    if !response.status().is_success() {
      let status = response.status();
      let body = response.text().unwrap_or_else(|_| "".to_string());
      return Err(format!("WebDAV download failed for {file_name}: {status} {body}"));
    }

    response
      .bytes()
      .map(|bytes| bytes.to_vec())
      .map_err(|err| format!("Failed to read downloaded snapshot bytes: {err}"))
  }

  fn delete_snapshot_file(&self, file_name: &str) -> Result<bool, String> {
    let relative = format!("{WEBDAV_SNAPSHOTS_DIR}/{file_name}");
    let response = self
      .request(reqwest::Method::DELETE, relative.as_str())?
      .send()
      .map_err(|err| format!("Failed to delete WebDAV snapshot {file_name}: {err}"))?;

    if response.status().is_success() {
      return Ok(true);
    }
    if response.status() == StatusCode::NOT_FOUND {
      return Ok(false);
    }

    let status = response.status();
    let body = response.text().unwrap_or_else(|_| "".to_string());
    Err(format!("WebDAV delete failed for {file_name}: {status} {body}"))
  }

  fn ensure_realtime_layout(&self) -> Result<(), String> {
    self.mkcol(WEBDAV_REALTIME_DIR)?;
    self.mkcol(WEBDAV_REALTIME_FILES_DIR)?;
    Ok(())
  }

  fn ensure_realtime_file_parent_dirs(&self, relative_path: &str) -> Result<(), String> {
    let normalized = normalize_relative_path(relative_path);
    let parent = Path::new(normalized.as_str()).parent();
    let Some(parent) = parent else {
      return Ok(());
    };

    let mut current = String::from(WEBDAV_REALTIME_FILES_DIR);
    for segment in parent.iter() {
      let value = segment.to_string_lossy();
      if value.is_empty() {
        continue;
      }
      current.push('/');
      current.push_str(value.as_ref());
      self.mkcol(current.as_str())?;
    }

    Ok(())
  }

  fn get_realtime_manifest(&self, device_id: &str) -> Result<ManifestWithEtag, String> {
    let response = self
      .request(reqwest::Method::GET, WEBDAV_REALTIME_MANIFEST_FILE)?
      .send()
      .map_err(|err| format!("Failed to GET WebDAV realtime manifest: {err}"))?;

    if response.status() == StatusCode::NOT_FOUND {
      return Ok(ManifestWithEtag {
        manifest: default_realtime_manifest(device_id.to_string()),
        etag: None,
      });
    }

    if !response.status().is_success() {
      let status = response.status();
      let body = response.text().unwrap_or_else(|_| "".to_string());
      return Err(format!("WebDAV GET realtime manifest failed: {status} {body}"));
    }

    let etag = response
      .headers()
      .get(ETAG)
      .and_then(|value| value.to_str().ok())
      .map(|value| value.to_string());

    let mut manifest: RealtimeManifest = response
      .json()
      .map_err(|err| format!("Failed to parse realtime manifest: {err}"))?;
    if manifest.schema_version != WEBDAV_SCHEMA_VERSION {
      manifest.schema_version = WEBDAV_SCHEMA_VERSION;
    }

    Ok(ManifestWithEtag { manifest, etag })
  }

  fn put_realtime_manifest(
    &self,
    manifest: &RealtimeManifest,
    etag: Option<&str>,
  ) -> Result<(), String> {
    let payload = serde_json::to_vec_pretty(manifest)
      .map_err(|err| format!("Failed to serialize realtime manifest: {err}"))?;
    let mut request = self
      .request(reqwest::Method::PUT, WEBDAV_REALTIME_MANIFEST_FILE)?
      .header(reqwest::header::CONTENT_TYPE, "application/json")
      .body(payload);

    request = if let Some(value) = etag {
      request.header(IF_MATCH, value)
    } else {
      request.header(IF_NONE_MATCH, "*")
    };

    let response = request
      .send()
      .map_err(|err| format!("Failed to PUT realtime manifest: {err}"))?;

    if response.status() == StatusCode::PRECONDITION_FAILED {
      return Err("WEBDAV_REALTIME_ETAG_CONFLICT".to_string());
    }

    if !response.status().is_success() {
      let status = response.status();
      let body = response.text().unwrap_or_else(|_| "".to_string());
      return Err(format!("WebDAV PUT realtime manifest failed: {status} {body}"));
    }

    Ok(())
  }

  fn upload_realtime_file(&self, relative_path: &str, bytes: Vec<u8>) -> Result<(), String> {
    let normalized = normalize_relative_path(relative_path);
    self.ensure_realtime_file_parent_dirs(normalized.as_str())?;
    let remote_file = format!("{WEBDAV_REALTIME_FILES_DIR}/{normalized}");
    let response = self
      .request(reqwest::Method::PUT, remote_file.as_str())?
      .header(reqwest::header::CONTENT_TYPE, "application/octet-stream")
      .body(bytes)
      .send()
      .map_err(|err| format!("Failed to upload realtime file {normalized}: {err}"))?;

    if !response.status().is_success() {
      let status = response.status();
      let body = response.text().unwrap_or_else(|_| "".to_string());
      return Err(format!("WebDAV upload realtime file failed for {normalized}: {status} {body}"));
    }

    Ok(())
  }

  fn download_realtime_file(&self, relative_path: &str) -> Result<Vec<u8>, String> {
    let normalized = normalize_relative_path(relative_path);
    let remote_file = format!("{WEBDAV_REALTIME_FILES_DIR}/{normalized}");
    let response = self
      .request(reqwest::Method::GET, remote_file.as_str())?
      .send()
      .map_err(|err| format!("Failed to download realtime file {normalized}: {err}"))?;

    if !response.status().is_success() {
      let status = response.status();
      let body = response.text().unwrap_or_else(|_| "".to_string());
      return Err(format!("WebDAV download realtime file failed for {normalized}: {status} {body}"));
    }

    response
      .bytes()
      .map(|bytes| bytes.to_vec())
      .map_err(|err| format!("Failed to read downloaded realtime file bytes: {err}"))
  }

  fn delete_realtime_file(&self, relative_path: &str) -> Result<bool, String> {
    let normalized = normalize_relative_path(relative_path);
    let remote_file = format!("{WEBDAV_REALTIME_FILES_DIR}/{normalized}");
    let response = self
      .request(reqwest::Method::DELETE, remote_file.as_str())?
      .send()
      .map_err(|err| format!("Failed to delete realtime file {normalized}: {err}"))?;

    if response.status().is_success() {
      return Ok(true);
    }
    if response.status() == StatusCode::NOT_FOUND {
      return Ok(false);
    }

    let status = response.status();
    let body = response.text().unwrap_or_else(|_| "".to_string());
    Err(format!("WebDAV delete realtime file failed for {normalized}: {status} {body}"))
  }
}

fn canonicalize_existing_dir(path: &str) -> Result<PathBuf, String> {
  if path.trim().is_empty() {
    return Err("Data root path is empty".to_string());
  }
  let root = PathBuf::from(path);
  if !root.exists() || !root.is_dir() {
    return Err(format!("Data root {} does not exist or is not a directory", root.display()));
  }
  fs::canonicalize(root.as_path())
    .map_err(|err| format!("Failed to resolve data root {}: {err}", root.display()))
}

fn ensure_dir_canonical(path: &str) -> Result<PathBuf, String> {
  if path.trim().is_empty() {
    return Err("Data root path is empty".to_string());
  }
  let root = PathBuf::from(path);
  fs::create_dir_all(root.as_path())
    .map_err(|err| format!("Failed to create data root {}: {err}", root.display()))?;
  fs::canonicalize(root.as_path())
    .map_err(|err| format!("Failed to resolve data root {}: {err}", root.display()))
}

fn make_relative_zip_path(root: &Path, absolute: &Path) -> Result<String, String> {
  let relative = absolute
    .strip_prefix(root)
    .map_err(|err| format!("Failed to resolve zip relative path {}: {err}", absolute.display()))?;
  let value = relative.to_string_lossy().replace('\\', "/");
  Ok(value)
}

fn zip_data_root(source_root: &Path, zip_path: &Path) -> Result<u64, String> {
  let file = File::create(zip_path)
    .map_err(|err| format!("Failed to create zip file {}: {err}", zip_path.display()))?;
  let mut zip = zip::ZipWriter::new(file);
  let options = FileOptions::default().compression_method(zip::CompressionMethod::Deflated);

  for entry in WalkDir::new(source_root).min_depth(1) {
    let entry = entry.map_err(|err| format!("Failed to walk {}: {err}", source_root.display()))?;
    let path = entry.path();
    let name = make_relative_zip_path(source_root, path)?;

    if entry.file_type().is_dir() {
      let folder_name = if name.ends_with('/') { name } else { format!("{name}/") };
      zip
        .add_directory(folder_name, options)
        .map_err(|err| format!("Failed to add directory to zip: {err}"))?;
      continue;
    }

    if entry.file_type().is_file() {
      zip
        .start_file(name, options)
        .map_err(|err| format!("Failed to add file to zip: {err}"))?;
      let mut source_file = File::open(path)
        .map_err(|err| format!("Failed to open file {}: {err}", path.display()))?;
      let mut buffer = Vec::new();
      source_file
        .read_to_end(&mut buffer)
        .map_err(|err| format!("Failed to read file {}: {err}", path.display()))?;
      zip
        .write_all(buffer.as_slice())
        .map_err(|err| format!("Failed to write zip file content: {err}"))?;
    }
  }

  zip
    .finish()
    .map_err(|err| format!("Failed to finalize zip archive: {err}"))?;

  let metadata = fs::metadata(zip_path)
    .map_err(|err| format!("Failed to read zip metadata {}: {err}", zip_path.display()))?;
  Ok(metadata.len())
}

fn unzip_snapshot(zip_path: &Path, destination: &Path) -> Result<(), String> {
  let file = File::open(zip_path)
    .map_err(|err| format!("Failed to open zip file {}: {err}", zip_path.display()))?;
  let mut archive = zip::ZipArchive::new(file)
    .map_err(|err| format!("Failed to read zip archive {}: {err}", zip_path.display()))?;

  for index in 0..archive.len() {
    let mut entry = archive
      .by_index(index)
      .map_err(|err| format!("Failed to read zip entry: {err}"))?;
    let entry_path = entry
      .enclosed_name()
      .ok_or_else(|| "Zip entry has invalid enclosed path".to_string())?
      .to_path_buf();
    let output_path = destination.join(entry_path);

    if entry.is_dir() {
      fs::create_dir_all(output_path.as_path())
        .map_err(|err| format!("Failed to create output directory {}: {err}", output_path.display()))?;
      continue;
    }

    if let Some(parent) = output_path.parent() {
      fs::create_dir_all(parent)
        .map_err(|err| format!("Failed to create output parent directory {}: {err}", parent.display()))?;
    }

    let mut output_file = File::create(output_path.as_path())
      .map_err(|err| format!("Failed to create output file {}: {err}", output_path.display()))?;
    std::io::copy(&mut entry, &mut output_file)
      .map_err(|err| format!("Failed to extract zip entry {}: {err}", output_path.display()))?;
  }

  Ok(())
}

fn sha256_hex(bytes: &[u8]) -> String {
  let mut hasher = Sha256::new();
  hasher.update(bytes);
  let output = hasher.finalize();
  output.iter().map(|byte| format!("{byte:02x}")).collect::<String>()
}

fn clear_dir_contents(path: &Path) -> Result<(), String> {
  if !path.exists() {
    return Ok(());
  }

  for entry in fs::read_dir(path)
    .map_err(|err| format!("Failed to read directory {}: {err}", path.display()))?
  {
    let entry = entry.map_err(|err| format!("Failed to read directory entry: {err}"))?;
    let entry_path = entry.path();
    if entry_path.is_dir() {
      fs::remove_dir_all(entry_path.as_path())
        .map_err(|err| format!("Failed to remove directory {}: {err}", entry_path.display()))?;
    } else {
      fs::remove_file(entry_path.as_path())
        .map_err(|err| format!("Failed to remove file {}: {err}", entry_path.display()))?;
    }
  }

  Ok(())
}

fn copy_dir_recursive_with_summary(
  source: &Path,
  destination: &Path,
  overwrite: bool,
  summary: &mut WebdavCopySummary,
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
      copy_dir_recursive_with_summary(source_path.as_path(), destination_path.as_path(), overwrite, summary)?;
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

fn copy_dir_recursive(source: &Path, destination: &Path, overwrite: bool) -> Result<WebdavCopySummary, String> {
  let mut summary = WebdavCopySummary::default();
  copy_dir_recursive_with_summary(source, destination, overwrite, &mut summary)?;
  Ok(summary)
}

fn create_temp_work_dir(prefix: &str) -> Result<PathBuf, String> {
  let path = std::env::temp_dir().join(format!("dailytrack-{prefix}-{}", Uuid::new_v4()));
  fs::create_dir_all(path.as_path())
    .map_err(|err| format!("Failed to create temporary directory {}: {err}", path.display()))?;
  Ok(path)
}

fn create_local_backup(data_root: &Path) -> Result<String, String> {
  let parent = data_root
    .parent()
    .ok_or_else(|| format!("Data root {} has no parent directory", data_root.display()))?;
  let backup_path = parent.join(format!("dailytrack-webdav-backup-{}", now_unix_seconds()));
  copy_dir_recursive(data_root, backup_path.as_path(), false)?;
  Ok(backup_path.to_string_lossy().to_string())
}

fn build_snapshot_id(device_id: &str) -> String {
  format!("{}-{}", now_unix_seconds(), device_id.replace(' ', "-"))
}

fn sort_snapshots_desc(snapshots: &mut [WebdavSnapshot]) {
  snapshots.sort_by(|left, right| right.created_at.cmp(&left.created_at));
}

fn persist_meta_with_retry(client: &WebdavClient, mut meta: WebdavMeta, etag: Option<String>) -> Result<(), String> {
  let mut current_etag = etag;
  for _ in 0..2 {
    match client.put_meta(&meta, current_etag.as_deref()) {
      Ok(()) => return Ok(()),
      Err(err) if err == "WEBDAV_META_ETAG_CONFLICT" => {
        let latest = client.get_meta()?;
        let mut merged = latest.meta;
        for snapshot in &meta.snapshots {
          if !merged.snapshots.iter().any(|item| item.id == snapshot.id) {
            merged.snapshots.push(snapshot.clone());
          }
        }
        sort_snapshots_desc(merged.snapshots.as_mut_slice());
        merged.updated_at = now_unix_millis();
        meta = merged;
        current_etag = latest.etag;
      }
      Err(err) => return Err(err),
    }
  }

  Err("Failed to persist WebDAV meta.json after conflict retries".to_string())
}

#[tauri::command]
pub fn get_webdav_config(app: AppHandle) -> Result<WebdavConfig, String> {
  load_webdav_config(&app)
}

#[tauri::command]
pub fn save_webdav_config(app: AppHandle, config: WebdavConfig) -> Result<WebdavConfig, String> {
  save_webdav_config_internal(&app, config)
}

#[tauri::command]
pub fn test_webdav_connection(app: AppHandle) -> Result<WebdavTestResult, String> {
  let config = load_webdav_config(&app)?;
  let client = WebdavClient::new(&config)?;
  client.ensure_remote_layout()?;
  let _ = client.get_meta()?;
  Ok(WebdavTestResult {
    ok: true,
    message: "WebDAV connection succeeded".to_string(),
  })
}

#[tauri::command]
pub fn webdav_list_snapshots(app: AppHandle) -> Result<Vec<WebdavSnapshot>, String> {
  let config = load_webdav_config(&app)?;
  let client = WebdavClient::new(&config)?;
  let mut meta = client.get_meta()?.meta;
  sort_snapshots_desc(meta.snapshots.as_mut_slice());
  Ok(meta.snapshots)
}

#[tauri::command]
pub fn webdav_push_snapshot(
  app: AppHandle,
  data_root: String,
  note: Option<String>,
) -> Result<WebdavPushResult, String> {
  let root = canonicalize_existing_dir(data_root.as_str())?;
  let config = load_webdav_config(&app)?;
  let client = WebdavClient::new(&config)?;
  client.ensure_remote_layout()?;

  let work_dir = create_temp_work_dir("webdav-push")?;
  let snapshot_id = build_snapshot_id(config.device_id.as_str());
  let file_name = format!("{snapshot_id}.zip");
  let zip_path = work_dir.join(file_name.as_str());

  let size_bytes = zip_data_root(root.as_path(), zip_path.as_path())?;
  let bytes = fs::read(zip_path.as_path())
    .map_err(|err| format!("Failed to read built snapshot {}: {err}", zip_path.display()))?;
  let sha256 = sha256_hex(bytes.as_slice());

  client.upload_snapshot(file_name.as_str(), bytes)?;

  let mut meta_with_etag = client.get_meta()?;
  let snapshot = WebdavSnapshot {
    id: snapshot_id,
    created_at: now_unix_millis(),
    device_id: config.device_id.clone(),
    app_version: app.package_info().version.to_string(),
    file_name,
    size_bytes,
    sha256,
    note: note.map(|value| value.trim().to_string()).filter(|value| !value.is_empty()),
  };

  meta_with_etag.meta.schema_version = WEBDAV_SCHEMA_VERSION;
  meta_with_etag.meta.device_id = config.device_id.clone();
  meta_with_etag.meta.updated_at = now_unix_millis();
  meta_with_etag.meta.snapshots.push(snapshot.clone());
  sort_snapshots_desc(meta_with_etag.meta.snapshots.as_mut_slice());

  let mut pruned_snapshot_ids: Vec<String> = Vec::new();
  if meta_with_etag.meta.snapshots.len() > config.max_snapshots as usize {
    let keep = config.max_snapshots as usize;
    let removed: Vec<WebdavSnapshot> = meta_with_etag.meta.snapshots.drain(keep..).collect();
    for old in removed {
      let _ = client.delete_snapshot_file(old.file_name.as_str());
      pruned_snapshot_ids.push(old.id);
    }
  }

  persist_meta_with_retry(&client, meta_with_etag.meta, meta_with_etag.etag)?;

  let _ = fs::remove_dir_all(work_dir.as_path());

  Ok(WebdavPushResult {
    snapshot,
    pruned_snapshot_ids,
  })
}

#[tauri::command]
pub fn webdav_pull_snapshot(
  app: AppHandle,
  data_root: String,
  snapshot_id: Option<String>,
  overwrite: Option<bool>,
  backup_before_pull: Option<bool>,
) -> Result<WebdavPullResult, String> {
  let overwrite = overwrite.unwrap_or(true);
  let backup_before_pull = backup_before_pull.unwrap_or(true);
  let root = ensure_dir_canonical(data_root.as_str())?;
  let config = load_webdav_config(&app)?;
  let client = WebdavClient::new(&config)?;

  let mut meta = client.get_meta()?.meta;
  if meta.snapshots.is_empty() {
    return Err("No WebDAV snapshots available".to_string());
  }
  sort_snapshots_desc(meta.snapshots.as_mut_slice());

  let target_snapshot = if let Some(id) = snapshot_id.as_deref() {
    meta
      .snapshots
      .iter()
      .find(|item| item.id == id)
      .cloned()
      .ok_or_else(|| format!("Snapshot {id} not found"))?
  } else {
    meta
      .snapshots
      .first()
      .cloned()
      .ok_or_else(|| "No WebDAV snapshots available".to_string())?
  };

  let work_dir = create_temp_work_dir("webdav-pull")?;
  let zip_path = work_dir.join(target_snapshot.file_name.as_str());
  let bytes = client.download_snapshot(target_snapshot.file_name.as_str())?;
  let checksum = sha256_hex(bytes.as_slice());
  if !target_snapshot.sha256.trim().is_empty() && checksum != target_snapshot.sha256 {
    return Err(format!(
      "Snapshot checksum mismatch for {}. Expected {}, got {}",
      target_snapshot.id,
      target_snapshot.sha256,
      checksum
    ));
  }

  fs::write(zip_path.as_path(), bytes)
    .map_err(|err| format!("Failed to write downloaded snapshot {}: {err}", zip_path.display()))?;

  let extract_dir = work_dir.join("extract");
  fs::create_dir_all(extract_dir.as_path())
    .map_err(|err| format!("Failed to create extract directory {}: {err}", extract_dir.display()))?;
  unzip_snapshot(zip_path.as_path(), extract_dir.as_path())?;

  let backup_path = if backup_before_pull {
    Some(create_local_backup(root.as_path())?)
  } else {
    None
  };

  if !overwrite {
    let mut entries = fs::read_dir(root.as_path())
      .map_err(|err| format!("Failed to inspect data root {}: {err}", root.display()))?;
    if entries.next().is_some() {
      return Err("Data root is not empty and overwrite is disabled".to_string());
    }
  }

  if overwrite {
    clear_dir_contents(root.as_path())?;
  }

  let summary = copy_dir_recursive(extract_dir.as_path(), root.as_path(), true)?;

  let _ = fs::remove_dir_all(work_dir.as_path());

  Ok(WebdavPullResult {
    snapshot: target_snapshot,
    summary,
    backup_path,
  })
}

#[tauri::command]
pub fn webdav_delete_snapshot(app: AppHandle, snapshot_id: String) -> Result<WebdavDeleteSnapshotResult, String> {
  let id = snapshot_id.trim();
  if id.is_empty() {
    return Err("Snapshot ID is required".to_string());
  }

  let config = load_webdav_config(&app)?;
  let client = WebdavClient::new(&config)?;

  let mut meta_with_etag = client.get_meta()?;
  let before_len = meta_with_etag.meta.snapshots.len();
  let mut removed_file_name: Option<String> = None;
  meta_with_etag.meta.snapshots.retain(|snapshot| {
    if snapshot.id == id {
      removed_file_name = Some(snapshot.file_name.clone());
      false
    } else {
      true
    }
  });

  if meta_with_etag.meta.snapshots.len() == before_len {
    return Ok(WebdavDeleteSnapshotResult { deleted: false });
  }

  meta_with_etag.meta.updated_at = now_unix_millis();
  persist_meta_with_retry(&client, meta_with_etag.meta, meta_with_etag.etag)?;

  if let Some(file_name) = removed_file_name {
    let _ = client.delete_snapshot_file(file_name.as_str());
  }

  Ok(WebdavDeleteSnapshotResult { deleted: true })
}

#[tauri::command]
pub fn webdav_realtime_status(app: AppHandle, data_root: String) -> Result<RealtimeSyncStatus, String> {
  let root = ensure_dir_canonical(data_root.as_str())?;
  let state = load_realtime_state(&app, root.as_path())?;
  let local_map = scan_local_files(root.as_path())?;
  Ok(summarize_realtime_status(&state, &local_map))
}

#[tauri::command]
pub fn webdav_realtime_sync_now(
  app: AppHandle,
  data_root: String,
  direction: Option<String>,
) -> Result<RealtimeSyncResult, String> {
  let root = ensure_dir_canonical(data_root.as_str())?;
  let state = load_realtime_state(&app, root.as_path())?;
  let parsed_direction = parse_realtime_sync_direction(direction)?;

  match realtime_sync_once(&app, root.as_path(), parsed_direction) {
    Ok(result) => Ok(result),
    Err(error) => {
      let _ = save_state_error(&app, root.as_path(), state, error.clone());
      Err(error)
    }
  }
}

#[tauri::command]
pub fn webdav_realtime_conflicts_list(
  app: AppHandle,
  data_root: String,
) -> Result<Vec<RealtimeConflict>, String> {
  let root = ensure_dir_canonical(data_root.as_str())?;
  let mut state = load_realtime_state(&app, root.as_path())?;
  state
    .conflicts
    .sort_by(|left, right| right.created_at.cmp(&left.created_at));
  Ok(state.conflicts)
}

#[tauri::command]
pub fn webdav_realtime_conflict_resolve(
  app: AppHandle,
  data_root: String,
  conflict_id: String,
  strategy: String,
) -> Result<RealtimeConflictResolveResult, String> {
  let root = ensure_dir_canonical(data_root.as_str())?;
  let mut state = load_realtime_state(&app, root.as_path())?;
  let normalized_strategy = strategy.trim().to_ascii_lowercase();
  if normalized_strategy != "keep_local"
    && normalized_strategy != "apply_remote"
    && normalized_strategy != "mark_resolved"
  {
    return Err("Invalid resolve strategy. Use keep_local, apply_remote, or mark_resolved".to_string());
  }

  let Some(conflict) = state
    .conflicts
    .iter_mut()
    .find(|item| item.id == conflict_id && item.status == "unresolved")
  else {
    return Ok(RealtimeConflictResolveResult {
      resolved: false,
      strategy: normalized_strategy,
      conflict: None,
    });
  };

  if normalized_strategy == "apply_remote" {
    if conflict.remote_present {
      let relative_conflict_path = conflict
        .conflict_copy_path
        .clone()
        .ok_or_else(|| "Missing conflict copy path for remote content".to_string())?;
      let absolute_conflict = root.join(relative_conflict_path.as_str());
      if !absolute_conflict.exists() {
        return Err(format!(
          "Conflict copy file does not exist: {}",
          absolute_conflict.display()
        ));
      }
      let bytes = fs::read(absolute_conflict.as_path()).map_err(|err| {
        format!(
          "Failed to read conflict copy {}: {err}",
          absolute_conflict.display()
        )
      })?;
      let target = root.join(conflict.path.as_str());
      write_bytes_atomic(target.as_path(), bytes.as_slice())?;
    } else {
      let target = root.join(conflict.path.as_str());
      if target.exists() {
        fs::remove_file(target.as_path())
          .map_err(|err| format!("Failed to remove local file {}: {err}", target.display()))?;
      }
    }
  }

  conflict.status = "resolved".to_string();
  let output = conflict.clone();
  save_realtime_state(&app, root.as_path(), &state)?;

  Ok(RealtimeConflictResolveResult {
    resolved: true,
    strategy: normalized_strategy,
    conflict: Some(output),
  })
}
