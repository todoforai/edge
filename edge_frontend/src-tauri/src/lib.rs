// Tauri V2
use dashmap::DashMap;
use log::{error, info};
use serde::{Deserialize, Serialize};
use std::io::{BufRead, BufReader};
use std::net::{SocketAddr, TcpStream};
use std::process::{Child, Command, Stdio};
use std::sync::Arc;
use std::thread;
use std::{env, fs, path::PathBuf, sync::Mutex};
use tauri::{path::BaseDirectory, AppHandle, Manager, PhysicalSize, WebviewWindow};

#[derive(Debug, Serialize, Deserialize)]
pub struct WindowState {
    pub width: u32,
    pub height: u32,
}

/// `$APPCONFIG/window_state.json`
fn state_file(app: &AppHandle) -> tauri::Result<PathBuf> {
    let path = app
        .path()
        .resolve("window_state.json", BaseDirectory::AppConfig);
    info!("Window state file path: {:?}", path);
    path
}

#[tauri::command]
fn save_current_window_size(app: AppHandle, win: WebviewWindow) -> Result<(), String> {
    // Get the current window size directly from the window
    let size = win.inner_size().map_err(|e| {
        error!("Failed to get window size: {}", e);
        e.to_string()
    })?;

    info!("Saving window size: {}x{}", size.width, size.height);
    let path = state_file(&app).map_err(|e| e.to_string())?;
    let state = WindowState {
        width: size.width,
        height: size.height,
    };

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    fs::write(path, serde_json::to_string(&state).unwrap()).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_saved_window_size(app: AppHandle) -> Result<WindowState, String> {
    info!("Getting saved window size");
    let path = state_file(&app).map_err(|e| e.to_string())?;

    if !path.exists() {
        return Ok(WindowState {
            width: 800,
            height: 600,
        });
    }

    let json = fs::read_to_string(path).map_err(|e| e.to_string())?;
    let state: WindowState = serde_json::from_str(&json).map_err(|e| e.to_string())?;
    info!("Loaded window size: {}x{}", state.width, state.height);
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

// Add a new struct for WebSocket sidecar
struct WebSocketSidecar {
    child: Child,
}

impl Drop for WebSocketSidecar {
    fn drop(&mut self) {
        if let Ok(Some(_status)) = self.child.try_wait() {
            // already exited
            return;
        }
        // Best-effort: kill and wait a little
        if let Err(e) = self.child.kill() {
            error!("Failed to kill WebSocket side-car: {}", e);
            return;
        }
        let _ = self.child.wait();
        info!("WebSocket side-car terminated (Drop)");
    }
}

// Store the WebSocket sidecar in Tauri state
struct WebSocketState(Arc<Mutex<Option<WebSocketSidecar>>>);

// Function to check if a port is already in use
fn is_port_in_use(port: u16) -> bool {
    TcpStream::connect(SocketAddr::from(([127, 0, 0, 1], port))).is_ok()
}

// Fixed WebSocket port
const WEBSOCKET_PORT: u16 = 9528;

#[tauri::command]
async fn start_websocket_sidecar(app: AppHandle) -> Result<u16, String> {
    let websocket_state = app.state::<WebSocketState>();
    let mut state_lock = websocket_state.0.lock().unwrap();

    // If already running in our process, return success
    if state_lock.is_some() {
        info!("WebSocket sidecar already running in this process");
        return Ok(WEBSOCKET_PORT);
    }

    // Check if the port is already in use (possibly by another process)
    if is_port_in_use(WEBSOCKET_PORT) {
        info!(
            "Port {} is already in use, assuming WebSocket sidecar is running",
            WEBSOCKET_PORT
        );
        return Ok(WEBSOCKET_PORT);
    }

    // Determine if we're in development or production mode
    #[cfg(debug_assertions)]
    let is_dev_mode = true;
    #[cfg(not(debug_assertions))]
    let is_dev_mode = false;

    info!("Running in {} mode", if is_dev_mode { "development" } else { "production" });

    // Try to get the sidecar path - Tauri will handle the platform-specific naming
    let sidecar_path = app.path()
        .resolve("binaries/todoforai-edge-sidecar", BaseDirectory::AppConfig)
        .ok();
    
    // Python script path (always available as a fallback)
    let script_path = app.path()
        .resolve("resources/python/ws_sidecar.py", BaseDirectory::Resource)
        .expect("Failed to resolve python script path");
    
    if let Some(ref path) = sidecar_path {
        info!("Found sidecar executable at: {:?}", path);
    } else {
        info!("Sidecar executable not found, will use Python script");
    }
    
    // Choose the appropriate command based on what's available and the mode
    let mut command = if is_dev_mode || sidecar_path.is_none() {
        // In development mode or if sidecar not found, use Python script
        info!("Using Python script at: {:?}", script_path);
        
        let python_executable = if cfg!(target_os = "windows") {
            "python"
        } else {
            "python3"
        };
        
        let mut cmd = Command::new(python_executable);
        cmd.arg(&script_path);
        cmd
    } else {
        // In production mode with sidecar available, use it
        let exec_path = sidecar_path
            .as_ref()  // Borrow the PathBuf instead of consuming it
            .unwrap();
            
        info!("Using sidecar executable at: {:?}", exec_path);
        
        Command::new(exec_path)  // No need for mut here
    };

    // Add common arguments
    command
        .arg("--port")
        .arg(WEBSOCKET_PORT.to_string())
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .env("PYTHONIOENCODING", "utf-8");

    // Start the process
    let mut child = command
        .spawn()
        .map_err(|e| format!("Failed to start WebSocket sidecar: {}", e))
        .or_else(|first_err| {
            if !is_dev_mode && sidecar_path.is_some() {
                info!("Falling back to Python script");
                
                let python = if cfg!(target_os = "windows") { "python" } else { "python3" };
                Command::new(python)
                    .arg(&script_path)
                    .arg("--port")
                    .arg(WEBSOCKET_PORT.to_string())
                    .stdin(Stdio::piped())
                    .stdout(Stdio::piped())
                    .stderr(Stdio::piped())
                    .env("PYTHONIOENCODING", "utf-8")
                    .spawn()
                    .map_err(|fallback_err| {
                        error!("Fallback to Python script also failed: {}", fallback_err);
                        format!(
                            "Failed to start WebSocket sidecar (exe) AND fallback (python): {} / {}",
                            first_err, fallback_err
                        )
                    })
            } else {
                Err(first_err) // propagate the original error string
            }
        })?;

    // Handle stderr for logging
    if let Some(stderr) = child.stderr.take() {
        thread::spawn(move || {
            let reader = BufReader::new(stderr);
            for line in reader.lines() {
                if let Ok(line) = line {
                    info!("WebSocket sidecar stderr: {}", line);
                }
            }
        });
    }

    // Handle stdout for logging
    if let Some(stdout) = child.stdout.take() {
        thread::spawn(move || {
            let reader = BufReader::new(stdout);
            for line in reader.lines() {
                if let Ok(line) = line {
                    info!("WebSocket sidecar stdout: {}", line);
                }
            }
        });
    }

    // Wait a moment for the server to start
    thread::sleep(std::time::Duration::from_millis(500));

    // Create a sidecar wrapper
    let sidecar = WebSocketSidecar { child };

    // Store the sidecar
    *state_lock = Some(sidecar);

    info!("WebSocket sidecar started on port {}", WEBSOCKET_PORT);
    Ok(WEBSOCKET_PORT)
}

#[tauri::command]
fn get_websocket_port() -> u16 {
    // Always return the fixed port
    WEBSOCKET_PORT
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_os::init())
        .manage(WebSocketState(Arc::new(Mutex::new(None))))
        .setup(|app| {
            // Set up logging with tauri_plugin_log
            app.handle().plugin(
                tauri_plugin_log::Builder::default()
                    .level(log::LevelFilter::Debug)
                    .build(),
            )?;
            info!("Logging initialized with tauri_plugin_log");

            // restore size before the window shows up
            if let Ok(size) = get_saved_window_size(app.handle().clone()) {
                if let Some(main) = app.get_webview_window("main") {
                    let _ = main.set_size(PhysicalSize::new(size.width, size.height));
                }
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
            get_websocket_port
        ])
        .run(tauri::generate_context!())
        .expect("error while running Tauri application");
}
