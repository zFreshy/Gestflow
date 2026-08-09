import React, { useEffect, useMemo, useState } from 'react';
import {
    X, Loader2, CheckCircle2, Split, Plus, Trash2,
} from 'lucide-react';
import { Button } from '../atoms/Button';
import { Input } from '../atoms/Input';
import { Select } from '../atoms/Select';
import { cn, formatCurrency } from '../../lib/utils';
import { PAYMENT_METHODS, STORE_CREDIT } from '../../lib/payments';
import { CustomerPicker } from '../molecules/CustomerPicker';
import { createSale } from '../../services/mercadinhoService';

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

export function CheckoutModal({ isOpen, cart, subtotal, onClose, onCompleted }) {
    const [paymentMethod, setPaymentMethod] = useState('Dinheiro');
    const [split, setSplit] = useState(false);
    const [lines, setLines] = useState([]);       // [{ method, amount }] no modo combinado
    const [discount, setDiscount] = useState('');
    const [received, setReceived] = useState(''); // dinheiro na mão, só para o troco
    const [note, setNote] = useState('');
    const [customerId, setCustomerId] = useState(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const discountValue = Math.min(Number(discount) || 0, subtotal);
    const total = round2(Math.max(subtotal - discountValue, 0));

    useEffect(() => {
        if (!isOpen) return;
        setPaymentMethod('Dinheiro');
        setSplit(false);
        setLines([]);
        setDiscount('');
        setReceived('');
        setNote('');
        setCustomerId(null);
        setError('');
    }, [isOpen]);

    // ------------------------------------------------------------------
    // Pagamento combinado
    // ------------------------------------------------------------------

    const paid = useMemo(
        () => round2(lines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0)),
        [lines]
    );

    const missing = round2(total - paid);

    const enableSplit = () => {
        // Começa com o que já estava escolhido cobrindo a venda toda: quem vai
        // dividir só precisa baixar esse valor e somar a segunda forma.
        setLines([{ method: paymentMethod, amount: String(total) }]);
        setSplit(true);
    };

    const disableSplit = () => {
        setSplit(false);
        setLines([]);
    };

    const addLine = () => {
        // Já entra com o que falta, que é quase sempre o valor certo.
        const rest = round2(total - paid);
        const used = new Set(lines.map((l) => l.method));
        const next = PAYMENT_METHODS.find((m) => !used.has(m.id))?.id ?? 'Dinheiro';
        setLines((prev) => [...prev, { method: next, amount: rest > 0 ? String(rest) : '' }]);
    };

    const updateLine = (idx, patch) =>
        setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));

    const removeLine = (idx) =>
        setLines((prev) => prev.filter((_, i) => i !== idx));

    // ------------------------------------------------------------------
    // Troco: só sobre a parte paga em dinheiro
    // ------------------------------------------------------------------

    const cashApplied = useMemo(() => {
        if (!split) return paymentMethod === 'Dinheiro' ? total : 0;
        return round2(lines
            .filter((l) => l.method === 'Dinheiro')
            .reduce((sum, l) => sum + (Number(l.amount) || 0), 0));
    }, [split, lines, paymentMethod, total]);

    const hasCash = cashApplied > 0;
    const change = round2((Number(received) || 0) - cashApplied);

    // ------------------------------------------------------------------
    // Validação
    // ------------------------------------------------------------------

    const payments = useMemo(() => {
        if (!split) return [{ method: paymentMethod, amount: total }];
        return lines
            .filter((l) => Number(l.amount) > 0)
            .map((l) => ({ method: l.method, amount: round2(l.amount) }));
    }, [split, lines, paymentMethod, total]);

    const usesStoreCredit = payments.some((p) => p.method === STORE_CREDIT);

    const problem = useMemo(() => {
        if (total <= 0) return 'A venda está zerada.';
        if (split) {
            if (payments.length === 0) return 'Informe o valor de cada forma de pagamento.';
            if (Math.abs(missing) > 0.01) {
                return missing > 0
                    ? `Ainda falta ${formatCurrency(missing)}.`
                    : `Passou ${formatCurrency(-missing)} do total.`;
            }
        }
        if (usesStoreCredit && !customerId) return 'Escolha de quem é o fiado antes de fechar.';
        return null;
    }, [split, payments, missing, total, usesStoreCredit, customerId]);

    const handleConfirm = async () => {
        setError('');
        if (problem) { setError(problem); return; }

        setSaving(true);
        try {
            await createSale({
                items: cart,
                payments,
                discount: discountValue,
                note: note.trim() || null,
                customerId,
            });
            onCompleted?.();
        } catch (err) {
            console.error(err);
            setError('Não consegui registrar a venda. Confira a conexão e tente de novo.');
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={saving ? undefined : onClose}>
            <div
                className="modal-content bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-900">Fechar venda</h3>
                            <p className="text-xs text-gray-500">
                                {cart.length} {cart.length === 1 ? 'produto' : 'produtos'} no carrinho
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={saving}
                        className="h-9 w-9 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors disabled:opacity-40"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-5">
                    {error && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm font-medium border border-red-100">
                            {error}
                        </div>
                    )}

                    {/* Forma de pagamento */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-semibold text-gray-700">
                                Forma de pagamento
                            </label>
                            <button
                                type="button"
                                onClick={split ? disableSplit : enableSplit}
                                className="flex items-center gap-1.5 text-xs font-semibold text-[#7E1A8B] hover:underline"
                            >
                                <Split className="h-3.5 w-3.5" />
                                {split ? 'Usar uma forma só' : 'Dividir em mais de uma'}
                            </button>
                        </div>

                        {!split ? (
                            <div className="grid grid-cols-3 gap-2">
                                {PAYMENT_METHODS.map(({ id, label, icon: Icon }) => (
                                    <button
                                        key={id}
                                        onClick={() => setPaymentMethod(id)}
                                        className={cn(
                                            "flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 transition-all",
                                            paymentMethod === id
                                                ? "border-[#7E1A8B] bg-[#7E1A8B]/[0.06] text-[#7E1A8B]"
                                                : "border-gray-100 text-gray-500 hover:border-gray-200 hover:bg-gray-50"
                                        )}
                                    >
                                        <Icon className="h-5 w-5" />
                                        <span className="text-[11px] font-semibold">{label}</span>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {lines.map((line, idx) => (
                                    <div key={idx} className="flex items-center gap-2">
                                        <div className="flex-1">
                                            <Select
                                                value={line.method}
                                                onChange={(e) => updateLine(idx, { method: e.target.value })}
                                            >
                                                {PAYMENT_METHODS.map((m) => (
                                                    <option key={m.id} value={m.id}>{m.label}</option>
                                                ))}
                                            </Select>
                                        </div>
                                        <div className="w-32">
                                            <Input
                                                type="number" step="0.01" min="0"
                                                value={line.amount}
                                                onChange={(e) => updateLine(idx, { amount: e.target.value })}
                                                placeholder="0,00"
                                                className="text-right font-semibold"
                                            />
                                        </div>
                                        <button
                                            onClick={() => removeLine(idx)}
                                            disabled={lines.length === 1}
                                            className="h-10 w-10 shrink-0 rounded-lg flex items-center justify-center text-gray-300 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-300"
                                            title="Remover"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                ))}

                                <div className="flex items-center justify-between pt-1">
                                    <button
                                        type="button"
                                        onClick={addLine}
                                        disabled={lines.length >= PAYMENT_METHODS.length}
                                        className="flex items-center gap-1.5 text-sm font-semibold text-[#7E1A8B] hover:underline disabled:opacity-40 disabled:no-underline"
                                    >
                                        <Plus className="h-4 w-4" />
                                        Adicionar forma
                                    </button>

                                    <span className={cn(
                                        "text-sm font-bold",
                                        Math.abs(missing) <= 0.01 ? "text-emerald-600"
                                            : missing > 0 ? "text-amber-600"
                                                : "text-red-600"
                                    )}>
                                        {Math.abs(missing) <= 0.01
                                            ? 'Fecha certo'
                                            : missing > 0
                                                ? `Falta ${formatCurrency(missing)}`
                                                : `Passou ${formatCurrency(-missing)}`}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Desconto */}
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-700">Desconto (R$)</label>
                        <Input
                            type="number" step="0.01" min="0"
                            value={discount}
                            onChange={(e) => setDiscount(e.target.value)}
                            placeholder="0,00"
                        />
                    </div>

                    {/* Totais */}
                    <div className="rounded-xl bg-gray-50 p-4 space-y-2">
                        <div className="flex justify-between text-sm text-gray-600">
                            <span>Subtotal</span>
                            <span className="font-semibold">{formatCurrency(subtotal)}</span>
                        </div>
                        {discountValue > 0 && (
                            <div className="flex justify-between text-sm text-red-600">
                                <span>Desconto</span>
                                <span className="font-semibold">− {formatCurrency(discountValue)}</span>
                            </div>
                        )}
                        <div className="h-px bg-gray-200" />
                        <div className="flex justify-between items-baseline">
                            <span className="font-bold text-gray-900">Total</span>
                            <span className="text-2xl font-extrabold text-gray-900">{formatCurrency(total)}</span>
                        </div>
                    </div>

                    {/* Troco: só quando entra dinheiro */}
                    {hasCash && (
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700">
                                Recebido em dinheiro
                                {split && (
                                    <span className="ml-1.5 font-normal text-gray-400">
                                        (parte em dinheiro: {formatCurrency(cashApplied)})
                                    </span>
                                )}
                            </label>
                            <Input
                                type="number" step="0.01" min="0"
                                value={received}
                                onChange={(e) => setReceived(e.target.value)}
                                placeholder="0,00"
                            />
                            {received !== '' && (
                                <div className={cn(
                                    "rounded-xl p-3 flex justify-between items-center",
                                    change >= 0
                                        ? "bg-emerald-50 text-emerald-700"
                                        : "bg-amber-50 text-amber-700"
                                )}>
                                    <span className="text-sm font-semibold">
                                        {change >= 0 ? 'Troco' : 'Ainda falta'}
                                    </span>
                                    <span className="text-xl font-extrabold">
                                        {formatCurrency(Math.abs(change))}
                                    </span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Cliente: obrigatório quando parte da venda fica no fiado */}
                    {usesStoreCredit && (
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700">
                                Cliente do fiado *
                            </label>
                            <CustomerPicker value={customerId} onChange={setCustomerId} />
                            <p className="text-xs text-gray-400">
                                O valor fiado entra na conta dele. Para receber depois, use a tela de Fiado.
                            </p>
                        </div>
                    )}

                    {/* Observação */}
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-700">
                            Observação (opcional)
                        </label>
                        <Input
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="Alguma anotação sobre a venda"
                        />
                    </div>
                </div>

                <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
                    <Button variant="outline" className="flex-1" onClick={onClose} disabled={saving}>
                        Voltar
                    </Button>
                    <Button
                        variant="success"
                        className="flex-[2]"
                        onClick={handleConfirm}
                        disabled={saving || Boolean(problem)}
                        title={problem ?? undefined}
                    >
                        {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                        Confirmar {formatCurrency(total)}
                    </Button>
                </div>
            </div>
        </div>
    );
}
