import React from 'react';
import { DashboardHeader } from '../organisms/DashboardHeader';

export function DashboardTemplate({ statsSection, chartSection, formSection, listSection }) {
    return (
        <div className="min-h-screen bg-background p-4 md:p-8 flex justify-center">
            <div className="w-full max-w-6xl space-y-6">
                <DashboardHeader />

                {/* Stats Row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {statsSection}
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Form + List Side (1 col on lg screen) */}
                    <div className="space-y-6 lg:col-span-1">
                        {formSection}
                        {listSection}
                    </div>

                    {/* Chart Side (2 cols on lg screen) */}
                    <div className="lg:col-span-2">
                        {chartSection}
                    </div>
                </div>
            </div>
        </div>
    );
}
