pub mod commands;
pub mod state;

use commands::*;
use state::PipelineState;
use tauri::Manager;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .manage(PipelineState::new())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(move |app, shortcut, event| {
                    let shortcut_str = shortcut.to_string();
                    let state = app.state::<PipelineState>();
                    let (configured_hotkey, is_toggle) = {
                        let s = state.settings.lock().unwrap();
                        (s.hotkey.clone(), s.is_toggle_mode)
                    };

                    // Match hotkey
                    let is_match = shortcut_str.eq_ignore_ascii_case(&configured_hotkey)
                        || shortcut_str.contains("Space") && configured_hotkey.contains("Space");

                    if is_match {
                        match event.state() {
                            ShortcutState::Pressed => {
                                if is_toggle {
                                    let is_recording = state.is_active_recording.load(std::sync::atomic::Ordering::SeqCst);
                                    if is_recording {
                                        let app_handle = app.clone();
                                        tokio::spawn(async move {
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
                                    tokio::spawn(async move {
                                        let st = app_handle.state::<PipelineState>();
                                        let _ = st.stop_and_process(app_handle.clone()).await;
                                    });
                                }
                            }
                        }
                    }
                })
                .build(),
        )
        .setup(|app| {
            // Register default global hotkey: Ctrl+Space
            let shortcut = "Control+Space".parse::<Shortcut>().unwrap();
            let _ = app.global_shortcut().register(shortcut);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_processing_state,
            start_recording,
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
            delete_model,
            get_hardware_recommendation
        ])
        .run(tauri::generate_context!())
        .expect("error while running Forge Wisper Tauri application");
}
