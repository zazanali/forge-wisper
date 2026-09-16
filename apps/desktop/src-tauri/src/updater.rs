use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateInfo {
    pub current_version: String,
    pub latest_version: String,
    pub has_update: bool,
    pub release_title: String,
    pub release_notes: String,
    pub published_at: String,
    pub download_url: String,
    pub asset_name: String,
    pub asset_size_bytes: u64,
}

#[derive(Deserialize)]
struct GitHubAsset {
    name: String,
    browser_download_url: String,
    size: u64,
}

#[derive(Deserialize)]
struct GitHubRelease {
    tag_name: String,
    name: Option<String>,
    body: Option<String>,
    published_at: Option<String>,
    html_url: Option<String>,
    assets: Vec<GitHubAsset>,
}

static UPDATE_CACHE: OnceLock<Mutex<Option<(Instant, UpdateInfo)>>> = OnceLock::new();

fn get_cache() -> &'static Mutex<Option<(Instant, UpdateInfo)>> {
    UPDATE_CACHE.get_or_init(|| Mutex::new(None))
}

/// Compares two semver strings (e.g. "0.1.2" and "v0.1.3").
/// Returns true if latest > current.
pub fn is_version_newer(current: &str, latest: &str) -> bool {
    let parse_parts = |s: &str| -> (u32, u32, u32) {
        let clean = s.trim().trim_start_matches('v').trim_start_matches('V');
        let mut parts = clean.split('.').filter_map(|p| {
            // Take digits before any pre-release suffix (e.g., "1-beta" -> 1)
            let digits: String = p.chars().take_while(|c| c.is_ascii_digit()).collect();
            digits.parse::<u32>().ok()
        });
        let major = parts.next().unwrap_or(0);
        let minor = parts.next().unwrap_or(0);
        let patch = parts.next().unwrap_or(0);
        (major, minor, patch)
    };

    let cur = parse_parts(current);
    let lat = parse_parts(latest);

    if lat.0 != cur.0 {
        return lat.0 > cur.0;
    }
    if lat.1 != cur.1 {
        return lat.1 > cur.1;
    }
    lat.2 > cur.2
}

/// Checks GitHub Releases for new Forge Wisper versions.
pub async fn check_github_update(repo: &str, force: bool) -> Result<UpdateInfo, String> {
    // Check in-memory cache if not forced (cache valid for 15 minutes)
    if !force {
        if let Ok(cache) = get_cache().lock() {
            if let Some((timestamp, ref info)) = *cache {
                if timestamp.elapsed() < Duration::from_secs(15 * 60) {
                    return Ok(info.clone());
                }
            }
        }
    }

    let current_version = env!("CARGO_PKG_VERSION").to_string();
    let url = format!("https://api.github.com/repos/{}/releases/latest", repo);

    let client = reqwest::Client::builder()
        .user_agent("ForgeWisper-DesktopApp")
        .timeout(Duration::from_secs(8))
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {e}"))?;

    let response = client
        .get(&url)
        .header("Accept", "application/vnd.github.v3+json")
        .send()
        .await
        .map_err(|e| format!("Network error checking for updates: {e}"))?;

    if !response.status().is_success() {
        return Err(format!(
            "GitHub Releases returned HTTP {}",
            response.status()
        ));
    }

    let release: GitHubRelease = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse release metadata: {e}"))?;

    let latest_version = release.tag_name.trim_start_matches('v').to_string();
    let has_update = is_version_newer(&current_version, &latest_version);

    // Pick preferred installer asset (.exe or .msi for Windows, .dmg for macOS)
    let mut selected_url = String::new();
    let mut selected_name = String::new();
    let mut selected_size = 0u64;

    #[cfg(target_os = "windows")]
    {
        // First try .exe, then .msi
        if let Some(asset) = release
            .assets
            .iter()
            .find(|a| a.name.to_lowercase().ends_with(".exe"))
            .or_else(|| {
                release
                    .assets
                    .iter()
                    .find(|a| a.name.to_lowercase().ends_with(".msi"))
            })
        {
            selected_url = asset.browser_download_url.clone();
            selected_name = asset.name.clone();
            selected_size = asset.size;
        }
    }

    #[cfg(target_os = "macos")]
    {
        if let Some(asset) = release
            .assets
            .iter()
            .find(|a| a.name.to_lowercase().ends_with(".dmg"))
        {
            selected_url = asset.browser_download_url.clone();
            selected_name = asset.name.clone();
            selected_size = asset.size;
        }
    }

    // Fallback if no matching binary asset is found: direct release HTML URL
    if selected_url.is_empty() {
        if let Some(asset) = release.assets.first() {
            selected_url = asset.browser_download_url.clone();
            selected_name = asset.name.clone();
            selected_size = asset.size;
        } else {
            selected_url = release
                .html_url
                .unwrap_or_else(|| format!("https://github.com/{}/releases/latest", repo));
            selected_name = "Forge Wisper Release".to_string();
        }
    }

    let info = UpdateInfo {
        current_version,
        latest_version: release.tag_name.clone(),
        has_update,
        release_title: release.name.unwrap_or_else(|| release.tag_name.clone()),
        release_notes: release.body.unwrap_or_else(|| "General improvements and bug fixes.".to_string()),
        published_at: release.published_at.unwrap_or_default(),
        download_url: selected_url,
        asset_name: selected_name,
        asset_size_bytes: selected_size,
    };

    if let Ok(mut cache) = get_cache().lock() {
        *cache = Some((Instant::now(), info.clone()));
    }

    Ok(info)
}

