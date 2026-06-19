#![cfg_attributes(
  all(not(debug_assertions), target_os = "windows"),
  windows_subsystem = "windows"
)]

use std::sync::Mutex;
use std::fs::File;
use std::io::{Write, Read};
use std::path::PathBuf;
use steamworks::Client;
use tauri::{State, Manager, Window};

// Steam durumunu ve istemcisini saklayan yapı
struct SteamState(Option<Client>);

// Kayıt dosyasının yolunu döndüren yardımcı fonksiyon
fn get_save_path(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    let mut path = app_handle.path_resolver().app_data_dir()
        .ok_or_else(|| "Uygulama veri dizini bulunamadı".to_string())?;
    
    // Klasör yoksa oluştur
    if !path.exists() {
        std::fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    }
    
    path.push("savegame.json");
    Ok(path)
}

// Oyuncu adını Steam'den alan komut
#[tauri::command]
fn get_steam_name(state: State<'_, Mutex<SteamState>>) -> Result<String, String> {
    let state_guard = state.lock().map_err(|_| "Steam durumu kilitlenemedi".to_string())?;
    if let Some(client) = &state_guard.0 {
        // Steam'deki oyuncu adını döndür
        Ok(client.friends().persona_name())
    } else {
        Err("Steam istemcisi aktif değil".to_string())
    }
}

// Steam üzerinde başarım (achievement) kilidini açan komut
#[tauri::command]
fn unlock_achievement(state: State<'_, Mutex<SteamState>>, name: String) -> Result<(), String> {
    let state_guard = state.lock().map_err(|_| "Steam durumu kilitlenemedi".to_string())?;
    if let Some(client) = &state_guard.0 {
        let user_stats = client.user_stats();
        user_stats.achievement(&name).set().map_err(|e| e.to_string())?;
        user_stats.store().map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err("Steam istemcisi aktif değil".to_string())
    }
}

// Oyunu yerel dosyaya kaydeden komut
#[tauri::command]
fn save_game_file(app_handle: tauri::AppHandle, data: String) -> Result<(), String> {
    let path = get_save_path(&app_handle)?;
    let mut file = File::create(path).map_err(|e| e.to_string())?;
    file.write_all(data.as_bytes()).map_err(|e| e.to_string())?;
    Ok(())
}

// Oyunu yerel dosyadan yükleyen komut
#[tauri::command]
fn load_game_file(app_handle: tauri::AppHandle) -> Result<String, String> {
    let path = get_save_path(&app_handle)?;
    if !path.exists() {
        return Err("Kayıt dosyası bulunamadı".to_string());
    }
    let mut file = File::open(path).map_err(|e| e.to_string())?;
    let mut contents = String::new();
    file.read_to_string(&mut contents).map_err(|e| e.to_string())?;
    Ok(contents)
}

// Tam ekran modunu açıp kapatan komut
#[tauri::command]
fn toggle_fullscreen(window: Window) -> Result<(), String> {
    let is_fullscreen = window.is_fullscreen().map_err(|e| e.to_string())?;
    window.set_fullscreen(!is_fullscreen).map_err(|e| e.to_string())?;
    Ok(())
}

// Uygulamayı kapatan komut
#[tauri::command]
fn close_app(window: Window) -> Result<(), String> {
    window.close().map_err(|e| e.to_string())?;
    Ok(())
}

fn main() {
    // Steamworks API'sini 480 test AppID'si ile başlatmaya çalışıyoruz
    let steam_client = match Client::init_app(480) {
        Ok((client, single)) => {
            // Steam callback'lerini arka planda çalıştırmak için bir thread açıyoruz
            std::thread::spawn(move || loop {
                single.run_callbacks();
                std::thread::sleep(std::time::Duration::from_millis(15));
            });
            Some(client)
        }
        Err(_) => {
            // Steam açık değilse veya API başlatılamadıysa log yaz ve oyunu başlat
            println!("Steamworks başlatılamadı, oyun Steam olmadan çalışıyor.");
            None
        }
    };

    tauri::Builder::default()
        .manage(Mutex::new(SteamState(steam_client)))
        .invoke_handler(tauri::generate_handler![
            get_steam_name,
            unlock_achievement,
            save_game_file,
            load_game_file,
            toggle_fullscreen,
            close_app
        ])
        .run(tauri::generate_context!())
        .expect("Tauri uygulaması başlatılırken hata oluştu");
}
