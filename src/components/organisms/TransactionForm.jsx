import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../atoms/Card';
import { Button } from '../atoms/Button';
import { Input } from '../atoms/Input';
import { Select } from '../atoms/Select';
import { FormField } from '../molecules/FormField';

export function TransactionForm({ onAddTransaction }) {
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
    };

    return (
        <Card className="h-full">
            <CardHeader>
                <CardTitle>Nova Transação</CardTitle>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
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

                    <Button type="submit" className="w-full mt-2">
                        Adicionar Transação
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}
