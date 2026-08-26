pub mod commands;
pub mod state;

use commands::*;
use state::PipelineState;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, WindowEvent,
};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .manage(PipelineState::new())
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(move |app, _shortcut, event| {
                    let state = app.state::<PipelineState>();
                    let is_toggle = {
                        let s = state.settings.lock().unwrap();
                        s.is_toggle_mode
                    };

                    match event.state() {
                        ShortcutState::Pressed => {
                            if is_toggle {
                                let mut toggle_guard = state.last_recording_toggle.lock().unwrap();
                                let now = std::time::Instant::now();

                                // Ignore repeat press events within 350ms to prevent accidental immediate cancellation
                                if now.duration_since(*toggle_guard) < std::time::Duration::from_millis(350) {
                                    return;
                                }
                                *toggle_guard = now;

                                let is_recording = state.is_active_recording.load(std::sync::atomic::Ordering::SeqCst);
                                if is_recording {
                                    let app_handle = app.clone();
                                    tauri::async_runtime::spawn(async move {
                                        let st = app_handle.state::<PipelineState>();
                                        let _ = st.stop_and_process(app_handle.clone()).await;
                                    });
                                } else {
                                    let _ = state.start_listening(app);
                                }
                            } else {
                                // Push-to-talk: key press starts recording
                                let _ = state.start_listening(app);
                            }
                        }
                        ShortcutState::Released => {
                            if !is_toggle {
                                // Push-to-talk: key release stops recording & triggers pipeline
                                let app_handle = app.clone();
                                tauri::async_runtime::spawn(async move {
                                    let st = app_handle.state::<PipelineState>();
                                    let _ = st.stop_and_process(app_handle.clone()).await;
                                });
                            }
                        }
                    }
                })
                .build(),
        )
        .setup(|app| {
            // Register configured global hotkey from persisted settings
            let state = app.state::<PipelineState>();
            let initial_hotkey = {
                let s = state.settings.lock().unwrap();
                s.hotkey.clone()
            };
            let _ = register_global_hotkey(app.handle(), &initial_hotkey);
            
            // Automatically register in Windows startup registry so the app always starts on PC boot
            let _ = set_autostart(true);

            // Setup System Tray icon
            let show_i = MenuItem::with_id(app, "show", "Open Forge Wisper", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "Quit Forge Wisper", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &quit_i])?;

            #[cfg(target_os = "windows")]
            {
                start_native_windows_hotkey_listener(app.handle().clone());
            }

            if let Some(icon) = app.default_window_icon() {
                let _tray = TrayIconBuilder::new()
                    .icon(icon.clone())
                    .tooltip("Forge Wisper - Press Ctrl+Space to Dictate")
                    .menu(&menu)
                    .on_menu_event(|app, event| match event.id.as_ref() {
                        "show" => {
                            if let Some(w) = app.get_webview_window("main") {
                                let _ = w.show();
                                let _ = w.set_focus();
                            }
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    })
                    .on_tray_icon_event(|tray, event| {
                        if let TrayIconEvent::Click {
                            button: MouseButton::Left,
                            button_state: MouseButtonState::Up,
                            ..
                        } = event
                        {
                            let app = tray.app_handle();
                            if let Some(w) = app.get_webview_window("main") {
                                let _ = w.show();
                                let _ = w.set_focus();
                            }
                        }
                    })
                    .build(app)?;
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_processing_state,
            start_recording,
            get_mic_level,
            stop_recording,
            cancel_recording,
            get_settings,
            update_settings,
            get_audio_devices,
            get_groq_api_key_status,
            set_groq_api_key,
            delete_groq_api_key,
            test_groq_connection,
            list_history,
            delete_history_item,
            clear_history,
            reprocess_history_item,
            list_models,
            download_model,
            get_active_model_downloads,
            delete_model,
            get_hardware_recommendation,
            open_url,
            get_autostart_status,
            set_autostart_status
        ])
        .run(tauri::generate_context!())
        .expect("error while running Forge Wisper Tauri application");
}

