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
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    return (
        <div className="flex h-screen bg-gray-50 overflow-hidden font-sans">
            {/* Sidebar Left */}
            <Sidebar 
                isOpen={isMobileMenuOpen} 
                onClose={() => setIsMobileMenuOpen(false)} 
            />

            {/* Main Content Right */}
            <main className="flex-1 flex flex-col min-w-0 overflow-y-auto relative">
                <div className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-8 pb-4 md:py-8 space-y-6 md:space-y-8">
                    {!hideHeader && (
                        <DashboardHeader
                            selectedMonth={selectedMonth}
                            onOpenForm={onOpenForm}
                            transactions={transactions}
                            onMenuClick={() => setIsMobileMenuOpen(true)}
                        />
                    )}
                    
                    {/* Mobile Menu Button if header is hidden? 
                        Usually if header is hidden, it's a full screen view like Calendar.
                        We might need a floating button or just rely on the page's own header.
                        For now, let's assume pages with hideHeader handle their own nav or don't need it.
                    */}

                    {/* Page Content */}
                    {children}
                </div>
            </main>
        </div>
    );
}
