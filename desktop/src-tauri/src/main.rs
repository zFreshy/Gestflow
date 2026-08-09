// Esconde o terminal preto que abriria junto com o app no Windows release.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    mercadinho_lib::run()
}