pub fn set_autostart(enable: bool) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        if enable {
            if let Ok(exe_path) = std::env::current_exe() {
                let exe_str = exe_path.to_string_lossy().to_string();
                let status = Command::new("reg")
                    .args([
                        "add",
                        "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run",
                        "/v",
                        "ForgeWisper",
                        "/t",
                        "REG_SZ",
                        "/d",
                        &format!("\"{}\"", exe_str),
                        "/f",
                    ])
                    .status()
                    .map_err(|e| e.to_string())?;

                if !status.success() {
                    return Err("Failed to register Forge Wisper in Windows startup registry".to_string());
                }
            }
        } else {
            let _ = Command::new("reg")
                .args([
                    "delete",
                    "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run",
                    "/v",
                    "ForgeWisper",
                    "/f",
                ])
                .status();
        }
    }
    Ok(())
}

pub fn check_is_autostart_enabled() -> bool {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        if let Ok(output) = Command::new("reg")
            .args([
                "query",
                "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run",
                "/v",
                "ForgeWisper",
            ])
            .output()
        {
            return output.status.success();
        }
    }
    false
}

pub fn parse_shortcut_explicit(s: &str) -> Option<Shortcut> {
    // 1. Try standard Shortcut::from_str
    if let Ok(sc) = s.parse::<Shortcut>() {
        return Some(sc);
    }

    // 2. Parse manually: extract modifiers and code
    let parts: Vec<&str> = s.split('+').map(|p| p.trim()).collect();
    if parts.is_empty() {
        return None;
    }

    let mut mods = Modifiers::empty();
    let mut code_str = "";

    for part in parts {
        match part.to_lowercase().as_str() {
            "ctrl" | "control" => mods |= Modifiers::CONTROL,
            "alt" | "option" => mods |= Modifiers::ALT,
            "shift" => mods |= Modifiers::SHIFT,
            "super" | "win" | "windows" | "cmd" | "command" | "meta" => mods |= Modifiers::SUPER,
            _ => code_str = part,
        }
    }

    if code_str.is_empty() {
        return None;
    }

    // Resolve Code enum from code_str
    let code = match code_str.to_lowercase().as_str() {
        "space" => Some(Code::Space),
        "backquote" | "`" | "~" => Some(Code::Backquote),
        "tab" => Some(Code::Tab),
        "enter" | "return" => Some(Code::Enter),
        "escape" | "esc" => Some(Code::Escape),
        "backspace" => Some(Code::Backspace),
        "delete" | "del" => Some(Code::Delete),
        "insert" | "ins" => Some(Code::Insert),
        "home" => Some(Code::Home),
        "end" => Some(Code::End),
        "pageup" | "pgup" => Some(Code::PageUp),
        "pagedown" | "pgdn" => Some(Code::PageDown),
        "f1" => Some(Code::F1),
        "f2" => Some(Code::F2),
        "f3" => Some(Code::F3),
        "f4" => Some(Code::F4),
        "f5" => Some(Code::F5),
        "f6" => Some(Code::F6),
        "f7" => Some(Code::F7),
        "f8" => Some(Code::F8),
        "f9" => Some(Code::F9),
        "f10" => Some(Code::F10),
        "f11" => Some(Code::F11),
        "f12" => Some(Code::F12),
        _ => {
            let upper = code_str.to_uppercase();
            let letter = if upper.starts_with("KEY") && upper.len() == 4 {
                &upper[3..]
            } else if upper.starts_with("DIGIT") && upper.len() == 6 {
                &upper[5..]
            } else {
                upper.as_str()
            };

            match letter {
                "A" => Some(Code::KeyA),
                "B" => Some(Code::KeyB),
                "C" => Some(Code::KeyC),
                "D" => Some(Code::KeyD),
                "E" => Some(Code::KeyE),
                "F" => Some(Code::KeyF),
                "G" => Some(Code::KeyG),
                "H" => Some(Code::KeyH),
                "I" => Some(Code::KeyI),
                "J" => Some(Code::KeyJ),
                "K" => Some(Code::KeyK),
                "L" => Some(Code::KeyL),
                "M" => Some(Code::KeyM),
                "N" => Some(Code::KeyN),
                "O" => Some(Code::KeyO),
                "P" => Some(Code::KeyP),
                "Q" => Some(Code::KeyQ),
                "R" => Some(Code::KeyR),
                "S" => Some(Code::KeyS),
                "T" => Some(Code::KeyT),
                "U" => Some(Code::KeyU),
                "V" => Some(Code::KeyV),
                "W" => Some(Code::KeyW),
                "X" => Some(Code::KeyX),
                "Y" => Some(Code::KeyY),
                "Z" => Some(Code::KeyZ),
                "0" => Some(Code::Digit0),
                "1" => Some(Code::Digit1),
                "2" => Some(Code::Digit2),
                "3" => Some(Code::Digit3),
                "4" => Some(Code::Digit4),
                "5" => Some(Code::Digit5),
                "6" => Some(Code::Digit6),
                "7" => Some(Code::Digit7),
                "8" => Some(Code::Digit8),
                "9" => Some(Code::Digit9),
                _ => None,
            }
        }
    };

    if let Some(c) = code {
        let modifier_opt = if mods.is_empty() { None } else { Some(mods) };
        Some(Shortcut::new(modifier_opt, c))
    } else {
        None
    }
}

