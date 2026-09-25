import React from 'react';
import { cn, formatCurrency } from '../../lib/utils';
import { Input } from '../atoms/Input';
import { resolveCost } from '../../lib/costRule';

/**
 * Custo de compra digitado em reais ou como "X% abaixo do preço de venda".
 *
 * O percentual existe porque é assim que muita compra chega: o fornecedor não
 * manda nota por item, e o dono sabe que "o biscoito sai uns 30% mais barato
 * que eu vendo". Pedir o valor em reais nesse caso só obrigaria a fazer a conta
 * de cabeça, com mais chance de errar.
 *
 * O valor fica em `{ mode, amount }` — texto, do jeito que foi digitado — e
 * `resolveCost` transforma em número na hora de gravar.
 */
export function CostField({ value, onChange, salePrice, autoFocus, big = false }) {
    const custo = resolveCost(value, salePrice);
    const semVenda = !(Number(salePrice) > 0);

    const setMode = (mode) => onChange({ ...value, mode, amount: '' });

    return (
        <div className="space-y-2">
            <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-gray-100">
                {[
                    { id: 'valor', label: 'Em reais' },
                    { id: 'percent', label: '% abaixo da venda' },
                ].map((opt) => (
                    <button
                        key={opt.id}
                        type="button"
                        onClick={() => setMode(opt.id)}
                        disabled={opt.id === 'percent' && semVenda}
                        title={opt.id === 'percent' && semVenda
                            ? 'O produto não tem preço de venda para calcular'
                            : undefined}
                        className={cn(
                            "py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-40",
                            value.mode === opt.id
                                ? "bg-white text-[#7E1A8B] shadow-sm"
                                : "text-gray-500 hover:text-gray-700"
                        )}
                    >
                        {opt.label}
                    </button>
                ))}
            </div>

            <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400 pointer-events-none">
                    {value.mode === 'valor' ? 'R$' : '%'}
                </span>
                <Input
                    value={value.amount}
                    onChange={(e) => onChange({ ...value, amount: e.target.value })}
                    inputMode="decimal"
                    placeholder={value.mode === 'valor' ? '0,00' : 'Ex.: 30'}
                    autoFocus={autoFocus}
                    className={cn("pl-10", big && "h-14 text-xl font-bold text-center")}
                />
            </div>

            {/* A conta aparece sempre que existe: quem digitou 30% vê na hora
                que isso deu R$ 7,00, e percebe se era 3% que queria. */}
            {value.mode === 'percent' && value.amount !== '' && (
                <p className="text-xs text-gray-500">
                    {Number.isNaN(custo)
                        ? 'Percentual entre 0 e 100.'
                        : <>
                            Venda {formatCurrency(salePrice)} − {String(value.amount).replace('.', ',')}%
                            {' = '}<strong className="text-gray-800">custo {formatCurrency(custo)}</strong>
                        </>}
                </p>
            )}
        </div>
    );
}
