/**
 * Última identidade conhecida de cada conta, guardada em disco.
 *
 * Quem decide se alguém é administrador é o banco (`is_admin()`). Mas essa
 * pergunta precisa de internet, e desde que o app passou a vender offline,
 * abrir sem conexão virou rotina — não exceção.
 *
 * Sem esta cópia, a falha da pergunta era tratada como "não é administrador",
 * e o dono do mercadinho abria o app rebaixado a funcionário: sem dashboard,
 * sem caixa, sem fiado. Aqui o app lembra o que o banco respondeu da última
 * vez e segue com isso até conseguir perguntar de novo.
 *
 * **Isto não é uma brecha de segurança**, e vale explicar por quê: o papel
 * guardado aqui decide só o que aparece no menu. Quem protege o dado é o RLS,
 * no servidor. Alguém que edite este arquivo à mão para virar "administrador"
 * consegue ver as telas — e todas voltam vazias, porque o banco continua
 * respondendo conforme o login de verdade.
 *
 * A chave é o id do usuário: sem isso, sair de uma conta de administrador e
 * entrar numa de funcionário herdaria o papel anterior.
 */

import { createStore } from './localStore';

const store = createStore('perfil.json');
const ROLES_KEY = 'papeis';
const ADMIN_EMAIL_KEY = 'email_admin';

/** Chave antiga, de quando isto morava no localStorage do WebView. */
const LEGACY_ADMIN_EMAIL = 'mercadinho:adminEmail';

export async function readRole(userId) {
    if (!userId) return null;
    const all = (await store.get(ROLES_KEY, {})) ?? {};
    return all[userId] ?? null;
}

export async function saveRole(userId, { isAdmin, profile }) {
    if (!userId) return;
    const all = (await store.get(ROLES_KEY, {})) ?? {};
    await store.set(ROLES_KEY, {
        ...all,
        [userId]: { isAdmin, profile, savedAt: new Date().toISOString() },
    });
}

// ---------------------------------------------------------------------------
// E-mail do administrador
//
// O seletor de perfil precisa dele em tempo de render, para oferecer o caminho
// de volta sem exigir que o funcionário digite um e-mail que ele nem conhece.
// Por isso existe uma cópia em memória: o valor de disco é assíncrono, e
// esperar por ele deixaria o botão sumir e reaparecer.
// ---------------------------------------------------------------------------

let adminEmailCache = '';

export const rememberedAdminEmail = () => adminEmailCache;

export async function hydrateAdminEmail() {
    const saved = await store.get(ADMIN_EMAIL_KEY, null);

    // Se alguém já gravou enquanto a leitura do disco estava a caminho, o que
    // está em memória é mais novo. Sobrescrever aqui apagaria o e-mail recém
    // descoberto — e o efeito disso não aparece na hora: só quando alguém
    // tenta voltar para o administrador e leva "senha incorreta" com a senha
    // certa, porque sem e-mail o login nem chega a ser tentado.
    if (!saved && adminEmailCache) return adminEmailCache;

    // Migração de quem já usava a versão anterior: o valor morava no
    // localStorage, que pertence à origem do WebView e some numa limpeza de
    // cache. Passa para o arquivo na primeira abertura e não se perde mais.
    if (!saved) {
        try {
            const legacy = localStorage.getItem(LEGACY_ADMIN_EMAIL);
            if (legacy) {
                adminEmailCache = legacy;
                await store.set(ADMIN_EMAIL_KEY, legacy);
                return legacy;
            }
        } catch {
            // Sem localStorage disponível — não é motivo para travar o boot.
        }
    }

    adminEmailCache = saved ?? '';
    return adminEmailCache;
}

export async function rememberAdminEmail(email) {
    if (!email || email === adminEmailCache) return;
    adminEmailCache = email;
    await store.set(ADMIN_EMAIL_KEY, email);
}
