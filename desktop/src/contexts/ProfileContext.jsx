import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { verifyEmployeePassword, listEmployeeProfiles } from '../services/mercadinhoService';

const ProfileContext = createContext({});

export const useProfile = () => useContext(ProfileContext);

const ACTIVE_PROFILE_KEY = 'mercadinho:activeProfile';

/**
 * Perfil ativo, no modelo do Chrome: a conta de verdade é a do administrador
 * (login do Supabase) e os funcionários são perfis dentro dela.
 *
 * IMPORTANTE: isto não é barreira de segurança. Todas as chamadas ao banco
 * continuam usando a sessão do administrador, então o perfil só decide o que a
 * interface mostra. Evita que o funcionário veja o financeiro sem querer; não
 * impede quem realmente queira burlar.
 */
export function ProfileProvider({ children }) {
    const { user } = useAuth();
    const [profile, setProfile] = useState(null); // null = administrador
    const [ready, setReady] = useState(false);

    // Restaura o perfil escolhido, conferindo se ele ainda existe e está ativo:
    // perfil apagado ou desativado não pode continuar valendo depois de um
    // restart só porque ficou salvo aqui.
    useEffect(() => {
        let cancelled = false;

        const restore = async () => {
            const raw = localStorage.getItem(ACTIVE_PROFILE_KEY);
            if (!raw) { setReady(true); return; }

            try {
                const saved = JSON.parse(raw);
                const profiles = await listEmployeeProfiles();
                const found = profiles.find((p) => p.id === saved.id);

                if (!cancelled) {
                    if (found) setProfile({ id: found.id, name: found.name });
                    else localStorage.removeItem(ACTIVE_PROFILE_KEY);
                }
            } catch (err) {
                console.error('Não consegui restaurar o perfil:', err);
                localStorage.removeItem(ACTIVE_PROFILE_KEY);
            } finally {
                if (!cancelled) setReady(true);
            }
        };

        if (user) restore();
        else { setProfile(null); setReady(true); }

        return () => { cancelled = true; };
    }, [user]);

    /** Entra num perfil de funcionário. Exige a senha dele. */
    const switchToEmployee = async (employeeProfile, password) => {
        const ok = await verifyEmployeePassword(employeeProfile.id, password);
        if (!ok) return false;

        const next = { id: employeeProfile.id, name: employeeProfile.name };
        localStorage.setItem(ACTIVE_PROFILE_KEY, JSON.stringify(next));
        setProfile(next);
        return true;
    };

    /**
     * Volta para o administrador. Exige a senha da conta.
     *
     * O Supabase não tem "conferir senha atual", então o jeito é tentar entrar
     * de novo com o mesmo e-mail: se autenticar, a senha está certa. É o mesmo
     * usuário, então a sessão apenas se renova.
     */
    const switchToAdmin = async (password) => {
        if (!user?.email) return false;

        const { error } = await supabase.auth.signInWithPassword({
            email: user.email,
            password,
        });
        if (error) return false;

        localStorage.removeItem(ACTIVE_PROFILE_KEY);
        setProfile(null);
        return true;
    };

    const value = useMemo(() => ({
        profile,
        isAdmin: profile === null,
        isEmployee: profile !== null,
        switchToEmployee,
        switchToAdmin,
        ready,
    }), [profile, ready, user?.email]);

    return (
        <ProfileContext.Provider value={value}>
            {ready ? children : null}
        </ProfileContext.Provider>
    );
}
