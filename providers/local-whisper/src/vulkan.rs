use serde::{Deserialize, Serialize};
use std::ffi::CStr;
use tracing::warn;
#[cfg(test)]
use tracing::info;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct VulkanDevice {
    pub device_index: u32,
    pub device_name: String,
    pub device_type: String,
    pub vendor_id: u32,
    pub vendor_name: String,
    pub driver_version: String,
    pub dedicated_vram_mb: u64,
    pub is_discrete: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackendDiagnostics {
    pub is_vulkan_available: bool,
    pub active_backend: String,
    pub active_device_name: Option<String>,
    pub active_device_index: Option<u32>,
    pub dedicated_vram_mb: Option<u64>,
    pub available_devices: Vec<VulkanDevice>,
    pub fallback_reason: Option<String>,
}

#[cfg(windows)]
#[allow(non_camel_case_types, dead_code, clippy::upper_case_acronyms, clippy::manual_c_str_literals)]
mod sys {

    type HMODULE = *mut std::ffi::c_void;
    type FARPROC = *mut std::ffi::c_void;

    extern "system" {
        fn LoadLibraryA(lpLibFileName: *const u8) -> HMODULE;
        fn GetProcAddress(hModule: HMODULE, lpProcName: *const u8) -> FARPROC;
        fn FreeLibrary(hLibModule: HMODULE) -> i32;
    }

    pub type VkInstance = *mut std::ffi::c_void;
    pub type VkPhysicalDevice = *mut std::ffi::c_void;
    pub type VkResult = i32;

    pub const VK_SUCCESS: VkResult = 0;
    pub const VK_STRUCTURE_TYPE_APPLICATION_INFO: u32 = 0;
    pub const VK_STRUCTURE_TYPE_INSTANCE_CREATE_INFO: u32 = 1;

    pub const VK_PHYSICAL_DEVICE_TYPE_OTHER: u32 = 0;
    pub const VK_PHYSICAL_DEVICE_TYPE_INTEGRATED_GPU: u32 = 1;
    pub const VK_PHYSICAL_DEVICE_TYPE_DISCRETE_GPU: u32 = 2;
    pub const VK_PHYSICAL_DEVICE_TYPE_VIRTUAL_GPU: u32 = 3;
    pub const VK_PHYSICAL_DEVICE_TYPE_CPU: u32 = 4;

    pub const VK_MEMORY_HEAP_DEVICE_LOCAL_BIT: u32 = 0x00000001;

    pub const VK_MAX_PHYSICAL_DEVICE_NAME_SIZE: usize = 256;
    pub const VK_MAX_MEMORY_TYPES: usize = 32;
    pub const VK_MAX_MEMORY_HEAPS: usize = 16;
    pub const VK_UUID_SIZE: usize = 16;

    #[repr(C)]
    #[derive(Debug, Clone, Copy)]
    pub struct VkApplicationInfo {
        pub s_type: u32,
        pub p_next: *const std::ffi::c_void,
        pub p_application_name: *const u8,
        pub application_version: u32,
        pub p_engine_name: *const u8,
        pub engine_version: u32,
        pub api_version: u32,
    }

    #[repr(C)]
    #[derive(Debug, Clone, Copy)]
    pub struct VkInstanceCreateInfo {
        pub s_type: u32,
        pub p_next: *const std::ffi::c_void,
        pub flags: u32,
        pub p_application_info: *const VkApplicationInfo,
        pub enabled_layer_count: u32,
        pub pp_enabled_layer_names: *const *const u8,
        pub enabled_extension_count: u32,
        pub pp_enabled_extension_names: *const *const u8,
    }

    #[repr(C)]
    pub struct VkPhysicalDeviceProperties {
        pub api_version: u32,
        pub driver_version: u32,
        pub vendor_id: u32,
        pub device_id: u32,
        pub device_type: u32,
        pub device_name: [u8; VK_MAX_PHYSICAL_DEVICE_NAME_SIZE],
        pub pipeline_cache_uuid: [u8; VK_UUID_SIZE],
        pub limits: [u8; 504],
        pub sparse_properties: [u8; 20],
    }

    #[repr(C)]
    #[derive(Debug, Clone, Copy)]
    pub struct VkMemoryType {
        pub property_flags: u32,
        pub heap_index: u32,
    }

    #[repr(C)]
    #[derive(Debug, Clone, Copy)]
    pub struct VkMemoryHeap {
        pub size: u64,
        pub flags: u32,
    }

    #[repr(C)]
    pub struct VkPhysicalDeviceMemoryProperties {
        pub memory_type_count: u32,
        pub memory_types: [VkMemoryType; VK_MAX_MEMORY_TYPES],
        pub memory_heap_count: u32,
        pub memory_heaps: [VkMemoryHeap; VK_MAX_MEMORY_HEAPS],
    }

    pub type PFN_vkCreateInstance = unsafe extern "system" fn(
        *const VkInstanceCreateInfo,
        *const std::ffi::c_void,
        *mut VkInstance,
    ) -> VkResult;

    pub type PFN_vkDestroyInstance =
        unsafe extern "system" fn(VkInstance, *const std::ffi::c_void);

    pub type PFN_vkEnumeratePhysicalDevices =
        unsafe extern "system" fn(VkInstance, *mut u32, *mut VkPhysicalDevice) -> VkResult;

    pub type PFN_vkGetPhysicalDeviceProperties =
        unsafe extern "system" fn(VkPhysicalDevice, *mut VkPhysicalDeviceProperties);

    pub type PFN_vkGetPhysicalDeviceMemoryProperties =
        unsafe extern "system" fn(VkPhysicalDevice, *mut VkPhysicalDeviceMemoryProperties);

    pub struct VulkanLib {
        handle: HMODULE,
        pub vk_create_instance: PFN_vkCreateInstance,
        pub vk_destroy_instance: PFN_vkDestroyInstance,
        pub vk_enumerate_physical_devices: PFN_vkEnumeratePhysicalDevices,
        pub vk_get_physical_device_properties: PFN_vkGetPhysicalDeviceProperties,
        pub vk_get_physical_device_memory_properties: PFN_vkGetPhysicalDeviceMemoryProperties,
    }

    impl VulkanLib {
        pub fn load() -> Option<Self> {
            unsafe {
                let dll_name = b"vulkan-1.dll\0";
                let handle = LoadLibraryA(dll_name.as_ptr());
                if handle.is_null() {
                    return None;
                }

                let vk_create_instance: PFN_vkCreateInstance = std::mem::transmute(GetProcAddress(
                    handle,
                    b"vkCreateInstance\0".as_ptr(),
                ));
                let vk_destroy_instance: PFN_vkDestroyInstance = std::mem::transmute(GetProcAddress(
                    handle,
                    b"vkDestroyInstance\0".as_ptr(),
                ));
                let vk_enumerate_physical_devices: PFN_vkEnumeratePhysicalDevices =
                    std::mem::transmute(GetProcAddress(
                        handle,
                        b"vkEnumeratePhysicalDevices\0".as_ptr(),
                    ));
                let vk_get_physical_device_properties: PFN_vkGetPhysicalDeviceProperties =
                    std::mem::transmute(GetProcAddress(
                        handle,
                        b"vkGetPhysicalDeviceProperties\0".as_ptr(),
                    ));
                let vk_get_physical_device_memory_properties: PFN_vkGetPhysicalDeviceMemoryProperties =
                    std::mem::transmute(GetProcAddress(
                        handle,
                        b"vkGetPhysicalDeviceMemoryProperties\0".as_ptr(),
                    ));

                if vk_create_instance as usize == 0
                    || vk_destroy_instance as usize == 0
                    || vk_enumerate_physical_devices as usize == 0
                    || vk_get_physical_device_properties as usize == 0
                    || vk_get_physical_device_memory_properties as usize == 0
                {
                    FreeLibrary(handle);
                    return None;
                }

                Some(Self {
                    handle,
                    vk_create_instance,
                    vk_destroy_instance,
                    vk_enumerate_physical_devices,
                    vk_get_physical_device_properties,
                    vk_get_physical_device_memory_properties,
                })
            }
        }
    }

    impl Drop for VulkanLib {
        fn drop(&mut self) {
            unsafe {
                if !self.handle.is_null() {
                    FreeLibrary(self.handle);
                }
            }
        }
    }
}

pub struct VulkanManager;

impl VulkanManager {
    /// Check whether a viable Vulkan GPU device is available (requires discrete GPU or >= 512 MB dedicated VRAM).
    /// Low-VRAM integrated GPUs (e.g. 128 MB Intel HD/UHD) are skipped in favor of high-speed multi-core CPU.
    pub fn is_available() -> bool {
        #[cfg(windows)]
        {
            Self::get_best_device().is_some()
        }
        #[cfg(not(windows))]
        {
            false
        }
    }

    /// Enumerate all Vulkan-compatible physical devices with hardware metrics
    pub fn enumerate_devices() -> Vec<VulkanDevice> {
        #[cfg(windows)]
        {
            let lib = match sys::VulkanLib::load() {
                Some(l) => l,
                None => return Vec::new(),
            };

            unsafe {
                let app_info = sys::VkApplicationInfo {
                    s_type: sys::VK_STRUCTURE_TYPE_APPLICATION_INFO,
                    p_next: std::ptr::null(),
                    p_application_name: c"ForgeWisper".as_ptr() as *const u8,
                    application_version: 1,
                    p_engine_name: c"ForgeEngine".as_ptr() as *const u8,
                    engine_version: 1,
                    api_version: 0x00401000, // Vulkan 1.1 (header version 1.1)
                };

                let create_info = sys::VkInstanceCreateInfo {
                    s_type: sys::VK_STRUCTURE_TYPE_INSTANCE_CREATE_INFO,
                    p_next: std::ptr::null(),
                    flags: 0,
                    p_application_info: &app_info,
                    enabled_layer_count: 0,
                    pp_enabled_layer_names: std::ptr::null(),
                    enabled_extension_count: 0,
                    pp_enabled_extension_names: std::ptr::null(),
                };

                let mut instance: sys::VkInstance = std::ptr::null_mut();
                let res = (lib.vk_create_instance)(&create_info, std::ptr::null(), &mut instance);
                if res != sys::VK_SUCCESS || instance.is_null() {
                    warn!("[Vulkan] Failed to create Vulkan instance (code {})", res);
                    return Vec::new();
                }

                let mut device_count: u32 = 0;
                let enum_res = (lib.vk_enumerate_physical_devices)(
                    instance,
                    &mut device_count,
                    std::ptr::null_mut(),
                );
                if enum_res != sys::VK_SUCCESS || device_count == 0 {
                    (lib.vk_destroy_instance)(instance, std::ptr::null());
                    return Vec::new();
                }

                let mut physical_devices: Vec<sys::VkPhysicalDevice> =
                    vec![std::ptr::null_mut(); device_count as usize];
                (lib.vk_enumerate_physical_devices)(
                    instance,
                    &mut device_count,
                    physical_devices.as_mut_ptr(),
                );

                let mut devices = Vec::new();

                for (idx, &pdev) in physical_devices.iter().enumerate() {
                    let mut props: sys::VkPhysicalDeviceProperties = std::mem::zeroed();
                    (lib.vk_get_physical_device_properties)(pdev, &mut props);

                    let mut mem_props: sys::VkPhysicalDeviceMemoryProperties = std::mem::zeroed();
                    (lib.vk_get_physical_device_memory_properties)(pdev, &mut mem_props);

                    let raw_name = CStr::from_ptr(props.device_name.as_ptr() as *const i8);
                    let device_name = raw_name.to_string_lossy().trim().to_string();

                    let is_discrete =
                        props.device_type == sys::VK_PHYSICAL_DEVICE_TYPE_DISCRETE_GPU;
                    let device_type = match props.device_type {
                        sys::VK_PHYSICAL_DEVICE_TYPE_DISCRETE_GPU => "Discrete GPU",
                        sys::VK_PHYSICAL_DEVICE_TYPE_INTEGRATED_GPU => "Integrated GPU",
                        sys::VK_PHYSICAL_DEVICE_TYPE_VIRTUAL_GPU => "Virtual GPU",
                        sys::VK_PHYSICAL_DEVICE_TYPE_CPU => "CPU",
                        _ => "Other",
                    }
                    .to_string();

                    let vendor_name = match props.vendor_id {
                        0x10DE => "NVIDIA",
                        0x1002 => "AMD",
                        0x8086 => "Intel",
                        0x13B5 => "ARM",
                        0x5143 => "Qualcomm",
                        _ => "Unknown",
                    }
                    .to_string();

                    let driver_version = if props.vendor_id == 0x10DE {
                        // NVIDIA driver version format
                        let major = (props.driver_version >> 22) & 0x3ff;
                        let minor = (props.driver_version >> 14) & 0x0ff;
                        let patch = (props.driver_version >> 6) & 0x0ff;
                        format!("{}.{:02}.{}", major, minor, patch)
                    } else {
                        // Standard Vulkan version format
                        let major = props.driver_version >> 22;
                        let minor = (props.driver_version >> 12) & 0x3ff;
                        let patch = props.driver_version & 0xfff;
                        format!("{}.{}.{}", major, minor, patch)
                    };

                    // Compute dedicated VRAM from device-local heaps
                    let mut dedicated_vram_bytes: u64 = 0;
                    for heap_idx in 0..mem_props.memory_heap_count as usize {
                        let heap = mem_props.memory_heaps[heap_idx];
                        if (heap.flags & sys::VK_MEMORY_HEAP_DEVICE_LOCAL_BIT) != 0 {
                            dedicated_vram_bytes = dedicated_vram_bytes.max(heap.size);
                        }
                    }
                    let dedicated_vram_mb = dedicated_vram_bytes / (1024 * 1024);

                    devices.push(VulkanDevice {
                        device_index: idx as u32,
                        device_name,
                        device_type,
                        vendor_id: props.vendor_id,
                        vendor_name,
                        driver_version,
                        dedicated_vram_mb,
                        is_discrete,
                    });
                }

                (lib.vk_destroy_instance)(instance, std::ptr::null());
                devices
            }
        }
        #[cfg(not(windows))]
        {
            Vec::new()
        }
    }

    /// Select the highest performance Vulkan device (prefers Discrete GPU with highest VRAM)
    pub fn get_best_device() -> Option<VulkanDevice> {
        let devices = Self::enumerate_devices();
        let mut viable_devices: Vec<_> = devices
            .into_iter()
            .filter(|d| d.is_discrete || d.dedicated_vram_mb >= 512)
            .collect();

        if viable_devices.is_empty() {
            return None;
        }

        viable_devices.sort_by(|a, b| {
            b.is_discrete
                .cmp(&a.is_discrete)
                .then_with(|| b.dedicated_vram_mb.cmp(&a.dedicated_vram_mb))
        });

        viable_devices.into_iter().next()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_vulkan_availability_and_device_enumeration() {
        let is_avail = VulkanManager::is_available();
        let devices = VulkanManager::enumerate_devices();

        if is_avail {
            assert!(
                !devices.is_empty(),
                "If Vulkan is available, at least one device should be enumerated"
            );
            for d in &devices {
                assert!(!d.device_name.is_empty());
                assert!(!d.driver_version.is_empty());
                assert!(!d.vendor_name.is_empty());
            }

            let best = VulkanManager::get_best_device();
            assert!(best.is_some(), "Best device should be found");
            let b = best.unwrap();
            info!(
                "Best detected Vulkan device: {} ({}, {} MB VRAM, driver {})",
                b.device_name, b.vendor_name, b.dedicated_vram_mb, b.driver_version
            );
        } else {
            assert!(VulkanManager::get_best_device().is_none());
        }
    }
}
