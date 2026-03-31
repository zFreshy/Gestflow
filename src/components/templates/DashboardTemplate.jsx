import React, { useState } from 'react';
import { DashboardHeader } from '../organisms/DashboardHeader';
import { Sidebar } from '../organisms/Sidebar';

export function DashboardTemplate({
    children,
    selectedMonth,
    onOpenForm,
    transactions,
    hideHeader = false
}) {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    return (
        <div className="flex h-screen bg-[#F8FAFC] overflow-hidden font-sans selection:bg-[#7E1A8B]/20">
            {/* Sidebar Left */}
            <Sidebar 
                isOpen={isMobileMenuOpen} 
                onClose={() => setIsMobileMenuOpen(false)} 
            />

            {/* Main Content Right */}
            <main className="flex-1 flex flex-col min-w-0 overflow-y-auto relative">
                {/* Background decorative elements */}
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-400/5 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-blue-400/5 rounded-full blur-3xl pointer-events-none" />

                <div className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-8 pb-4 md:py-8 space-y-6 md:space-y-8 relative z-10">
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
