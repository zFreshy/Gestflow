import React, {
    createContext, useCallback, useContext, useMemo, useRef, useState,
} from 'react';
import QRCode from 'qrcode';
import { ReceiptDocument } from '../components/organisms/ReceiptDocument';
import { getFiscalSettings } from '../services/mercadinhoService';

const ReceiptContext = createContext({});

export const useReceipt = () => useContext(ReceiptContext);

/**
 * Quem imprime o cupom.
 *
 * O documento fica montado uma vez só, aqui na raiz. Qualquer tela pede a
 * impressão pelo `print(...)` e o resto é problema deste arquivo: buscar os
 * dados da loja, gerar o QR Code e só então chamar a impressão.
 *
 * A ordem importa. `window.print()` congela a página no estado em que ela está
 * naquele instante — chamar antes de o QR Code existir imprimiria o cupom com
 * um buraco no lugar dele, e o cliente não conseguiria consultar a nota.
 */
export function ReceiptProvider({ children }) {
    const [data, setData] = useState(null);
    const [qr, setQr] = useState(null);

    // Dados da loja mudam quase nunca: buscar a cada venda seria uma ida ao
    // servidor no pior momento possível, com o cliente esperando o papel.
    const storeCache = useRef(null);

    const print = useCallback(async (receipt) => {
        let store = storeCache.current;
        if (!store) {
            try {
                store = await getFiscalSettings();
                storeCache.current = store;
            } catch (err) {
                // Sem os dados do emitente o cupom sai com o cabeçalho pobre,
                // mas sai. Deixar de imprimir seria pior: o cliente está com a
                // mão estendida esperando o comprovante.
                console.error('Não consegui ler os dados da loja:', err);
                store = null;
            }
        }

        let qrUrl = null;
        if (receipt.invoice?.qrcode) {
            try {
                // `margin: 0` porque o cupom já tem a margem do papel; a quiet
                // zone padrão desperdiçaria uns 6mm de bobina em cada nota.
                qrUrl = await QRCode.toDataURL(receipt.invoice.qrcode, {
                    errorCorrectionLevel: 'M',
                    margin: 0,
                    width: 240,
                });
            } catch (err) {
                console.error('Não consegui gerar o QR Code:', err);
            }
        }

        setData({ ...receipt, store });
        setQr(qrUrl);

        // Dois quadros de espera: um para o React aplicar o estado, outro para
        // o navegador terminar o layout do que acabou de aparecer.
        await new Promise((resolve) => requestAnimationFrame(
            () => requestAnimationFrame(resolve)
        ));

        window.print();
    }, []);

    const value = useMemo(() => ({
        print,
        /** Força reler os dados da loja depois de editar a configuração fiscal. */
        forgetStore: () => { storeCache.current = null; },
    }), [print]);

    return (
        <ReceiptContext.Provider value={value}>
            {children}
            <ReceiptDocument data={data} qr={qr} />
        </ReceiptContext.Provider>
    );
}
