import React, { useEffect, useMemo, useState } from 'react';
import { X, Loader2, Percent, Check } from 'lucide-react';
import { Button } from '../atoms/Button';
import { Input } from '../atoms/Input';
import { Select } from '../atoms/Select';
import { cn, formatCurrency, formatDate } from '../../lib/utils';
import { resolveCost } from '../../lib/costRule';
import { listAwaitingCostEntries, confirmStockEntriesCost } from '../../services/mercadinhoService';

/**
 * Confirma o custo de todas as entradas pendentes de uma vez.
 *
 * O caso comum: chegou a mercadoria da semana, o funcionário deu entrada sem
 * valor, e o dono sabe que "tudo saiu uns 30% abaixo do que eu vendo". Um
 * percentual geral resolve a maioria das linhas; as exceções — aquele produto
 * que veio mais caro, o que tem nota com valor certo — ganham regra própria na
 * própria linha, sem precisar sair do lote.
 *
 * Linha sem preço de venda não tem de onde calcular percentual. Ela começa
 * como "pular" e só entra se receber um valor em reais.
 */
export function BulkCostModal({ onClose, onDone }) {
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const [percentGeral, setPercentGeral] = useState('30');
    // Exceções por entrada: { mode: 'padrao' | 'percent' | 'valor' | 'pular', amount }
    const [regras, setRegras] = useState({});

    useEffect(() => {
        listAwaitingCostEntries()
            .then(setEntries)
            .catch((err) => {
                console.error(err);
                setError('Não consegui carregar as entradas pendentes.');
            })
            .finally(() => setLoading(false));
    }, []);

    const vendaDe = (e) => Number(e.products?.sale_price) || 0;

    const regraDe = (e) => regras[e.id]
        ?? { mode: vendaDe(e) > 0 ? 'padrao' : 'pular', amount: '' };

    const setRegra = (id, patch) => setRegras((prev) => {
        const atual = prev[id] ?? regraDe(entries.find((e) => e.id === id));
        return { ...prev, [id]: { ...atual, ...patch } };
    });

    /** Custo que cada linha vai receber, ou null se ela fica de fora. */
    const linhas = useMemo(() => entries.map((e) => {
        const regra = regraDe(e);
        let custo = null;

        if (regra.mode === 'padrao') {
            custo = resolveCost({ mode: 'percent', amount: percentGeral }, vendaDe(e));
        } else if (regra.mode === 'percent' || regra.mode === 'valor') {
            custo = resolveCost({ mode: regra.mode, amount: regra.amount }, vendaDe(e));
        }

        return { entry: e, regra, custo };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }), [entries, regras, percentGeral]);

    const validas = linhas.filter((l) => l.custo !== null && !Number.isNaN(l.custo));
    const invalidas = linhas.filter((l) => l.regra.mode !== 'pular' && (l.custo === null || Number.isNaN(l.custo)));
    const totalCompra = validas.reduce((s, l) => s + l.custo * Number(l.entry.quantity), 0);

    const confirmar = async () => {
        setError('');
        if (validas.length === 0) return;

        setSaving(true);
        try {
            await confirmStockEntriesCost(validas.map((l) => ({
                entryId: l.entry.id,
                unitCost: l.custo,
            })));
            onDone?.(validas.length);
        } catch (err) {
            console.error(err);
            setError(err?.message ?? 'Não consegui confirmar.');
            setSaving(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={saving ? undefined : onClose}>
            <div
                className="modal-content bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[88vh] flex flex-col"
                onClick={(ev) => ev.stopPropagation()}
            >
                <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-gray-100">
                    <div>
                        <h3 className="font-bold text-gray-900 text-lg">Confirmar custos em lote</h3>
                        <p className="text-sm text-gray-500 mt-0.5">
                            Um percentual para todas, e regra própria só onde for diferente.
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={saving}
                        className="h-9 w-9 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Regra geral */}
                <div className="px-6 py-4 bg-[#7E1A8B]/[0.04] border-b border-[#7E1A8B]/10 flex items-center gap-4">
                    <div className="h-10 w-10 rounded-xl bg-[#7E1A8B]/10 flex items-center justify-center shrink-0">
                        <Percent className="h-5 w-5 text-[#7E1A8B]" />
                    </div>
                    <p className="text-sm text-gray-700">
                        Tudo foi comprado
                    </p>
                    <div className="relative w-28">
                        <Input
                            value={percentGeral}
                            onChange={(e) => setPercentGeral(e.target.value)}
                            inputMode="decimal"
                            className="pr-8 text-center font-bold text-lg"
                            autoFocus
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">%</span>
                    </div>
                    <p className="text-sm text-gray-700">
                        abaixo do preço de venda
                    </p>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="p-16 flex justify-center text-gray-400">
                            <Loader2 className="h-6 w-6 animate-spin" />
                        </div>
                    ) : entries.length === 0 ? (
                        <div className="p-16 text-center">
                            <p className="font-semibold text-gray-500">Nenhuma entrada esperando custo.</p>
                        </div>
                    ) : (
                        <table className="w-full">
                            <thead className="sticky top-0 bg-gray-50/95 backdrop-blur z-10">
                                <tr className="text-[11px] uppercase tracking-wide text-gray-500">
                                    <th className="text-left font-bold px-6 py-2.5">Produto</th>
                                    <th className="text-right font-bold px-3 py-2.5 w-24">Venda</th>
                                    <th className="text-left font-bold px-3 py-2.5 w-64">Regra</th>
                                    <th className="text-right font-bold px-3 py-2.5 w-24">Custo un.</th>
                                    <th className="text-right font-bold px-6 py-2.5 w-28">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {linhas.map(({ entry: e, regra, custo }) => {
                                    const venda = vendaDe(e);
                                    const pulada = regra.mode === 'pular';
                                    const ruim = !pulada && (custo === null || Number.isNaN(custo));

                                    return (
                                        <tr
                                            key={e.id}
                                            className={cn(
                                                "border-b border-gray-50 last:border-0",
                                                pulada && "opacity-50",
                                                regra.mode !== 'padrao' && !pulada && "bg-amber-50/40"
                                            )}
                                        >
                                            <td className="px-6 py-2.5">
                                                <p className="text-sm font-semibold text-gray-900">{e.product_name}</p>
                                                <p className="text-xs text-gray-400">
                                                    {Number(e.quantity)} {e.products?.unit ?? 'un'} · {formatDate(`${e.entry_date}T00:00:00`)}
                                                </p>
                                            </td>
                                            <td className="px-3 py-2.5 text-right text-sm text-gray-600">
                                                {venda > 0 ? formatCurrency(venda) : <span className="text-gray-300">—</span>}
                                            </td>
                                            <td className="px-3 py-2.5">
                                                <div className="flex items-center gap-1.5">
                                                  <div className="flex-1 min-w-0">
                                                    <Select
                                                        value={regra.mode}
                                                        onChange={(ev) => setRegra(e.id, { mode: ev.target.value, amount: '' })}
                                                        className="h-9 text-xs"
                                                    >
                                                        <option value="padrao" disabled={!(venda > 0)}>
                                                            {percentGeral || '—'}% (geral)
                                                        </option>
                                                        <option value="percent" disabled={!(venda > 0)}>Outro %</option>
                                                        <option value="valor">Valor em R$</option>
                                                        <option value="pular">Pular</option>
                                                    </Select>
                                                  </div>
                                                    {(regra.mode === 'percent' || regra.mode === 'valor') && (
                                                        <Input
                                                            value={regra.amount}
                                                            onChange={(ev) => setRegra(e.id, { amount: ev.target.value })}
                                                            inputMode="decimal"
                                                            placeholder={regra.mode === 'valor' ? 'R$' : '%'}
                                                            className={cn("h-9 w-20 text-xs text-center", ruim && regra.amount !== '' && "border-red-300")}
                                                        />
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-3 py-2.5 text-right text-sm text-gray-700">
                                                {custo !== null && !Number.isNaN(custo) ? formatCurrency(custo) : '—'}
                                            </td>
                                            <td className="px-6 py-2.5 text-right text-sm font-bold text-gray-900">
                                                {custo !== null && !Number.isNaN(custo)
                                                    ? formatCurrency(custo * Number(e.quantity))
                                                    : '—'}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                <div className="px-6 py-4 border-t border-gray-100 space-y-3">
                    {error && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm font-medium border border-red-100">
                            {error}
                        </div>
                    )}
                    {invalidas.length > 0 && (
                        <p className="text-xs text-amber-700">
                            {invalidas.length} {invalidas.length === 1 ? 'linha está' : 'linhas estão'} sem
                            valor válido e {invalidas.length === 1 ? 'fica' : 'ficam'} de fora deste lote.
                        </p>
                    )}
                    <div className="flex items-center justify-between gap-4">
                        <div className="text-sm text-gray-500">
                            {validas.length} de {entries.length} {entries.length === 1 ? 'entrada' : 'entradas'} ·
                            total da compra <strong className="text-gray-900">{formatCurrency(totalCompra)}</strong>
                        </div>
                        <div className="flex gap-3">
                            <Button variant="outline" onClick={onClose} disabled={saving}>
                                Cancelar
                            </Button>
                            <Button variant="success" onClick={confirmar} disabled={saving || validas.length === 0}>
                                {saving
                                    ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    : <Check className="h-4 w-4 mr-2" />}
                                Confirmar {validas.length}
                            </Button>
                        </div>
                    </div>
                    <p className="text-xs text-gray-400">
                        Cada valor também passa a ser o custo do produto — a não ser que ele já tenha
                        uma compra mais nova com valor confirmado.
                    </p>
                </div>
            </div>
        </div>
    );
}
