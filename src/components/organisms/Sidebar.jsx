import React, { useState } from 'react';
import { cn } from '../../lib/utils';
import { LayoutDashboard, Calendar, Receipt, ChevronLeft, ChevronDown, ChevronRight, FileText } from 'lucide-react';
import { Avatar } from '../atoms/Avatar';

const MENU_ITEMS = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { 
        id: 'transactions', 
        label: 'Transações', 
        icon: Receipt,
        subItems: [
            { id: 'fixed-expenses', label: 'Despesas Fixas', icon: FileText }
        ]
    },
    { id: 'calendar', label: 'Calendário', icon: Calendar },
];

export function Sidebar({ activeTab, onTabChange }) {
    const [expandedItems, setExpandedItems] = useState(['transactions']);

    const toggleExpand = (itemId) => {
        setExpandedItems(prev => 
            prev.includes(itemId) 
                ? prev.filter(id => id !== itemId) 
                : [...prev, itemId]
        );
    };

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
                    const hasSubItems = item.subItems && item.subItems.length > 0;
                    const isExpanded = expandedItems.includes(item.id);
                    const isChildActive = hasSubItems && item.subItems.some(sub => sub.id === activeTab);

                    return (
                        <div key={item.id}>
                            <button
                                onClick={() => {
                                    onTabChange(item.id);
                                    if (hasSubItems && !isExpanded) {
                                        toggleExpand(item.id);
                                    }
                                }}
                                className={cn(
                                    "w-full flex items-center justify-between px-4 py-3.5 rounded-xl text-[15px] font-medium transition-all group",
                                    isActive || isChildActive
                                        ? "bg-[#F3E8F6] text-[#7E1A8B]"
                                        : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                                )}
                            >
                                <div className="flex items-center gap-3">
                                    <Icon
                                        className={cn(
                                            "h-5 w-5",
                                            isActive || isChildActive
                                                ? "text-[#7E1A8B]"
                                                : "text-gray-400 group-hover:text-gray-600"
                                        )}
                                    />
                                    {item.label}
                                </div>
                                {hasSubItems && (
                                    <div className="text-gray-400">
                                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                    </div>
                                )}
                            </button>
                            
                            {/* Submenu */}
                            {hasSubItems && isExpanded && (
                                <div className="mt-1 ml-4 pl-4 border-l border-gray-100 space-y-1">
                                    {item.subItems.map((subItem) => {
                                        const SubIcon = subItem.icon;
                                        const isSubActive = activeTab === subItem.id;
                                        
                                        return (
                                            <button
                                                key={subItem.id}
                                                onClick={() => onTabChange(subItem.id)}
                                                className={cn(
                                                    "w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all",
                                                    isSubActive
                                                        ? "text-[#7E1A8B] bg-[#F3E8F6]/50"
                                                        : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                                                )}
                                            >
                                                <SubIcon className={cn("h-4 w-4", isSubActive ? "text-[#7E1A8B]" : "text-gray-400")} />
                                                {subItem.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </nav>

            {/* Footer with avatar and collapse */}
            <div className="p-6 mt-auto">
                <div className="flex items-center justify-between">
                    <Avatar name="Nal" size="md" className="ring-2 ring-white shadow-sm" />
                    <button className="h-8 w-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                        <ChevronLeft className="h-4 w-4" />
                    </button>
                </div>
            </div>
        </aside>
    );
}
