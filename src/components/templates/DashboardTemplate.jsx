import React, { useState } from 'react';
import { DashboardHeader } from '../organisms/DashboardHeader';
import { Sidebar } from '../organisms/Sidebar';

export function DashboardTemplate({
    children,
    selectedMonth,
    onOpenForm,
    transactions,
    title,
    hideHeader = false
}) {
    return (
        <div className="flex h-screen bg-gray-50 overflow-hidden font-sans">
            {/* Sidebar Left */}
            <Sidebar />

            {/* Main Content Right */}
            <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
                <div className="flex-1 w-full max-w-7xl mx-auto px-8 py-8 space-y-8">
                    {!hideHeader && (
                        <DashboardHeader
                            selectedMonth={selectedMonth}
                            onOpenForm={onOpenForm}
                            transactions={transactions}
                        />
                    )}

                    {/* Page Content */}
                    {children}
                </div>
            </main>
        </div>
    );
}
