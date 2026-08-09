import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { checkIsAdmin, getMyEmployeeProfile } from '../services/mercadinhoService';

const ProfileContext = createContext({});

export const useProfile = () => useContext(ProfileContext);

const ADMIN_EMAIL_KEY = 'mercadinho:adminEmail';

/** E-mail do último administrador que usou este computador. */
export const rememberedAdminEmail = () => localStorage.getItem(ADMIN_EMAIL_KEY) ?? '';

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

    const refresh = useCallback(async () => {
        if (!user) {
            setProfile(null);
            setIsAdmin(true);
            setReady(true);
            return;
        }

        try {
            const admin = await checkIsAdmin();
            setIsAdmin(admin);
            setProfile(admin ? null : await getMyEmployeeProfile());

            // Guarda o e-mail do administrador para o caminho de volta: dentro
            // de um perfil de funcionário não há como descobri-lo, e obrigar a
            // digitar o e-mail quebraria a ideia de "só a senha".
            if (admin && user.email) {
                localStorage.setItem(ADMIN_EMAIL_KEY, user.email);
            }
        } catch (err) {
            console.error('Não consegui identificar o perfil:', err);
            // Na dúvida, o papel mais restrito: melhor esconder demais do que
            // mostrar o financeiro para quem não devia.
            setIsAdmin(false);
            setProfile(null);
        } finally {
            setReady(true);
        }
    }, [user]);

    useEffect(() => { refresh(); }, [refresh]);

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
        switchToEmployee,
        switchToAdmin,
        refresh,
        ready,
    }), [profile, isAdmin, ready, refresh]);

    return (
        <ProfileContext.Provider value={value}>
            {ready ? children : null}
        </ProfileContext.Provider>
    );
}
