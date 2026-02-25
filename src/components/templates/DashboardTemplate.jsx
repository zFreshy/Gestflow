import React from 'react';
import { DashboardHeader } from '../organisms/DashboardHeader';
import { Sidebar } from '../organisms/Sidebar';

export function DashboardTemplate({
    statsSection,
    chartSection,
    listSection,
    formSection,
    selectedMonth,
    onOpenForm,
}) {
    return (
        <div className="flex h-screen bg-gray-50 overflow-hidden font-sans">
            {/* Sidebar Left */}
            <Sidebar />

            {/* Main Content Right */}
            <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
                <div className="flex-1 w-full max-w-7xl mx-auto px-8 py-8 space-y-8">
                    <DashboardHeader
                        selectedMonth={selectedMonth}
                        onOpenForm={onOpenForm}
                    />

                    {/* Stats Row — 3 cards like reference */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {statsSection}
                    </div>

                    {/* Transactions Table — full width */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        {listSection}
                    </div>

                    {/* Modal Form */}
                    {formSection}
                </div>
            </main>
        </div>
    );
}
