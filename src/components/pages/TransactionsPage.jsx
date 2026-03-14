import React, { useState } from 'react';
import { TransactionList } from '../organisms/TransactionList';
import { MonthSelector } from '../molecules/MonthSelector';
import { cn } from '../../lib/utils';

export function TransactionsPage({ transactions, onEdit, onDelete }) {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [viewMode, setViewMode] = useState('month'); // 'month' | 'year'

    // Filter transactions by selected month or year
    const filteredTransactions = transactions.filter(t => {
        if (!t.date) return false;
        // Parse DD/MM/YYYY
        const [day, month, year] = t.date.split('/');
        const tDate = new Date(year, month - 1, day);
        
        const sameYear = tDate.getFullYear() === currentMonth.getFullYear();

        if (viewMode === 'year') {
            return sameYear;
        }

        return sameYear && tDate.getMonth() === currentMonth.getMonth();
    });

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Transações</h2>
                    <p className="text-sm text-gray-500 mt-1">Gerencie todos os seus registros financeiros.</p>
                </div>
                
                <div className="flex items-center gap-2">
                    <div className="bg-gray-100 p-1 rounded-lg flex items-center">
                        <button
                            onClick={() => setViewMode('month')}
                            className={cn(
                                "px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                                viewMode === 'month' 
                                    ? "bg-white text-gray-900 shadow-sm" 
                                    : "text-gray-500 hover:text-gray-900"
                            )}
                        >
                            Mensal
                        </button>
                        <button
                            onClick={() => setViewMode('year')}
                            className={cn(
                                "px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                                viewMode === 'year' 
                                    ? "bg-white text-gray-900 shadow-sm" 
                                    : "text-gray-500 hover:text-gray-900"
                            )}
                        >
                            Anual
                        </button>
                    </div>
                    <MonthSelector currentDate={currentMonth} onMonthChange={setCurrentMonth} viewMode={viewMode} />
                </div>
            </div>

            {/* Transactions Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <TransactionList 
                    transactions={filteredTransactions} 
                    onEdit={onEdit} 
                    onDelete={onDelete}
                    viewMode={viewMode}
                />
            </div>
        </div>
    );
}
