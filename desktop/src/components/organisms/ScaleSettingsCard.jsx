import React, { useEffect, useMemo, useState } from 'react';
import { Scale, Check, AlertTriangle, ScanBarcode } from 'lucide-react';
import { Button } from '../atoms/Button';
import { Input } from '../atoms/Input';
import { Select } from '../atoms/Select';
import { cn, formatCurrency } from '../../lib/utils';
import {
    MODOS, DEFAULTS, decodificar, gerarExemplo, ean13Valido,
    getScaleConfig, saveScaleConfig,
} from '../../lib/scaleLabel';

/**
 * Configuração da etiqueta de balança, com teste ao vivo.
 *
 * O testador não é conforto: é a única forma honesta de acertar isso. A mesma
 * etiqueta lida com a configuração errada dá um número plausível e errado —
 * `2000123010991` vale R$ 10,99 num modo e 1,099 kg no outro, e os dois parecem
 * razoáveis na tela. Só comparando com o que está impresso no papel dá para
 * saber qual é.
 *
 * Por isso a tela pede uma etiqueta de verdade e mostra as duas leituras lado a
 * lado, em vez de perguntar "sua balança usa preço ou peso?" — pergunta que
 * quase ninguém sabe responder de cabeça.
 */
export function ScaleSettingsCard() {
    const [config, setConfig] = useState(null);
    const [saved, setSaved] = useState(false);
    const [teste, setTeste] = useState('');

    useEffect(() => { getScaleConfig().then(setConfig); }, []);

    const set = (key, value) => {
        setConfig((prev) => ({ ...prev, [key]: value }));
        setSaved(false);
    };

    /** Como a etiqueta digitada seria lida em cada um dos dois modos. */
    const leituras = useMemo(() => {
        const codigo = teste.trim();
        if (!/^\d{13}$/.test(codigo)) return null;
        if (!ean13Valido(codigo)) return { invalido: true };

        const base = { ...(config ?? DEFAULTS), ativo: true };
        return {
            preco: decodificar(codigo, { ...base, modo: 'preco' }),
            peso: decodificar(codigo, { ...base, modo: 'peso' }),
        };
    }, [teste, config]);

    const exemplo = useMemo(
        () => (config ? gerarExemplo({ codigoProduto: 45, valor: 1099, config }) : null),
        [config],
    );

    if (!config) return null;

    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
            <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-[#7E1A8B]/10 flex items-center justify-center">
                    <Scale className="h-5 w-5 text-[#7E1A8B]" />
                </div>
                <div>
                    <h2 className="font-bold text-gray-900">Etiqueta de balança</h2>
                    <p className="text-xs text-gray-500">
                        Como ler o código que a balança imprime ao pesar
                    </p>
                </div>
            </div>

            <label className="flex items-start gap-3 cursor-pointer">
                <input
                    type="checkbox"
                    checked={Boolean(config.ativo)}
                    onChange={(e) => set('ativo', e.target.checked)}
                    className="h-5 w-5 mt-0.5 rounded border-gray-300 accent-[#7E1A8B] shrink-0"
                />
                <div>
                    <p className="font-semibold text-gray-900">Ler etiqueta de balança</p>
                    <p className="text-sm text-gray-500">
                        Desligado, um código começando com {config.prefixo} é procurado no
                        cadastro como qualquer outro produto.
                    </p>
                </div>
            </label>

            {config.ativo && (
                <>
                    <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700">Começa com</label>
                            <Select value={config.prefixo} onChange={(e) => set('prefixo', e.target.value)}>
                                {['2', '20', '21', '22'].map((p) => (
                                    <option key={p} value={p}>{p}</option>
                                ))}
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700">
                                Dígitos do código
                            </label>
                            <Select
                                value={String(config.digitosCodigo)}
                                onChange={(e) => set('digitosCodigo', Number(e.target.value))}
                            >
                                {[4, 5, 6].map((d) => (
                                    <option key={d} value={d}>{d}</option>
                                ))}
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700">
                                O que vem embutido
                            </label>
                            <Select value={config.modo} onChange={(e) => set('modo', e.target.value)}>
                                {Object.entries(MODOS).map(([k, m]) => (
                                    <option key={k} value={k}>{m.label}</option>
                                ))}
                            </Select>
                        </div>
                    </div>

                    <p className="text-xs text-gray-400">
                        {MODOS[config.modo]?.hint}. Com esta configuração, uma etiqueta sai
                        parecida com <code className="bg-gray-100 px-1.5 py-0.5 rounded font-mono">
                            {exemplo ?? '—'}
                        </code>
                    </p>

                    {/* O testador */}
                    <div className="rounded-xl border-2 border-dashed border-gray-200 p-5 space-y-4">
                        <div className="flex items-center gap-2">
                            <ScanBarcode className="h-4 w-4 text-gray-400" />
                            <h3 className="font-bold text-gray-900 text-sm">
                                Descobrir a configuração certa
                            </h3>
                        </div>
                        <p className="text-sm text-gray-500">
                            Pese qualquer coisa, bipe a etiqueta aqui (ou digite os 13 dígitos)
                            e veja as duas leituras. A que bater com o valor impresso no papel
                            é a configuração da sua balança.
                        </p>

                        <Input
                            value={teste}
                            onChange={(e) => setTeste(e.target.value.replace(/\D/g, '').slice(0, 13))}
                            placeholder="Bipe a etiqueta aqui"
                            className="font-mono text-lg h-12"
                            autoComplete="off"
                        />

                        {teste.length > 0 && teste.length < 13 && (
                            <p className="text-xs text-gray-400">
                                {13 - teste.length} dígito{13 - teste.length > 1 ? 's' : ''} faltando
                            </p>
                        )}

                        {leituras?.invalido && (
                            <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-xl text-sm flex gap-2">
                                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                                <span>
                                    Esse código não fecha a conta de verificação do EAN-13.
                                    Confira se digitou certo — ou bipe direto com o leitor.
                                </span>
                            </div>
                        )}

                        {leituras && !leituras.invalido && (
                            <div className="grid grid-cols-2 gap-3">
                                {['preco', 'peso'].map((modo) => {
                                    const r = leituras[modo];
                                    const escolhido = config.modo === modo;

                                    return (
                                        <button
                                            key={modo}
                                            type="button"
                                            onClick={() => set('modo', modo)}
                                            className={cn(
                                                "text-left rounded-xl border-2 p-4 transition-all",
                                                escolhido
                                                    ? "border-[#7E1A8B] bg-[#7E1A8B]/[0.04]"
                                                    : "border-gray-200 hover:border-gray-300"
                                            )}
                                        >
                                            <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">
                                                {MODOS[modo].label}
                                            </p>

                                            {r?.erro ? (
                                                <p className="text-sm text-red-600 mt-2">{r.erro}</p>
                                            ) : (
                                                <>
                                                    <p className="text-2xl font-extrabold text-gray-900 mt-1">
                                                        {modo === 'preco'
                                                            ? formatCurrency(r?.precoTotal ?? 0)
                                                            : `${(r?.peso ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} kg`}
                                                    </p>
                                                    <p className="text-xs text-gray-500 mt-1">
                                                        produto nº {r?.codigoProduto ?? '—'}
                                                    </p>
                                                </>
                                            )}

                                            {escolhido && (
                                                <p className="mt-2 text-[11px] font-bold text-[#7E1A8B] flex items-center gap-1">
                                                    <Check className="h-3 w-3" /> em uso
                                                </p>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {leituras && !leituras.invalido && (
                            <p className="text-xs text-gray-400">
                                O número do produto tem que ser o mesmo que está cadastrado na
                                balança. Se vier estranho, ajuste os <strong>dígitos do
                                código</strong> acima e olhe de novo.
                            </p>
                        )}
                    </div>
                </>
            )}

            <div className="flex items-center justify-between gap-3 pt-1">
                <span className="text-sm">
                    {saved
                        ? <span className="text-emerald-700 font-semibold flex items-center gap-1.5">
                            <Check className="h-4 w-4" /> Salvo
                        </span>
                        : <span className="text-gray-400">Alterações não salvas</span>}
                </span>
                <Button
                    variant="brand"
                    onClick={async () => { await saveScaleConfig(config); setSaved(true); }}
                >
                    Salvar
                </Button>
            </div>
        </div>
    );
}