pub fn register_global_hotkey<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    hotkey_str: &str,
) -> Result<String, String> {
    let global_shortcut = app.global_shortcut();
    let _ = global_shortcut.unregister_all();

    let clean = hotkey_str.trim();
    if clean.is_empty() {
        return Ok("No shortcut configured".to_string());
    }

    if let Some(shortcut) = parse_shortcut_explicit(clean) {
        let _ = global_shortcut.register(shortcut);
    }

    // Candidate variants registration attempt
    let candidate_strings = vec![
        clean.replace("Ctrl", "Control"),
        clean.replace("Control", "Ctrl"),
        clean.replace("Super", "Command"),
        clean.replace("Command", "Super"),
        clean.replace("Win", "Super"),
        clean.to_lowercase(),
    ];

    for candidate in candidate_strings {
        if let Some(shortcut) = parse_shortcut_explicit(&candidate) {
            let _ = global_shortcut.register(shortcut);
        }
    }

    println!("[Forge Shortcut] Global hotkey configured to '{}' (Universal Native OS Listener Active)", clean);
    Ok(clean.to_string())
}

#[cfg(target_os = "windows")]
extern "system" {
    fn GetAsyncKeyState(vKey: i32) -> i16;
}

#[cfg(target_os = "windows")]
fn is_vk_down(vk: i32) -> bool {
    unsafe {
        // Special case for Windows/Super key: check both Left Win (0x5B) and Right Win (0x5C)
        if vk == 0x5B || vk == 0x5C {
            (GetAsyncKeyState(0x5B) as u16 & 0x8000 != 0) || (GetAsyncKeyState(0x5C) as u16 & 0x8000 != 0)
        } else if vk == 0x11 {
            // Control
            (GetAsyncKeyState(0x11) as u16 & 0x8000 != 0)
                || (GetAsyncKeyState(0xA2) as u16 & 0x8000 != 0)
                || (GetAsyncKeyState(0xA3) as u16 & 0x8000 != 0)
        } else if vk == 0x12 {
            // Alt
            (GetAsyncKeyState(0x12) as u16 & 0x8000 != 0)
                || (GetAsyncKeyState(0xA4) as u16 & 0x8000 != 0)
                || (GetAsyncKeyState(0xA5) as u16 & 0x8000 != 0)
        } else if vk == 0x10 {
            // Shift
            (GetAsyncKeyState(0x10) as u16 & 0x8000 != 0)
                || (GetAsyncKeyState(0xA0) as u16 & 0x8000 != 0)
                || (GetAsyncKeyState(0xA1) as u16 & 0x8000 != 0)
        } else {
            (GetAsyncKeyState(vk) as u16 & 0x8000) != 0
        }
    }
}

