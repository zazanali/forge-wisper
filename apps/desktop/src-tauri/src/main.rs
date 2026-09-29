#![windows_subsystem = "windows"]

#[cfg(target_os = "windows")]
mod single_instance {
    use std::ffi::c_void;

    extern "system" {
        fn CreateMutexW(
            lpMutexAttributes: *const c_void,
            bInitialOwner: i32,
            lpName: *const u16,
        ) -> *mut c_void;
        fn GetLastError() -> u32;
        fn CloseHandle(hObject: *mut c_void) -> i32;
        fn FindWindowW(lpClassName: *const u16, lpWindowName: *const u16) -> *mut c_void;
        fn ShowWindow(hWnd: *mut c_void, nCmdShow: i32) -> i32;
        fn SetForegroundWindow(hWnd: *mut c_void) -> i32;
    }

    const ERROR_ALREADY_EXISTS: u32 = 183;
    const SW_RESTORE: i32 = 9;

    pub struct SingleInstanceGuard(*mut c_void);

    impl SingleInstanceGuard {
        pub fn acquire() -> Option<Self> {
            let mutex_name: Vec<u16> = "Local\\ForgeWisperSingleInstanceMutex\0"
                .encode_utf16()
                .collect();

            unsafe {
                let handle = CreateMutexW(std::ptr::null(), 0, mutex_name.as_ptr());
                if handle.is_null() {
                    return None;
                }
                if GetLastError() == ERROR_ALREADY_EXISTS {
                    let window_title: Vec<u16> = "Forge Wisper\0".encode_utf16().collect();
                    let hwnd = FindWindowW(std::ptr::null(), window_title.as_ptr());
                    if !hwnd.is_null() {
                        ShowWindow(hwnd, SW_RESTORE);
                        SetForegroundWindow(hwnd);
                    }
                    CloseHandle(handle);
                    return None;
                }
                Some(SingleInstanceGuard(handle))
            }
        }
    }

    impl Drop for SingleInstanceGuard {
        fn drop(&mut self) {
            if !self.0.is_null() {
                unsafe {
                    CloseHandle(self.0);
                }
            }
        }
    }
}

fn main() {
    #[cfg(target_os = "windows")]
    let _guard = match single_instance::SingleInstanceGuard::acquire() {
        Some(g) => g,
        None => {
            // Another instance is already running; restore its window and exit cleanly
            return;
        }
    };

    forge_desktop_lib::run();
}
