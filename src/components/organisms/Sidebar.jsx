import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { LayoutDashboard, Calendar, Receipt, ChevronLeft, ChevronRight, ChevronDown, FileText, LogOut } from 'lucide-react';
import { Avatar } from '../atoms/Avatar';
import { useAuth } from '../../contexts/AuthContext';

const MENU_ITEMS = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard, exact: true },
    { path: '/transactions', label: 'Transações', icon: Receipt },
    { path: '/fixed-expenses', label: 'Despesas Fixas', icon: FileText },
    { path: '/calendar', label: 'Calendário', icon: Calendar },
];

export function Sidebar() {
    const location = useLocation();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const { signOut } = useAuth();

    const handleLogout = async () => {
        try {
            await signOut();
        } catch (error) {
            console.error('Error logging out:', error);
        }
    };

    return (
        <aside 
            className={cn(
                "h-screen bg-white border-r border-gray-100 flex flex-col shrink-0 transition-all duration-300",
                isCollapsed ? "w-[80px]" : "w-[280px]"
            )}
        >
            {/* Logo */}
            <div className={cn("h-24 flex items-center transition-all", isCollapsed ? "justify-center px-0" : "px-8")}>
                <span className={cn(
                    "font-bold tracking-tight text-[#7E1A8B] transition-all",
                    isCollapsed ? "text-xl" : "text-3xl"
                )}>
                    {isCollapsed ? 'F' : 'Fornalha'}
                </span>
            </div>
        
            {/* Navigation */}
            <nav className={cn("flex-1 py-2 space-y-1.5 overflow-y-auto overflow-x-hidden", isCollapsed ? "px-2" : "px-4")}>
                {MENU_ITEMS.map((item) => {
                    const Icon = item.icon;
                    const isActive = item.exact 
                        ? location.pathname === item.path
                        : location.pathname === item.path;

                    return (
                        <div key={item.path}>
                            <NavLink
                                to={item.path}
                                className={cn(
                                    "w-full flex items-center gap-3 rounded-xl text-[15px] font-medium transition-all group",
                                    isCollapsed ? "px-0 justify-center py-3" : "px-4 py-3.5",
                                    isActive
                                        ? "bg-[#F3E8F6] text-[#7E1A8B]"
                                        : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                                )}
                                title={isCollapsed ? item.label : undefined}
                                end={item.exact}
                            >
                                <Icon
                                    className={cn(
                                        "h-5 w-5 shrink-0",
                                        isActive
                                            ? "text-[#7E1A8B]"
                                            : "text-gray-400 group-hover:text-gray-600"
                                    )} 
                                />
                                {!isCollapsed && item.label}
                            </NavLink>
                        </div>
                    );
                })}
            </nav>

            {/* Footer with avatar and collapse */}
            <div className={cn("mt-auto transition-all", isCollapsed ? "p-4" : "p-6")}>
                <div className={cn("flex items-center", isCollapsed ? "flex-col gap-4" : "justify-between")}>
                    <div className={cn("flex items-center gap-3", isCollapsed ? "flex-col" : "")}>
                        <Avatar name="Nal" size="md" className="ring-2 ring-white shadow-sm" />
                        
                        {!isCollapsed && (
                            <button 
                                onClick={handleLogout}
                                className="h-8 w-8 rounded-full flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                title="Sair"
                            >
                                <LogOut className="h-4 w-4" />
                            </button>
                        )}
                        {isCollapsed && (
                             <button 
                                onClick={handleLogout}
                                className="h-8 w-8 rounded-full flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                title="Sair"
                            >
                                <LogOut className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                    
                    <button 
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className="h-8 w-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                    >
                        {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                    </button>
                </div>
            </div>
        </aside>
    );
}
