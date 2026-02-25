import React from 'react';
import { TransactionList } from '../organisms/TransactionList';

export function TransactionsPage({ transactions }) {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Transações</h2>
                    <p className="text-sm text-gray-500 mt-1">Gerencie todos os seus registros financeiros e exames.</p>
                </div>
            </div>

            {/* Transactions Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <TransactionList transactions={transactions} />
            </div>
        </div>
    );
}
