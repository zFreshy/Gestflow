import React, {
    createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { flushOutbox, listQueued, subscribeOutbox } from '../lib/salesOutbox';
import { refreshCatalog } from '../lib/catalogCache';

const ConnectionContext = createContext({});

export const useConnection = () => useContext(ConnectionContext);

/** De quanto em quanto tempo tenta de novo enquanto está fora do ar. */
const RETRY_MS = 20_000;
/** Ritmo do sinal de vida quando está tudo certo. */
const HEARTBEAT_MS = 60_000;

/**
 * Se o app enxerga o servidor agora, e o que ainda falta subir.
 *
 * `navigator.onLine` sozinho não serve: ele diz apenas que existe uma placa de
 * rede com cabo, e responde `true` num Wi-Fi de roteador sem internet — o caso
 * mais comum no comércio. Por isso o estado real vem de uma pergunta barata ao
 * Supabase, e não do navegador. O evento do navegador continua sendo usado,
 * mas só como aviso de "tenta agora", nunca como resposta.
 */
export function ConnectionProvider({ children }) {
    // Sem sessão não há o que conferir: o RLS nega toda leitura para quem não
    // está logado, e a conferência responderia "sem internet" na tela de login
    // de uma máquina perfeitamente conectada.
    const { user } = useAuth();

    const [online, setOnline] = useState(true);
    const [queued, setQueued] = useState([]);
    const [syncing, setSyncing] = useState(false);

    // Evita duas sincronizações ao mesmo tempo (voltou a conexão E bateu o
    // relógio no mesmo instante), que mandariam a mesma venda duas vezes.
    // O banco recusaria a duplicata, mas o contador na tela piscaria errado.
    const running = useRef(false);
    const timer = useRef(null);

    useEffect(() => {
        listQueued().then(setQueued);
        return subscribeOutbox(setQueued);
    }, []);

    /** Pergunta barata só para saber se o servidor responde. */
    const ping = useCallback(async () => {
        try {
            const { error } = await supabase
                .from('products_pos')
                .select('id', { count: 'exact', head: true })
                .limit(1);
            return !error;
        } catch {
            return false;
        }
    }, []);

    const sync = useCallback(async ({ silent = true } = {}) => {
        if (!user || running.current) return;
        running.current = true;
        if (!silent) setSyncing(true);

        try {
            const reachable = await ping();
            setOnline(reachable);
            if (!reachable) return;

            const pending = await listQueued();
            if (pending.length > 0) {
                setSyncing(true);
                const result = await flushOutbox();
                // Uma venda recusada não derruba o app: ela fica marcada na
                // fila e aparece na tela de vendas pendentes.
                if (result.blocked > 0) {
                    console.warn(`${result.blocked} venda(s) recusada(s) pelo servidor.`);
                }
            }

            // O catálogo é atualizado junto: é o que permite bipar produto na
            // próxima queda. Falhar aqui não é motivo para dizer que está
            // offline — a cópia velha ainda serve.
            try {
                await refreshCatalog();
            } catch (err) {
                console.error('Não consegui atualizar o catálogo local:', err);
            }
        } finally {
            running.current = false;
            setSyncing(false);
        }
    }, [ping, user]);

    // Relógio: rápido enquanto está fora, devagar enquanto está tudo certo.
    useEffect(() => {
        if (!user) {
            // Volta ao otimismo ao deslogar, senão o aviso de "sem internet"
            // ficaria pendurado na tela de login do próximo turno.
            setOnline(true);
            return undefined;
        }

        const tick = () => sync();
        tick();

        clearInterval(timer.current);
        timer.current = setInterval(tick, online ? HEARTBEAT_MS : RETRY_MS);

        return () => clearInterval(timer.current);
    }, [online, sync, user]);

    // O aviso do navegador é atalho, não verdade: dispara uma conferência.
    useEffect(() => {
        const onUp = () => sync();
        window.addEventListener('online', onUp);
        // Voltar para a janela depois de horas é um bom momento para conferir.
        window.addEventListener('focus', onUp);
        return () => {
            window.removeEventListener('online', onUp);
            window.removeEventListener('focus', onUp);
        };
    }, [sync]);

    const value = useMemo(() => ({
        online,
        syncing,
        queued,
        pendingCount: queued.filter((e) => !e.blocked).length,
        blockedCount: queued.filter((e) => e.blocked).length,
        sync,
        /** Marca como offline na hora em que uma chamada de verdade falhou. */
        reportOffline: () => setOnline(false),
    }), [online, syncing, queued, sync]);

    return (
        <ConnectionContext.Provider value={value}>
            {children}
        </ConnectionContext.Provider>
    );
}