/// Downloads the update installer with real-time progress callbacks.
pub async fn download_update_installer<F>(
    download_url: &str,
    asset_name: &str,
    mut progress_callback: F,
) -> Result<PathBuf, String>
where
    F: FnMut(u64, u64) + Send + 'static,
{
    let client = reqwest::Client::builder()
        .user_agent("ForgeWisper-DesktopApp")
        .build()
        .map_err(|e| format!("Failed to create download client: {e}"))?;

    let response = client
        .get(download_url)
        .send()
        .await
        .map_err(|e| format!("Failed to initiate download: {e}"))?;

    if !response.status().is_success() {
        return Err(format!("Download failed with status: {}", response.status()));
    }

    let total_size = response.content_length().unwrap_or(0);

    let temp_dir = std::env::temp_dir().join("forge-wisper-updates");
    tokio::fs::create_dir_all(&temp_dir)
        .await
        .map_err(|e| format!("Failed to create update directory: {e}"))?;

    let clean_name = if asset_name.trim().is_empty() {
        "ForgeWisper-Update.exe"
    } else {
        asset_name
    };

    let target_file = temp_dir.join(clean_name);

    use tokio::io::AsyncWriteExt;
    let mut file = tokio::fs::File::create(&target_file)
        .await
        .map_err(|e| format!("Failed to create destination file: {e}"))?;

    let mut mut_response = response;
    let mut downloaded = 0u64;

    while let Some(chunk) = mut_response
        .chunk()
        .await
        .map_err(|e| format!("Error downloading chunk: {e}"))?
    {
        file.write_all(&chunk)
            .await
            .map_err(|e| format!("Error writing chunk to file: {e}"))?;

        downloaded += chunk.len() as u64;
        progress_callback(downloaded, total_size);
    }

    file.flush()
        .await
        .map_err(|e| format!("Failed to flush downloaded file: {e}"))?;

    Ok(target_file)
}

