use tauri::{
    menu::{Menu, MenuItem},
    plugin::Builder as PluginBuilder,
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, Runtime, Url,
};
use tauri_plugin_opener::OpenerExt;
use tiny_http::{Response, Server};

const TRAY_COMMAND_EVENT: &str = "desktop://tray-command";
const LOCAL_AUTH_EVENT: &str = "desktop://local-auth";

fn is_first_party_host(host: &str) -> bool {
    host == "localhost"
        || host == "127.0.0.1"
        || host == "profitabledge.com"
        || host == "www.profitabledge.com"
        || host == "api.profitabledge.com"
        || host == "www.api.profitabledge.com"
}

fn has_google_provider(url: &Url) -> bool {
    url.query_pairs().any(|(key, value)| {
        key.eq_ignore_ascii_case("provider") && value.eq_ignore_ascii_case("google")
    })
}

fn is_google_auth_host(host: &str) -> bool {
    host == "accounts.google.com"
        || host == "oauth2.googleapis.com"
        || host == "apis.google.com"
        || host == "accounts.youtube.com"
}

fn should_open_in_system_browser(url: &Url) -> bool {
    if !matches!(url.scheme(), "http" | "https") {
        return false;
    }

    let Some(host) = url.host_str() else {
        return false;
    };

    if is_google_auth_host(host) {
        return true;
    }

    if !is_first_party_host(host) {
        return false;
    }

    let path = url.path();
    if path.starts_with("/desktop/auth/start") || path.starts_with("/desktop/auth/begin") {
        return true;
    }

    path.starts_with("/api/auth/")
        && (has_google_provider(url)
            || path.contains("/sign-in/social")
            || path.contains("/sign-in/oauth")
            || path.contains("/callback/google"))
}

fn desktop_navigation_plugin<R: Runtime>() -> tauri::plugin::TauriPlugin<R> {
    PluginBuilder::new("desktop-navigation")
        .on_navigation(|webview, url| {
            if !should_open_in_system_browser(url) {
                return true;
            }

            if let Err(error) = webview
                .app_handle()
                .opener()
                .open_url(url.as_str(), None::<String>)
            {
                eprintln!(
                    "[desktop] failed to open external browser for {}: {}",
                    url, error
                );
                return true;
            }

            false
        })
        .build()
}

fn emit_tray_command<R: Runtime>(app: &tauri::AppHandle<R>, command: &str) {
    let _ = app.emit(TRAY_COMMAND_EVENT, command.to_string());
}

fn spawn_local_auth_bridge<R: Runtime>(app: tauri::AppHandle<R>) {
    std::thread::spawn(move || {
        let server = match Server::http("127.0.0.1:3310") {
            Ok(server) => server,
            Err(error) => {
                eprintln!("[desktop] failed to start local auth bridge: {}", error);
                return;
            }
        };

        for request in server.incoming_requests() {
            let url = request.url().to_string();
            if url.starts_with("/desktop/auth/complete?") {
                let payload = format!("http://127.0.0.1:3310{}", url);
                let _ = app.emit(LOCAL_AUTH_EVENT, payload);
            }

            let response = Response::from_string(
                "<!doctype html><html><head><meta charset=\"utf-8\"><title>Profitabledge</title><style>body{font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display',sans-serif;background:#0b0d12;color:#f5f7fb;display:grid;place-items:center;min-height:100vh;margin:0}main{width:min(100%,28rem);text-align:center;padding:2rem}p{color:rgba(245,247,251,.72);line-height:1.6}</style></head><body><main><h1>Opening Profitabledge…</h1><p>You can return to the desktop app now.</p></main></body></html>"
            )
            .with_status_code(200)
            .with_header(
                tiny_http::Header::from_bytes(&b"Content-Type"[..], &b"text/html; charset=utf-8"[..])
                    .unwrap(),
            );
            let _ = request.respond(response);
        }
    });
}

fn build_tray<R: Runtime>(app: &tauri::AppHandle<R>) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "tray-show", "Open Profitabledge", true, None::<&str>)?;
    let new_tab = MenuItem::with_id(app, "tray-new-tab", "New tab", true, None::<&str>)?;
    let assistant = MenuItem::with_id(app, "tray-assistant", "Open Assistant", true, None::<&str>)?;
    let notifications = MenuItem::with_id(
        app,
        "tray-notifications",
        "Notifications",
        true,
        None::<&str>,
    )?;
    let import = MenuItem::with_id(app, "tray-import", "Import account", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "tray-quit", "Quit", true, None::<&str>)?;

    let menu = Menu::with_items(
        app,
        &[&show, &new_tab, &assistant, &notifications, &import, &quit],
    )?;

    TrayIconBuilder::with_id("main-tray")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.unminimize();
                    let _ = window.set_focus();
                }
            }
        })
        .on_menu_event(|app, event| match event.id.as_ref() {
            "tray-show" => emit_tray_command(app, "show"),
            "tray-new-tab" => emit_tray_command(app, "new-tab"),
            "tray-assistant" => emit_tray_command(app, "assistant"),
            "tray-notifications" => emit_tray_command(app, "notifications"),
            "tray-import" => emit_tray_command(app, "import"),
            "tray-quit" => app.exit(0),
            _ => {}
        })
        .build(app)?;

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let handle = app.handle().clone();
            build_tray(&handle)?;
            #[cfg(debug_assertions)]
            spawn_local_auth_bridge(handle.clone());
            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_deep_link::init())
        .plugin(desktop_navigation_plugin())
        .run(tauri::generate_context!())
        .expect("failed to run Profitabledge");
}
