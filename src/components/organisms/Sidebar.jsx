import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { LayoutDashboard, Calendar, Receipt, ChevronLeft, ChevronRight, ChevronDown, FileText, LogOut, X } from 'lucide-react';
import { Avatar } from '../atoms/Avatar';
import { useAuth } from '../../contexts/AuthContext';

const MENU_ITEMS = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard, exact: true },
    { path: '/transactions', label: 'Transações', icon: Receipt },
    { path: '/fixed-expenses', label: 'Despesas Fixas', icon: FileText },
    { path: '/calendar', label: 'Calendário', icon: Calendar },
];

export function Sidebar({ isOpen, onClose }) {
    const location = useLocation();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const { signOut, getUserEmail } = useAuth();

    const getUserName = () => {
        const email = getUserEmail();
        if (email === 'ecarneirodemelo@gmail.com') return 'Nal';
        if (email === 'esthermenezes90@gmail.com') return 'Esther';
        if (email === 'matheusv090807@gmail.com') return 'Matheus';
        return 'Usuário';
    };

    const handleLogout = async () => {
        try {
            await signOut();
        } catch (error) {
            console.error('Error logging out:', error);
        }
    };

    return (
        <>
            {/* Mobile Overlay */}
            {isOpen && (
                <div 
                    className="fixed inset-0 bg-black/50 z-40 md:hidden"
                    onClick={onClose}
                />
            )}

            <aside 
                className={cn(
                    "h-screen bg-white border-r border-gray-100 flex flex-col shrink-0 transition-all duration-300",
                    "fixed md:relative z-50 md:z-auto", // Mobile positioning
                    isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0", // Mobile toggle
                    isCollapsed ? "w-[80px]" : "w-[280px]"
                )}
            >
                {/* Logo */}
                <div className={cn("h-24 flex items-center transition-all justify-between", isCollapsed ? "justify-center px-0" : "px-8")}>
                    <span className={cn(
                        "font-bold tracking-tight text-[#7E1A8B] transition-all",
                        isCollapsed ? "text-xl" : "text-3xl"
                    )}>
                        {isCollapsed ? 'G' : 'Gestflow'}
                    </span>
                    
                    {/* Mobile Close Button */}
                    <button 
                        onClick={onClose}
                        className="md:hidden p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                    >
                        <X className="h-5 w-5" />
                    </button>
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
                                    onClick={() => onClose && onClose()} // Close on navigation on mobile
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
                            <Avatar name={getUserName()} size="md" className="ring-2 ring-white shadow-sm" />
                            
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
                        
                        {!isCollapsed && (
                            <div className="flex flex-col">
                                <span className="text-sm font-bold text-gray-900">{getUserName()}</span>
                                <span className="text-xs text-gray-500 font-medium">Administrador</span>
                            </div>
                        )}

                        <button 
                            onClick={() => setIsCollapsed(!isCollapsed)}
                            className="hidden md:flex h-8 w-8 items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"
                        >
                            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                        </button>
                    </div>
                </div>
            </aside>
        </>
    );
}
