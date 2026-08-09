import React, { useEffect, useMemo, useState } from 'react';
import {
    NotebookPen, Loader2, Search, X, HandCoins, Phone, UserPlus,
    ChevronRight, CheckCircle2, Trash2, ShoppingBag,
} from 'lucide-react';
import { Button } from '../atoms/Button';
import { Input } from '../atoms/Input';
import { Badge } from '../atoms/Badge';
import { cn, formatCurrency, formatDate, formatDateTime } from '../../lib/utils';
import { paymentLabel } from '../../lib/payments';
import {
    listCustomerBalances, listCustomerCreditSales, listCreditPayments,
    deleteCreditPayment,
} from '../../services/mercadinhoService';
import { CustomerFormModal } from '../organisms/CustomerFormModal';
import { ReceivePaymentModal } from '../organisms/ReceivePaymentModal';

export function StoreCreditPage() {
    const [balances, setBalances] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [onlyDebtors, setOnlyDebtors] = useState(true);

    const [selected, setSelected] = useState(null);
    const [detail, setDetail] = useState({ sales: [], payments: [], loading: false });

    const [newCustomerOpen, setNewCustomerOpen] = useState(false);
    const [receiveFor, setReceiveFor] = useState(null);

    const load = async () => {
        setLoading(true);
        try {
            setBalances(await listCustomerBalances());
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    // Carrega o extrato do cliente aberto.
    useEffect(() => {
        if (!selected) return;
        let cancelled = false;

        setDetail({ sales: [], payments: [], loading: true });
        Promise.all([
            listCustomerCreditSales(selected.id),
            listCreditPayments(selected.id),
        ])
            .then(([sales, payments]) => {
                if (!cancelled) setDetail({ sales, payments, loading: false });
            })
            .catch((err) => {
                console.error(err);
                if (!cancelled) setDetail({ sales: [], payments: [], loading: false });
            });

        return () => { cancelled = true; };
    }, [selected]);

    const refreshAll = async () => {
        await load();
        if (selected) {
            const [sales, payments] = await Promise.all([
                listCustomerCreditSales(selected.id),
                listCreditPayments(selected.id),
            ]);
            setDetail({ sales, payments, loading: false });
            // O saldo do cabeçalho vem da lista recarregada.
            const fresh = (await listCustomerBalances()).find((b) => b.id === selected.id);
            if (fresh) setSelected(fresh);
        }
    };

    const filtered = useMemo(() => {
        const term = search.trim().toLowerCase();
        return balances.filter((c) => {
            if (onlyDebtors && Number(c.balance) <= 0) return false;
            if (term) {
                const haystack = `${c.name} ${c.phone ?? ''}`.toLowerCase();
                if (!haystack.includes(term)) return false;
            }
            return true;
        });
    }, [balances, search, onlyDebtors]);

    const totals = useMemo(() => {
        const debtors = balances.filter((c) => Number(c.balance) > 0);
        return {
            outstanding: debtors.reduce((sum, c) => sum + Number(c.balance), 0),
            count: debtors.length,
        };
    }, [balances]);

    const handleDeletePayment = async (payment) => {
        const ok = window.confirm(
            `Apagar o recebimento de ${formatCurrency(payment.amount)}?\n\n` +
            'A dívida do cliente volta a subir nesse valor.'
        );
        if (!ok) return;

        try {
            await deleteCreditPayment(payment.id);
            await refreshAll();
        } catch (err) {
            console.error(err);
            alert('Não consegui apagar o recebimento.');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Fiado</h1>
                    <p className="text-sm text-gray-500 mt-0.5">
                        Quem está devendo e quanto já pagou
                    </p>
                </div>
                <Button variant="outline" onClick={() => setNewCustomerOpen(true)}>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Novo cliente
                </Button>
            </div>

            {/* Total a receber */}
            <div className="grid grid-cols-3 gap-4">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
                    <div className="h-11 w-11 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                        <HandCoins className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">A receber</p>
                        <p className="text-2xl font-extrabold text-gray-900 mt-0.5">
                            {formatCurrency(totals.outstanding)}
                        </p>
                    </div>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
                    <div className="h-11 w-11 rounded-xl bg-[#7E1A8B]/10 flex items-center justify-center shrink-0">
                        <NotebookPen className="h-5 w-5 text-[#7E1A8B]" />
                    </div>
                    <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Devendo</p>
                        <p className="text-2xl font-extrabold text-gray-900 mt-0.5">
                            {totals.count} {totals.count === 1 ? 'cliente' : 'clientes'}
                        </p>
                    </div>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
                    <div className="h-11 w-11 rounded-xl bg-gray-50 flex items-center justify-center shrink-0">
                        <ShoppingBag className="h-5 w-5 text-gray-400" />
                    </div>
                    <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Cadastrados</p>
                        <p className="text-2xl font-extrabold text-gray-900 mt-0.5">{balances.length}</p>
                    </div>
                </div>
            </div>

            <div className="flex gap-6 items-start">
                {/* Lista de clientes */}
                <div className="w-[420px] shrink-0 space-y-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Buscar cliente"
                            className="pl-10 pr-9"
                        />
                        {search && (
                            <button
                                onClick={() => setSearch('')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 rounded flex items-center justify-center text-gray-400 hover:text-gray-600"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>

                    <label className="flex items-center gap-2 text-sm font-medium text-gray-600 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={onlyDebtors}
                            onChange={(e) => setOnlyDebtors(e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 accent-[#7E1A8B]"
                        />
                        Mostrar só quem está devendo
                    </label>

                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        {loading ? (
                            <div className="p-12 flex items-center justify-center text-gray-400">
                                <Loader2 className="h-6 w-6 animate-spin" />
                            </div>
                        ) : filtered.length === 0 ? (
                            <div className="p-12 flex flex-col items-center text-center">
                                <div className="h-14 w-14 rounded-2xl bg-gray-50 flex items-center justify-center mb-3">
                                    <CheckCircle2 className="h-7 w-7 text-emerald-500" />
                                </div>
                                <p className="font-semibold text-gray-500">
                                    {balances.length === 0 ? 'Nenhum cliente cadastrado' : 'Ninguém devendo'}
                                </p>
                                <p className="text-sm text-gray-400 mt-1">
                                    {balances.length === 0
                                        ? 'Clientes aparecem ao vender no Crédito Loja.'
                                        : 'Todo mundo em dia por aqui.'}
                                </p>
                            </div>
                        ) : (
                            <div className="max-h-[560px] overflow-y-auto">
                                {filtered.map((c) => {
                                    const balance = Number(c.balance);
                                    const isSelected = selected?.id === c.id;

                                    return (
                                        <button
                                            key={c.id}
                                            onClick={() => setSelected(c)}
                                            className={cn(
                                                "w-full flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0 text-left transition-colors",
                                                isSelected ? "bg-[#7E1A8B]/[0.06]" : "hover:bg-gray-50/70"
                                            )}
                                        >
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-bold text-gray-900 truncate">{c.name}</p>
                                                {c.phone && (
                                                    <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                                                        <Phone className="h-3 w-3" /> {c.phone}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="text-right shrink-0">
                                                <p className={cn(
                                                    "text-sm font-extrabold",
                                                    balance > 0 ? "text-amber-600" : "text-emerald-600"
                                                )}>
                                                    {balance > 0 ? formatCurrency(balance) : 'em dia'}
                                                </p>
                                            </div>
                                            <ChevronRight className={cn(
                                                "h-4 w-4 shrink-0",
                                                isSelected ? "text-[#7E1A8B]" : "text-gray-300"
                                            )} />
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Extrato do cliente */}
                <div className="flex-1 min-w-0">
                    {!selected ? (
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 flex flex-col items-center text-center">
                            <div className="h-16 w-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-4">
                                <NotebookPen className="h-8 w-8 text-gray-300" />
                            </div>
                            <p className="font-semibold text-gray-500">Escolha um cliente</p>
                            <p className="text-sm text-gray-400 mt-1">
                                Aqui aparecem as compras fiadas e os pagamentos dele.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Cabeçalho do cliente */}
                            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="min-w-0">
                                        <h2 className="text-xl font-extrabold text-gray-900 truncate">
                                            {selected.name}
                                        </h2>
                                        {selected.phone && (
                                            <p className="text-sm text-gray-500 flex items-center gap-1.5 mt-1">
                                                <Phone className="h-3.5 w-3.5" /> {selected.phone}
                                            </p>
                                        )}
                                        <div className="flex gap-6 mt-4">
                                            <div>
                                                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                                                    Levou fiado
                                                </p>
                                                <p className="text-lg font-bold text-gray-700">
                                                    {formatCurrency(selected.total_debt)}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                                                    Já pagou
                                                </p>
                                                <p className="text-lg font-bold text-emerald-600">
                                                    {formatCurrency(selected.total_paid)}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                                                    Deve
                                                </p>
                                                <p className={cn(
                                                    "text-lg font-extrabold",
                                                    Number(selected.balance) > 0 ? "text-amber-600" : "text-emerald-600"
                                                )}>
                                                    {formatCurrency(selected.balance)}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <Button
                                        variant="brand"
                                        onClick={() => setReceiveFor(selected)}
                                        disabled={Number(selected.balance) <= 0}
                                        title={Number(selected.balance) <= 0 ? 'Não há dívida em aberto' : undefined}
                                    >
                                        <HandCoins className="h-4 w-4 mr-2" />
                                        Receber
                                    </Button>
                                </div>
                            </div>

                            {detail.loading ? (
                                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 flex items-center justify-center text-gray-400">
                                    <Loader2 className="h-6 w-6 animate-spin" />
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-4">
                                    {/* Compras fiadas */}
                                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                                        <div className="px-5 py-3.5 border-b border-gray-100">
                                            <h3 className="font-bold text-gray-900 text-sm">Compras no fiado</h3>
                                        </div>
                                        {detail.sales.length === 0 ? (
                                            <p className="p-8 text-center text-sm text-gray-400">
                                                Nenhuma compra fiada.
                                            </p>
                                        ) : (
                                            <div className="max-h-80 overflow-y-auto">
                                                {detail.sales.map((s) => (
                                                    <div key={s.id} className="px-5 py-3 border-b border-gray-50 last:border-0">
                                                        <div className="flex items-baseline justify-between gap-3">
                                                            <span className="text-sm text-gray-600">
                                                                {formatDateTime(s.sold_at)}
                                                            </span>
                                                            <span className="text-sm font-bold text-gray-900">
                                                                {formatCurrency(s.credit_amount)}
                                                            </span>
                                                        </div>
                                                        {Number(s.credit_amount) < Number(s.total) && (
                                                            <p className="text-[11px] text-gray-400 mt-0.5">
                                                                compra de {formatCurrency(s.total)}, o resto pago na hora
                                                            </p>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Recebimentos */}
                                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                                        <div className="px-5 py-3.5 border-b border-gray-100">
                                            <h3 className="font-bold text-gray-900 text-sm">Pagamentos recebidos</h3>
                                        </div>
                                        {detail.payments.length === 0 ? (
                                            <p className="p-8 text-center text-sm text-gray-400">
                                                Ainda não pagou nada.
                                            </p>
                                        ) : (
                                            <div className="max-h-80 overflow-y-auto">
                                                {detail.payments.map((p) => (
                                                    <div key={p.id} className="px-5 py-3 border-b border-gray-50 last:border-0 flex items-center gap-3">
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex items-baseline gap-2">
                                                                <span className="text-sm text-gray-600">
                                                                    {formatDate(`${p.paid_at}T00:00:00`)}
                                                                </span>
                                                                <Badge>{paymentLabel(p.method)}</Badge>
                                                            </div>
                                                            {p.note && (
                                                                <p className="text-[11px] text-gray-400 mt-0.5 truncate">{p.note}</p>
                                                            )}
                                                        </div>
                                                        <span className="text-sm font-bold text-emerald-600 shrink-0">
                                                            {formatCurrency(p.amount)}
                                                        </span>
                                                        <button
                                                            onClick={() => handleDeletePayment(p)}
                                                            className="h-7 w-7 shrink-0 rounded-lg flex items-center justify-center text-gray-300 hover:text-red-600 hover:bg-red-50 transition-colors"
                                                            title="Apagar recebimento"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <CustomerFormModal
                isOpen={newCustomerOpen}
                onClose={() => setNewCustomerOpen(false)}
                onSaved={load}
            />

            <ReceivePaymentModal
                customer={receiveFor}
                onClose={() => setReceiveFor(null)}
                onSaved={refreshAll}
            />
        </div>
    );
}
