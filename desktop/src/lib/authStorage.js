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

            // `autoSave` grava sozinho, mas com 100ms de atraso — e é justamente
            // nesse intervalo que o risco mora. O Supabase troca o token de
            // renovação de tempos em tempos e invalida o anterior no servidor;
            // se o computador for desligado antes da gravação sair, o disco fica
            // com um token que já não vale mais, e a próxima abertura cai na
            // tela de login sem ninguém ter saído da conta.
            //
            // Salvar na hora custa uma escrita a cada renovação (uma por hora,
            // mais ou menos) e elimina a janela.
            await store.save();
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
            // Mesmo motivo do setItem, ao contrário: sair da conta tem que valer
            // mesmo se o app for fechado no segundo seguinte.
            await store.save();
        } catch (err) {
            console.error('Falha ao apagar a sessão:', err);
        }
    },
};
