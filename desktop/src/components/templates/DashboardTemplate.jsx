import React from 'react';
import { Sidebar } from '../organisms/Sidebar';
import { UpdateBanner } from '../organisms/UpdateBanner';

export function DashboardTemplate({ children }) {
    return (
        <div className="h-screen flex bg-background overflow-hidden">
            <Sidebar />

            <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto p-8">
                    <div className="max-w-[1600px] mx-auto space-y-6 h-full flex flex-col">
                        <UpdateBanner />
                        <div className="flex-1 min-h-0">
                            {children}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
