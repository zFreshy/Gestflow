import { createClient } from '@supabase/supabase-js';
import { tauriAuthStorage, isTauri } from './authStorage';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    // Sem isso o app abre numa tela branca sem explicacao nenhuma.
    console.error(
        'VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY nao configurados. ' +
        'Copie o desktop/.env.example para desktop/.env e preencha.'
    );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        // Dentro do Tauri a sessão vai para arquivo; no navegador (npm run dev)
        // cai no localStorage padrão do Supabase. Ver lib/authStorage.js.
        storage: isTauri() ? tauriAuthStorage : undefined,
        // O app roda em tauri://localhost e nao recebe callback de URL,
        // entao nao adianta tentar ler sessao da querystring.
        detectSessionInUrl: false,
    },
});
