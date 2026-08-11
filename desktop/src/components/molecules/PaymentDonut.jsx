import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { CreditCard } from 'lucide-react';
import { formatCurrency } from '../../lib/utils';
import { paymentLabel } from '../../lib/payments';

/**
 * Cores por forma de pagamento — as mesmas do resto do app.
 *
 * Fixas por método, e não pela ordem de chegada: se a cor mudasse conforme quem
 * vendeu mais no período, comparar dois meses viraria adivinhação.
 */
const COLORS = {
    'Dinheiro':     '#10b981',
    'PIX':          '#3b82f6',
    'Débito':       '#6366f1',
    'Crédito':      '#f59e0b',
    'Ticket':       '#7E1A8B',
    'Crédito Loja': '#ef4444',
};

export function PaymentDonut({ data }) {
    const total = data.reduce((sum, d) => sum + d.amount, 0);

    if (total === 0) {
        return (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 h-full flex flex-col">
                <Header />
                <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
                    <CreditCard className="h-10 w-10 text-gray-200 mb-3" />
                    <p className="text-sm font-medium text-gray-400">Nenhuma venda no período</p>
                </div>
            </div>
        );
    }

    const chartData = data.map((d) => ({
        ...d,
        label: paymentLabel(d.method),
        color: COLORS[d.method] ?? '#94a3b8',
    }));

    const leader = chartData[0];

    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 h-full flex flex-col">
            <Header />

            <div className="relative">
                <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                        <Pie
                            data={chartData}
                            dataKey="amount"
                            nameKey="label"
                            innerRadius={58}
                            outerRadius={82}
                            paddingAngle={2}
                            strokeWidth={0}
                        >
                            {chartData.map((entry) => (
                                <Cell key={entry.method} fill={entry.color} />
                            ))}
                        </Pie>
                        <Tooltip
                            formatter={(value, name) => [formatCurrency(value), name]}
                            contentStyle={{
                                borderRadius: 12,
                                border: '1px solid hsl(214 32% 91%)',
                                fontSize: 13,
                            }}
                        />
                    </PieChart>
                </ResponsiveContainer>

                {/* O buraco do donut não fica vazio: é onde cabe a resposta que
                    a pessoa foi buscar ao olhar o gráfico. */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">
                        Mais usado
                    </span>
                    <span className="text-sm font-extrabold text-gray-900 mt-0.5">
                        {leader.label}
                    </span>
                    <span className="text-[11px] text-gray-400">
                        {((leader.amount / total) * 100).toFixed(0)}% do total
                    </span>
                </div>
            </div>

            <div className="mt-4 space-y-2">
                {chartData.map((d) => (
                    <div key={d.method} className="flex items-center gap-2.5">
                        <span
                            className="h-2.5 w-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: d.color }}
                        />
                        <span className="text-sm text-gray-600 flex-1 truncate">{d.label}</span>
                        <span className="text-sm font-bold text-gray-900 shrink-0">
                            {formatCurrency(d.amount)}
                        </span>
                        <span className="text-[11px] text-gray-400 w-9 text-right shrink-0">
                            {((d.amount / total) * 100).toFixed(0)}%
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

const Header = () => (
    <>
        <div className="flex items-center gap-2 mb-1">
            <CreditCard className="h-4 w-4 text-gray-400" />
            <h2 className="font-bold text-gray-900">Como o cliente paga</h2>
        </div>
        <p className="text-sm text-gray-400 mb-4">Valor recebido por forma</p>
    </>
);