/// Launches the downloaded installer and exits the app so the update completes.
pub fn launch_installer_and_exit(installer_path: &str) -> Result<(), String> {
    let path = PathBuf::from(installer_path);
    if !path.exists() {
        return Err(format!("Installer file not found at: {}", installer_path));
    }

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const DETACHED_PROCESS: u32 = 0x00000008;
        const CREATE_BREAKAWAY_FROM_JOB: u32 = 0x01000000;

        let spawn_res = std::process::Command::new(&path)
            .creation_flags(DETACHED_PROCESS | CREATE_BREAKAWAY_FROM_JOB)
            .spawn();

        if spawn_res.is_err() {
            std::process::Command::new(&path)
                .creation_flags(DETACHED_PROCESS)
                .spawn()
                .map_err(|e| format!("Failed to launch installer: {e}"))?;
        }

        std::thread::sleep(Duration::from_millis(300));
        std::process::exit(0);
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open DMG: {e}"))?;

        std::thread::sleep(Duration::from_millis(300));
        std::process::exit(0);
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        Err("Unsupported operating system for automated install".to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_version_comparisons() {
        assert!(is_version_newer("0.1.2", "v0.1.3"));
        assert!(is_version_newer("0.1.2", "0.2.0"));
        assert!(is_version_newer("0.1.2", "1.0.0"));
        assert!(!is_version_newer("0.1.2", "0.1.2"));
        assert!(!is_version_newer("0.1.2", "v0.1.2"));
        assert!(!is_version_newer("0.1.2", "0.1.1"));
        assert!(!is_version_newer("1.0.0", "0.9.9"));
        assert!(is_version_newer("0.1.9", "0.1.10"));
        assert!(is_version_newer("0.9.0", "0.10.0"));
        assert!(is_version_newer("0.1.2", "v0.1.3-beta.1"));
        assert!(!is_version_newer("0.1.2", "0.1.2-alpha"));
    }

    #[test]
    fn test_parse_release_json_structure() {
        let sample_json = r#"{
            "tag_name": "v0.1.3",
            "name": "Forge Wisper v0.1.3: Streaming Update",
            "body": "• New real-time streaming\n• Faster credentials load",
            "published_at": "2026-09-17T02:00:00Z",
            "html_url": "https://github.com/zazanali/forge-wisper/releases/tag/v0.1.3",
            "assets": [
                {
                    "name": "Forge.Wisper_0.1.3_x64-setup.exe",
                    "browser_download_url": "https://github.com/zazanali/forge-wisper/releases/download/v0.1.3/Forge.Wisper_0.1.3_x64-setup.exe",
                    "size": 4194304
                },
                {
                    "name": "Forge.Wisper_0.1.3_aarch64.dmg",
                    "browser_download_url": "https://github.com/zazanali/forge-wisper/releases/download/v0.1.3/Forge.Wisper_0.1.3_aarch64.dmg",
                    "size": 7340032
                }
            ]
        }"#;

        let release: GitHubRelease = serde_json::from_str(sample_json).expect("Must parse GitHubRelease");
        assert_eq!(release.tag_name, "v0.1.3");
        assert_eq!(release.assets.len(), 2);

        #[cfg(target_os = "windows")]
        {
            let exe_asset = release.assets.iter().find(|a| a.name.ends_with(".exe"));
            assert!(exe_asset.is_some());
            assert_eq!(exe_asset.unwrap().name, "Forge.Wisper_0.1.3_x64-setup.exe");
        }

        #[cfg(target_os = "macos")]
        {
            let dmg_asset = release.assets.iter().find(|a| a.name.ends_with(".dmg"));
            assert!(dmg_asset.is_some());
            assert_eq!(dmg_asset.unwrap().name, "Forge.Wisper_0.1.3_aarch64.dmg");
        }
    }

    #[tokio::test]
    async fn test_live_github_api_check() {
        let res = check_github_update("zazanali/forge-wisper", true).await;
        assert!(res.is_ok(), "Live GitHub Releases API call must succeed: {:?}", res.err());
        let info = res.unwrap();
        assert!(!info.latest_version.is_empty());
        assert!(!info.current_version.is_empty());
        assert!(!info.download_url.is_empty());
        println!("Live update check result: latest={}, has_update={}", info.latest_version, info.has_update);
    }
}
