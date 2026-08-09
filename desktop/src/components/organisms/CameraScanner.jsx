import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { DecodeHintType, BarcodeFormat } from '@zxing/library';
import { Camera, X, AlertTriangle, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '../atoms/Button';
import { Select } from '../atoms/Select';

// Só os formatos que aparecem em prateleira de mercado. Limitar a lista deixa
// o reconhecimento bem mais rapido do que deixar o ZXing testar tudo.
const HINTS = new Map([
    [DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
        BarcodeFormat.CODE_128,
        BarcodeFormat.CODE_39,
        BarcodeFormat.ITF,
    ]],
]);

const SAVED_CAMERA_KEY = 'mercadinho:cameraId';

/** Traduz o erro do navegador para algo que dê para agir. */
function describeError(err) {
    switch (err?.name) {
        case 'NotAllowedError':
            return 'Acesso à câmera bloqueado. Se você clicou em "Bloquear" quando o Windows perguntou, ' +
                'o WebView não pergunta de novo — feche o app, apague a pasta ' +
                '%LOCALAPPDATA%\\com.gestflow.mercadinho\\EBWebView e abra o app outra vez.';
        case 'NotFoundError':
        case 'OverconstrainedError':
            return 'Nenhuma câmera encontrada. Se você usa Iriun ou outro app de câmera virtual, ' +
                'abra ele e conecte o celular primeiro, depois clique em "Procurar de novo".';
        case 'NotReadableError':
            return 'A câmera existe mas está ocupada por outro programa. Feche quem estiver usando ' +
                '(Teams, Zoom, o próprio Iriun em outra janela) e tente de novo.';
        default:
            return `Não consegui abrir a câmera (${err?.name || 'erro desconhecido'}).`;
    }
}

