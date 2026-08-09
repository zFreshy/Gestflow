import React from 'react';
import { cn, toISODate } from '../../lib/utils';
import { Input } from '../atoms/Input';

/**
 * Atalhos de período. Cada um devolve { from, to } em YYYY-MM-DD (data local).
 * A conversão para instante com fuso fica com quem consome — coluna `date` e
 * coluna `timestamptz` precisam de formatos diferentes.
 */
export const PERIOD_PRESETS = {
    hoje: {
        label: 'Hoje',
        range: () => {
            const d = toISODate();
            return { from: d, to: d };
        },
    },
    ontem: {
        label: 'Ontem',
        range: () => {
            const d = new Date();
            d.setDate(d.getDate() - 1);
            const iso = toISODate(d);
            return { from: iso, to: iso };
        },
    },
    semana: {
        label: '7 dias',
        range: () => {
            const start = new Date();
            start.setDate(start.getDate() - 6);
            return { from: toISODate(start), to: toISODate() };
        },
    },
    mes: {
        label: 'Este mês',
        range: () => {
            const now = new Date();
            return {
                from: toISODate(new Date(now.getFullYear(), now.getMonth(), 1)),
                to: toISODate(),
            };
        },
    },
    mesPassado: {
        label: 'Mês passado',
        range: () => {
            const now = new Date();
            return {
                from: toISODate(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
                // Dia 0 do mês atual = último dia do mês anterior.
                to: toISODate(new Date(now.getFullYear(), now.getMonth(), 0)),
            };
        },
    },
};

export function PeriodFilter({ preset, onPresetChange, from, to, onFromChange, onToChange }) {
    return (
        <div className="flex flex-wrap items-center gap-2">
            {Object.entries(PERIOD_PRESETS).map(([key, { label }]) => (
                <button
                    key={key}
                    onClick={() => onPresetChange(key)}
                    className={cn(
                        "px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors border",
                        preset === key
                            ? "bg-[#7E1A8B] text-white border-[#7E1A8B]"
                            : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                    )}
                >
                    {label}
                </button>
            ))}

            <button
                onClick={() => onPresetChange('custom')}
                className={cn(
                    "px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors border",
                    preset === 'custom'
                        ? "bg-[#7E1A8B] text-white border-[#7E1A8B]"
                        : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                )}
            >
                Escolher datas
            </button>

            {preset === 'custom' && (
                <div className="flex items-center gap-2">
                    <Input
                        type="date"
                        value={from}
                        max={to || undefined}
                        onChange={(e) => onFromChange(e.target.value)}
                        className="h-9 w-40"
                    />
                    <span className="text-sm text-gray-400">até</span>
                    <Input
                        type="date"
                        value={to}
                        min={from || undefined}
                        onChange={(e) => onToChange(e.target.value)}
                        className="h-9 w-40"
                    />
                </div>
            )}
        </div>
    );
}
