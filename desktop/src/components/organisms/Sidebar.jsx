import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { cn, STORE_INITIALS } from '../../lib/utils';
import {
    LayoutDashboard, ScanBarcode, Package, PackagePlus,
    Receipt, NotebookPen, ShoppingBasket, Users, Wallet, FileText,
    ChevronLeft, ChevronRight, LogOut, CloudOff, RefreshCw, Cloud,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useProfile } from '../../contexts/ProfileContext';
import { useConnection } from '../../contexts/ConnectionContext';
import { ProfileSwitcher } from './ProfileSwitcher';
import { PendingSalesModal } from './PendingSalesModal';

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
    // Abrir, sangrar e conferir caixa é mexer em dinheiro fora da venda — o
    // banco só aceita do administrador. O funcionário continua vendendo, e as
    // vendas dele entram no turno aberto sozinhas.
    { path: '/caixa', label: 'Caixa', icon: Wallet, adminOnly: true },
    // Receber pagamento de fiado é mexer em dinheiro que entrou — o banco só
    // aceita do administrador. O funcionário ainda vende fiado no PDV, onde
    // escolhe ou cadastra o cliente.
    { path: '/fiado', label: 'Fiado', icon: NotebookPen, adminOnly: true },
    // Histórico mostra faturamento e lucro — o banco nem devolve essas linhas
    // para o funcionário, então a tela viria vazia de qualquer forma.
    { path: '/vendas', label: 'Histórico', icon: Receipt, adminOnly: true },
    { path: '/meu-credito', label: 'Meu crédito', icon: ShoppingBasket, employeeOnly: true },
    { path: '/creditos', label: 'Crédito da loja', icon: ShoppingBasket, adminOnly: true },
    { path: '/perfis', label: 'Perfis', icon: Users, adminOnly: true },
    { path: '/fiscal', label: 'Nota e equipamentos', icon: FileText, adminOnly: true },
];

export function Sidebar() {
    const location = useLocation();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [pendingOpen, setPendingOpen] = useState(false);
    const { signOut } = useAuth();
    const { isAdmin } = useProfile();
    const { online, syncing, pendingCount, blockedCount } = useConnection();

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
                {/* Em duas linhas: "Mercadinho da Família" numa linha só ficaria
                    minúsculo para caber na largura da barra. Quebrado assim, o
                    nome grande continua grande e o complemento vira assinatura. */}
                {isCollapsed ? (
                    <span className="text-2xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-[#7E1A8B] to-purple-600 relative z-10">
                        {STORE_INITIALS}
                    </span>
                ) : (
                    <div className="relative z-10 leading-none">
                        <span className="block text-[28px] font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-[#7E1A8B] to-purple-600">
                            Mercadinho
                        </span>
                        <span className="block mt-1 text-[11px] font-bold uppercase tracking-[0.28em] text-[#7E1A8B]/55">
                            da Família
                        </span>
                    </div>
                )}
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

                {/* Estado da conexão.
                    Fica visível o tempo todo quando algo está fora do normal:
                    o operador precisa saber que está vendendo offline ANTES de
                    prometer nota fiscal ao cliente, e não depois. */}
                {(!online || pendingCount > 0 || blockedCount > 0) && (
                    <button
                        onClick={() => setPendingOpen(true)}
                        className={cn(
                            "relative z-10 w-full mb-3 rounded-xl border p-2.5 flex items-center gap-2.5 transition-colors text-left",
                            blockedCount > 0
                                ? "bg-red-50 border-red-200 hover:bg-red-100"
                                : !online
                                    ? "bg-amber-50 border-amber-200 hover:bg-amber-100"
                                    : "bg-blue-50 border-blue-200 hover:bg-blue-100"
                        )}
                        title="Ver as vendas que ainda não subiram"
                    >
                        {syncing ? (
                            <RefreshCw className="h-4 w-4 shrink-0 animate-spin text-blue-600" />
                        ) : !online ? (
                            <CloudOff className="h-4 w-4 shrink-0 text-amber-600" />
                        ) : (
                            <Cloud className="h-4 w-4 shrink-0 text-blue-600" />
                        )}

                        {!isCollapsed && (
                            <div className="min-w-0">
                                <p className={cn(
                                    "text-xs font-bold",
                                    blockedCount > 0 ? "text-red-800"
                                        : !online ? "text-amber-800" : "text-blue-800"
                                )}>
                                    {!online ? 'Sem internet' : syncing ? 'Enviando...' : 'Vendas na fila'}
                                </p>
                                <p className={cn(
                                    "text-[11px] leading-tight",
                                    blockedCount > 0 ? "text-red-600"
                                        : !online ? "text-amber-700" : "text-blue-700"
                                )}>
                                    {blockedCount > 0
                                        ? `${blockedCount} recusada${blockedCount > 1 ? 's' : ''} pelo servidor`
                                        : pendingCount > 0
                                            ? `${pendingCount} venda${pendingCount > 1 ? 's' : ''} aguardando`
                                            : 'Continua vendendo normalmente'}
                                </p>
                            </div>
                        )}
                    </button>
                )}

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

            <PendingSalesModal isOpen={pendingOpen} onClose={() => setPendingOpen(false)} />
        </aside>
    );
}
