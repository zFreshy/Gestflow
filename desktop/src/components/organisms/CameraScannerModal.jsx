import React, { Suspense, lazy } from 'react';
import { Loader2 } from 'lucide-react';

/**
 * A leitura por camera carrega o ZXing, que sozinho passa de 600kB. Como o uso
 * normal e o leitor USB, so puxamos esse peso quando alguem abre a camera de
 * fato - o resto do app abre bem mais rapido assim.
 */
const CameraScanner = lazy(() => import('./CameraScanner'));

export function CameraScannerModal(props) {
    if (!props.isOpen) return null;

    return (
        <Suspense
            fallback={
                <div className="modal-overlay">
                    <div className="bg-white rounded-2xl px-8 py-6 flex items-center gap-3 shadow-2xl">
                        <Loader2 className="h-5 w-5 animate-spin text-[#7E1A8B]" />
                        <span className="text-sm font-semibold text-gray-700">Abrindo a câmera...</span>
                    </div>
                </div>
            }
        >
            <CameraScanner {...props} />
        </Suspense>
    );
}
