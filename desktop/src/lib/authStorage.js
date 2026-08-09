/**
 * Onde a sessão do Supabase fica guardada no app desktop.
 *
 * O padrão do Supabase é o localStorage, que no Tauri pertence à origem que o
 * WebView carregou — `http://localhost:1420` em desenvolvimento e
 * `http://tauri.localhost` no app instalado. São origens diferentes, então cada
 * uma tem seu próprio localStorage e a sessão de uma não vale na outra.
 *
 * Aqui a sessão vai para um arquivo (`auth.json`) na pasta de dados do app.
 * O arquivo é identificado pelo aplicativo, não pela origem web, então dev e
 * app instalado passam a compartilhar o mesmo login — e ele sobrevive a
 * qualquer limpeza de cache do WebView.
 */

export const isTauri = () =>
    typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

let storePromise = null;

// Carrega sob demanda: em `npm run dev` no navegador o plugin não existe, e um
// import estático quebraria o app inteiro no boot.
function getStore() {
    if (!storePromise) {
        storePromise = import('@tauri-apps/plugin-store')
            .then(({ load }) => load('auth.json', { autoSave: true }));
    }
    return storePromise;
}

/**
 * Adaptador no formato que o supabase-js espera. Os métodos podem ser async —
 * o cliente aguarda as promises.
 */
export const tauriAuthStorage = {
    async getItem(key) {
        try {
            const store = await getStore();
            return (await store.get(key)) ?? null;
        } catch (err) {
            console.error('Falha ao ler a sessão salva:', err);
            return null;
        }
    },

    async setItem(key, value) {
        try {
            const store = await getStore();
            await store.set(key, value);
        } catch (err) {
            // Se gravar falhar, o login vale só até fechar o app. Melhor do que
            // derrubar a tela na cara de quem está no meio de uma venda.
            console.error('Falha ao salvar a sessão:', err);
        }
    },

    async removeItem(key) {
        try {
            const store = await getStore();
            await store.delete(key);
        } catch (err) {
            console.error('Falha ao apagar a sessão:', err);
        }
    },
};
