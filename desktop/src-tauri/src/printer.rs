//! Impressao direta na bobina, sem o dialogo do Windows.
//!
//! O caminho anterior era `window.print()`, que abre a janela de impressao e
//! exige um clique por venda. Num balcao de padaria isso e um clique a mais com
//! o cliente esperando, e o operador acaba deixando de imprimir.
//!
//! Aqui os bytes ESC/POS vao direto para o spooler com o tipo de dado "RAW",
//! que manda a impressora executar os comandos em vez de tentar desenhar uma
//! pagina. E o que permite cortar o papel e abrir a gaveta — coisas que nao
//! existem no modelo de impressao de documento.
//!
//! So Windows: o app e distribuido em MSI e roda no computador da loja. Nos
//! outros sistemas os comandos respondem erro, e o app cai de volta no dialogo.

use serde::Serialize;

#[derive(Serialize)]
pub struct PrinterInfo {
    pub name: String,
    pub is_default: bool,
}

#[cfg(windows)]
mod win {
    use super::PrinterInfo;
    use std::ffi::c_void;
    use std::ptr;
    use windows_sys::Win32::Foundation::{HANDLE, INVALID_HANDLE_VALUE};
    use windows_sys::Win32::Graphics::Printing::{
        ClosePrinter, EndDocPrinter, EndPagePrinter, EnumPrintersW, GetDefaultPrinterW,
        OpenPrinterW, StartDocPrinterW, StartPagePrinter, WritePrinter, DOC_INFO_1W,
        PRINTER_ENUM_CONNECTIONS, PRINTER_ENUM_LOCAL, PRINTER_INFO_4W,
    };

    /// Converte para UTF-16 terminado em zero, como a API do Windows espera.
    fn wide(text: &str) -> Vec<u16> {
        text.encode_utf16().chain(std::iter::once(0)).collect()
    }

    fn from_wide(ptr: *const u16) -> String {
        if ptr.is_null() {
            return String::new();
        }
        let mut len = 0;
        unsafe {
            while *ptr.add(len) != 0 {
                len += 1;
            }
            String::from_utf16_lossy(std::slice::from_raw_parts(ptr, len))
        }
    }

    fn default_printer() -> String {
        let mut size: u32 = 0;
        unsafe {
            // Primeira chamada so descobre o tamanho: a API nao diz de quanto
            // precisa sem antes falhar por falta de espaco.
            GetDefaultPrinterW(ptr::null_mut(), &mut size);
            if size == 0 {
                return String::new();
            }
            let mut buf = vec![0u16; size as usize];
            if GetDefaultPrinterW(buf.as_mut_ptr(), &mut size) == 0 {
                return String::new();
            }
            from_wide(buf.as_ptr())
        }
    }

    pub fn list() -> Result<Vec<PrinterInfo>, String> {
        let flags = PRINTER_ENUM_LOCAL | PRINTER_ENUM_CONNECTIONS;
        let mut needed: u32 = 0;
        let mut returned: u32 = 0;

        unsafe {
            // Mesmo padrao de duas passadas: a primeira mede, a segunda le.
            EnumPrintersW(flags, ptr::null(), 4, ptr::null_mut(), 0, &mut needed, &mut returned);

            if needed == 0 {
                return Ok(Vec::new());
            }

            let mut buffer = vec![0u8; needed as usize];
            let ok = EnumPrintersW(
                flags,
                ptr::null(),
                4,
                buffer.as_mut_ptr(),
                needed,
                &mut needed,
                &mut returned,
            );

            if ok == 0 {
                return Err("Nao consegui listar as impressoras do Windows.".into());
            }

            let default = default_printer();
            let entries = buffer.as_ptr() as *const PRINTER_INFO_4W;

            let mut printers = Vec::with_capacity(returned as usize);
            for i in 0..returned as usize {
                let name = from_wide((*entries.add(i)).pPrinterName);
                if name.is_empty() {
                    continue;
                }
                printers.push(PrinterInfo {
                    is_default: name == default,
                    name,
                });
            }

            Ok(printers)
        }
    }

    pub fn print_raw(printer: &str, data: &[u8]) -> Result<(), String> {
        let mut name = wide(printer);
        let mut handle: HANDLE = INVALID_HANDLE_VALUE;

        unsafe {
            if OpenPrinterW(name.as_mut_ptr(), &mut handle, ptr::null()) == 0 {
                return Err(format!("Nao consegui abrir a impressora \"{printer}\"."));
            }

            let mut doc_name = wide("Cupom Mercadinho");
            // "RAW" e o que faz a diferenca: sem isso o Windows trataria os
            // bytes como texto a ser renderizado e os comandos ESC/POS sairiam
            // impressos como lixo no papel.
            let mut datatype = wide("RAW");

            let info = DOC_INFO_1W {
                pDocName: doc_name.as_mut_ptr(),
                pOutputFile: ptr::null_mut(),
                pDatatype: datatype.as_mut_ptr(),
            };

            let job = StartDocPrinterW(handle, 1, &info);
            if job == 0 {
                ClosePrinter(handle);
                return Err("A impressora recusou o trabalho de impressao.".into());
            }

            if StartPagePrinter(handle) == 0 {
                EndDocPrinter(handle);
                ClosePrinter(handle);
                return Err("Nao consegui iniciar a pagina.".into());
            }

            let mut written: u32 = 0;
            let ok = WritePrinter(
                handle,
                data.as_ptr() as *const c_void,
                data.len() as u32,
                &mut written,
            );

            EndPagePrinter(handle);
            EndDocPrinter(handle);
            ClosePrinter(handle);

            if ok == 0 {
                return Err("Falha ao enviar os dados para a impressora.".into());
            }
            if written as usize != data.len() {
                return Err("A impressora recebeu o cupom pela metade.".into());
            }
        }

        Ok(())
    }
}

#[cfg(not(windows))]
mod win {
    use super::PrinterInfo;

    pub fn list() -> Result<Vec<PrinterInfo>, String> {
        Ok(Vec::new())
    }

    pub fn print_raw(_printer: &str, _data: &[u8]) -> Result<(), String> {
        Err("Impressao direta so funciona no Windows.".into())
    }
}

#[tauri::command]
pub fn list_printers() -> Result<Vec<PrinterInfo>, String> {
    win::list()
}

/// `data` chega como lista de bytes porque o front monta o ESC/POS em JS —
/// tudo que o Rust faz aqui e entregar ao spooler sem interpretar nada.
#[tauri::command]
pub fn print_raw(printer: String, data: Vec<u8>) -> Result<(), String> {
    if printer.trim().is_empty() {
        return Err("Nenhuma impressora escolhida.".into());
    }
    if data.is_empty() {
        return Err("Nada para imprimir.".into());
    }
    win::print_raw(&printer, &data)
}
