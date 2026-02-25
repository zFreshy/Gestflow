import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

const COLORS = [
    'hsl(221, 83%, 53%)',   // blue
    'hsl(142, 71%, 45%)',   // green
    'hsl(38, 92%, 50%)',    // amber
    'hsl(280, 67%, 60%)',   // purple
    'hsl(0, 84%, 60%)',     // red
];

const METHOD_LABELS = {
    pix: 'Pix',
    cartao: 'Cartão',
    dinheiro: 'Dinheiro',
};

export function DonutChart({ transactions }) {
    const { data, total } = useMemo(() => {
        const grouped = transactions.reduce((acc, t) => {
            if (t.type === 'income') {
                const method = t.paymentMethod || 'outro';
                acc[method] = (acc[method] || 0) + 1;
            }
            return acc;
        }, {});

        const chartData = Object.entries(grouped).map(([key, value]) => ({
            name: METHOD_LABELS[key] || key,
            value,
        }));

        return { data: chartData, total: chartData.reduce((s, d) => s + d.value, 0) };
    }, [transactions]);

    if (data.length === 0) {
        return (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                Sem dados
            </div>
        );
    }

    return (
        <div className="flex items-center gap-4">
            <div className="flex-1">
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                    {data.map((entry, idx) => (
                        <div key={entry.name} className="flex items-center gap-2 text-sm">
                            <div
                                className="h-2.5 w-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                            />
                            <span className="text-muted-foreground">{entry.value}</span>
                            <span className="font-medium">{entry.name}</span>
                        </div>
                    ))}
                </div>
            </div>
            <div className="relative h-28 w-28 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="50%"
                            innerRadius={32}
                            outerRadius={50}
                            paddingAngle={3}
                            dataKey="value"
                            stroke="none"
                        >
                            {data.map((_, idx) => (
                                <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                            ))}
                        </Pie>
                    </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-lg font-bold">{total}</span>
                </div>
            </div>
        </div>
    );
}