pub fn parse_hotkey_to_vks(hotkey_str: &str) -> Vec<i32> {
    let mut vks = Vec::new();
    let parts: Vec<&str> = hotkey_str.split('+').map(|p| p.trim()).collect();

    for part in parts {
        match part.to_lowercase().as_str() {
            "ctrl" | "control" => vks.push(0x11), // VK_CONTROL
            "alt" | "option" => vks.push(0x12),   // VK_MENU
            "shift" => vks.push(0x10),            // VK_SHIFT
            "super" | "win" | "windows" | "cmd" | "command" | "meta" => vks.push(0x5B), // VK_LWIN
            "space" => vks.push(0x20),            // VK_SPACE
            "backquote" | "`" | "~" => vks.push(0xC0), // VK_OEM_3
            "tab" => vks.push(0x09),              // VK_TAB
            "enter" | "return" => vks.push(0x0D), // VK_RETURN
            "escape" | "esc" => vks.push(0x1B),   // VK_ESCAPE
            "backspace" => vks.push(0x08),        // VK_BACK
            "delete" | "del" => vks.push(0x2E),   // VK_DELETE
            "insert" | "ins" => vks.push(0x2D),   // VK_INSERT
            "home" => vks.push(0x24),             // VK_HOME
            "end" => vks.push(0x23),              // VK_END
            "pageup" | "pgup" => vks.push(0x21),  // VK_PRIOR
            "pagedown" | "pgdn" => vks.push(0x22),// VK_NEXT
            "f1" => vks.push(0x70),
            "f2" => vks.push(0x71),
            "f3" => vks.push(0x72),
            "f4" => vks.push(0x73),
            "f5" => vks.push(0x74),
            "f6" => vks.push(0x75),
            "f7" => vks.push(0x76),
            "f8" => vks.push(0x77),
            "f9" => vks.push(0x78),
            "f10" => vks.push(0x79),
            "f11" => vks.push(0x7A),
            "f12" => vks.push(0x7B),
            other => {
                let upper = other.to_uppercase();
                let clean_key = if upper.starts_with("KEY") && upper.len() == 4 {
                    &upper[3..]
                } else if upper.starts_with("DIGIT") && upper.len() == 6 {
                    &upper[5..]
                } else {
                    upper.as_str()
                };

                if clean_key.len() == 1 {
                    let ch = clean_key.chars().next().unwrap();
                    if ch.is_ascii_alphabetic() {
                        vks.push(ch.to_ascii_uppercase() as i32); // 'A'..'Z' is 0x41..0x5A
                    } else if ch.is_ascii_digit() {
                        vks.push(ch as i32); // '0'..'9' is 0x30..0x39
                    }
                }
            }
        }
    }

    vks
}

#[cfg(target_os = "windows")]
fn start_native_windows_hotkey_listener(app: tauri::AppHandle) {
    std::thread::spawn(move || {
        let mut was_combo_pressed = false;

        loop {
            std::thread::sleep(std::time::Duration::from_millis(15));

            let state = app.state::<PipelineState>();
            let (hotkey_str, is_toggle) = {
                if let Ok(s) = state.settings.lock() {
                    (s.hotkey.clone(), s.is_toggle_mode)
                } else {
                    continue;
                }
            };

            let required_vks = parse_hotkey_to_vks(&hotkey_str);
            if required_vks.is_empty() {
                continue;
            }

            let is_combo_currently_down = required_vks.iter().all(|vk| is_vk_down(*vk));

            if is_combo_currently_down && !was_combo_pressed {
                was_combo_pressed = true;

                let mut toggle_guard = state.last_recording_toggle.lock().unwrap();
                let now = std::time::Instant::now();
                if now.duration_since(*toggle_guard) < std::time::Duration::from_millis(350) {
                    continue;
                }
                *toggle_guard = now;

                if is_toggle {
                    let is_recording = state.is_active_recording.load(std::sync::atomic::Ordering::SeqCst);
                    if is_recording {
                        let app_handle = app.clone();
                        tauri::async_runtime::spawn(async move {
                            let st = app_handle.state::<PipelineState>();
                            let _ = st.stop_and_process(app_handle.clone()).await;
                        });
                    } else {
                        let _ = state.start_listening(&app);
                    }
                } else {
                    // Push to talk: Key press starts recording
                    let _ = state.start_listening(&app);
                }
            } else if !is_combo_currently_down && was_combo_pressed {
                was_combo_pressed = false;

                if !is_toggle {
                    // Push to talk: Key release stops recording and processes
                    let app_handle = app.clone();
                    tauri::async_runtime::spawn(async move {
                        let st = app_handle.state::<PipelineState>();
                        let _ = st.stop_and_process(app_handle.clone()).await;
                    });
                }
            }
        }
    });
}
