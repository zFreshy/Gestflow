import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { checkIsAdmin, getMyEmployeeProfile } from '../services/mercadinhoService';
import {
    readRole, saveRole, hydrateAdminEmail, rememberAdminEmail, rememberedAdminEmail,
} from '../lib/profileCache';

const ProfileContext = createContext({});

export const useProfile = () => useContext(ProfileContext);

/** E-mail do último administrador que usou este computador. */
export { rememberedAdminEmail };

/** De quanto em quanto tempo tenta confirmar o papel com o banco, quando ficou no cache. */
const RECHECK_MS = 30_000;

/**
 * Todo funcionário tem e-mail sintético terminado assim (ver `create-employee`).
 * Quem entra com qualquer outro e-mail é administrador — e isso dá para saber
 * olhando só a sessão, sem perguntar nada ao banco.
 */
const EMPLOYEE_DOMAIN = '@funcionario.local';

/** Falha de conexão, e não recusa do servidor nem erro de dado. */
function pareceFalhaDeRede(err) {
    const msg = String(err?.message ?? '').toLowerCase();
    return (
        err?.name === 'TypeError'
        || err?.name === 'AbortError'
        || msg.includes('fetch')
        || msg.includes('network')
        || msg.includes('failed to send')
        || msg.includes('timeout')
    );
}

const isAdminEmail = (email) =>
    Boolean(email) && !String(email).toLowerCase().endsWith(EMPLOYEE_DOMAIN);

/**
 * Quem está usando o app agora.
 *
 * A troca de perfil é um login de verdade: cada funcionário tem conta Supabase
 * própria, com e-mail sintético que ele nunca vê. Na tela ele digita só nome e
 * senha, como um perfil do Chrome — mas por baixo a sessão muda, e o banco
 * passa a responder de acordo com quem é.
 *
 * Por isso `isAdmin` não é decidido aqui: vem do banco (`is_admin()`). A tela
 * apenas reflete uma regra que já é aplicada no servidor — esconder menu é
 * conveniência, não a proteção.
 */
