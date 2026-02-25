import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../atoms/Card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export function FinancesChart({ transactions }) {
    // Group transactions by date for the chart
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

        // Sort dates or return latest 7 days
        return Object.values(grouped).sort((a, b) => {
            // Very naive string sort for DD/MM/YYYY, better to use proper date objects in real app
            const [d1, m1, y1] = a.date.split('/');
            const [d2, m2, y2] = b.date.split('/');
            return new Date(`${y1}-${m1}-${d1}`) - new Date(`${y2}-${m2}-${d2}`);
        }).slice(-7); // Last 7 days
    }, [transactions]);

    return (
        <Card className="col-span-1 lg:col-span-2">
            <CardHeader>
                <CardTitle>Visão Geral (Últimos Dias)</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="h-[300px] w-full">
                    {data.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                            Adicione transações para ver o gráfico.
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted-foreground) / 0.2)" />
                                <XAxis
                                    dataKey="date"
                                    stroke="hsl(var(--muted-foreground))"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <YAxis
                                    stroke="hsl(var(--muted-foreground))"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(value) => `R$${value}`}
                                />
                                <Tooltip
                                    cursor={{ fill: 'hsl(var(--muted) / 0.5)' }}
                                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                                    itemStyle={{ color: 'hsl(var(--foreground))' }}
                                />
                                <Legend iconType="circle" />
                                <Bar dataKey="ganhos" name="Ganhos" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="gastos" name="Gastos" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
