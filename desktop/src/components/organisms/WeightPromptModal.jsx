import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Scale, X } from 'lucide-react';
import { Button } from '../atoms/Button';
import { Input } from '../atoms/Input';
import { cn, formatCurrency } from '../../lib/utils';

/**
 * Pergunta a quantidade de um produto vendido por peso.
 *
 * Aparece ao bipar queijo, frios, granel — qualquer coisa em kg, g, l ou ml.
 * Antes esses entravam como "1 unidade", o que cobrava 1 kg de quem levou
 * 300 g. Foi o defeito que motivou esta tela.
 *
 * O total aparece enquanto se digita, porque é ele que o operador confere com
 * a balança antes de confirmar — não a quantidade.
 */

/** Atalhos que cobrem quase toda venda de balcão. */
const RAPIDOS = [0.1, 0.25, 0.5, 1, 1.5, 2];

export function WeightPromptModal({ product, onConfirm, onCancel }) {
    const [texto, setTexto] = useState('');
    const inputRef = useRef(null);

    // Só o foco: o campo já nasce vazio porque o pai monta este componente do
    // zero a cada produto (ver a `key` no SalePage). Zerar o texto aqui dentro
    // seria mexer em estado durante o efeito, e o React reclama com razão —
    // é um render a mais em cada abertura.
    useEffect(() => {
        // Imediato: o operador acabou de bipar e a mão já está no teclado.
        const t = setTimeout(() => inputRef.current?.focus(), 40);
        return () => clearTimeout(t);
    }, []);

    // Vírgula é o que se digita no Brasil, e o teclado numérico do balcão manda
    // vírgula na tecla decimal.
    const quantidade = useMemo(() => {
        const n = Number(String(texto).replace(',', '.'));
        return Number.isFinite(n) && n > 0 ? n : 0;
    }, [texto]);

    if (!product) return null;

    const precoUnitario = Number(product.sale_price) || 0;
    const total = quantidade * precoUnitario;
    const unidade = product.unit || 'kg';

    const confirmar = () => {
        if (quantidade <= 0) return;
        onConfirm(product, quantidade);
    };

    return (
        <div className="modal-overlay" onClick={onCancel}>
            <div
                className="modal-content bg-white rounded-2xl shadow-2xl w-full max-w-md"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="h-10 w-10 rounded-xl bg-[#7E1A8B]/10 flex items-center justify-center shrink-0">
                            <Scale className="h-5 w-5 text-[#7E1A8B]" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="font-bold text-gray-900 truncate">{product.name}</h3>
                            <p className="text-xs text-gray-500">
                                {formatCurrency(precoUnitario)} por {unidade}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onCancel}
                        className="h-9 w-9 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 shrink-0"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <form
                    className="p-6 space-y-5"
                    onSubmit={(e) => { e.preventDefault(); confirmar(); }}
                >
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-700">
                            Quanto em {unidade}?
                        </label>
                        <Input
                            ref={inputRef}
                            value={texto}
                            onChange={(e) => setTexto(e.target.value)}
                            // `inputMode` numérico faz o teclado do balcão abrir
                            // já nos números; `text` porque `number` recusa a
                            // vírgula que se digita aqui.
                            inputMode="decimal"
                            placeholder={unidade === 'kg' ? 'Ex.: 0,350' : 'Ex.: 1,5'}
                            className="text-2xl font-extrabold h-16 text-center"
                        />
                    </div>

                    <div className="grid grid-cols-6 gap-1.5">
                        {RAPIDOS.map((v) => (
                            <button
                                key={v}
                                type="button"
                                onClick={() => setTexto(String(v).replace('.', ','))}
                                className="py-2 rounded-lg border border-gray-200 text-xs font-bold text-gray-600 hover:border-[#7E1A8B] hover:text-[#7E1A8B] transition-colors"
                            >
                                {String(v).replace('.', ',')}
                            </button>
                        ))}
                    </div>

                    {/* O número que o operador confere de verdade. */}
                    <div className={cn(
                        "rounded-xl p-4 flex items-baseline justify-between transition-colors",
                        quantidade > 0 ? "bg-emerald-50" : "bg-gray-50"
                    )}>
                        <span className="text-sm font-semibold text-gray-600">
                            {quantidade > 0
                                ? `${formatQuantityLocal(quantidade, unidade)} × ${formatCurrency(precoUnitario)}`
                                : 'Total'}
                        </span>
                        <span className={cn(
                            "text-3xl font-extrabold",
                            quantidade > 0 ? "text-emerald-700" : "text-gray-300"
                        )}>
                            {formatCurrency(total)}
                        </span>
                    </div>

                    <div className="flex gap-3">
                        <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            variant="success"
                            className="flex-[2]"
                            disabled={quantidade <= 0}
                        >
                            Adicionar
                        </Button>
                    </div>

                    <p className="text-center text-xs text-gray-400">
                        Enter confirma. Se a balança imprime etiqueta, é só bipar ela —
                        o peso vem junto.
                    </p>
                </form>
            </div>
        </div>
    );
}

const formatQuantityLocal = (n, unidade) =>
    `${n.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} ${unidade}`;