export function ProfileProvider({ children }) {
    const { user } = useAuth();
    const [profile, setProfile] = useState(null); // null = administrador
    const [isAdmin, setIsAdmin] = useState(true);
    const [ready, setReady] = useState(false);

    // O papel veio do disco porque o banco não respondeu. Enquanto for true, o
    // app continua tentando confirmar por baixo.
    const [fromCache, setFromCache] = useState(false);
    const retryTimer = useRef(null);

    // Em estado, e não só no módulo: o seletor de perfil mostra o nome do
    // administrador, e uma variável solta mudaria sem a tela ficar sabendo.
    const [adminEmail, setAdminEmail] = useState('');

    const refresh = useCallback(async () => {
        // Quem está logado AGORA, e não quem estava no último render.
        //
        // Trocar de perfil é um login de verdade, e este refresh roda logo em
        // seguida — antes do React repassar o novo `user`. Usando o do render,
        // o papel do funcionário era gravado e lido sob o id do administrador:
        // o cache devolvia "é admin" e a tela abria como administrador mesmo
        // depois da troca.
        const { data: { session } } = await supabase.auth.getSession();
        const atual = session?.user ?? user;

        if (!atual) {
            setProfile(null);
            setIsAdmin(true);
            setFromCache(false);
            setReady(true);
            return;
        }

        try {
            const admin = await checkIsAdmin();
            const employeeProfile = admin ? null : await getMyEmployeeProfile();

            setIsAdmin(admin);
            setProfile(employeeProfile);
            setFromCache(false);

            // Guarda para a próxima abertura sem internet.
            await saveRole(atual.id, { isAdmin: admin, profile: employeeProfile });

            // O e-mail do administrador serve ao caminho de volta: dentro de um
            // perfil de funcionário não há como descobri-lo, e obrigar a digitar
            // o e-mail quebraria a ideia de "só a senha".
            if (admin && atual.email) {
                await rememberAdminEmail(atual.email);
                setAdminEmail(atual.email);
            }
        } catch (err) {
            console.error('Não consegui identificar o perfil:', err);

            // Sem internet, vale a última identidade conhecida DESTE usuário:
            // antes o app assumia "funcionário" e o dono abria o sistema
            // rebaixado sempre que a conexão caía.
            //
            // Mas só falta de conexão justifica isso. Erro de dado — consulta
            // que devolveu mais linhas do que devia — não é internet fora, e
            // tratar como se fosse fazia o app mostrar um papel antigo em vez
            // de falhar visivelmente.
            const cached = pareceFalhaDeRede(err) ? await readRole(atual.id) : null;

            if (cached) {
                setIsAdmin(cached.isAdmin);
                setProfile(cached.profile ?? null);
                setFromCache(true);
            } else {
                // Primeira abertura desta conta e sem internet: aí não há o que
                // lembrar, e o papel mais restrito é o certo.
                setIsAdmin(false);
                setProfile(null);
            }
        } finally {
            setReady(true);
        }
    }, [user]);

    useEffect(() => { refresh(); }, [refresh]);

    // Enquanto estiver valendo o cache, tenta confirmar com o banco. Assim que
    // a internet volta, o papel real substitui o lembrado sozinho.
    useEffect(() => {
        clearInterval(retryTimer.current);
        if (!fromCache || !user) return undefined;

        retryTimer.current = setInterval(() => { refresh(); }, RECHECK_MS);
        return () => clearInterval(retryTimer.current);
    }, [fromCache, user, refresh]);

    // O e-mail do administrador é lido em tempo de render pelo seletor de
    // perfil, então precisa estar em memória antes da primeira pintura.
    useEffect(() => { hydrateAdminEmail().then(setAdminEmail); }, []);

    /**
     * Aprende o e-mail do administrador só de olhar quem está logado.
     *
     * Antes isso só acontecia depois de o banco confirmar `is_admin()`. Se essa
     * pergunta falhasse — internet fora, servidor lento — o e-mail nunca era
     * guardado, e o caminho de volta ficava quebrado: o seletor mandava
     * `switchToAdmin` com e-mail vazio, o login nem era tentado, e a tela
     * respondia "senha incorreta" com a senha certa.
     *
     * O e-mail sintético do funcionário é reconhecível pelo domínio, então dá
     * para saber quem é administrador sem perguntar nada a ninguém.
     */
    useEffect(() => {
        if (!user?.email || !isAdminEmail(user.email)) return;
        rememberAdminEmail(user.email);
        setAdminEmail(user.email);
    }, [user?.email]);

    /**
     * Entra num perfil de funcionário — na prática, faz login na conta dele.
     * O e-mail sintético vem do cadastro; o funcionário só digita a senha.
     */
    const switchToEmployee = async (employeeProfile, password) => {
        const email = employeeProfile.login_email;
        if (!email) return { ok: false, reason: 'sem-email' };

        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
            return {
                ok: false,
                reason: /fetch|network|failed to send/i.test(error.message ?? '')
                    ? 'sem-conexao'
                    : 'senha',
            };
        }

        await refresh();
        return { ok: true };
    };

    /**
     * Volta para o administrador: login na conta dele, com a senha dele.
     *
     * Devolve o motivo da recusa, e não só `false`. A diferença importa porque
     * "não sei o e-mail" e "a senha não confere" pedem coisas diferentes de
     * quem está na frente da tela — e antes as duas apareciam como
     * "senha incorreta", mandando a pessoa digitar de novo uma senha que já
     * estava certa.
     */
    const switchToAdmin = async (password, email = rememberedAdminEmail()) => {
        if (!email) return { ok: false, reason: 'sem-email' };

        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
            return {
                ok: false,
                // Sem internet o login falha por rede, não por senha errada.
                reason: /fetch|network|failed to send/i.test(error.message ?? '')
                    ? 'sem-conexao'
                    : 'senha',
            };
        }

        await refresh();
        return { ok: true };
    };

    const value = useMemo(() => ({
        profile,
        isAdmin,
        isEmployee: !isAdmin,
        /** O papel está valendo pelo cache local, sem confirmação do banco. */
        roleFromCache: fromCache,
        /** E-mail do último administrador que usou este computador. */
        adminEmail,
        switchToEmployee,
        switchToAdmin,
        refresh,
        ready,
    }), [profile, isAdmin, ready, refresh, fromCache, adminEmail]);

    return (
        <ProfileContext.Provider value={value}>
            {ready ? children : null}
        </ProfileContext.Provider>
    );
}
