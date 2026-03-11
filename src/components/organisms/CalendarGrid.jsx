import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, X } from 'lucide-react';
import { cn } from '../../lib/utils';

const DAYS_OF_WEEK = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTHS = ['JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];

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
    // Initialize with current date instead of hardcoded 2025
    const [currentDate, setCurrentDate] = useState(new Date()); 
    const [view, setView] = useState('month'); // 'month', 'week', 'day'
    const [selectedDate, setSelectedDate] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

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

    const handleDateClick = (dateStr) => {
        if (!dateStr) return;
        // Allow opening modal even if no transactions, to see detail or add (future feature)
        const dayTransactions = transactionsByDate[dateStr] || [];
        if (dayTransactions.length > 0) {
            setSelectedDate(dateStr);
            setIsModalOpen(true);
        }
    };

    return (
        <div className="flex flex-col h-full bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden relative">
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
                        Hoje
                    </button>
                </div>

                <div className="text-lg font-medium tracking-wide capitalize">
                    {title.toLowerCase()}
                </div>

                <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                    <button className="px-4 py-2 bg-[#7E1A8B] text-white text-sm font-medium hover:bg-[#6a1675] transition-colors">
                        Mês
                    </button>
                    <button className="px-4 py-2 bg-white text-gray-500 text-sm font-medium hover:bg-gray-50 transition-colors border-l border-gray-200">
                        Semana
                    </button>
                    <button className="px-4 py-2 bg-white text-gray-500 text-sm font-medium hover:bg-gray-50 transition-colors border-l border-gray-200">
                        Dia
                    </button>
                </div>
            </div>

            {/* Calendar Grid */}
            <div className="flex-1 overflow-auto">
                <div className="grid grid-cols-7 border-b border-gray-100">
                    {DAYS_OF_WEEK.map((day) => (
                        <div key={day} className="py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            {day}
                        </div>
                    ))}
                </div>
                <div className="grid grid-cols-7 h-full auto-rows-fr">
                    {calendarCells.map((cell, idx) => {
                        const dateKey = cell.dateStr;
                        const dayTransactions = transactionsByDate[dateKey] || [];
                        const displayTransactions = dayTransactions.slice(0, 3); // Show up to 3
                        const remainingCount = dayTransactions.length - 3;
                        const isToday = cell.day === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear();

                        return (
                            <div 
                                key={idx} 
                                className={cn(
                                    "min-h-[120px] p-2 border-b border-r border-gray-100 transition-colors relative group flex flex-col",
                                    !cell.day && "bg-gray-50/30",
                                    cell.day && "hover:bg-gray-50 cursor-pointer",
                                    isToday && cell.day && "bg-purple-50/30"
                                )}
                                onClick={() => handleDateClick(dateKey)}
                            >
                                {cell.day && (
                                    <>
                                        <div className={cn(
                                            "text-xs font-medium mb-2 text-right w-6 h-6 flex items-center justify-center rounded-full ml-auto",
                                            isToday ? "bg-[#7E1A8B] text-white" : "text-gray-400"
                                        )}>
                                            {cell.day}
                                        </div>
                                        <div className="space-y-1 flex-1">
                                            {displayTransactions.map((t) => (
                                                <div 
                                                    key={t.id}
                                                    className={cn(
                                                        "px-1.5 py-0.5 rounded text-[10px] font-medium truncate",
                                                        t.type === 'income' 
                                                            ? "bg-emerald-100 text-emerald-700" 
                                                            : "bg-red-100 text-red-700"
                                                    )}
                                                    title={t.description}
                                                >
                                                    {t.description}
                                                </div>
                                            ))}
                                            {remainingCount > 0 && (
                                                <div className="text-[10px] text-gray-400 font-medium pl-1">
                                                    +{remainingCount} mais...
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Transactions Modal */}
            {isModalOpen && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}>
                    <div 
                        className="bg-white rounded-xl shadow-xl w-full max-w-md m-4 overflow-hidden border border-gray-200 animate-in fade-in zoom-in duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50">
                            <h3 className="font-semibold text-gray-900">Transações em {selectedDate}</h3>
                            <button 
                                onClick={() => setIsModalOpen(false)}
                                className="h-8 w-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-200 hover:text-gray-600 transition-colors"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="p-4 max-h-[60vh] overflow-y-auto space-y-3">
                            {(transactionsByDate[selectedDate] || []).length > 0 ? (
                                (transactionsByDate[selectedDate] || []).map((t) => (
                                    <div key={t.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors bg-white shadow-sm">
                                        <div className="flex flex-col">
                                            <span className="font-medium text-sm text-gray-900">{t.description}</span>
                                            <span className="text-xs text-muted-foreground">{t.exam || t.paymentMethod}</span>
                                        </div>
                                        <span className={cn(
                                            "font-semibold text-sm",
                                            t.type === 'income' ? "text-emerald-600" : "text-red-600"
                                        )}>
                                            {t.type === 'income' ? '+' : '-'} {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(t.amount)}
                                        </span>
                                    </div>
                                ))
                            ) : (
                                <p className="text-center text-gray-500 text-sm py-4">Nenhuma transação neste dia.</p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
