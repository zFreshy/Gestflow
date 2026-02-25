import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../atoms/Card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export function FinancesChart({ transactions }) {
    const data = useMemo(() => {
        const grouped = transactions.reduce((acc, curr) => {
            if (!acc[curr.date]) {
                acc[curr.date] = { date: curr.date, ganhos: 0, gastos: 0 };
            }
            if (curr.type === 'income') {
                acc[curr.date].ganhos += curr.amount;
            } else {
                acc[curr.date].gastos += curr.amount;
            }
            return acc;
        }, {});

        return Object.values(grouped).sort((a, b) => {
            const [d1, m1, y1] = a.date.split('/');
            const [d2, m2, y2] = b.date.split('/');
            return new Date(`${y1}-${m1}-${d1}`) - new Date(`${y2}-${m2}-${d2}`);
        }).slice(-7);
    }, [transactions]);

    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-card border rounded-xl shadow-lg p-3 text-sm">
                    <p className="font-medium mb-1">{label}</p>
                    {payload.map((item, idx) => (
                        <p key={idx} style={{ color: item.color }} className="text-xs">
                            {item.name}: R$ {item.value.toFixed(2)}
                        </p>
                    ))}
                </div>
            );
        }
        return null;
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">Visão Geral</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="h-[280px] w-full">
                    {data.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                            Adicione transações para ver o gráfico.
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(214, 32%, 91%)" />
                                <XAxis
                                    dataKey="date"
                                    stroke="hsl(215, 16%, 47%)"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <YAxis
                                    stroke="hsl(215, 16%, 47%)"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(value) => `R$${value}`}
                                />
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(210, 40%, 96%, 0.5)' }} />
                                <Legend
                                    iconType="circle"
                                    iconSize={8}
                                    wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
                                />
                                <Bar
                                    dataKey="ganhos"
                                    name="Ganhos"
                                    fill="hsl(142, 71%, 45%)"
                                    radius={[6, 6, 0, 0]}
                                />
                                <Bar
                                    dataKey="gastos"
                                    name="Gastos"
                                    fill="hsl(0, 84%, 60%)"
                                    radius={[6, 6, 0, 0]}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
