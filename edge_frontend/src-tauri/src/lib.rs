 // Tauri V2
use log::{error, info};
use serde::{Deserialize, Serialize};
use std::net::{SocketAddr, TcpStream};
use std::sync::Arc;
use std::{env, fs, path::PathBuf, sync::Mutex, time::Duration};
use tauri::{path::BaseDirectory, AppHandle, Manager, PhysicalSize, WebviewWindow};
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::{CommandEvent, CommandChild};

#[derive(Debug, Serialize, Deserialize)]
pub struct WindowState {
    pub width: u32,
    pub height: u32,
    #[serde(default = "default_x")]
    pub x: i32,
    #[serde(default = "default_y")]
    pub y: i32,
}

fn default_x() -> i32 {
    100
}

fn default_y() -> i32 {
    100
}

/// $APPCONFIG/window_state.json
fn state_file(app: &AppHandle) -> tauri::Result<PathBuf> {
    let path = app
        .path()
        .resolve("window_state.json", BaseDirectory::AppConfig);
    info!("Window state file path: {:?}", path);
    path
}

#[tauri::command]
fn save_current_window_size(app: AppHandle, win: WebviewWindow) -> Result<(), String> {
    // Get the current window size and position
    let size = win.inner_size().map_err(|e| {
        error!("Failed to get window size: {}", e);
        e.to_string()
    })?;

    let position = win.outer_position().map_err(|e| {
        error!("Failed to get window position: {}", e);
        e.to_string()
    })?;

    info!("Saving window size: {}x{} at position: ({}, {})", size.width, size.height, position.x, position.y);
    let path = state_file(&app).map_err(|e| e.to_string())?;
    let state = WindowState {
        width: size.width,
        height: size.height,
        x: position.x,
        y: position.y,
    };

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    fs::write(path, serde_json::to_string(&state).unwrap()).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_saved_window_size(app: AppHandle) -> Result<WindowState, String> {
    info!("Getting saved window size and position");
    let path = state_file(&app).map_err(|e| e.to_string())?;

    if !path.exists() {
        return Ok(WindowState {
            width: 1000,
            height: 800,
            x: 100,
            y: 100,
        });
    }

    let json = fs::read_to_string(path).map_err(|e| e.to_string())?;
    let state: WindowState = serde_json::from_str(&json).map_err(|e| {
        error!("Failed to parse window state JSON: {}", e);
        e.to_string()
    })?;
    info!("Loaded window size: {}x{} at position: ({}, {})", state.width, state.height, state.x, state.y);
    Ok(state)
}

#[tauri::command]
fn open_devtools(win: WebviewWindow) {
    info!("Opening devtools on the left side");
    win.open_devtools();
}

#[tauri::command]
fn get_cli_args() -> Vec<String> {
    info!("Retrieving command-line arguments");
    env::args().collect()
}

#[tauri::command]
fn get_current_working_directory() -> Result<String, String> {
    info!("Getting current working directory");
    match env::current_dir() {
        Ok(path) => {
            let path_str = path.to_string_lossy().to_string();
            info!("Current working directory: {}", path_str);
            Ok(path_str)
        }
        Err(e) => {
            error!("Failed to get current working directory: {}", e);
            Err(e.to_string())
        }
    }
}

#[tauri::command]
fn get_env_var(name: String) -> Option<String> {
    info!("Getting environment variable: {}", name);
    let result = env::var(&name).ok();
    if let Some(ref value) = result {
        info!("Environment variable {} = {}", name, value);
    } else {
        info!("Environment variable {} not found", name);
    }
    result
}

// -------------------------------------------
// WebSocket side-car management
// -------------------------------------------

struct WebSocketSidecar {
    child: Option<CommandChild>,
}

// Clean shutdown when the struct is dropped
impl Drop for WebSocketSidecar {
    fn drop(&mut self) {
        // Best-effort terminate; ignore any error if the process is gone already
        if let Some(child) = self.child.take() {
            let _ = child.kill();
        }
        info!("WebSocket side-car terminated (Drop)");
    }
}

// Shared state wrapper
struct WebSocketState(Arc<Mutex<Option<WebSocketSidecar>>>);

// Function to check if a port is already in use
fn is_port_in_use(port: u16) -> bool {
    TcpStream::connect_timeout(
        &SocketAddr::from(([127, 0, 0, 1], port)),
        Duration::from_millis(100)
    ).is_ok()
}

// Function to wait for the sidecar to be ready
async fn wait_for_sidecar_ready(port: u16, timeout_seconds: u64) -> Result<(), String> {
    let start_time = std::time::Instant::now();
    let timeout = Duration::from_secs(timeout_seconds);
    
    info!("Waiting for sidecar to be ready on port {}...", port);
    
    while start_time.elapsed() < timeout {
        if is_port_in_use(port) {
            info!("Sidecar is ready on port {}", port);
            return Ok(());
        }
        
        // Wait a bit before checking again
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
    }
    
    Err(format!("Timeout waiting for sidecar to be ready on port {} after {} seconds", port, timeout_seconds))
}

// Fixed WebSocket port
const WEBSOCKET_PORT: u16 = 9528;

#[tauri::command]
async fn start_websocket_sidecar(app: AppHandle) -> Result<u16, String> {
    info!("start_websocket_sidecar called");
    let websocket_state = app.state::<WebSocketState>();
    
    // Check if already running - do this in a separate scope to release the lock
    {
        let state_lock = websocket_state.0.lock().unwrap();
        if state_lock.is_some() {
            info!("WebSocket sidecar already running in this process");
            return Ok(WEBSOCKET_PORT);
        }
    }

    // Check if the port is already in use (possibly by another process)
    if is_port_in_use(WEBSOCKET_PORT) {
        info!(
            "Port {} is already in use, assuming WebSocket sidecar is running",
            WEBSOCKET_PORT
        );
        return Ok(WEBSOCKET_PORT);
    }

    // Check for force Python mode via environment variable
    let force_python = env::var("TODOFORAI_FORCE_PYTHON").unwrap_or_default() == "1";
    let force_production = env::var("TODOFORAI_FORCE_PRODUCTION").unwrap_or_default() == "1";
    
    // Determine if we're in development or production mode
    #[cfg(debug_assertions)]
    let is_dev_mode = true;
    #[cfg(not(debug_assertions))]
    let is_dev_mode = false;
    
    
    // Override mode if force_python is set
    let use_python = (is_dev_mode && !force_production) || force_python;

    info!(
        "Running in {} mode (is_dev_mode: {}, force_python: {}, force_production: {})",
        if use_python { "Python script" } else { "sidecar executable" },
        is_dev_mode,
        force_python,
        force_production
    );

    // Python script path (always available as a fallback)
    let script_path = app
        .path()
        .resolve("resources/python/ws_sidecar.py", BaseDirectory::Resource)
        .expect("Failed to resolve python script path");

    let (mut rx, child) = if use_python {
        // In development mode (or forced), use Python script
        info!("Using Python script at: {:?}", script_path);

        let python_executable = if cfg!(target_os = "windows") {
            "python"
        } else {
            "python3"
        };

        app.shell()
            .command(python_executable)
            .args([
                script_path.to_string_lossy().to_string(),
                "--port".to_string(),
                WEBSOCKET_PORT.to_string(),
            ])
            .env("PYTHONIOENCODING", "utf-8")
            .env("PYTHONUTF8", "1")
            .spawn()
            .map_err(|e| format!("Failed to start Python script: {}", e))?
    } else {
        // In production mode, use the sidecar
        info!("Using sidecar executable: todoforai-edge-sidecar");

        // Use the shell extension to get the sidecar
        match app.shell().sidecar("todoforai-edge-sidecar") {
            Ok(command) => {
                info!("Sidecar command created successfully");

                command
                    .args(["--port", &WEBSOCKET_PORT.to_string()])
                    .spawn()
                    .map_err(|e| format!("Failed to spawn sidecar: {}", e))?
            }
            Err(e) => {
                error!("Failed to create sidecar command: {}", e);
                // Fall back to Python script
                info!("Falling back to Python script at: {:?}", script_path);

                let python_executable = if cfg!(target_os = "windows") {
                    "python"
                } else {
                    "python3"
                };

                app.shell()
                    .command(python_executable)
                    .args([
                        script_path.to_string_lossy().to_string(),
                        "--port".to_string(),
                        WEBSOCKET_PORT.to_string(),
                    ])
                    .env("PYTHONIOENCODING", "utf-8")
                    .env("PYTHONUTF8", "1")
                    .spawn()
                    .map_err(|e| format!("Failed to start Python script fallback: {}", e))?
            }
        }
    };

    // Handle stdout/stderr in a separate thread for both cases
    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(line) => {
                    println!(
                        "Py stdout: {}",
                        String::from_utf8_lossy(&line).trim_end()
                    );
                }
                CommandEvent::Stderr(line) => {
                    println!(
                        "Py stderr: {}",
                        String::from_utf8_lossy(&line).trim_end()
                    );
                }
                _ => {}
            }
        }
    });

    // Wait for the sidecar to be ready (up to 10 seconds)
    wait_for_sidecar_ready(WEBSOCKET_PORT, 10).await?;

    // Create a sidecar wrapper and store it - do this in a separate scope
    {
        let mut state_lock = websocket_state.0.lock().unwrap();
        let sidecar = WebSocketSidecar { child: Some(child) };
        *state_lock = Some(sidecar);
    }

    info!("WebSocket sidecar started and ready on port {}", WEBSOCKET_PORT);
    Ok(WEBSOCKET_PORT)
}

