import React from 'react';
import { Typography } from '../atoms/Typography';
import { Search, Bell, Calendar, Plus } from 'lucide-react';

const MONTHS = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export function DashboardHeader({ selectedMonth, onOpenForm }) {
    const monthName = MONTHS[selectedMonth] || MONTHS[new Date().getMonth()];

    return (
        <div className="space-y-6">
            {/* Top Bar */}
            <header className="flex items-center justify-between">
                {/* Search Bar - now left aligned since logo is in sidebar */}
                <div className="flex-1 max-w-lg">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Buscar por CPF, Nome ou Telefone"
                            className="w-full h-11 pl-10 pr-4 rounded-xl bg-gray-50 border-transparent text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#7E1A8B]/20 focus:border-[#7E1A8B]/50 transition-all font-medium"
                        />
                    </div>
                </div>

                {/* Right Icons */}
                <div className="flex items-center gap-3">
                    <button className="h-10 w-10 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors">
                        <Calendar className="h-5 w-5" />
                    </button>
                    <button className="h-10 w-10 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors relative">
                        <Bell className="h-5 w-5" />
                        <div className="absolute top-2 right-2.5 h-2 w-2 bg-red-500 rounded-full border-2 border-white"></div>
                    </button>
                </div>
            </header>

            {/* Welcome Banner */}
            <div className="flex items-center justify-between pt-2">
                <div>
                    <h1 className="text-[28px] font-semibold text-gray-900 tracking-tight flex items-center gap-2">
                        Bom dia, <span className="font-bold">Nal!</span> 👋🏼
                    </h1>
                    <div className="flex items-center gap-2 mt-1.5">
                        <Calendar className="h-4 w-4 text-[#7E1A8B]" />
                        <p className="text-[15px] font-medium text-gray-500">
                            Confira sua agenda de <span className="text-[#7E1A8B] cursor-pointer hover:underline">{monthName}</span>.
                        </p>
                    </div>
                </div>
                <button
                    onClick={onOpenForm}
                    className="flex items-center gap-2 bg-blue-500 text-white px-6 py-2.5 rounded-xl font-medium text-sm hover:bg-blue-600 transition-all shadow-md active:scale-[0.98]"
                >
                    <Plus className="h-4 w-4" />
                    Adicionar Transação
                </button>
            </div>
        </div>
    );
}
