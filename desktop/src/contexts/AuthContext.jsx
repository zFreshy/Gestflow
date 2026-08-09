import React, { createContext, useState, useEffect, useContext } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            setLoading(false);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
            setLoading(false);
        });

        return () => subscription.unsubscribe();
    }, []);

    const signIn = async (email, password) => {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        return data;
    };

    const signOut = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
    };

    // O app roda em tauri://localhost, que o Supabase nao aceita como redirect.
    // Por isso o link do e-mail aponta para o site, onde a troca ja funciona.
    const resetPassword = async (email) => {
        const siteUrl = import.meta.env.VITE_SITE_URL;
        const { error } = await supabase.auth.resetPasswordForEmail(
            email,
            siteUrl ? { redirectTo: `${siteUrl}/update-password` } : undefined
        );
        if (error) throw error;
    };

    const getUserEmail = () => user?.email ?? '';

    const value = { signIn, signOut, resetPassword, user, session, loading, getUserEmail };

    return (
        <AuthContext.Provider value={value}>
            {loading ? <SessionSplash /> : children}
        </AuthContext.Provider>
    );
};

/**
 * Enquanto a sessão é lida do disco a tela ficaria branca. Curto, mas branco
 * parece app quebrado — melhor mostrar a marca.
 */
function SessionSplash() {
    return (
        <div className="h-screen flex flex-col items-center justify-center gap-4 bg-background">
            <span className="text-3xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-[#7E1A8B] to-purple-600">
                Mercadinho
            </span>
            <div className="h-1 w-32 rounded-full bg-gray-200 overflow-hidden">
                <div className="h-full w-1/2 rounded-full bg-[#7E1A8B] animate-pulse" />
            </div>
        </div>
    );
}
