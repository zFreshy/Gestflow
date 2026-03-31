import React, { useState } from 'react';
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
                    "h-screen bg-white/80 backdrop-blur-xl border-r border-gray-100/50 flex flex-col shrink-0 transition-all duration-300 shadow-[4px_0_24px_-12px_rgba(0,0,0,0.05)]",
                    "fixed md:relative z-50 md:z-auto", // Mobile positioning
                    isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0", // Mobile toggle
                    isCollapsed ? "w-[80px]" : "w-[280px]"
                )}
            >
                {/* Logo */}
                <div className={cn("h-24 flex items-center transition-all justify-between relative", isCollapsed ? "justify-center px-0" : "px-8")}>
                    <div className="absolute inset-0 bg-gradient-to-b from-[#7E1A8B]/5 to-transparent pointer-events-none" />
                    <span className={cn(
                        "font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-[#7E1A8B] to-purple-600 transition-all relative z-10",
                        isCollapsed ? "text-2xl" : "text-3xl"
                    )}>
                        {isCollapsed ? 'G' : 'Gestflow'}
                    </span>
                    
                    {/* Mobile Close Button */}
                    <button 
                        onClick={onClose}
                        className="md:hidden p-2 text-gray-500 hover:bg-gray-100 rounded-lg relative z-10"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>
            
                {/* Navigation */}
                <nav className={cn("flex-1 py-4 space-y-2 overflow-y-auto overflow-x-hidden", isCollapsed ? "px-3" : "px-5")}>
                    {MENU_ITEMS.map((item) => {
                        const Icon = item.icon;
                        const isActive = item.exact 
                            ? location.pathname === item.path
                            : location.pathname === item.path;

                        return (
                            <div key={item.path} className="relative group">
                                {isActive && (
                                    <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-[#7E1A8B] to-purple-500 rounded-r-full shadow-[0_0_8px_rgba(126,26,139,0.5)]" />
                                )}
                                <NavLink
                                    to={item.path}
                                    onClick={() => onClose && onClose()} // Close on navigation on mobile
                                    className={cn(
                                        "w-full flex items-center gap-3.5 rounded-2xl text-[15px] font-semibold transition-all duration-300 relative overflow-hidden",
                                        isCollapsed ? "px-0 justify-center py-3.5" : "px-4 py-3.5",
                                        isActive
                                            ? "text-[#7E1A8B] bg-[#7E1A8B]/[0.08]"
                                            : "text-gray-500 hover:bg-gray-50/80 hover:text-gray-900"
                                    )}
                                    title={isCollapsed ? item.label : undefined}
                                    end={item.exact}
                                >
                                    {isActive && (
                                        <div className="absolute inset-0 bg-gradient-to-r from-white/40 to-transparent" />
                                    )}
                                    <Icon
                                        className={cn(
                                            "h-[22px] w-[22px] shrink-0 transition-transform duration-300 group-hover:scale-110",
                                            isActive
                                                ? "text-[#7E1A8B]"
                                                : "text-gray-400 group-hover:text-gray-600"
                                        )} 
                                    />
                                    {!isCollapsed && <span className="relative z-10">{item.label}</span>}
                                </NavLink>
                            </div>
                        );
                    })}
                </nav>

                {/* Footer with avatar and collapse */}
                <div className={cn("mt-auto transition-all relative", isCollapsed ? "p-4" : "p-6")}>
                    <div className="absolute inset-0 bg-gradient-to-t from-gray-50/80 to-transparent pointer-events-none" />
                    <div className={cn("flex items-center relative z-10", isCollapsed ? "flex-col gap-4" : "justify-between bg-white p-3 rounded-2xl border border-gray-100 shadow-sm")}>
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
                                    className="h-10 w-10 rounded-2xl flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors shadow-sm bg-white border border-gray-100"
                                    title="Sair"
                                >
                                    <LogOut className="h-5 w-5" />
                                </button>
                            )}
                        </div>
                        
                        {!isCollapsed && (
                            <div className="flex flex-col ml-1 flex-1 overflow-hidden">
                                <span className="text-sm font-bold text-gray-900 truncate">{getUserName()}</span>
                                <span className="text-xs text-gray-500 font-medium truncate">Administrador</span>
                            </div>
                        )}

                        <button 
                            onClick={() => setIsCollapsed(!isCollapsed)}
                            className={cn(
                                "hidden md:flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors",
                                isCollapsed ? "h-10 w-10 rounded-2xl bg-white border border-gray-100 shadow-sm mt-2" : "h-8 w-8 rounded-lg hover:bg-gray-100"
                            )}
                        >
                            {isCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-4 w-4" />}
                        </button>
                    </div>
                </div>
            </aside>
        </>
    );
}
