/**
 * Guarda coisa em disco, do lado de cá.
 *
 * Mesma razão do `authStorage.js`: no Tauri o localStorage pertence à origem
 * que o WebView carregou, que muda entre `npm run dev` e o app instalado, e
 * some numa limpeza de cache. Uma venda esperando para ser enviada não pode
 * morrer assim — ela é dinheiro que entrou no caixa e ainda não existe no
 * servidor.
 *
 * No navegador (desenvolvimento) cai no localStorage, que é suficiente para
 * testar o fluxo.
 */

import { isTauri } from './authStorage';

const stores = new Map();

function tauriStore(file) {
    if (!stores.has(file)) {
        stores.set(
            file,
            import('@tauri-apps/plugin-store').then(({ load }) => load(file, { autoSave: true }))
        );
    }
    return stores.get(file);
}

/**
 * `file` vira um arquivo separado na pasta de dados do app. Vale separar por
 * assunto: a fila de vendas é reescrita a cada venda, o catálogo a cada
 * sincronização — juntos, um arquivo grande seria regravado por inteiro toda
 * vez que uma venda entrasse.
 */
export function createStore(file) {
    const webKey = (key) => `mercadinho:${file}:${key}`;

    if (!isTauri()) {
        return {
            async get(key, fallback = null) {
                try {
                    const raw = localStorage.getItem(webKey(key));
                    return raw === null ? fallback : JSON.parse(raw);
                } catch {
                    return fallback;
                }
            },
            async set(key, value) {
                try {
                    localStorage.setItem(webKey(key), JSON.stringify(value));
                } catch (err) {
                    console.error('Falha ao gravar local:', err);
                }
            },
        };
    }

    return {
        async get(key, fallback = null) {
            try {
                const store = await tauriStore(file);
                const value = await store.get(key);
                return value === undefined || value === null ? fallback : value;
            } catch (err) {
                console.error('Falha ao ler o arquivo local:', err);
                return fallback;
            }
        },
        async set(key, value) {
            try {
                const store = await tauriStore(file);
                await store.set(key, value);
                // `autoSave` grava sozinho, mas com atraso. Numa venda offline o
                // app pode ser fechado no segundo seguinte, então aqui não dá
                // para confiar no atraso.
                await store.save();
            } catch (err) {
                console.error('Falha ao gravar o arquivo local:', err);
                throw err;
            }
        },
    };
}