export default function CameraScanner({ isOpen, onClose, onDetect }) {
    const videoRef = useRef(null);
    const controlsRef = useRef(null);

    const [devices, setDevices] = useState([]);
    const [deviceId, setDeviceId] = useState('');
    const [status, setStatus] = useState('loading'); // loading | ready | error
    const [error, setError] = useState('');

    /**
     * Descobre as câmeras disponíveis.
     *
     * O getUserMedia vem antes do enumerateDevices de propósito: sem uma
     * permissão já concedida, o navegador devolve a lista com `deviceId` e
     * `label` vazios — dá para saber quantas câmeras existem, mas não qual é
     * qual nem como abrir. E enumerateDevices sozinho nunca dispara o pedido de
     * permissão, então sem isto aqui o usuário nem chega a ser perguntado.
     */
    const discover = useCallback(async () => {
        setStatus('loading');
        setError('');

        let probe = null;
        try {
            probe = await navigator.mediaDevices.getUserMedia({ video: true });

            const list = await BrowserMultiFormatReader.listVideoInputDevices();
            setDevices(list);

            if (list.length === 0) {
                setStatus('error');
                setError('Nenhuma câmera encontrada neste computador.');
                return;
            }

            // Preferência salva, se a câmera ainda estiver conectada.
            const saved = localStorage.getItem(SAVED_CAMERA_KEY);
            const chosen = list.some((d) => d.deviceId === saved) ? saved : list[0].deviceId;

            setDeviceId(chosen);
            setStatus('ready');
        } catch (err) {
            console.error('Erro ao acessar a câmera:', err);
            setStatus('error');
            setError(describeError(err));

            // Mesmo sem conseguir abrir, tenta listar o que existe. Câmera
            // virtual sem o celular conectado aparece na lista mas não abre —
            // vendo o nome ali, dá para conectar e clicar em "Procurar de novo".
            try {
                setDevices(await BrowserMultiFormatReader.listVideoInputDevices());
            } catch {
                setDevices([]);
            }
        } finally {
            // Solta a câmera antes do ZXing abrir a dele. Câmera virtual como a
            // do Iriun costuma aceitar um consumidor só, e sem isto o leitor
            // encontraria o dispositivo ocupado por nós mesmos.
            probe?.getTracks().forEach((t) => t.stop());
        }
    }, []);

    useEffect(() => {
        if (isOpen) discover();
    }, [isOpen, discover]);

    // Liga a leitura na câmera escolhida.
    useEffect(() => {
        if (!isOpen || status !== 'ready' || !deviceId || !videoRef.current) return;

        let cancelled = false;
        const reader = new BrowserMultiFormatReader(HINTS);

        reader
            .decodeFromVideoDevice(deviceId, videoRef.current, (result) => {
                if (result && !cancelled) onDetect?.(result.getText());
            })
            .then((controls) => {
                if (cancelled) controls.stop();
                else controlsRef.current = controls;
            })
            .catch((err) => {
                if (cancelled) return;
                console.error('Erro ao iniciar a leitura:', err);
                setStatus('error');
                setError(describeError(err));
            });

        return () => {
            cancelled = true;
            controlsRef.current?.stop();
            controlsRef.current = null;
        };
    }, [isOpen, status, deviceId, onDetect]);

    const handlePick = (id) => {
        setDeviceId(id);
        localStorage.setItem(SAVED_CAMERA_KEY, id);
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div
                className="modal-content bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-[#7E1A8B]/10 flex items-center justify-center">
                            <Camera className="h-5 w-5 text-[#7E1A8B]" />
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-900">Ler pela câmera</h3>
                            <p className="text-xs text-gray-500">Aponte o código de barras para a câmera</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="h-9 w-9 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    {status === 'error' ? (
                        <div className="flex items-start gap-3 rounded-xl bg-amber-50 border border-amber-200 p-4">
                            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                            <p className="text-sm text-amber-800 leading-relaxed">{error}</p>
                        </div>
                    ) : (
                        <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
                            <video ref={videoRef} className="w-full h-full object-cover" />

                            {status === 'loading' && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/80">
                                    <Loader2 className="h-6 w-6 animate-spin" />
                                    <p className="text-sm font-medium">Procurando câmeras...</p>
                                </div>
                            )}

                            {/* Mira: ajuda a pessoa a centralizar o codigo. */}
                            {status === 'ready' && (
                                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                                    <div className="w-[70%] h-[28%] border-2 border-[#7E1A8B] rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
                                </div>
                            )}
                        </div>
                    )}

                    {/* Seletor sempre visível: com câmera virtual (Iriun, DroidCam,
                        OBS) costuma haver mais de uma entrada, e mesmo com uma só
                        é preciso enxergar qual está em uso. */}
                    <div className="flex items-end gap-2">
                        <div className="flex-1 space-y-1.5">
                            <label className="text-sm font-semibold text-gray-700">Câmera</label>
                            <Select
                                value={deviceId}
                                onChange={(e) => handlePick(e.target.value)}
                                disabled={devices.length === 0}
                            >
                                {devices.length === 0 ? (
                                    <option value="">Nenhuma câmera disponível</option>
                                ) : (
                                    devices.map((d, i) => (
                                        <option key={d.deviceId} value={d.deviceId}>
                                            {d.label || `Câmera ${i + 1}`}
                                        </option>
                                    ))
                                )}
                            </Select>
                        </div>

                        <Button
                            variant="outline"
                            onClick={discover}
                            disabled={status === 'loading'}
                            title="Procurar câmeras de novo"
                        >
                            <RefreshCw className={status === 'loading' ? 'h-4 w-4 mr-2 animate-spin' : 'h-4 w-4 mr-2'} />
                            Procurar de novo
                        </Button>
                    </div>

                    <p className="text-xs text-gray-400">
                        Usa câmera virtual (Iriun, DroidCam)? Conecte o celular primeiro e depois
                        clique em "Procurar de novo" — ela só aparece na lista quando está ativa.
                    </p>

                    <div className="flex justify-end">
                        <Button variant="outline" onClick={onClose}>Fechar</Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
