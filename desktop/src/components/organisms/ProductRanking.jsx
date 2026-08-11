import React, { useMemo, useState } from 'react';
import { Trophy, Package } from 'lucide-react';
import { cn, formatCurrency } from '../../lib/utils';

/**
 * Ranking de produtos, com duas leituras.
 *
 * As duas existem porque não são a mesma lista, e confundi-las custa dinheiro:
 * o campeão de quantidade numa padaria é o pão, de margem apertada; quem paga
 * as contas costuma ser outro item, vendido bem menos. Ver só "mais vendidos"
 * leva a proteger o produto errado numa negociação com fornecedor.
 */
const MODES = {
    revenue:  { label: 'Faturamento', pick: (p) => p.revenue,  format: formatCurrency },
    profit:   { label: 'Lucro',       pick: (p) => p.profit,   format: formatCurrency },
    quantity: { label: 'Quantidade',  pick: (p) => p.quantity, format: (v) => `${Number(v).toLocaleString('pt-BR')} un` },
};

export function ProductRanking({ products }) {
    const [mode, setMode] = useState('revenue');
    const config = MODES[mode];

    const ranked = useMemo(() => {
        const sorted = [...products].sort((a, b) => config.pick(b) - config.pick(a));
        const top = sorted[0] ? config.pick(sorted[0]) : 0;
        return sorted.map((p) => ({
            ...p,
            // Barra proporcional ao líder: é o que deixa ver de relance se o
            // primeiro lugar dispara ou se está todo mundo empatado.
            share: top > 0 ? (config.pick(p) / top) * 100 : 0,
        }));
    }, [products, mode, config]);

    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 h-full flex flex-col">
            <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <Trophy className="h-4 w-4 text-amber-500" />
                        <h2 className="font-bold text-gray-900">Campeões</h2>
                    </div>
                    <p className="text-sm text-gray-400">Produtos que mais rendem</p>
                </div>

                <div className="flex rounded-lg bg-gray-100 p-0.5 shrink-0">
                    {Object.entries(MODES).map(([key, m]) => (
                        <button
                            key={key}
                            onClick={() => setMode(key)}
                            className={cn(
                                "px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors",
                                mode === key
                                    ? "bg-white text-[#7E1A8B] shadow-sm"
                                    : "text-gray-500 hover:text-gray-700"
                            )}
                        >
                            {m.label}
                        </button>
                    ))}
                </div>
            </div>

            {ranked.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center py-10">
                    <Package className="h-10 w-10 text-gray-200 mb-3" />
                    <p className="text-sm font-medium text-gray-400">Nenhuma venda no período</p>
                </div>
            ) : (
                <div className="space-y-2.5">
                    {ranked.map((p, idx) => (
                        <div key={p.name} className="relative">
                            {/* Barra de fundo: o número já está escrito, então
                                ela fica clara para não brigar com o texto. */}
                            <div
                                className="absolute inset-y-0 left-0 rounded-lg bg-[#7E1A8B]/[0.07] transition-all duration-500"
                                style={{ width: `${p.share}%` }}
                            />

                            <div className="relative flex items-center gap-3 px-2 py-2">
                                <span className={cn(
                                    "h-6 w-6 rounded-md flex items-center justify-center text-[11px] font-extrabold shrink-0",
                                    idx === 0 ? "bg-amber-100 text-amber-700"
                                        : idx === 1 ? "bg-gray-200 text-gray-600"
                                            : idx === 2 ? "bg-orange-100 text-orange-700"
                                                : "bg-gray-50 text-gray-400"
                                )}>
                                    {idx + 1}
                                </span>

                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-semibold text-gray-900 truncate">
                                        {p.name}
                                    </p>
                                    {/* O contraponto da métrica escolhida: quem
                                        olha faturamento quer saber o lucro. */}
                                    <p className="text-[11px] text-gray-400">
                                        {mode === 'quantity'
                                            ? formatCurrency(p.revenue)
                                            : `${Number(p.quantity).toLocaleString('pt-BR')} un`}
                                        {mode !== 'profit' && p.profit > 0 && (
                                            <span className="text-emerald-600 font-semibold">
                                                {' · '}{formatCurrency(p.profit)} de lucro
                                            </span>
                                        )}
                                    </p>
                                </div>

                                <span className="text-sm font-extrabold text-gray-900 shrink-0">
                                    {config.format(config.pick(p))}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
