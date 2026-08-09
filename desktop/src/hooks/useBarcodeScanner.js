import { useEffect, useRef } from 'react';

/**
 * Captura leitor de codigo de barras USB.
 *
 * Leitor de pistola USB se apresenta pro Windows como teclado: ele "digita" o
 * codigo caractere por caractere e no fim manda Enter. O que separa ele de uma
 * pessoa digitando e a velocidade - o leitor solta ~10ms entre teclas, uma
 * pessoa nao passa de ~50ms nem digitando rapido.
 *
 * Se o foco estiver num campo de texto, o hook sai de cena e deixa o campo
 * receber - e o caso do PDV, que tem o proprio campo de bipe sempre focado.
 *
 * @param {(code: string) => void} onScan  chamado com o codigo lido
 * @param {object}  options
 * @param {boolean} options.enabled       liga/desliga a captura
 * @param {number}  options.maxKeyDelay   intervalo maximo entre teclas (ms)
 * @param {number}  options.minLength     tamanho minimo pra valer como codigo
 */
export function useBarcodeScanner(onScan, options = {}) {
    const {
        enabled = true,
        maxKeyDelay = 60,
        minLength = 4,
    } = options;

    // Em ref pra nao precisar reinstalar o listener a cada render do pai.
    const onScanRef = useRef(onScan);
    onScanRef.current = onScan;

    const bufferRef = useRef('');
    const lastKeyRef = useRef(0);
    const flushTimerRef = useRef(null);

    useEffect(() => {
        if (!enabled) return;

        const clearFlush = () => {
            if (flushTimerRef.current) {
                clearTimeout(flushTimerRef.current);
                flushTimerRef.current = null;
            }
        };

        const commit = () => {
            const code = bufferRef.current.trim();
            bufferRef.current = '';
            clearFlush();
            if (code.length >= minLength) onScanRef.current?.(code);
        };

        const isTypingTarget = (el) => {
            if (!el) return false;
            const tag = el.tagName;
            return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
        };

        const handleKeyDown = (e) => {
            // O campo focado cuida da propria leitura.
            if (isTypingTarget(document.activeElement)) return;
            if (e.ctrlKey || e.altKey || e.metaKey) return;

            const now = Date.now();
            const gap = now - lastKeyRef.current;
            lastKeyRef.current = now;

            // Pausa longa = comeco de uma leitura nova, joga fora o que sobrou.
            if (gap > maxKeyDelay) bufferRef.current = '';

            if (e.key === 'Enter' || e.key === 'Tab') {
                if (bufferRef.current.length >= minLength) {
                    e.preventDefault();
                    commit();
                }
                return;
            }

            // Só caractere imprimivel entra no buffer (ignora Shift, F5, setas...).
            if (e.key.length !== 1) return;

            bufferRef.current += e.key;

            // Leitor sem sufixo de Enter: se as teclas pararem, fecha sozinho.
            clearFlush();
            flushTimerRef.current = setTimeout(() => {
                if (bufferRef.current.length >= minLength) commit();
                else bufferRef.current = '';
            }, maxKeyDelay * 4);
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            clearFlush();
        };
    }, [enabled, maxKeyDelay, minLength]);
}
