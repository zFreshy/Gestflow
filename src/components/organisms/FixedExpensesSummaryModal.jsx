import React, { useMemo, useState } from 'react';
import { X, FileText, CheckCircle, Clock, ChevronRight, ArrowLeft } from 'lucide-react';
import { cn } from '../../lib/utils';

export function FixedExpensesSummaryModal({ isOpen, onClose, transactions }) {
    const [selectedGroup, setSelectedGroup] = useState(null);

    const isPaid = (status) => ['Pago', 'Liberado'].includes(status);

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value);
    };

    const parseDate = (dateStr) => {
        if (!dateStr) return new Date(0);
        if (dateStr.includes('-')) {
            const [year, month, day] = dateStr.split('-');
            return new Date(year, month - 1, day);
        }
        if (dateStr.includes('/')) {
            const [day, month, year] = dateStr.split('/');
            return new Date(year, month - 1, day);
        }
        return new Date(0);
    };

    const summaryData = useMemo(() => {
        const groups = {};

        transactions
            .filter(t => t.type === 'expense' && t.expenseType === 'fixed')
            .forEach(t => {
                if (!groups[t.description]) {
                    groups[t.description] = {
                        description: t.description,
                        paidCount: 0,
                        paidAmount: 0,
                        pendingCount: 0,
                        pendingAmount: 0,
                        isPlannedOrParceled: !!t.installments,
                        totalInstallments: t.installments || null,
                        recurrence: t.recurrence,
                        hasEndDate: !!t.end_date,
                        endDate: t.end_date,
                        items: []
                    };
                }

                groups[t.description].items.push(t);

                if (isPaid(t.status)) {
                    groups[t.description].paidCount += 1;
                    groups[t.description].paidAmount += t.amount;
                } else {
                    groups[t.description].pendingCount += 1;
                    groups[t.description].pendingAmount += t.amount;
                }
            });

        return Object.values(groups).sort((a, b) => b.paidAmount - a.paidAmount);
    }, [transactions]);

    const handleClose = () => {
        setSelectedGroup(null);
        onClose();
    };

    if (!isOpen) return null;

    const renderList = () => (
        <div className="grid gap-3">
            {summaryData.map((item, idx) => (
                <button 
                    key={idx} 
                    onClick={() => setSelectedGroup(item)}
                    className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between gap-4 hover:border-purple-200 hover:shadow-md transition-all text-left w-full group"
                >
                    <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-full bg-purple-50 flex items-center justify-center text-purple-600 group-hover:bg-purple-100 transition-colors">
                            <FileText className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-gray-900">{item.description}</h3>
                            <div className="text-sm text-gray-500 flex items-center gap-2 mt-0.5">
                                {item.isPlannedOrParceled ? (
                                    <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                                        Planejada/Parcelada
                                    </span>
                                ) : (
                                    <span className="text-[10px] bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full font-medium">
                                        Recorrente
                                    </span>
                                )}
                                <span>•</span>
                                <span>Total: {formatCurrency(item.paidAmount + item.pendingAmount)}</span>
                            </div>
                        </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-purple-500 transition-colors" />
                </button>
            ))}
        </div>
    );

    const renderDetail = () => {
        if (!selectedGroup) return null;

        // Sort items by date
        const sortedItems = [...selectedGroup.items].sort((a, b) => parseDate(a.date) - parseDate(b.date));
        
        // Find next pending
        const nextPending = sortedItems.find(t => !isPaid(t.status));
        let daysToNext = null;
        
        if (nextPending) {
            const nextDate = parseDate(nextPending.date);
            const today = new Date();
            today.setHours(0,0,0,0);
            const diffTime = nextDate - today;
            daysToNext = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        }

        return (
            <div className="animate-in slide-in-from-right-4 duration-200">
                {/* Header Detail */}
                <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-gray-900">{selectedGroup.description}</h3>
                        {selectedGroup.isPlannedOrParceled && (
                            <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                                Planejada/Parcelada ({selectedGroup.paidCount}/{selectedGroup.totalInstallments})
                            </span>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-emerald-50/50 p-4 rounded-lg border border-emerald-100">
                            <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium mb-1">
                                <CheckCircle className="h-4 w-4" /> Total Pago
                            </span>
                            <span className="text-xl font-bold text-gray-900">{formatCurrency(selectedGroup.paidAmount)}</span>
                            <span className="block text-xs text-gray-500 mt-1">{selectedGroup.paidCount} ocorrências</span>
                        </div>
                        
                        <div className="bg-amber-50/50 p-4 rounded-lg border border-amber-100">
                            <span className="flex items-center gap-1 text-xs text-amber-600 font-medium mb-1">
                                <Clock className="h-4 w-4" /> Restante
                            </span>
                            {selectedGroup.isPlannedOrParceled ? (
                                <>
                                    <span className="text-xl font-bold text-gray-900">{formatCurrency(selectedGroup.pendingAmount)}</span>
                                    <span className="block text-xs text-gray-500 mt-1">{selectedGroup.pendingCount} pendentes</span>
                                </>
                            ) : (
                                <span className="text-sm font-medium text-gray-500 italic flex items-center h-full">
                                    Despesa Contínua
                                </span>
                            )}
                        </div>
                    </div>

                    {nextPending && (
                        <div className="mt-4 p-3 bg-blue-50 text-blue-800 rounded-lg flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4" />
                                <span className="font-medium">Próximo Vencimento:</span>
                                <span>{nextPending.date}</span>
                            </div>
                            <span className="font-bold">
                                {daysToNext === 0 ? 'Vence hoje!' : daysToNext < 0 ? `Atrasado há ${Math.abs(daysToNext)} dias` : `Faltam ${daysToNext} dias`}
                            </span>
                        </div>
                    )}
                </div>

                {/* Timeline */}
                <h4 className="text-sm font-bold text-gray-900 mb-3 px-1">Histórico e Previsão</h4>
                <div className="space-y-3 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-200 before:to-transparent">
                    {sortedItems.map((item, idx) => {
                        const paid = isPaid(item.status);
                        return (
                            <div key={idx} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                                <div className="flex items-center justify-center w-10 h-10 rounded-full border-white border-4 bg-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                                    {paid ? (
                                        <div className="h-6 w-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                                            <CheckCircle className="h-4 w-4" />
                                        </div>
                                    ) : (
                                        <div className="h-6 w-6 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center">
                                            <div className="h-2 w-2 rounded-full bg-gray-300" />
                                        </div>
                                    )}
                                </div>
                                
                                <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border bg-white shadow-sm transition-all hover:shadow-md">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className={cn("text-xs font-bold", paid ? "text-emerald-600" : "text-gray-500")}>
                                            {item.date}
                                        </span>
                                        <span className={cn(
                                            "text-[10px] px-2 py-0.5 rounded-full font-medium",
                                            paid ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                                        )}>
                                            {paid ? 'Pago' : 'Pendente'}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between mt-2">
                                        <span className="text-sm text-gray-600">
                                            {item.current_installment ? `Parcela ${item.current_installment}` : 'Ocorrência'}
                                        </span>
                                        <span className={cn("font-bold", paid ? "text-gray-900" : "text-gray-500")}>
                                            {formatCurrency(item.amount)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={handleClose}>
            <div 
                className="bg-gray-50 rounded-2xl shadow-xl w-full max-w-2xl h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between p-6 bg-white border-b border-gray-100 shrink-0 shadow-sm z-10">
                    <div className="flex items-center gap-3">
                        {selectedGroup ? (
                            <button 
                                onClick={() => setSelectedGroup(null)}
                                className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200 transition-colors"
                            >
                                <ArrowLeft className="h-5 w-5" />
                            </button>
                        ) : (
                            <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
                                <FileText className="h-5 w-5" />
                            </div>
                        )}
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">
                                {selectedGroup ? 'Detalhes da Despesa' : 'Resumo de Despesas Fixas'}
                            </h2>
                            <p className="text-sm text-gray-500">
                                {selectedGroup ? 'Acompanhamento de pagamentos' : 'Selecione uma despesa para ver detalhes'}
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={handleClose}
                        className="h-8 w-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1">
                    {summaryData.length === 0 ? (
                        <div className="text-center text-gray-500 py-8">
                            Nenhuma despesa fixa encontrada.
                        </div>
                    ) : (
                        selectedGroup ? renderDetail() : renderList()
                    )}
                </div>
            </div>
        </div>
    );
}