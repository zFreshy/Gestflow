import React, { useEffect, useState } from 'react';
import { Printer, Loader2, Check, AlertTriangle, RefreshCw, FileText } from 'lucide-react';
import { Button } from '../atoms/Button';
import { Select } from '../atoms/Select';
import { Input } from '../atoms/Input';
import { cn } from '../../lib/utils';
import {
    getPrinterConfig, savePrinterConfig, listPrinters, printTestPage,
    printPlainTest, sampleReceipt,
} from '../../lib/thermalPrinter';
import { CODEPAGES } from '../../lib/escpos';
import { isTauri } from '../../lib/authStorage';
import { useReceipt } from '../../contexts/ReceiptContext';

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
    const { print } = useReceipt();
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

    /**
     * Prévia em PDF: mesmo cupom de teste, pelo diálogo do Windows.
     *
     * Serve para conferir o layout sem ter a bobina ligada — no diálogo dá para
     * escolher "Microsoft Print to PDF" e abrir o arquivo. É o único caminho em
     * que aquela impressora funciona, porque aí quem desenha a página é o
     * Windows, e não os comandos ESC/POS.
     */
    const handlePreview = async () => {
        setMessage(null);
        try {
            await print(sampleReceipt(), { forceDialog: true });
        } catch (err) {
            console.error(err);
            setMessage({ ok: false, text: 'Não consegui abrir a prévia.' });
        }
    };

    const runTest = async (fn, sucesso) => {
        setTesting(true);
        setMessage(null);
        try {
            // Salva antes: testar uma configuração diferente da que está
            // gravada faria o teste passar e a venda sair errada.
            await savePrinterConfig(config);
            setSaved(true);
            await fn(config);
            setMessage({ ok: true, text: sucesso });
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

    const handleTest = () => runTest(
        printTestPage,
        'Cupom de teste enviado. Confira o papel.',
    );

    const handlePlainTest = () => runTest(
        printPlainTest,
        'Texto simples enviado. Se sair em branco, o problema não é o cupom.',
    );

    const selected = printers.find((p) => p.name === config?.printer);

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
                            {p.name}
                            {p.virtual ? ' — não serve (gera arquivo)' : ''}
                            {p.is_default ? ' (padrão do Windows)' : ''}
                        </option>
                    ))}
                </Select>

                <p className="text-xs text-gray-400">
                    {config.printer
                        ? 'O cupom sai sozinho ao fechar a venda, sem precisar clicar.'
                        : 'Sem escolher, cada cupom abre a janela de impressão do Windows.'}
                </p>

                {/* Escolher uma virtual aqui é o erro mais fácil de cometer: ela
                    aparece na lista igual às outras e costuma ser a padrão do
                    Windows. O aviso explica o porquê e aponta a saída. */}
                {selected?.virtual && (
                    <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-sm flex gap-2">
                        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                            <p className="font-semibold">
                                Essa não é uma impressora de papel.
                            </p>
                            <p>
                                Ela gera arquivo, e o cupom é enviado em modo bruto para a
                                térmica entender os comandos — o arquivo sairia ilegível.
                                Para gerar um PDF de teste, deixe a opção do diálogo do
                                Windows e use o botão <strong>Ver prévia em PDF</strong>.
                            </p>
                        </div>
                    </div>
                )}

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

            {config.printer && !selected?.virtual && (
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

                        <div className="space-y-2 col-span-2">
                            <label className="text-sm font-semibold text-gray-700">
                                Tabela de acentos
                            </label>
                            <Select
                                value={config.codepage}
                                onChange={(e) => set('codepage', e.target.value)}
                            >
                                {Object.entries(CODEPAGES).map(([key, page]) => (
                                    <option key={key} value={key}>{page.label}</option>
                                ))}
                            </Select>
                            <p className="text-xs text-gray-400">
                                Se sair "P?o" no lugar de "Pão", troque aqui. "Sem acentos"
                                imprime "Pao" e funciona em qualquer impressora.
                            </p>
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

            {/* Sai papel em branco é o defeito mais comum, e quase nunca é o
                app. Fica escrito aqui porque quem está no balcão às 7h da
                manhã não vai abrir manual nenhum. */}
            {config.printer && !selected?.virtual && (
                <details className="rounded-xl border border-gray-100 bg-gray-50/60">
                    <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-gray-700">
                        Está saindo papel em branco?
                    </summary>
                    <div className="px-4 pb-4 text-sm text-gray-600 space-y-2">
                        <p>Clique em <strong>Teste simples</strong> e veja o que acontece:</p>
                        <p>
                            <strong>Saiu texto</strong> — a impressora está certa e o problema é
                            algum comando. Troque a <em>tabela de acentos</em> para CP437, ou
                            desligue o <em>corte automático</em>, e teste de novo.
                        </p>
                        <p>
                            <strong>Saiu em branco de novo</strong> — o problema é antes do app.
                            Confira, nesta ordem:
                        </p>
                        <ol className="list-decimal ml-5 space-y-1">
                            <li>
                                <strong>O lado da bobina.</strong> Papel térmico só marca de um
                                lado. Colocado ao contrário, ele sai limpinho como se nada
                                tivesse sido impresso. Vire o rolo e teste.
                            </li>
                            <li>
                                <strong>A impressora escolhida.</strong> Se houver mais de uma
                                instalada, pode estar imprimindo na errada.
                            </li>
                            <li>
                                <strong>Imprima a página de teste do Windows</strong>, em
                                Dispositivos e Impressoras. Se nem ela sair, o problema é o
                                driver ou o cabo, não o sistema.
                            </li>
                        </ol>
                    </div>
                </details>
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
                    {/* Sempre disponível: é o teste que funciona sem ter a
                        bobina ligada, e o único caminho em que "Print to PDF"
                        gera um arquivo que abre. */}
                    <Button variant="outline" onClick={handlePreview}>
                        <FileText className="h-4 w-4 mr-2" />
                        Ver prévia em PDF
                    </Button>

                    {/* Diagnóstico: texto puro, sem nenhum comando. Separa
                        "a impressora não entendeu um comando" de "os dados nem
                        chegaram nela". */}
                    <Button
                        variant="outline"
                        onClick={handlePlainTest}
                        disabled={testing || !config.printer || selected?.virtual}
                        title="Manda só texto, sem nenhum comando de impressora"
                    >
                        Teste simples
                    </Button>

                    <Button
                        variant="outline"
                        onClick={handleTest}
                        disabled={testing || !config.printer || selected?.virtual}
                        title={
                            !config.printer ? 'Escolha uma impressora primeiro'
                                : selected?.virtual ? 'Essa impressora gera arquivo, não papel'
                                    : undefined
                        }
                    >
                        {testing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Imprimir na bobina
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
