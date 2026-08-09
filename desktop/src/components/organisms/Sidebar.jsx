import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '../../lib/utils';
import {
    LayoutDashboard, ScanBarcode, Package, PackagePlus,
    Receipt, NotebookPen, ShoppingBasket, Users,
    ChevronLeft, ChevronRight, LogOut,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useProfile } from '../../contexts/ProfileContext';
import { ProfileSwitcher } from './ProfileSwitcher';

/**
 * `adminOnly` esconde o que é financeiro do funcionário.
 * `employeeOnly` é a parte que só faz sentido dentro de um perfil pessoal.
 */
const MENU_ITEMS = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard, exact: true, adminOnly: true },
    { path: '/venda', label: 'Venda (PDV)', icon: ScanBarcode },
    { path: '/produtos', label: 'Produtos', icon: Package },
    // Estoque fica só com o admin: dar entrada exige digitar o custo de compra,
    // que é exatamente o que o funcionário não deve ver.
    { path: '/estoque', label: 'Estoque', icon: PackagePlus, adminOnly: true },
    { path: '/fiado', label: 'Fiado', icon: NotebookPen },
    // Histórico mostra faturamento e lucro — o banco nem devolve essas linhas
    // para o funcionário, então a tela viria vazia de qualquer forma.
    { path: '/vendas', label: 'Histórico', icon: Receipt, adminOnly: true },
    { path: '/meu-credito', label: 'Meu crédito', icon: ShoppingBasket, employeeOnly: true },
    { path: '/creditos', label: 'Crédito da loja', icon: ShoppingBasket, adminOnly: true },
    { path: '/perfis', label: 'Perfis', icon: Users, adminOnly: true },
];

export function Sidebar() {
    const location = useLocation();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const { signOut } = useAuth();
    const { isAdmin } = useProfile();

    const items = MENU_ITEMS.filter((item) => {
        if (item.adminOnly && !isAdmin) return false;
        if (item.employeeOnly && isAdmin) return false;
        return true;
    });

    const handleLogout = async () => {
        try {
            await signOut();
        } catch (error) {
            console.error('Erro ao sair:', error);
        }
    };

    return (
        <aside
            className={cn(
                "h-screen bg-white/80 backdrop-blur-xl border-r border-gray-100/50 flex flex-col shrink-0 transition-all duration-300 shadow-[4px_0_24px_-12px_rgba(0,0,0,0.05)] relative",
                isCollapsed ? "w-[80px]" : "w-[280px]"
            )}
        >
            {/* Logo */}
            <div className={cn("h-24 flex items-center transition-all relative", isCollapsed ? "justify-center px-0" : "px-8")}>
                <div className="absolute inset-0 bg-gradient-to-b from-[#7E1A8B]/5 to-transparent pointer-events-none" />
                <span className={cn(
                    "font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-[#7E1A8B] to-purple-600 transition-all relative z-10",
                    isCollapsed ? "text-2xl" : "text-3xl"
                )}>
                    {isCollapsed ? 'M' : 'Mercadinho'}
                </span>
            </div>

            {/* Navegação */}
            <nav className={cn("flex-1 py-4 space-y-2 overflow-y-auto overflow-x-hidden", isCollapsed ? "px-3" : "px-5")}>
                {items.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;

                    return (
                        <div key={item.path} className="relative group">
                            {isActive && (
                                <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-[#7E1A8B] to-purple-500 rounded-r-full shadow-[0_0_8px_rgba(126,26,139,0.5)]" />
                            )}
                            <NavLink
                                to={item.path}
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
                                        isActive ? "text-[#7E1A8B]" : "text-gray-400 group-hover:text-gray-600"
                                    )}
                                />
                                {!isCollapsed && <span className="relative z-10">{item.label}</span>}
                            </NavLink>
                        </div>
                    );
                })}
            </nav>

            {/* Rodapé: perfil ativo */}
            <div className={cn("mt-auto transition-all relative", isCollapsed ? "p-4" : "p-5")}>
                <div className="absolute inset-0 bg-gradient-to-t from-gray-50/80 to-transparent pointer-events-none" />

                <ProfileSwitcher collapsed={isCollapsed} />

                <div className={cn(
                    "flex items-center relative z-10 mt-3",
                    isCollapsed ? "flex-col gap-2" : "justify-between"
                )}>
                    <button
                        onClick={handleLogout}
                        className={cn(
                            "flex items-center justify-center gap-2 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors rounded-lg",
                            isCollapsed ? "h-9 w-9" : "h-8 px-2 text-xs font-semibold"
                        )}
                        title="Sair da conta"
                    >
                        <LogOut className="h-4 w-4" />
                        {!isCollapsed && 'Sair da conta'}
                    </button>

                    <button
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className={cn(
                            "flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors rounded-lg",
                            isCollapsed ? "h-9 w-9" : "h-8 w-8"
                        )}
                    >
                        {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                    </button>
                </div>
            </div>
        </aside>
    );
}
