import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { LayoutDashboard, Calendar, Receipt, ChevronLeft, ChevronDown, ChevronRight, FileText } from 'lucide-react';
import { Avatar } from '../atoms/Avatar';

const MENU_ITEMS = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard, exact: true },
    { 
        path: '/transactions', 
        label: 'Transações', 
        icon: Receipt,
        subItems: [
            { path: '/fixed-expenses', label: 'Despesas Fixas', icon: FileText }
        ]
    },
    { path: '/calendar', label: 'Calendário', icon: Calendar },
];

export function Sidebar() {
    const location = useLocation();
    const [expandedItems, setExpandedItems] = useState(['/transactions']);

    const toggleExpand = (path) => {
        setExpandedItems(prev => 
            prev.includes(path) 
                ? prev.filter(p => p !== path) 
                : [...prev, path]
        );
    };

    // Auto-expand if child is active
    useEffect(() => {
        MENU_ITEMS.forEach(item => {
            if (item.subItems) {
                const hasActiveChild = item.subItems.some(sub => sub.path === location.pathname);
                if (hasActiveChild && !expandedItems.includes(item.path)) {
                    setExpandedItems(prev => [...prev, item.path]);
                }
            }
        });
    }, [location.pathname]);

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
                    const hasSubItems = item.subItems && item.subItems.length > 0;
                    const isExpanded = expandedItems.includes(item.path);
                    
                    // Check if parent is active (either exact match or child active)
                    const isActive = item.exact 
                        ? location.pathname === item.path
                        : location.pathname === item.path || (hasSubItems && item.subItems.some(sub => sub.path === location.pathname));

                    return (
                        <div key={item.path}>
                            {hasSubItems ? (
                                <div
                                    className={cn(
                                        "w-full flex items-center justify-between px-4 py-3.5 rounded-xl text-[15px] font-medium transition-all group cursor-pointer",
                                        isActive
                                            ? "bg-[#F3E8F6] text-[#7E1A8B]"
                                            : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                                    )}
                                    onClick={(e) => {
                                        // If clicking the parent itself, we navigate to it
                                        // AND toggle expand
                                        if (e.target.closest('.expand-trigger')) {
                                            e.preventDefault();
                                            toggleExpand(item.path);
                                        }
                                    }}
                                >
                                    <NavLink 
                                        to={item.path}
                                        className="flex items-center gap-3 flex-1"
                                        end={item.exact}
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
                                    </NavLink>
                                    <div 
                                        className="text-gray-400 p-1 hover:bg-gray-100 rounded-md expand-trigger"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            e.preventDefault();
                                            toggleExpand(item.path);
                                        }}
                                    >
                                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                    </div>
                                </div>
                            ) : (
                                <NavLink
                                    to={item.path}
                                    className={({ isActive }) => cn(
                                        "w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-[15px] font-medium transition-all group",
                                        isActive
                                            ? "bg-[#F3E8F6] text-[#7E1A8B]"
                                            : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                                    )}
                                >
                                    <Icon
                                        className={cn(
                                            "h-5 w-5",
                                            // We can't easily access isActive inside className callback for the icon, 
                                            // so we rely on the parent styling or duplication. 
                                            // Actually NavLink exposes isActive.
                                        )} 
                                        // Simplified approach below
                                    />
                                    {item.label}
                                </NavLink>
                            )}
                            
                            {/* Submenu */}
                            {hasSubItems && isExpanded && (
                                <div className="mt-1 ml-4 pl-4 border-l border-gray-100 space-y-1">
                                    {item.subItems.map((subItem) => {
                                        const SubIcon = subItem.icon;
                                        return (
                                            <NavLink
                                                key={subItem.path}
                                                to={subItem.path}
                                                className={({ isActive }) => cn(
                                                    "w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all",
                                                    isActive
                                                        ? "text-[#7E1A8B] bg-[#F3E8F6]/50"
                                                        : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                                                )}
                                            >
                                                {({ isActive }) => (
                                                    <>
                                                        <SubIcon className={cn("h-4 w-4", isActive ? "text-[#7E1A8B]" : "text-gray-400")} />
                                                        {subItem.label}
                                                    </>
                                                )}
                                            </NavLink>
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
