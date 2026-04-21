import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../atoms/Card';
import { Select } from '../atoms/Select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { cn } from '../../lib/utils';

export function GrowthEvolutionChart({ transactions }) {
    const [timeUnit, setTimeUnit] = useState('week'); // 'week' | 'month'
    const [count, setCount] = useState(4); // 2 to 12

    const getTransactionDate = (dateStr) => {
        if (!dateStr) return new Date(0);
        const [day, month, year] = dateStr.split('/');
        return new Date(year, month - 1, day);
    };

    const formatBRL = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

    const chartData = useMemo(() => {
        const bins = [];
        const now = new Date();
        now.setHours(0,0,0,0);

        if (timeUnit === 'week') {
            const currentDay = now.getDay(); // 0 = Domingo
            const currentWeekStart = new Date(now);
            currentWeekStart.setDate(now.getDate() - currentDay);

            // Gerar 'count' semanas para exibição + 1 semana anterior para o cálculo base
            for (let i = count; i >= 0; i--) {
                const wStart = new Date(currentWeekStart);
                wStart.setDate(wStart.getDate() - (i * 7));
                const wEnd = new Date(wStart);
                wEnd.setDate(wEnd.getDate() + 6);
                wEnd.setHours(23,59,59,999);
                
                bins.push({
                    label: `Sem ${wStart.getDate().toString().padStart(2, '0')}/${(wStart.getMonth()+1).toString().padStart(2, '0')}`,
                    start: wStart.getTime(),
                    end: wEnd.getTime(),
                    total: 0
                });
            }
        } else {
            const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            
            for (let i = count; i >= 0; i--) {
                const mStart = new Date(currentMonthStart);
                mStart.setMonth(mStart.getMonth() - i);
                const mEnd = new Date(mStart.getFullYear(), mStart.getMonth() + 1, 0);
                mEnd.setHours(23,59,59,999);
                
                const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
                bins.push({
                    label: `${monthNames[mStart.getMonth()]}/${mStart.getFullYear().toString().slice(-2)}`,
                    start: mStart.getTime(),
                    end: mEnd.getTime(),
                    total: 0
                });
            }
        }

        // Popular valores
        transactions.forEach(t => {
            const tDate = getTransactionDate(t.date).getTime();
            for (let bin of bins) {
                if (tDate >= bin.start && tDate <= bin.end) {
                    bin.total += t.amount;
                    break;
                }
            }
        });

        const data = [];
        // O primeiro item (index 0) é a semana/mês base, então o loop começa do 1
        for (let i = 1; i < bins.length; i++) {
            const prev = bins[i-1].total;
            const curr = bins[i].total;
            let growth = 0;
            
            if (prev === 0) {
                growth = curr > 0 ? 100 : 0;
            } else {
                growth = ((curr - prev) / prev) * 100;
            }
            
            data.push({
                label: bins[i].label,
                growth: Number(growth.toFixed(1)),
                currentTotal: curr,
                previousTotal: prev
            });
        }

        return data;
    }, [transactions, timeUnit, count]);

    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            const isPositive = data.growth >= 0;
            return (
                <div className="bg-white/95 backdrop-blur-md border border-gray-100 rounded-2xl shadow-lg p-4 text-sm min-w-[200px]">
                    <p className="font-bold text-gray-800 mb-3">{label}</p>
                    
                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <span className="text-gray-500 text-xs font-medium">Crescimento</span>
                            <span className={cn("font-bold flex items-center gap-1", isPositive ? "text-emerald-600" : "text-rose-600")}>
                                {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                {Math.abs(data.growth).toFixed(1)}%
                            </span>
                        </div>
                        <div className="h-px w-full bg-gray-100 my-2"></div>
                        <div className="flex justify-between items-center">
                            <span className="text-gray-500 text-xs">Atual</span>
                            <span className="font-semibold text-gray-900">{formatBRL(data.currentTotal)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-gray-500 text-xs">Anterior</span>
                            <span className="font-semibold text-gray-400">{formatBRL(data.previousTotal)}</span>
                        </div>
                    </div>
                </div>
            );
        }
        return null;
    };

    return (
        <Card className="border-gray-100 shadow-sm rounded-2xl">
            <CardHeader className="pb-2">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Activity className="w-5 h-5 text-indigo-500" />
                        Evolução de Crescimento (%)
                    </CardTitle>
                    
                    <div className="flex items-center gap-2">
                        <Select 
                            value={timeUnit} 
                            onChange={(e) => setTimeUnit(e.target.value)}
                            className="w-32 h-9 text-sm"
                        >
                            <option value="week">Por Semana</option>
                            <option value="month">Por Mês</option>
                        </Select>
                        
                        <Select 
                            value={count} 
                            onChange={(e) => setCount(Number(e.target.value))}
                            className="w-36 h-9 text-sm"
                        >
                            {[...Array(11)].map((_, i) => {
                                const val = i + 2; // de 2 até 12
                                return (
                                    <option key={val} value={val}>
                                        Últimas {val} {timeUnit === 'week' ? 'semanas' : 'meses'}
                                    </option>
                                );
                            })}
                        </Select>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="h-72 w-full mt-4">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis 
                                dataKey="label" 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }}
                                dy={10}
                            />
                            <YAxis 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{ fill: '#94a3b8', fontSize: 12 }}
                                tickFormatter={(val) => `${val}%`}
                            />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                            <ReferenceLine y={0} stroke="#cbd5e1" strokeWidth={1} />
                            <Bar dataKey="growth" radius={[6, 6, 6, 6]} barSize={24}>
                                {chartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.growth >= 0 ? '#10b981' : '#f43f5e'} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}