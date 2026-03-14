import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const MONTHS = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export function MonthSelector({ currentDate, onMonthChange, viewMode = 'month' }) {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const handlePrev = () => {
        if (viewMode === 'year') {
            // Subtract 1 year
            onMonthChange(new Date(year - 1, month, 1));
        } else {
            // Subtract 1 month
            onMonthChange(new Date(year, month - 1, 1));
        }
    };

    const handleNext = () => {
        if (viewMode === 'year') {
            // Add 1 year
            onMonthChange(new Date(year + 1, month, 1));
        } else {
            // Add 1 month
            onMonthChange(new Date(year, month + 1, 1));
        }
    };

    return (
        <div className="flex items-center justify-between bg-white p-2 rounded-xl border border-gray-100 shadow-sm w-full md:w-64">
            <button 
                onClick={handlePrev}
                className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
            >
                <ChevronLeft className="h-5 w-5" />
            </button>
            
            <div className="text-center min-w-[100px]">
                {viewMode === 'month' && (
                    <span className="block text-sm font-bold text-gray-900">
                        {MONTHS[month]}
                    </span>
                )}
                <span className={`block ${viewMode === 'year' ? 'text-lg font-bold text-gray-900' : 'text-xs text-gray-500'}`}>
                    {year}
                </span>
            </div>

            <button 
                onClick={handleNext}
                className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
            >
                <ChevronRight className="h-5 w-5" />
            </button>
        </div>
    );
}
