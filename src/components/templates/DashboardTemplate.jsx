import React from 'react';
import { DashboardHeader } from '../organisms/DashboardHeader';
import { MonthFilter } from '../molecules/MonthFilter';

export function DashboardTemplate({
    statsSection,
    chartSection,
    listSection,
    formSection,
    selectedMonth,
    selectedYear,
    onMonthChange,
    onYearChange,
    onOpenForm,
}) {
    return (
        <div className="min-h-screen bg-background">
            <div className="w-full max-w-7xl mx-auto px-4 md:px-8 py-6 space-y-6">
                <DashboardHeader
                    selectedMonth={selectedMonth}
                    onOpenForm={onOpenForm}
                />

                {/* Month Filter */}
                <MonthFilter
                    selectedMonth={selectedMonth}
                    selectedYear={selectedYear}
                    onMonthChange={onMonthChange}
                    onYearChange={onYearChange}
                />

                {/* Stats Row — 3 cards like reference */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    {statsSection}
                </div>

                {/* Transactions Table — full width */}
                {listSection}

                {/* Chart below table */}
                {chartSection}

                {/* Modal Form */}
                {formSection}
            </div>
        </div>
    );
}
