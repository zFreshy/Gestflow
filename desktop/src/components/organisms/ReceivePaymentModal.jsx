import React, { useEffect, useMemo, useState } from 'react';
import { HandCoins, X, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '../atoms/Button';
import { Input } from '../atoms/Input';
import { Select } from '../atoms/Select';
import { cn, formatCurrency, toISODate } from '../../lib/utils';
import { PAYMENT_METHODS, STORE_CREDIT } from '../../lib/payments';
import { createCreditPayment } from '../../services/mercadinhoService';

// Receber fiado pagando com fiado não faz sentido.
const RECEIVE_METHODS = PAYMENT_METHODS.filter((m) => m.id !== STORE_CREDIT);

export function ReceivePaymentModal({ customer, onClose, onSaved }) {
    const [amount, setAmount] = useState('');
    const [method, setMethod] = useState('Dinheiro');
    const [paidAt, setPaidAt] = useState(toISODate());
    const [note, setNote] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const balance = Number(customer?.balance) || 0;

    useEffect(() => {
        if (!customer) return;
        // Quitar tudo é o caso mais comum — já vem preenchido.
        setAmount(String(balance.toFixed(2)));
        setMethod('Dinheiro');
        setPaidAt(toISODate());
        setNote('');
        setError('');
    }, [customer, balance]);

    const value = Number(amount) || 0;
    const remaining = useMemo(() => balance - value, [balance, value]);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!(value > 0)) {
            setError('Informe quanto ele está pagando.');
            return;
        }

        setError('');
        setSaving(true);
        try {
            await createCreditPayment({
                customerId: customer.id,
                amount: value,
                method,
                paidAt,
                note,
            });
            onSaved?.();
            onClose?.();
        } catch (err) {
            console.error(err);
            setError('Não consegui registrar o recebimento.');
        } finally {
            setSaving(false);
        }
    };

    if (!customer) return null;

    return (
        <div className="modal-overlay" onClick={saving ? undefined : onClose}>
            <div
                className="modal-content bg-white rounded-2xl shadow-2xl w-full max-w-md"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                            <HandCoins className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-900">Receber do {customer.name}</h3>
                            <p className="text-xs text-gray-500">
                                Deve {formatCurrency(balance)}
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

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {error && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm font-medium border border-red-100">
                            {error}
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-700">Valor recebido *</label>
                        <Input
                            type="number" step="0.01" min="0"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="0,00"
                            autoFocus
                            className="text-lg font-bold"
                        />
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => setAmount(String(balance.toFixed(2)))}
                                className="text-xs font-semibold text-[#7E1A8B] hover:underline"
                            >
                                Quitar tudo ({formatCurrency(balance)})
                            </button>
                        </div>
                    </div>

                    {/* O que sobra depois deste pagamento */}
                    {value > 0 && (
                        <div className={cn(
                            "rounded-xl p-3 flex justify-between items-center",
                            remaining > 0.005 ? "bg-amber-50 text-amber-700"
                                : Math.abs(remaining) <= 0.005 ? "bg-emerald-50 text-emerald-700"
                                    : "bg-blue-50 text-blue-700"
                        )}>
                            <span className="text-sm font-semibold">
                                {remaining > 0.005 ? 'Ainda vai dever'
                                    : Math.abs(remaining) <= 0.005 ? 'Fica quite'
                                        : 'Pagou a mais (fica de crédito)'}
                            </span>
                            <span className="text-lg font-extrabold">
                                {formatCurrency(Math.abs(remaining))}
                            </span>
                        </div>
                    )}

                    {remaining < -0.005 && (
                        <div className="flex items-start gap-2.5 rounded-xl bg-gray-50 p-3">
                            <AlertTriangle className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" />
                            <p className="text-xs text-gray-500">
                                O saldo dele vai ficar negativo, o que significa crédito a favor do
                                cliente. Se não foi essa a intenção, ajuste o valor.
                            </p>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700">Forma</label>
                            <Select value={method} onChange={(e) => setMethod(e.target.value)}>
                                {RECEIVE_METHODS.map((m) => (
                                    <option key={m.id} value={m.id}>{m.label}</option>
                                ))}
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700">Data</label>
                            <Input
                                type="date"
                                value={paidAt}
                                onChange={(e) => setPaidAt(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-700">Observação</label>
                        <Input
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="Opcional"
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-1">
                        <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
                            Cancelar
                        </Button>
                        <Button type="submit" variant="success" disabled={saving}>
                            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                            Registrar {formatCurrency(value)}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
