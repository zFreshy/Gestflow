import React, { useState } from 'react';
import { CirclePlus, X } from 'lucide-react';
import { Button } from '../atoms/Button';
import { Input } from '../atoms/Input';
import { formatCurrency } from '../../lib/utils';

/**
 * Valor que entra na venda sem ser produto: taxa de entrega, sacola, um item
 * que ainda não foi cadastrado e não dá para parar a fila por causa dele.
 *
 * Vira uma linha do carrinho sem `product_id`. O banco já sabe gravar isso — é
 * o mesmo caminho do produto que foi excluído depois de vendido —, e como não
 * há produto, o estoque não se mexe.
 *
 * `initial` preenche o formulário para editar uma linha que já está no carrinho.
 */
export function ExtraValueModal({ initial = null, onConfirm, onCancel }) {
    const [valor, setValor] = useState(initial ? String(initial.amount).replace('.', ',') : '');
    const [descricao, setDescricao] = useState(initial?.description ?? '');

    const numero = Number(String(valor).trim().replace(',', '.'));
    const valido = valor.trim() !== '' && Number.isFinite(numero) && numero > 0;

    const confirmar = (e) => {
        e?.preventDefault();
        if (!valido) return;
        onConfirm({
            amount: Math.round(numero * 100) / 100,
            description: descricao.trim(),
        });
    };

    return (
        <div className="modal-overlay" onClick={onCancel}>
            <form
                onSubmit={confirmar}
                className="modal-content bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5"
                onClick={(ev) => ev.stopPropagation()}
            >
                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-[#7E1A8B]/10 flex items-center justify-center">
                            <CirclePlus className="h-5 w-5 text-[#7E1A8B]" />
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-900">
                                {initial ? 'Editar valor avulso' : 'Valor avulso'}
                            </h3>
                            <p className="text-xs text-gray-500">
                                Soma na venda sem ser um produto do cadastro
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onCancel}
                        className="h-8 w-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700">Valor *</label>
                    <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-gray-400 pointer-events-none">
                            R$
                        </span>
                        <Input
                            value={valor}
                            onChange={(e) => setValor(e.target.value)}
                            inputMode="decimal"
                            placeholder="0,00"
                            className="h-14 pl-12 text-2xl font-extrabold"
                            autoFocus
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700">Descrição</label>
                    <Input
                        value={descricao}
                        onChange={(e) => setDescricao(e.target.value)}
                        placeholder="Opcional — ex.: taxa de entrega"
                        maxLength={80}
                    />
                    <p className="text-xs text-gray-400">
                        Aparece no cupom e no histórico. Em branco, fica “Valor avulso”.
                    </p>
                </div>

                <div className="flex gap-3">
                    <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
                        Cancelar
                    </Button>
                    <Button type="submit" variant="brand" className="flex-[2]" disabled={!valido}>
                        {valido
                            ? `${initial ? 'Salvar' : 'Adicionar'} ${formatCurrency(numero)}`
                            : 'Adicionar'}
                    </Button>
                </div>
            </form>
        </div>
    );
}
