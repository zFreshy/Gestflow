import React from 'react';
import { cn } from '../../lib/utils';
import { LayoutDashboard, Calendar, Receipt, ChevronLeft } from 'lucide-react';
import { Avatar } from '../atoms/Avatar';

const MENU_ITEMS = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'transactions', label: 'Transações', icon: Receipt },
    { id: 'calendar', label: 'Calendário', icon: Calendar },
];

export function Sidebar({ activeTab, onTabChange }) {
    return (
        <aside className="w-[280px] h-screen bg-white border-r border-gray-100 flex flex-col shrink-0">
            {/* Logo */}
            <div className="h-24 flex items-center px-8">
                <span className="text-3xl font-bold tracking-tight text-[#7E1A8B]">
                    Fornalha
                </span>
            </div>
        
            {/* Navigation */}
            <nav className="flex-1 px-4 py-2 space-y-1.5 overflow-y-auto">
                {MENU_ITEMS.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                        <button
                            key={item.id}
                            onClick={() => onTabChange(item.id)}
                            className={cn(
                                "w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-[15px] font-medium transition-all group",
                                isActive
                                    ? "bg-[#F3E8F6] text-[#7E1A8B]"
                                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                            )}
                        >
                            <Icon
                                className={cn(
                                    "h-5 w-5",
                                    isActive
                                        ? "text-[#7E1A8B]"
                                        : "text-gray-400 group-hover:text-gray-600"
                                )}
                            />
                            {item.label}
                        </button>
                    );
                })}
            </nav>

            {/* Footer with avatar and collapse */}
            <div className="p-6 mt-auto">
                <div className="flex items-center justify-between">
                    <Avatar name="Dr. Fernando" size="md" className="ring-2 ring-white shadow-sm" />
                    <button className="h-8 w-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                        <ChevronLeft className="h-4 w-4" />
                    </button>
                </div>
            </div>
        </aside>
    );
}
