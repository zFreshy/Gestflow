import React, { useMemo } from 'react';
import { Flame } from 'lucide-react';
import { cn, formatCurrency } from '../../lib/utils';

const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const SHORT = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

/**
 * Termômetro de vendas das últimas 12 semanas.
 *
 * Um quadradinho por dia, mais escuro quanto mais vendeu. O que ele responde
 * não é "quanto vendi" — isso o gráfico já diz — e sim **qual dia da semana
 * rende**. Numa padaria isso decide escala de funcionário, quanto de massa
 * deixar pronta e em que dia vale fazer promoção.
 *
 * A escala é relativa ao melhor dia do próprio período, e não a valores fixos:
 * uma loja que fatura R$ 300/dia e outra que fatura R$ 8.000 precisam das duas
 * pontas da escala, senão uma fica toda clara e a outra toda escura.
 */
export function SalesHeatmap({ days }) {
    const { grid, max, insight, byWeekday } = useMemo(() => {
        const max = days.reduce((m, d) => Math.max(m, d.revenue), 0);

        // Média por dia da semana, ignorando dias sem movimento nenhum — dia
        // fechado entraria como "vendeu zero" e afundaria a média do domingo.
        const totals = Array(7).fill(0);
        const counts = Array(7).fill(0);

        for (const d of days) {
            if (d.revenue <= 0) continue;
            const weekday = new Date(`${d.day}T12:00:00`).getDay();
            totals[weekday] += d.revenue;
            counts[weekday] += 1;
        }

        const byWeekday = totals.map((total, i) => ({
            weekday: i,
            average: counts[i] > 0 ? total / counts[i] : 0,
            samples: counts[i],
        }));

        // Só compara dias com pelo menos duas ocorrências: uma sexta-feira
        // isolada não é tendência, é acaso.
        const reliable = byWeekday.filter((d) => d.samples >= 2);
        let insight = 'Ainda não há semanas suficientes para dizer qual é o melhor dia.';

        if (reliable.length >= 2) {
            const best = reliable.reduce((a, b) => (b.average > a.average ? b : a));
            const worst = reliable.reduce((a, b) => (b.average < a.average ? b : a));
            const diff = worst.average > 0
                ? ((best.average - worst.average) / worst.average) * 100
                : 0;

            // Acima de 100% a porcentagem para de ser legível ("604% acima"
            // exige fazer conta na cabeça). Múltiplo se lê direto.
            const gap = diff >= 100
                ? `${(best.average / worst.average).toFixed(1).replace('.', ',')}× o de`
                : `${diff.toFixed(0)}% acima de`;

            insight = diff >= 15
                ? `**${WEEKDAYS[best.weekday]}** é o dia mais forte: em média ${formatCurrency(best.average)}, `
                  + `${gap} **${WEEKDAYS[worst.weekday]}**, o mais fraco `
                  + `(${formatCurrency(worst.average)}).`
                : `O movimento é parelho na semana — entre **${WEEKDAYS[worst.weekday]}** e `
                  + `**${WEEKDAYS[best.weekday]}** há só ${diff.toFixed(0)}% de diferença.`;
        }

        // Colunas = semanas, linhas = dia da semana. É preciso alinhar o começo
        // pelo dia da semana do primeiro dia, senão as linhas não representam
        // um dia fixo e o padrão semanal — a razão do gráfico existir — some.
        const grid = [];
        if (days.length > 0) {
            const firstWeekday = new Date(`${days[0].day}T12:00:00`).getDay();
            for (let i = 0; i < firstWeekday; i++) grid.push(null);
            grid.push(...days);
        }

        return { grid, max, insight, byWeekday };
    }, [days]);

    /** Cinco degraus. Menos que isso não mostra padrão; mais vira ruído. */
    const shade = (revenue) => {
        if (revenue <= 0) return 'bg-gray-100';
        const ratio = max > 0 ? revenue / max : 0;
        if (ratio > 0.8) return 'bg-[#7E1A8B]';
        if (ratio > 0.6) return 'bg-[#7E1A8B]/75';
        if (ratio > 0.4) return 'bg-[#7E1A8B]/50';
        if (ratio > 0.2) return 'bg-[#7E1A8B]/30';
        return 'bg-[#7E1A8B]/15';
    };

    const bestAverage = Math.max(...byWeekday.map((d) => d.average), 0);

    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 h-full flex flex-col">
            <div className="flex items-center gap-2 mb-1">
                <Flame className="h-4 w-4 text-orange-500" />
                <h2 className="font-bold text-gray-900">Termômetro de vendas</h2>
            </div>
            <p className="text-sm text-gray-400 mb-5">Últimas 12 semanas, dia a dia</p>

            <div className="flex gap-2">
                {/* Régua dos dias da semana */}
                <div className="grid grid-rows-7 gap-1 pt-0.5">
                    {SHORT.map((letter, i) => (
                        <span
                            key={i}
                            className="h-3.5 text-[9px] font-bold text-gray-300 leading-[14px] w-3"
                            title={WEEKDAYS[i]}
                        >
                            {letter}
                        </span>
                    ))}
                </div>

                <div className="grid grid-rows-7 grid-flow-col gap-1 overflow-x-auto pb-1">
                    {grid.map((day, i) => (
                        day === null ? (
                            <div key={`empty-${i}`} className="h-3.5 w-3.5" />
                        ) : (
                            <div
                                key={day.day}
                                title={
                                    `${new Date(`${day.day}T12:00:00`).toLocaleDateString('pt-BR', {
                                        weekday: 'long', day: '2-digit', month: '2-digit',
                                    })}\n`
                                    + `${formatCurrency(day.revenue)} · ${day.saleCount} `
                                    + `${day.saleCount === 1 ? 'venda' : 'vendas'}`
                                }
                                className={cn(
                                    "h-3.5 w-3.5 rounded-[3px] cursor-help transition-transform hover:scale-150 hover:ring-2 hover:ring-[#7E1A8B]/30",
                                    shade(day.revenue)
                                )}
                            />
                        )
                    ))}
                </div>
            </div>

            {/* Média por dia da semana: a leitura que o quadriculado sugere,
                dita com número. */}
            <div className="mt-5 grid grid-cols-7 gap-1.5">
                {byWeekday.map((d) => (
                    <div key={d.weekday} className="text-center">
                        <div className="h-14 flex items-end justify-center">
                            <div
                                className={cn(
                                    "w-full rounded-t-md transition-all",
                                    d.average > 0 && d.average === bestAverage
                                        ? "bg-[#7E1A8B]"
                                        : "bg-[#7E1A8B]/25"
                                )}
                                style={{
                                    height: bestAverage > 0
                                        ? `${Math.max((d.average / bestAverage) * 100, 3)}%`
                                        : '3%',
                                }}
                                title={`${WEEKDAYS[d.weekday]}: média de ${formatCurrency(d.average)}`}
                            />
                        </div>
                        <p className="text-[10px] font-bold text-gray-400 mt-1">
                            {SHORT[d.weekday]}
                        </p>
                    </div>
                ))}
            </div>

            <div className="mt-auto pt-5">
                <div className="bg-orange-50/70 border border-orange-100 rounded-xl p-3.5 flex gap-2.5">
                    <Flame className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
                    <p
                        className="text-sm text-gray-700 leading-relaxed"
                        // O texto vem daqui mesmo, com os destaques marcados em
                        // ** — não é conteúdo de fora.
                        dangerouslySetInnerHTML={{
                            __html: insight.replace(/\*\*(.*?)\*\*/g, '<strong class="text-gray-900">$1</strong>'),
                        }}
                    />
                </div>
            </div>
        </div>
    );
}
