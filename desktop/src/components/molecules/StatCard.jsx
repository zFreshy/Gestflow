import React from 'react';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { cn } from '../../lib/utils';

const TONES = {
    brand:   { bg: 'bg-[#7E1A8B]/10', icon: 'text-[#7E1A8B]', ring: 'ring-[#7E1A8B]/15', glow: 'group-hover:to-[#7E1A8B]/[0.06]' },
    success: { bg: 'bg-emerald-50',   icon: 'text-emerald-600', ring: 'ring-emerald-100', glow: 'group-hover:to-emerald-50/60' },
    danger:  { bg: 'bg-rose-50',      icon: 'text-rose-600',    ring: 'ring-rose-100',    glow: 'group-hover:to-rose-50/60' },
    warning: { bg: 'bg-amber-50',     icon: 'text-amber-600',   ring: 'ring-amber-100',   glow: 'group-hover:to-amber-50/60' },
    info:    { bg: 'bg-blue-50',      icon: 'text-blue-600',    ring: 'ring-blue-100',    glow: 'group-hover:to-blue-50/60' },
};

/**
 * Cartão de indicador.
 *
 * `trend` é a variação contra o período anterior, em porcentagem. Existe porque
 * um número sozinho não informa: "R$ 8.400 no mês" só quer dizer alguma coisa
 * ao lado de quanto foi no mês passado. Quando não dá para comparar (período
 * anterior zerado), some — inventar "+100%" seria pior que não mostrar.
 *
 * `trendGood` inverte a leitura da cor para indicador em que subir é ruim:
 * gasto com reposição que cresce 30% não é uma boa notícia pintada de verde.
 */
export function StatCard({
    label, value, hint, icon: Icon, tone = 'brand',
    trend = null, trendGood = true, onClick, className, children,
}) {
    const t = TONES[tone] ?? TONES.brand;
    const Tag = onClick ? 'button' : 'div';

    const positive = trend !== null && trend > 0.5;
    const negative = trend !== null && trend < -0.5;
    const flat = trend !== null && !positive && !negative;
    const good = positive ? trendGood : negative ? !trendGood : null;

    return (
        <Tag
            onClick={onClick}
            className={cn(
                "group relative overflow-hidden text-left w-full bg-white rounded-2xl border border-gray-100",
                "shadow-[0_1px_3px_rgba(16,24,40,0.04)] p-5",
                "transition-all duration-300 hover:shadow-[0_12px_28px_-12px_rgba(16,24,40,0.18)] hover:-translate-y-0.5",
                onClick && "cursor-pointer",
                className
            )}
        >
            {/* Brilho de fundo no hover: dá vida sem competir com o número. */}
            <div className={cn(
                "absolute inset-0 bg-gradient-to-br from-transparent to-transparent transition-colors duration-500",
                t.glow
            )} />

            <div className="relative z-10 flex items-start gap-4">
                {Icon && (
                    <div className={cn(
                        "h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ring-1 transition-transform duration-300 group-hover:scale-110",
                        t.bg, t.ring
                    )}>
                        <Icon className={cn("h-5 w-5", t.icon)} />
                    </div>
                )}

                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide truncate">
                            {label}
                        </p>
                        {trend !== null && (
                            <span className={cn(
                                "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold shrink-0",
                                good === null ? "bg-gray-100 text-gray-500"
                                    : good ? "bg-emerald-50 text-emerald-700"
                                        : "bg-rose-50 text-rose-700"
                            )}>
                                {flat ? <Minus className="h-2.5 w-2.5" />
                                    : positive ? <ArrowUp className="h-2.5 w-2.5" />
                                        : <ArrowDown className="h-2.5 w-2.5" />}
                                {Math.abs(trend).toFixed(0)}%
                            </span>
                        )}
                    </div>

                    <p className="text-[26px] leading-tight font-extrabold text-gray-900 tracking-tight mt-1 truncate">
                        {value}
                    </p>
                    {hint && <p className="text-xs text-gray-400 mt-0.5 truncate">{hint}</p>}
                    {children}
                </div>
            </div>
        </Tag>
    );
}