#[tauri::command]
fn get_websocket_port() -> u16 {
    // Always return the fixed port
    WEBSOCKET_PORT
}

// Cross-platform function to kill process on port
fn kill_process_on_port(port: u16) -> Result<(), String> {
    info!("Attempting to kill process on port {}", port);

    #[cfg(target_os = "windows")]
    {
        // Windows: Use netstat and taskkill
        let output = std::process::Command::new("netstat")
            .args(["-ano"])
            .output()
            .map_err(|e| format!("Failed to run netstat: {}", e))?;

        let output_str = String::from_utf8_lossy(&output.stdout);
        for line in output_str.lines() {
            if line.contains(&format!(":{}", port)) && line.contains("LISTENING") {
                let parts: Vec<&str> = line.split_whitespace().collect();
                if let Some(pid) = parts.last() {
                    let _ = std::process::Command::new("taskkill")
                        .args(["/F", "/PID", pid])
                        .output();
                    info!("Killed process with PID: {}", pid);
                }
            }
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        // Unix-like: Use lsof and kill
        let output = std::process::Command::new("lsof")
            .args(["-t", &format!("-i:{}", port)])
            .output();

        if let Ok(output) = output {
            let pids = String::from_utf8_lossy(&output.stdout);
            for pid in pids.lines() {
                if !pid.trim().is_empty() {
                    let _ = std::process::Command::new("kill")
                        .args(["-9", pid.trim()])
                        .output();
                    info!("Killed process with PID: {}", pid.trim());
                }
            }
        }
    }

    Ok(())
}

#[tauri::command]
fn stop_websocket_sidecar(app: AppHandle) -> Result<(), String> {
    let websocket_state = app.state::<WebSocketState>();
    let mut state_lock = websocket_state.0.lock().unwrap();

    // Kill our managed process
    if let Some(mut sidecar) = state_lock.take() {
        if let Some(child) = sidecar.child.take() {
            let _ = child.kill();
            info!("Terminated managed WebSocket sidecar process");
        }
    }

    // Also kill any process using the port (cleanup orphaned processes)
    kill_process_on_port(WEBSOCKET_PORT)?;

    info!("WebSocket sidecar cleanup completed");
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_shell::init())
        .manage(WebSocketState(Arc::new(Mutex::new(None))))
        .setup(|app| {
            // Set up logging with tauri_plugin_log
            app.handle().plugin(
                tauri_plugin_log::Builder::default()
                    .level(log::LevelFilter::Debug)
                    .build(),
            )?;
            info!("Logging initialized with tauri_plugin_log!");

            // Debug: Print all CLI args
            let args: Vec<String> = std::env::args().collect();
            info!("🔍 CLI ARGS: {:?}", args);
            
            // Just log deep link detection for debugging
            for arg in &args {
                if arg.starts_with("todoforai-edge://auth/apikey/") {
                    if let Some(api_key) = arg.strip_prefix("todoforai-edge://auth/apikey/") {
                        info!("🔑 API KEY DETECTED: {}", api_key);
                    }
                }
            }

            info!("🔗 Deep link processing will be handled by frontend via CLI args");

            // restore size and position before the window shows up
            if let Ok(state) = get_saved_window_size(app.handle().clone()) {
                if let Some(main) = app.get_webview_window("main") {
                    let _ = main.set_size(PhysicalSize::new(state.width, state.height));
                    let _ = main.set_position(tauri::PhysicalPosition::new(state.x, state.y));
                }
            }

            // Add window close event handler for cleanup
            if let Some(main_window) = app.get_webview_window("main") {
                let app_handle = app.handle().clone();
                main_window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { .. } = event {
                        info!("Window close requested, cleaning up WebSocket sidecar");
                        let _ = stop_websocket_sidecar(app_handle.clone());
                    }
                });
            }

            // Only in debug
            #[cfg(debug_assertions)]
            {
                let win = app.get_webview_window("main").unwrap();
                win.open_devtools();
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            open_devtools,
            get_saved_window_size,
            save_current_window_size,
            get_cli_args,
            get_current_working_directory,
            get_env_var,
            start_websocket_sidecar,
            stop_websocket_sidecar,
            get_websocket_port
        ])
        .run(tauri::generate_context!())
        .expect("error while running Tauri application");
}
