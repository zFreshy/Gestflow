import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock } from 'lucide-react';
import { cn } from '../../lib/utils';

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];

// Deterministic gradient selection
const GRADIENTS = [
    'bg-gradient-to-br from-cyan-100 to-blue-50 text-blue-900 border-blue-200',
    'bg-gradient-to-br from-purple-100 to-fuchsia-50 text-purple-900 border-purple-200',
    'bg-gradient-to-br from-blue-100 to-indigo-50 text-indigo-900 border-indigo-200',
    'bg-gradient-to-br from-emerald-100 to-teal-50 text-teal-900 border-teal-200',
    'bg-gradient-to-br from-amber-100 to-orange-50 text-orange-900 border-orange-200'
];

function getGradientForId(id) {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
        hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
}

export function CalendarGrid({ transactions }) {
    // Start with September 2025 since our mock data has dates there
    const [currentDate, setCurrentDate] = useState(new Date(2025, 8, 1)); // September is 8
    const [view, setView] = useState('month'); // 'month', 'week', 'day'

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    function goToPreviousMonth() {
        setCurrentDate(new Date(year, month - 1, 1));
    }
    function goToNextMonth() {
        setCurrentDate(new Date(year, month + 1, 1));
    }
    function goToToday() {
        setCurrentDate(new Date());
    }

    const title = `${MONTHS[month]} ${year}`;

    // Calendar logic
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = new Date(year, month, 1).getDay();

    const calendarCells = useMemo(() => {
        const cells = [];
        // Empties before start
        for (let i = 0; i < firstDayOfMonth; i++) {
            cells.push({ day: null, dateStr: null });
        }
        // Days
        for (let d = 1; d <= daysInMonth; d++) {
            // format: DD/MM/YYYY
            const dStr = String(d).padStart(2, '0');
            const mStr = String(month + 1).padStart(2, '0');
            const dateStr = `${dStr}/${mStr}/${year}`;
            cells.push({ day: d, dateStr });
        }
        // Empties after to fill weeks
        while (cells.length % 7 !== 0) {
            cells.push({ day: null, dateStr: null });
        }
        return cells;
    }, [year, month, daysInMonth, firstDayOfMonth]);

    // Group transactions by date
    const transactionsByDate = useMemo(() => {
        const map = {};
        transactions.forEach(t => {
            if (!map[t.date]) map[t.date] = [];
            map[t.date].push(t);
        });
        return map;
    }, [transactions]);

    return (
        <div className="flex flex-col h-full bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Header Toolbar */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
                <div className="flex items-center gap-3">
                    <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                        <button onClick={goToPreviousMonth} className="px-3 py-2 hover:bg-gray-50 text-gray-500 transition-colors border-r border-gray-200">
                            <ChevronLeft className="h-4 w-4" />
                        </button>
                        <button onClick={goToNextMonth} className="px-3 py-2 hover:bg-gray-50 text-gray-500 transition-colors">
                            <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>
                    <button onClick={goToToday} className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
                        Today
                    </button>
                </div>

                <div className="text-lg font-medium tracking-wide">
                    {title}
                </div>

                <div className="flex rounded-lg overflow-hidden border border-gray-200 text-sm font-medium">
                    {['Month', 'Week', 'Day'].map((v) => (
                        <button
                            key={v}
                            onClick={() => setView(v.toLowerCase())}
                            className={cn(
                                "px-6 py-2 transition-colors",
                                view === v.toLowerCase()
                                    ? "bg-blue-500 text-white"
                                    : "bg-white text-gray-600 hover:bg-gray-50 border-r border-gray-200 last:border-0"
                            )}
                        >
                            {v}
                        </button>
                    ))}
                </div>
            </div>

            {/* Grid */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Days Header */}
                <div className="grid grid-cols-7 border-b border-gray-100">
                    {DAYS_OF_WEEK.map((day) => (
                        <div key={day} className="py-3 text-center text-[13px] font-medium text-gray-900 border-r border-gray-100 last:border-0">
                            {day}
                        </div>
                    ))}
                </div>

                {/* Calendar Cells */}
                <div className="flex-1 grid grid-cols-7 grid-rows-5 bg-gray-50/30">
                    {calendarCells.map((cell, idx) => {
                        const cellTransactions = cell.dateStr ? (transactionsByDate[cell.dateStr] || []) : [];
                        const isToday = cell.dateStr === new Intl.DateTimeFormat('pt-BR').format(new Date());

                        return (
                            <div
                                key={idx}
                                className="min-h-[120px] p-2 border-r border-b border-gray-100 last:border-r-0 bg-white"
                            >
                                {cell.day && (
                                    <div className="flex flex-col h-full">
                                        <div className="flex justify-end mb-1">
                                            <span className={cn(
                                                "text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full",
                                                isToday ? "bg-blue-500 text-white" : "text-gray-500"
                                            )}>
                                                {cell.day}
                                            </span>
                                        </div>
                                        <div className="flex-1 space-y-1 overflow-y-auto">
                                            {cellTransactions.map((t) => (
                                                <div
                                                    key={t.id}
                                                    className={cn(
                                                        "p-2 rounded-lg border text-xs relative group cursor-pointer",
                                                        getGradientForId(t.id)
                                                    )}
                                                >
                                                    <p className="font-medium truncate leading-tight mb-1">{t.exam || t.description}</p>
                                                    <div className="flex items-center gap-1 mt-3 text-current opacity-70">
                                                        <CalendarIcon className="h-3.5 w-3.5" />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
