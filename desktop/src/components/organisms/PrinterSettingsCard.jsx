import React, { useEffect, useState } from 'react';
import { Printer, Loader2, Check, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '../atoms/Button';
import { Select } from '../atoms/Select';
import { Input } from '../atoms/Input';
import { cn } from '../../lib/utils';
import {
    getPrinterConfig, savePrinterConfig, listPrinters, printTestPage,
} from '../../lib/thermalPrinter';
import { isTauri } from '../../lib/authStorage';

/**
 * Configuração da impressora de cupom.
 *
 * Existe porque "imprimir" tem dois modos muito diferentes na prática: com uma
 * térmica escolhida aqui, o cupom sai sozinho no fim da venda; sem nada
 * escolhido, abre o diálogo do Windows e alguém precisa clicar. O segundo é o
 * padrão de propósito — funciona no primeiro dia, em qualquer impressora,
 * antes de configurar coisa nenhuma.
 *
 * O botão de teste não é enfeite: é o único jeito de descobrir se a largura e
 * os acentos estão certos sem ter que fazer uma venda de verdade para
 * descobrir no papel, com o cliente na frente.
 */
export function PrinterSettingsCard() {
    const [config, setConfig] = useState(null);
    const [printers, setPrinters] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saved, setSaved] = useState(false);
    const [testing, setTesting] = useState(false);
    const [message, setMessage] = useState(null);

    const loadPrinters = async () => {
        try {
            setPrinters(await listPrinters());
        } catch (err) {
            console.error(err);
            setPrinters([]);
        }
    };

    useEffect(() => {
        Promise.all([getPrinterConfig(), loadPrinters()])
            .then(([saved]) => setConfig(saved))
            .finally(() => setLoading(false));
    }, []);

    const set = (key, value) => {
        setConfig((prev) => ({ ...prev, [key]: value }));
        setSaved(false);
        setMessage(null);
    };

    const handleSave = async () => {
        await savePrinterConfig(config);
        setSaved(true);
    };

    const handleTest = async () => {
        setTesting(true);
        setMessage(null);
        try {
            // Salva antes: testar uma configuração diferente da que está
            // gravada faria o teste passar e a venda sair errada.
            await savePrinterConfig(config);
            setSaved(true);
            await printTestPage(config);
            setMessage({ ok: true, text: 'Cupom de teste enviado. Confira o papel.' });
        } catch (err) {
            console.error(err);
            setMessage({
                ok: false,
                text: String(err?.message ?? err ?? 'Não consegui imprimir.'),
            });
        } finally {
            setTesting(false);
        }
    };

    if (loading || !config) {
        return (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-gray-300" />
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
            <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-[#7E1A8B]/10 flex items-center justify-center">
                    <Printer className="h-5 w-5 text-[#7E1A8B]" />
                </div>
                <div>
                    <h2 className="font-bold text-gray-900">Impressora do cupom</h2>
                    <p className="text-xs text-gray-500">
                        Bobina térmica de 80mm ou 58mm, ligada nesta máquina
                    </p>
                </div>
            </div>

            {!isTauri() && (
                <div className="bg-gray-50 border border-gray-200 text-gray-600 p-3 rounded-xl text-sm">
                    A impressão direta só funciona no aplicativo instalado. No navegador,
                    o cupom sai pelo diálogo de impressão.
                </div>
            )}

            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold text-gray-700">Impressora</label>
                    <button
                        onClick={loadPrinters}
                        className="flex items-center gap-1.5 text-xs font-semibold text-[#7E1A8B] hover:underline"
                    >
                        <RefreshCw className="h-3 w-3" />
                        Procurar de novo
                    </button>
                </div>

                <Select value={config.printer} onChange={(e) => set('printer', e.target.value)}>
                    <option value="">Usar o diálogo de impressão do Windows</option>
                    {printers.map((p) => (
                        <option key={p.name} value={p.name}>
                            {p.name}{p.is_default ? ' (padrão do Windows)' : ''}
                        </option>
                    ))}
                </Select>

                <p className="text-xs text-gray-400">
                    {config.printer
                        ? 'O cupom sai sozinho ao fechar a venda, sem precisar clicar.'
                        : 'Sem escolher, cada cupom abre a janela de impressão do Windows.'}
                </p>

                {isTauri() && printers.length === 0 && (
                    <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-xl text-sm flex gap-2">
                        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                        <span>
                            Nenhuma impressora encontrada. Instale o driver dela no Windows
                            primeiro — o app enxerga as mesmas impressoras que o Windows.
                        </span>
                    </div>
                )}
            </div>

            {config.printer && (
                <>
                    <div className="grid grid-cols-2 gap-5">
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700">
                                Largura do papel
                            </label>
                            <Select
                                value={String(config.width)}
                                onChange={(e) => set('width', Number(e.target.value))}
                            >
                                <option value="80">80mm (padrão)</option>
                                <option value="58">58mm (bobina estreita)</option>
                            </Select>
                            <p className="text-xs text-gray-400">
                                Errado aqui, o texto quebra na linha errada.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700">
                                Vias por venda
                            </label>
                            <Input
                                type="number" min="1" max="3"
                                value={config.copies}
                                onChange={(e) => set('copies', Number(e.target.value) || 1)}
                            />
                        </div>
                    </div>

                    <div className="space-y-3">
                        <Toggle
                            checked={config.autoCut}
                            onChange={(v) => set('autoCut', v)}
                            title="Cortar o papel automaticamente"
                            hint="Desligue se a impressora não tiver guilhotina — senão sai um comando estranho no fim."
                        />
                        <Toggle
                            checked={config.openDrawer}
                            onChange={(v) => set('openDrawer', v)}
                            title="Abrir a gaveta de dinheiro"
                            hint="Só funciona se a gaveta estiver ligada no cabo da impressora."
                        />
                    </div>
                </>
            )}

            {message && (
                <div className={cn(
                    "p-3 rounded-xl text-sm font-medium border flex gap-2",
                    message.ok
                        ? "bg-emerald-50 border-emerald-100 text-emerald-700"
                        : "bg-red-50 border-red-100 text-red-600"
                )}>
                    {message.ok
                        ? <Check className="h-4 w-4 shrink-0 mt-0.5" />
                        : <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />}
                    <span>{message.text}</span>
                </div>
            )}

            <div className="flex items-center justify-between gap-3 pt-1">
                <span className="text-sm">
                    {saved
                        ? <span className="text-emerald-700 font-semibold flex items-center gap-1.5">
                            <Check className="h-4 w-4" /> Salvo
                        </span>
                        : <span className="text-gray-400">Alterações não salvas</span>}
                </span>

                <div className="flex gap-3">
                    <Button
                        variant="outline"
                        onClick={handleTest}
                        disabled={testing || !config.printer}
                        title={!config.printer ? 'Escolha uma impressora primeiro' : undefined}
                    >
                        {testing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Imprimir teste
                    </Button>
                    <Button variant="brand" onClick={handleSave}>Salvar</Button>
                </div>
            </div>
        </div>
    );
}

function Toggle({ checked, onChange, title, hint }) {
    return (
        <label className="flex items-start gap-3 cursor-pointer">
            <input
                type="checkbox"
                checked={checked}
                onChange={(e) => onChange(e.target.checked)}
                className="h-5 w-5 mt-0.5 rounded border-gray-300 accent-[#7E1A8B] shrink-0"
            />
            <div>
                <p className="text-sm font-semibold text-gray-800">{title}</p>
                <p className="text-xs text-gray-500">{hint}</p>
            </div>
        </label>
    );
}
