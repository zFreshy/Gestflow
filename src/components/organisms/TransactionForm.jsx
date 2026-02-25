import React, { useState } from 'react';
import { Button } from '../atoms/Button';
import { Input } from '../atoms/Input';
import { Select } from '../atoms/Select';
import { FormField } from '../molecules/FormField';
import { X } from 'lucide-react';

export function TransactionForm({ onAddTransaction, isOpen, onClose }) {
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [type, setType] = useState('income');
    const [paymentMethod, setPaymentMethod] = useState('pix');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!description || !amount) return;

        onAddTransaction({
            id: crypto.randomUUID(),
            description,
            amount: parseFloat(amount),
            type,
            paymentMethod,
            date: new Date().toLocaleDateString('pt-BR'),
            timestamp: Date.now()
        });

        setDescription('');
        setAmount('');
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div
                className="modal-content bg-card rounded-2xl shadow-2xl border w-full max-w-md mx-4 overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Modal Header */}
                <div className="flex items-center justify-between p-6 pb-0">
                    <h2 className="text-lg font-semibold">Nova Transação</h2>
                    <button
                        onClick={onClose}
                        className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Modal Body */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <FormField label="Descrição">
                        <Input
                            placeholder="Ex: Venda de Produto, Aluguel..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            required
                        />
                    </FormField>

                    <div className="grid grid-cols-2 gap-4">
                        <FormField label="Valor (R$)">
                            <Input
                                type="number"
                                step="0.01"
                                min="0.01"
                                placeholder="0.00"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                required
                            />
                        </FormField>

                        <FormField label="Tipo">
                            <Select value={type} onChange={(e) => setType(e.target.value)}>
                                <option value="income">Ganho (+)</option>
                                <option value="expense">Gasto (-)</option>
                            </Select>
                        </FormField>
                    </div>

                    <FormField label="Método de Pagamento">
                        <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                            <option value="pix">PIX</option>
                            <option value="dinheiro">Dinheiro</option>
                            <option value="cartao">Cartão</option>
                        </Select>
                    </FormField>

                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 h-10 rounded-xl border text-sm font-medium hover:bg-muted transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="flex-1 h-10 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-all shadow-lg shadow-primary/25"
                        >
                            Adicionar
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
