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
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/25">
                        <span className="text-white font-bold text-lg">G</span>
                    </div>
                </div>

                {/* Search Bar */}
                <div className="flex-1 max-w-lg mx-6">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Buscar transação, descrição..."
                            className="w-full h-10 pl-10 pr-4 rounded-xl border bg-card text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                        />
                    </div>
                </div>

                {/* Right Icons */}
                <div className="flex items-center gap-2">
                    <button className="h-10 w-10 rounded-xl border bg-card flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all">
                        <Calendar className="h-4 w-4" />
                    </button>
                    <button className="h-10 w-10 rounded-xl border bg-card flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all relative">
                        <Bell className="h-4 w-4" />
                        <div className="absolute -top-1 -right-1 h-4 w-4 bg-destructive rounded-full flex items-center justify-center">
                            <span className="text-[10px] text-white font-bold">2</span>
                        </div>
                    </button>
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-blue-400 flex items-center justify-center ml-1">
                        <span className="text-white text-sm font-semibold">GN</span>
                    </div>
                </div>
            </header>

            {/* Welcome Banner */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">
                        Bom dia, <span className="text-primary">Nal</span>! 👋
                    </h1>
                    <div className="flex items-center gap-2 mt-1">
                        <Calendar className="h-4 w-4 text-success" />
                        <p className="text-sm text-muted-foreground">
                            Confira seus registros de <span className="font-medium text-foreground">{monthName}</span>.
                        </p>
                    </div>
                </div>
                <button
                    onClick={onOpenForm}
                    className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl font-medium text-sm hover:bg-primary/90 transition-all shadow-lg shadow-primary/25 active:scale-[0.98]"
                >
                    <Plus className="h-4 w-4" />
                    Nova Transação
                </button>
            </div>
        </div>
    );
}
