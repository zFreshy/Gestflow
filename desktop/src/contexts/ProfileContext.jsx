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
        if (!user) {
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
            await saveRole(user.id, { isAdmin: admin, profile: employeeProfile });

            // O e-mail do administrador serve ao caminho de volta: dentro de um
            // perfil de funcionário não há como descobri-lo, e obrigar a digitar
            // o e-mail quebraria a ideia de "só a senha".
            if (admin && user.email) {
                await rememberAdminEmail(user.email);
                setAdminEmail(user.email);
            }
        } catch (err) {
            console.error('Não consegui identificar o perfil:', err);

            // Sem resposta do banco, vale a última identidade conhecida DESTE
            // usuário. Antes o app assumia "funcionário", e o dono do
            // mercadinho abria o sistema rebaixado sempre que a internet caía —
            // sem dashboard, sem caixa, sem fiado, e com a tela de crédito
            // quebrando por falta de perfil.
            const cached = await readRole(user.id);

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
     * Entra num perfil de funcionário — na prática, faz login na conta dele.
     * O e-mail sintético vem do cadastro; o funcionário só digita a senha.
     */
    const switchToEmployee = async (employeeProfile, password) => {
        const email = employeeProfile.login_email;
        if (!email) return false;

        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) return false;

        await refresh();
        return true;
    };

    /** Volta para o administrador: login na conta dele, com a senha dele. */
    const switchToAdmin = async (password, email = rememberedAdminEmail()) => {
        if (!email) return false;

        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) return false;

        await refresh();
        return true;
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
