import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const COLORS = [
    'hsl(221, 83%, 53%)',   // blue
    'hsl(142, 71%, 45%)',   // green
    'hsl(38, 92%, 50%)',    // amber
    'hsl(280, 67%, 60%)',   // purple
    'hsl(0, 84%, 60%)',     // red
];

const METHOD_LABELS = {
    pix: 'Pix',
    cartao: 'Cartão de Crédito',
    debito: 'Cartão de Débito',
    dinheiro: 'Dinheiro',
    credito_loja: 'Crédito Loja (fiado)',
    vale_alimentacao: 'Vale Alimentação',
    vale_combustivel: 'Vale Combustível',
    diversos: 'Diversos',
    outro: 'Outro'
};

const getFillColor = (name, index) => {
    if (name === 'Entradas' || name === 'Receitas') return 'hsl(142, 71%, 45%)'; // emerald
    if (name === 'Saídas' || name === 'Despesas') return 'hsl(0, 84%, 60%)'; // red
    if (name === 'Fornecedores') return 'hsl(221, 83%, 53%)'; // blue
    if (name === 'Padaria') return 'hsl(38, 92%, 50%)'; // amber
    if (name === 'Consultório') return 'hsl(221, 83%, 53%)'; // blue
    if (name === 'Fixas') return 'hsl(280, 67%, 60%)'; // purple
    if (name === 'Variáveis') return 'hsl(0, 84%, 60%)'; // red
    return COLORS[index % COLORS.length];
};

export function DonutChart({ transactions, type = 'payment_methods' }) {
    const { data, total } = useMemo(() => {
        let grouped = {};

        if (type === 'payment_methods') {
            grouped = transactions.reduce((acc, t) => {
                if (t.type === 'income') {
                    const method = t.paymentMethod || 'outro';
                    acc[method] = (acc[method] || 0) + t.amount;
                }
                return acc;
            }, {});
        } else if (type === 'profit_sources') {
            grouped = { 'Padaria': 0, 'Consultório': 0 };
            transactions.forEach(t => {
                if (t.type === 'income') {
                    const source = t.isBakeryIncome ? 'Padaria' : 'Consultório';
                    grouped[source] += t.amount;
                }
            });
        } else if (type === 'expense_forecast') {
            grouped = { 'Fixas': 0, 'Variáveis': 0 };
            transactions.forEach(t => {
                if (t.type === 'expense') {
                    const source = t.expenseType === 'fixed' ? 'Fixas' : 'Variáveis';
                    grouped[source] += t.amount;
                }
            });
        } else if (type === 'real_balance') {
            grouped = { 'Entradas': 0, 'Saídas': 0, 'Fornecedores': 0 };
            const isPaid = (status) => ['Pago', 'Liberado'].includes(status);
            transactions.forEach(t => {
                if (t.type === 'income') {
                    grouped['Entradas'] += t.amount;
                } else if (t.type === 'expense') {
                    if (t.expenseType === 'variable' || isPaid(t.status)) {
                        if (t.supplier_id || t.expenseType === 'supplier' || t.expense_type === 'supplier') {
                            grouped['Fornecedores'] += t.amount;
                        } else {
                            grouped['Saídas'] += t.amount;
                        }
                    }
                }
            });
        } else if (type === 'forecast_balance') {
            grouped = { 'Entradas': 0, 'Saídas': 0, 'Fornecedores': 0 };
            transactions.forEach(t => {
                if (t.type === 'income') {
                    grouped['Entradas'] += t.amount;
                } else if (t.type === 'expense') {
                    if (t.supplier_id || t.expenseType === 'supplier' || t.expense_type === 'supplier') {
                        grouped['Fornecedores'] += t.amount;
                    } else {
                        grouped['Saídas'] += t.amount;
                    }
                }
            });
        }

        let chartData = Object.entries(grouped).map(([key, value]) => ({
            name: METHOD_LABELS[key] || key,
            value,
        }));

        if (type === 'payment_methods') {
            chartData = chartData.filter(d => d.value > 0);
        }

        return { data: chartData, total: chartData.reduce((s, d) => s + d.value, 0) };
    }, [transactions, type]);

    if (data.length === 0) {
        return (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                Sem dados
            </div>
        );
    }

    const formatValue = (value) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    };

    const CustomTooltip = ({ active, payload }) => {
        if (active && payload && payload.length && total > 0) {
            return (
                <div className="bg-white p-2 border border-gray-100 shadow-sm rounded-lg text-xs">
                    <span className="font-medium text-gray-900">{payload[0].name}: </span>
                    <span className="text-gray-600">{formatValue(payload[0].value)}</span>
                </div>
            );
        }
        return null;
    };

    const pieData = total === 0 ? [{ name: 'Vazio', value: 1 }] : data;

    const showBalance = type === 'real_balance' || type === 'forecast_balance';
    const balance = showBalance ? (data.find(d => d.name === 'Entradas')?.value || 0) - (data.find(d => d.name === 'Saídas')?.value || 0) - (data.find(d => d.name === 'Fornecedores')?.value || 0) : 0;

    return (
        <div className="flex items-center gap-6 h-full w-full">
            <div className="flex-1 min-w-0">
                <div className="flex flex-col gap-y-3">
                    {data.map((entry, idx) => (
                        <div key={entry.name} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2 truncate pr-2">
                                <div
                                    className="h-3 w-3 rounded-full shrink-0"
                                    style={{ backgroundColor: getFillColor(entry.name, idx) }}
                                />
                                <span className="font-medium text-gray-700 truncate">{entry.name}</span>
                            </div>
                            <span className="text-gray-500 font-medium shrink-0">
                                {formatValue(entry.value)}
                            </span>
                        </div>
                    ))}
                    {showBalance && (
                        <div className="flex items-center justify-between text-sm pt-2 border-t border-gray-100">
                            <div className="flex items-center gap-2 truncate pr-2">
                                <div
                                    className="h-3 w-3 rounded-full shrink-0"
                                    style={{ backgroundColor: 'transparent' }}
                                />
                                <span className="font-bold text-gray-800 truncate">Saldo</span>
                            </div>
                            <span className={`font-bold shrink-0 ${balance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {formatValue(balance)}
                            </span>
                        </div>
                    )}
                </div>
            </div>
            <div className="relative h-28 w-28 shrink-0 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={30}
                            outerRadius={45}
                            paddingAngle={3}
                            dataKey="value"
                            stroke="none"
                        >
                            {pieData.map((entry, idx) => (
                                <Cell key={idx} fill={total === 0 ? '#f3f4f6' : getFillColor(entry.name, idx)} />
                            ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
