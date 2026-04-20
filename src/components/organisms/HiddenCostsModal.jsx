import React from 'react';
import { X, Search, Calendar, DollarSign } from 'lucide-react';

export function HiddenCostsModal({ isOpen, onClose, data }) {
    if (!isOpen || !data) return null;

    // Função local para formatar moeda
    const formatCurrency = (value) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
    };

    // Função local para formatar data (se precisar)
    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        // Se vier YYYY-MM-DD
        if (dateStr.includes('-')) {
            const [y, m, d] = dateStr.split('-');
            return `${d}/${m}/${y}`;
        }
        return dateStr;
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div
                className="modal-content bg-card rounded-2xl shadow-2xl border w-full max-w-lg mx-4 flex flex-col max-h-[85vh]"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 pb-4 border-b shrink-0 bg-rose-50/50 rounded-t-2xl">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-rose-100 text-rose-600 rounded-xl">
                            <Search className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 capitalize">{data.originalName}</h2>
                            <p className="text-sm text-rose-600 font-medium">
                                {data.count} repetições • {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(data.total)}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="h-8 w-8 rounded-lg flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-white/50 transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Body - Lista de Transações */}
                <div className="flex-1 overflow-y-auto p-6 bg-gray-50/30">
                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">
                        Histórico dos últimos 30 dias
                    </h3>
                    
                    <div className="space-y-3">
                        {data.history && data.history.map(tx => (
                            <div key={tx.id} className="bg-white border border-gray-100 p-4 rounded-xl shadow-sm flex justify-between items-center hover:border-rose-100 transition-colors">
                                <div className="flex flex-col gap-1">
                                    <span className="font-semibold text-gray-900">{tx.description}</span>
                                    <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
                                        <Calendar className="w-3.5 h-3.5" />
                                        {formatDate(tx.date)}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className="font-bold text-rose-600 text-base">
                                        -{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(tx.amount)}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
