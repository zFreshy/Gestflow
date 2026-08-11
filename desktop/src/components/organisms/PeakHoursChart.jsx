import React, { useMemo } from 'react';
import {
    ResponsiveContainer, BarChart, Bar, XAxis, Tooltip, Cell,
} from 'recharts';
import { Clock } from 'lucide-react';
import { formatCurrency } from '../../lib/utils';

/**
 * Movimento por hora do dia.
 *
 * A pergunta prática é "a que horas a loja enche" — o que decide escala de
 * funcionário e a hora de assar mais pão. Por isso o eixo mostra a hora e a
 * barra mais alta vem destacada: quem olha quer achar o pico, não ler valores.
 *
 * As horas mortas do começo e do fim ficam de fora. Uma padaria não vende às
 * 3h da manhã, e 24 barras espremeriam justamente a faixa que importa.
 */
export function PeakHoursChart({ data }) {
    const { visible, peak, insight } = useMemo(() => {
        const active = data.filter((h) => h.saleCount > 0);

        if (active.length === 0) {
            return { visible: [], peak: null, insight: null };
        }

        const first = Math.min(...active.map((h) => h.hour));
        const last = Math.max(...active.map((h) => h.hour));
        const visible = data.filter((h) => h.hour >= first && h.hour <= last);

        const peak = active.reduce((a, b) => (b.revenue > a.revenue ? b : a));
        const total = active.reduce((sum, h) => sum + h.revenue, 0);

        // Faixa de 3 horas em volta do pico: "das 7h às 9h" é acionável de um
        // jeito que "às 8h" não é — ninguém escala funcionário por uma hora.
        const windowStart = Math.max(peak.hour - 1, first);
        const windowRevenue = data
            .filter((h) => h.hour >= windowStart && h.hour <= windowStart + 2)
            .reduce((sum, h) => sum + h.revenue, 0);

        const share = total > 0 ? (windowRevenue / total) * 100 : 0;

        return {
            visible,
            peak,
            insight: `Entre **${windowStart}h e ${windowStart + 3}h** passa `
                + `${share.toFixed(0)}% do faturamento do período.`,
        };
    }, [data]);

    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 h-full flex flex-col">
            <div className="flex items-center gap-2 mb-1">
                <Clock className="h-4 w-4 text-gray-400" />
                <h2 className="font-bold text-gray-900">Horário de pico</h2>
            </div>
            <p className="text-sm text-gray-400 mb-4">Faturamento por hora do dia</p>

            {visible.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
                    <Clock className="h-10 w-10 text-gray-200 mb-3" />
                    <p className="text-sm font-medium text-gray-400">Sem vendas no período</p>
                </div>
            ) : (
                <>
                    <ResponsiveContainer width="100%" height={160}>
                        <BarChart data={visible} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                            <XAxis
                                dataKey="hour"
                                tickLine={false}
                                axisLine={false}
                                tick={{ fontSize: 10, fill: 'hsl(215 16% 47%)' }}
                                tickFormatter={(h) => `${h}h`}
                                interval={Math.floor(visible.length / 8)}
                            />
                            <Tooltip
                                cursor={{ fill: 'rgba(126,26,139,0.05)' }}
                                formatter={(value, _name, entry) => [
                                    `${formatCurrency(value)} · ${entry.payload.saleCount} vendas`,
                                    'Faturamento',
                                ]}
                                labelFormatter={(h) => `${h}h às ${h + 1}h`}
                                contentStyle={{
                                    borderRadius: 12,
                                    border: '1px solid hsl(214 32% 91%)',
                                    fontSize: 13,
                                }}
                            />
                            <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                                {visible.map((h) => (
                                    <Cell
                                        key={h.hour}
                                        fill={h.hour === peak.hour ? '#7E1A8B' : '#7E1A8B33'}
                                    />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>

                    <div className="mt-auto pt-4">
                        <div className="bg-gray-50 border border-gray-100 rounded-xl p-3.5 flex gap-2.5">
                            <Clock className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" />
                            <p
                                className="text-sm text-gray-700 leading-relaxed"
                                dangerouslySetInnerHTML={{
                                    __html: insight.replace(
                                        /\*\*(.*?)\*\*/g,
                                        '<strong class="text-gray-900">$1</strong>'
                                    ),
                                }}
                            />
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
