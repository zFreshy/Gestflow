import React, { useEffect, useState } from 'react';
import { Download, Loader2, X } from 'lucide-react';
import { Button } from '../atoms/Button';

/** No `vite dev` puro (navegador) o updater não existe — só dentro do Tauri. */
const isTauri = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export function UpdateBanner() {
    const [update, setUpdate] = useState(null);
    const [installing, setInstalling] = useState(false);
    const [progress, setProgress] = useState(0);
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        if (!isTauri()) return;

        let cancelled = false;

        (async () => {
            try {
                const { check } = await import('@tauri-apps/plugin-updater');
                const result = await check();
                if (!cancelled && result?.available) setUpdate(result);
            } catch (err) {
                // Sem internet ou release ainda não publicado: o app segue normal.
                console.warn('Não foi possível checar atualizações:', err);
            }
        })();

        return () => { cancelled = true; };
    }, []);

    const handleInstall = async () => {
        if (!update) return;

        setInstalling(true);
        try {
            let downloaded = 0;
            let total = 0;

            await update.downloadAndInstall((event) => {
                if (event.event === 'Started') {
                    total = event.data.contentLength ?? 0;
                } else if (event.event === 'Progress') {
                    downloaded += event.data.chunkLength;
                    if (total > 0) setProgress(Math.round((downloaded / total) * 100));
                }
            });

            const { relaunch } = await import('@tauri-apps/plugin-process');
            await relaunch();
        } catch (err) {
            console.error('Falha ao atualizar:', err);
            setInstalling(false);
            alert('Não consegui instalar a atualização. Tente de novo mais tarde.');
        }
    };

    if (!update || dismissed) return null;

    return (
        <div className="flex items-center gap-4 rounded-2xl bg-[#7E1A8B] text-white px-5 py-3.5 shadow-lg shadow-purple-900/10">
            <Download className="h-5 w-5 shrink-0" />

            <div className="flex-1 min-w-0">
                <p className="text-sm font-bold">
                    Atualização disponível — versão {update.version}
                </p>
                <p className="text-xs text-purple-200 truncate">
                    {installing
                        ? `Baixando... ${progress}%`
                        : 'O app reinicia sozinho depois de instalar.'}
                </p>
            </div>

            <Button
                size="sm"
                onClick={handleInstall}
                disabled={installing}
                className="bg-white text-[#7E1A8B] hover:bg-purple-50 shrink-0"
            >
                {installing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {installing ? 'Instalando' : 'Atualizar agora'}
            </Button>

            {!installing && (
                <button
                    onClick={() => setDismissed(true)}
                    className="h-8 w-8 rounded-lg flex items-center justify-center text-purple-200 hover:bg-white/10 transition-colors shrink-0"
                    title="Depois"
                >
                    <X className="h-4 w-4" />
                </button>
            )}
        </div>
    );
}
