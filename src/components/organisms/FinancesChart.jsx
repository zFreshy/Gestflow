import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../atoms/Card';
import { Select } from '../atoms/Select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export function FinancesChart({ transactions }) {
    const [viewMode, setViewMode] = useState('week');

    const data = useMemo(() => {
        const parseDate = (dateStr) => {
            if (!dateStr) return new Date();
            const [d, m, y] = dateStr.split('/');
            return new Date(y, m - 1, d);
        };

        const grouped = transactions.reduce((acc, curr) => {
            const dateObj = parseDate(curr.date);
            let key;
            
            if (viewMode === 'year') {
                const month = dateObj.getMonth() + 1;
                const year = dateObj.getFullYear();
                key = `${year}-${month.toString().padStart(2, '0')}`;
            } else {
                const d = dateObj.getDate().toString().padStart(2, '0');
                const m = (dateObj.getMonth() + 1).toString().padStart(2, '0');
                const y = dateObj.getFullYear();
                key = `${y}-${m}-${d}`;
            }

            if (!acc[key]) {
                acc[key] = {
                    date: key,
                    rawDate: dateObj,
                    ganhos: 0,
                    gastos: 0
                };
            }
            
            if (curr.type === 'income') {
                acc[key].ganhos += curr.amount;
            } else {
                acc[key].gastos += curr.amount;
            }
            return acc;
        }, {});

        const sortedData = Object.values(grouped).sort((a, b) => {
            if (viewMode === 'year') {
                 // Sort by YYYY-MM
                 return a.date.localeCompare(b.date);
            }
            return a.rawDate - b.rawDate;
        });

        const formattedData = sortedData.map(item => {
            if (viewMode === 'year') {
                const [year, month] = item.date.split('-');
                const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
                return { 
                    ...item, 
                    displayDate: `${monthNames[parseInt(month) - 1]}/${year.slice(2)}` 
                };
            } else {
                const date = item.rawDate;
                const d = date.getDate().toString().padStart(2, '0');
                const m = (date.getMonth() + 1).toString().padStart(2, '0');
                return { 
                    ...item, 
                    displayDate: `${d}/${m}` 
                };
            }
        });

        if (viewMode === 'week') {
            return formattedData.slice(-7);
        } else if (viewMode === 'month') {
            return formattedData.slice(-30);
        } else {
            return formattedData.slice(-12);
        }
    }, [transactions, viewMode]);

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
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg">Visão Geral</CardTitle>
                <div className="w-[120px]">
                    <Select
                        value={viewMode}
                        onChange={(e) => setViewMode(e.target.value)}
                    >
                        <option value="week">Semana</option>
                        <option value="month">Mês</option>
                        <option value="year">Ano</option>
                    </Select>
                </div>
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
                                    dataKey="displayDate"
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
