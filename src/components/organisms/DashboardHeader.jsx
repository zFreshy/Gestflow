import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Typography } from '../atoms/Typography';
import { Search, Bell, Calendar, Plus, X, Menu } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const MONTHS = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export function DashboardHeader({ selectedMonth, onOpenForm, transactions = [], onMenuClick }) {
    const navigate = useNavigate();
    const { getUserEmail } = useAuth();
    const monthName = MONTHS[selectedMonth] || MONTHS[new Date().getMonth()];
    const [searchTerm, setSearchTerm] = useState('');

    const getUserName = () => {
        const email = getUserEmail();
        if (email === 'ecarneirodemelo@gmail.com') return 'Nal';
        if (email === 'esthermenezes90@gmail.com') return 'Esther';
        if (email === 'matheusv090807@gmail.com') return 'Matheus';
        return 'Usuário';
    };

    const gotoCalendar = () => {
        navigate('/calendar');
    };
    const [showResults, setShowResults] = useState(false);
    const searchRef = useRef(null);

    // Filter transactions based on search term
    const filteredTransactions = transactions.filter(t => {
        if (!searchTerm) return false;
        const lowerTerm = searchTerm.toLowerCase();
        return (
            t.description.toLowerCase().includes(lowerTerm) ||
            (t.clientName && t.clientName.toLowerCase().includes(lowerTerm)) ||
            (t.id && t.id.toLowerCase().includes(lowerTerm)) ||
            (t.subtitle && t.subtitle.toLowerCase().includes(lowerTerm))
        );
    });

    // Close search results when clicking outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (searchRef.current && !searchRef.current.contains(event.target)) {
                setShowResults(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [searchRef]);

    const handleSearchChange = (e) => {
        setSearchTerm(e.target.value);
        setShowResults(true);
    };

    const clearSearch = () => {
        setSearchTerm('');
        setShowResults(false);
    };

    return (
        <div className="space-y-6">
            {/* Top Bar Spacer for Mobile */}
            <div className="h-14 md:hidden"></div>

            {/* Top Bar */}
            <header className="fixed top-[-24px] left-0 right-0 z-30 flex items-center justify-between gap-3 bg-gray-50 px-4 py-3 shadow-sm md:shadow-none md:static md:bg-transparent md:p-0">
                {/* Mobile Menu Button */}
                <button 
                    onClick={onMenuClick}
                    className="md:hidden p-2 -ml-2 text-gray-500 hover:bg-gray-100 rounded-lg shrink-0"
                >
                    <Menu className="h-6 w-6" />
                </button>

                {/* Search Bar - now left aligned since logo is in sidebar */}
                <div className="flex-1 max-w-lg relative" ref={searchRef}>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Buscar..."
                            value={searchTerm}
                            onChange={handleSearchChange}
                            onFocus={() => setShowResults(true)}
                            className="w-full h-11 pl-10 pr-10 rounded-xl bg-gray-50 border-transparent text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#7E1A8B]/20 focus:border-[#7E1A8B]/50 transition-all font-medium"
                        />
                        {searchTerm && (
                            <button 
                                onClick={clearSearch}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>

                    {/* Dropdown Search Results */}
                    {showResults && searchTerm && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-lg border border-gray-100 max-h-96 overflow-y-auto z-50">
                            {filteredTransactions.length > 0 ? (
                                <div className="py-2">
                                    <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                        Resultados ({filteredTransactions.length})
                                    </div>
                                    {filteredTransactions.map((transaction) => (
                                        <div 
                                            key={transaction.id}
                                            className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-50 last:border-0 flex items-center justify-between group transition-colors"
                                        >
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium text-gray-900 group-hover:text-[#7E1A8B] transition-colors">
                                                    {transaction.description}
                                                </span>
                                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                                    <span>{transaction.date}</span>
                                                    {transaction.subtitle && (
                                                        <>
                                                            <span>•</span>
                                                            <span>{transaction.subtitle}</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end">
                                                <span className={`text-sm font-semibold ${
                                                    transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                                                }`}>
                                                    {transaction.type === 'income' ? '+' : '-'} 
                                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(transaction.amount)}
                                                </span>
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                                                    transaction.status === 'Liberado' 
                                                        ? 'bg-green-100 text-green-700' 
                                                        : transaction.status === 'Aguardando'
                                                            ? 'bg-yellow-100 text-yellow-700'
                                                            : 'bg-red-100 text-red-700'
                                                }`}>
                                                    {transaction.status}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-8 text-center text-gray-500 text-sm">
                                    Nenhuma transação encontrada para "{searchTerm}"
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Right Icons */}
                <div className="flex items-center gap-2 md:gap-3 shrink-0">
                    <button onClick={() => gotoCalendar()} className="h-10 w-10 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors">
                        <Calendar className="h-5 w-5" />
                    </button>
                    <button className="h-10 w-10 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors relative">
                        <Bell className="h-5 w-5" />
                        <div className="absolute top-2 right-2.5 h-2 w-2 bg-red-500 rounded-full border-2 border-white"></div>
                    </button>
                </div>
            </header>

            {/* Welcome Banner */}
            <div className="flex flex-col md:flex-row md:items-center justify-between p-6 rounded-3xl bg-gradient-to-br from-[#7E1A8B]/5 via-[#7E1A8B]/[0.02] to-transparent border border-[#7E1A8B]/10 gap-4 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-gradient-to-br from-[#7E1A8B]/20 to-[#7E1A8B]/5 rounded-full blur-3xl" />
                <div className="absolute bottom-0 left-10 -mb-4 w-24 h-24 bg-gradient-to-tr from-blue-500/10 to-transparent rounded-full blur-2xl" />
                
                <div className="relative z-10">
                    <h1 className="text-2xl md:text-[32px] font-bold text-gray-900 tracking-tight flex items-center gap-2 mb-1">
                        Bom dia, <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#7E1A8B] to-purple-500">{getUserName()}!</span> 👋🏼
                    </h1>
                    <div className="flex items-center gap-2 mt-2">
                        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-[#7E1A8B]/10">
                            <Calendar className="h-3.5 w-3.5 text-[#7E1A8B]" />
                        </div>
                        <p className="text-sm md:text-[15px] font-medium text-gray-600">
                            Confira sua agenda de <span onClick={gotoCalendar} className="text-[#7E1A8B] font-semibold cursor-pointer hover:text-purple-700 transition-colors underline decoration-[#7E1A8B]/30 underline-offset-2">{monthName}</span>.
                        </p>
                    </div>
                </div>
                <button
                    onClick={onOpenForm}
                    className="relative z-10 w-full md:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-[#7E1A8B] to-purple-600 text-white px-8 py-3.5 rounded-2xl font-semibold text-[15px] hover:shadow-lg hover:shadow-purple-500/25 transition-all duration-300 active:scale-[0.98] group overflow-hidden"
                >
                    <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-in-out" />
                    <Plus className="h-5 w-5 relative z-10" />
                    <span className="relative z-10">Adicionar Transação</span>
                </button>
            </div>
        </div>
    );
}
