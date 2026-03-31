import React, { useMemo, useState } from 'react';
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
                <div className="bg-white/90 backdrop-blur-md border border-gray-100/50 rounded-2xl shadow-[0_8px_30px_-4px_rgba(0,0,0,0.1)] p-4 text-sm min-w-[150px]">
                    <p className="font-bold text-gray-800 mb-3 pb-2 border-b border-gray-100">{label}</p>
                    <div className="space-y-2">
                        {payload.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                                    <span className="text-gray-600 font-medium">{item.name}</span>
                                </div>
                                <span className="font-bold text-gray-900">
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.value)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="p-2">
            <div className="flex flex-row items-center justify-between pb-6 px-4 pt-4">
                <h3 className="text-xl font-bold text-gray-900">Visão Geral de Fluxo</h3>
                <div className="w-[140px]">
                    <Select
                        value={viewMode}
                        onChange={(e) => setViewMode(e.target.value)}
                        className="bg-gray-50 border-transparent hover:bg-gray-100 transition-colors font-medium rounded-xl"
                    >
                        <option value="week">Última Semana</option>
                        <option value="month">Último Mês</option>
                        <option value="year">Este Ano</option>
                    </Select>
                </div>
            </div>
            <div className="px-2">
                <div className="h-[320px] w-full">
                    {data.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-gray-400 font-medium text-sm bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
                            Adicione transações para ver o gráfico.
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis
                                    dataKey="displayDate"
                                    stroke="#94a3b8"
                                    fontSize={12}
                                    fontWeight={500}
                                    tickLine={false}
                                    axisLine={false}
                                    dy={10}
                                />
                                <YAxis
                                    stroke="#94a3b8"
                                    fontSize={12}
                                    fontWeight={500}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(value) => {
                                        if (value >= 1000) return `R$${(value/1000).toFixed(1)}k`;
                                        return `R$${value}`;
                                    }}
                                    dx={-10}
                                />
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                                <Legend
                                    iconType="circle"
                                    iconSize={8}
                                    wrapperStyle={{ fontSize: '13px', fontWeight: 500, paddingTop: '20px' }}
                                />
                                <Bar
                                    dataKey="ganhos"
                                    name="Receitas"
                                    fill="#10B981"
                                    radius={[6, 6, 6, 6]}
                                    barSize={12}
                                />
                                <Bar
                                    dataKey="gastos"
                                    name="Despesas"
                                    fill="#F43F5E"
                                    radius={[6, 6, 6, 6]}
                                    barSize={12}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>
        </div>
    );
}
