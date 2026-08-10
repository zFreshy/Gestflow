import React, { useEffect, useMemo, useState } from 'react';
import {
    Receipt, Loader2, Trash2, ChevronDown, ChevronRight, Search, X, FilterX,
    Printer, FileText, CloudOff,
} from 'lucide-react';
import { Input } from '../atoms/Input';
import { Badge } from '../atoms/Badge';
import { Button } from '../atoms/Button';
import { PeriodFilter, PERIOD_PRESETS } from '../molecules/PeriodFilter';
import {
    cn, formatCurrency, formatDateTime, dayStartInstant, dayEndInstant, toISODate,
} from '../../lib/utils';
import { PAYMENT_METHODS, paymentLabel, paymentTone } from '../../lib/payments';
import {
    listSales, listSaleItems, deleteSale, listInvoicesForSales,
    emitInvoice, refreshInvoice,
} from '../../services/mercadinhoService';
import { useProfile } from '../../contexts/ProfileContext';
import { useReceipt } from '../../contexts/ReceiptContext';

export function SalesHistoryPage() {
    const { isAdmin } = useProfile();
    const { print } = useReceipt();
    const [sales, setSales] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState(null);
    const [itemsBySale, setItemsBySale] = useState({});
    const [invoices, setInvoices] = useState({});
    const [workingOn, setWorkingOn] = useState(null);

    // Filtros
    const [preset, setPreset] = useState('mes');
    const [customFrom, setCustomFrom] = useState(toISODate());
    const [customTo, setCustomTo] = useState(toISODate());
    const [methods, setMethods] = useState([]);   // vazio = todas
    const [search, setSearch] = useState('');
    const [minValue, setMinValue] = useState('');

    const range = useMemo(() => (
        preset === 'custom'
            ? { from: customFrom, to: customTo }
            : PERIOD_PRESETS[preset].range()
    ), [preset, customFrom, customTo]);

    // Recarrega quando o período muda; o resto dos filtros é aplicado em memória.
    useEffect(() => {
        let cancelled = false;
        setLoading(true);

        listSales({
            from: dayStartInstant(range.from),
            to: dayEndInstant(range.to),
            limit: 1000,
        })
            .then(async (data) => {
                if (cancelled) return;
                setSales(data);
                // Quais dessas vendas já têm nota. Numa consulta só: uma por
                // linha seriam mil idas ao servidor para pintar um ícone.
                try {
                    const map = await listInvoicesForSales(data.map((s) => s.id));
                    if (!cancelled) setInvoices(map);
                } catch (err) {
                    console.error(err);
                }
            })
            .catch((err) => console.error(err))
            .finally(() => { if (!cancelled) setLoading(false); });

        return () => { cancelled = true; };
    }, [range.from, range.to]);

    const toggleMethod = (id) =>
        setMethods((prev) => prev.includes(id)
            ? prev.filter((m) => m !== id)
            : [...prev, id]);

    const clearFilters = () => {
        setPreset('mes');
        setMethods([]);
        setSearch('');
        setMinValue('');
    };

    const hasExtraFilters = methods.length > 0 || search.trim() !== '' || minValue !== '';

    const filtered = useMemo(() => {
        const term = search.trim().toLowerCase();
        const min = Number(minValue) || 0;

        return sales.filter((sale) => {
            // Forma de pagamento: compara com o detalhe, não com o resumo.
            // No resumo, "Crédito" casaria com "Crédito Loja" por ser prefixo.
            if (methods.length > 0) {
                const pays = sale.sale_payments ?? [];
                // Vendas gravadas antes do pagamento combinado não têm detalhe;
                // para essas, o resumo é a única informação que existe.
                const used = pays.length > 0
                    ? pays.map((p) => p.method)
                    : [sale.payment_method];
                if (!used.some((m) => methods.includes(m))) return false;
            }

            if (min > 0 && Number(sale.total) < min) return false;

            if (term) {
                const haystack = [
                    sale.note ?? '',
                    sale.payment_method ?? '',
                    sale.user_email ?? '',
                    sale.customers?.name ?? '',
                ].join(' ').toLowerCase();
                if (!haystack.includes(term)) return false;
            }

            return true;
        });
    }, [sales, methods, search, minValue]);

    // Resumo do que está na tela — é o que serve pra fechar o caixa.
    const summary = useMemo(() => {
        const total = filtered.reduce((sum, s) => sum + Number(s.total), 0);
        const cost = filtered.reduce((sum, s) => sum + Number(s.cost_total), 0);

        // Quebra por forma de pagamento, usando o valor de cada meio.
        const byMethod = new Map();
        for (const sale of filtered) {
            for (const p of sale.sale_payments ?? []) {
                byMethod.set(p.method, (byMethod.get(p.method) ?? 0) + Number(p.amount));
            }
        }

        return {
            total,
            profit: total - cost,
            count: filtered.length,
            average: filtered.length > 0 ? total / filtered.length : 0,
            byMethod: [...byMethod.entries()].sort((a, b) => b[1] - a[1]),
        };
    }, [filtered]);

    const toggle = async (sale) => {
        if (expanded === sale.id) { setExpanded(null); return; }
        setExpanded(sale.id);

        if (!itemsBySale[sale.id]) {
            try {
                const items = await listSaleItems(sale.id);
                setItemsBySale((prev) => ({ ...prev, [sale.id]: items }));
            } catch (err) {
                console.error(err);
            }
        }
    };

    /** Itens da venda, do cache da tela ou do servidor. */
    const itemsOf = async (sale) => {
        if (itemsBySale[sale.id]) return itemsBySale[sale.id];
        const items = await listSaleItems(sale.id);
        setItemsBySale((prev) => ({ ...prev, [sale.id]: items }));
        return items;
    };

    /**
     * Reimprime o cupom.
     *
     * Reimprimir NÃO é emitir de novo: se a venda tem nota autorizada, sai o
     * mesmo DANFE, com a mesma chave e o mesmo protocolo. Emitir outra nota
     * para a mesma venda significaria imposto em dobro e um cancelamento junto
     * à SEFAZ para desfazer.
     */
    const handleReprint = async (sale) => {
        setWorkingOn(sale.id);
        try {
            const items = await itemsOf(sale);
            await print({
                sale: {
                    total: sale.total,
                    discount: sale.discount,
                    sold_at: sale.sold_at,
                    customer_name: sale.customers?.name ?? null,
                },
                items,
                payments: sale.sale_payments ?? [{ method: sale.payment_method, amount: sale.total }],
                invoice: invoices[sale.id] ?? null,
                change: 0,
            });
        } catch (err) {
            console.error(err);
            alert('Não consegui montar o cupom.');
        } finally {
            setWorkingOn(null);
        }
    };

    const handleEmit = async (sale) => {
        setWorkingOn(sale.id);
        try {
            let invoice = await emitInvoice(sale.id);

            for (let tries = 0; invoice?.status === 'processando' && tries < 6; tries++) {
                await new Promise((r) => setTimeout(r, 1500));
                invoice = await refreshInvoice(invoice.id);
            }

            setInvoices((prev) => ({ ...prev, [sale.id]: invoice }));

            if (invoice?.status === 'autorizada') {
                const items = await itemsOf(sale);
                await print({
                    sale: {
                        total: sale.total,
                        discount: sale.discount,
                        sold_at: sale.sold_at,
                        customer_name: sale.customers?.name ?? null,
                    },
                    items,
                    payments: sale.sale_payments ?? [],
                    invoice,
                    change: 0,
                });
            } else if (invoice?.status === 'rejeitada') {
                alert(`A SEFAZ rejeitou a nota:\n\n${invoice.mensagem ?? 'sem detalhe'}`);
            } else {
                alert('A nota ainda está sendo autorizada. Atualize a tela em instantes.');
            }
        } catch (err) {
            console.error(err);
            alert(err?.message ?? 'Não consegui emitir a nota.');
        } finally {
            setWorkingOn(null);
        }
    };

    const handleDelete = async (sale) => {
        const ok = window.confirm(
            `Estornar a venda de ${formatCurrency(sale.total)}?\n\n` +
            'Os produtos voltam para o estoque e a venda some do histórico.'
        );
        if (!ok) return;

        try {
            await deleteSale(sale.id);
            setSales((prev) => prev.filter((s) => s.id !== sale.id));
        } catch (err) {
            console.error(err);
            // O banco recusa estornar venda com nota autorizada, e a mensagem
            // dele explica o porquê e o que fazer — vale mais que um texto
            // genérico daqui.
            alert(err?.message ?? 'Não consegui estornar a venda.');
        }
    };

    return (
        <div className="space-y-5">
            <div>
                <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Histórico de vendas</h1>
                <p className="text-sm text-gray-500 mt-0.5">
                    {range.from === range.to
                        ? `Vendas de ${new Date(`${range.from}T12:00`).toLocaleDateString('pt-BR')}`
                        : `De ${new Date(`${range.from}T12:00`).toLocaleDateString('pt-BR')} a ${new Date(`${range.to}T12:00`).toLocaleDateString('pt-BR')}`}
                </p>
            </div>

            {/* Filtros */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
                <PeriodFilter
                    preset={preset}
                    onPresetChange={setPreset}
                    from={customFrom}
                    to={customTo}
                    onFromChange={setCustomFrom}
                    onToChange={setCustomTo}
                />

                <div className="h-px bg-gray-100" />

                {/* Forma de pagamento */}
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-gray-500 mr-1">Pagamento:</span>
                    {PAYMENT_METHODS.map(({ id, label }) => (
                        <button
                            key={id}
                            onClick={() => toggleMethod(id)}
                            className={cn(
                                "px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors border",
                                methods.includes(id)
                                    ? "bg-[#7E1A8B] text-white border-[#7E1A8B]"
                                    : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                            )}
                        >
                            {label}
                        </button>
                    ))}
                    {methods.length > 0 && (
                        <button
                            onClick={() => setMethods([])}
                            className="text-xs font-semibold text-gray-400 hover:text-gray-600 ml-1"
                        >
                            limpar
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Buscar por observação, cliente do fiado ou quem vendeu"
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

                    <div className="w-44">
                        <Input
                            type="number" step="0.01" min="0"
                            value={minValue}
                            onChange={(e) => setMinValue(e.target.value)}
                            placeholder="Valor mínimo (R$)"
                        />
                    </div>

                    {hasExtraFilters && (
                        <Button variant="outline" onClick={clearFilters}>
                            <FilterX className="h-4 w-4 mr-2" />
                            Limpar
                        </Button>
                    )}
                </div>
            </div>

            {/* Resumo */}
            <div className={cn("grid gap-4", isAdmin ? "grid-cols-4" : "grid-cols-3")}>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Faturamento</p>
                    <p className="text-2xl font-extrabold text-gray-900 mt-1">{formatCurrency(summary.total)}</p>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Vendas</p>
                    <p className="text-2xl font-extrabold text-gray-900 mt-1">{summary.count}</p>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Ticket médio</p>
                    <p className="text-2xl font-extrabold text-gray-900 mt-1">{formatCurrency(summary.average)}</p>
                </div>
                {/* Lucro é financeiro: fora do alcance do perfil de funcionário. */}
                {isAdmin && (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Lucro bruto</p>
                        <p className="text-2xl font-extrabold text-emerald-600 mt-1">{formatCurrency(summary.profit)}</p>
                    </div>
                )}
            </div>

            {/* Quanto entrou por forma de pagamento */}
            {summary.byMethod.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                        Entrou por forma de pagamento
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {summary.byMethod.map(([method, amount]) => (
                            <div
                                key={method}
                                className="flex items-baseline gap-2 px-3 py-2 rounded-xl bg-gray-50 border border-gray-100"
                            >
                                <span className="text-sm font-semibold text-gray-600">{paymentLabel(method)}</span>
                                <span className="text-sm font-extrabold text-gray-900">{formatCurrency(amount)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Lista */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="p-16 flex items-center justify-center text-gray-400">
                        <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="p-16 flex flex-col items-center text-center">
                        <div className="h-16 w-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-4">
                            <Receipt className="h-8 w-8 text-gray-300" />
                        </div>
                        <p className="font-semibold text-gray-500">
                            {sales.length === 0
                                ? 'Nenhuma venda neste período'
                                : 'Nenhuma venda com esses filtros'}
                        </p>
                        <p className="text-sm text-gray-400 mt-1">
                            {sales.length === 0
                                ? 'As vendas fechadas no PDV aparecem aqui.'
                                : `${sales.length} ${sales.length === 1 ? 'venda foi escondida' : 'vendas foram escondidas'} pelos filtros.`}
                        </p>
                        {sales.length > 0 && (
                            <Button variant="outline" className="mt-5" onClick={clearFilters}>
                                <FilterX className="h-4 w-4 mr-2" />
                                Limpar filtros
                            </Button>
                        )}
                    </div>
                ) : (
                    <table className="w-full">
                        <thead className="bg-gray-50/80">
                            <tr className="text-[11px] uppercase tracking-wide text-gray-500">
                                <th className="w-10" />
                                <th className="text-left font-bold px-3 py-3">Data e hora</th>
                                <th className="text-left font-bold px-3 py-3 w-56">Pagamento</th>
                                <th className="text-left font-bold px-3 py-3">Observação</th>
                                <th className="text-right font-bold px-3 py-3 w-20">Itens</th>
                                <th className="text-right font-bold px-3 py-3 w-32">Total</th>
                                <th className="text-left font-bold px-3 py-3 w-28">Nota</th>
                                <th className="w-32" />
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((sale) => {
                                const isOpen = expanded === sale.id;
                                const items = itemsBySale[sale.id];
                                const pays = sale.sale_payments ?? [];
                                const busy = workingOn === sale.id;
                                const hasInvoice = invoices[sale.id]?.status === 'autorizada';

                                return (
                                    <React.Fragment key={sale.id}>
                                        <tr
                                            onClick={() => toggle(sale)}
                                            className={cn(
                                                "border-b border-gray-50 cursor-pointer transition-colors",
                                                isOpen ? "bg-gray-50/80" : "hover:bg-gray-50/50"
                                            )}
                                        >
                                            <td className="pl-4 text-gray-400">
                                                {isOpen
                                                    ? <ChevronDown className="h-4 w-4" />
                                                    : <ChevronRight className="h-4 w-4" />}
                                            </td>
                                            <td className="px-3 py-3 text-sm font-semibold text-gray-900">
                                                {formatDateTime(sale.sold_at)}
                                            </td>
                                            <td className="px-3 py-3">
                                                <div className="flex flex-wrap gap-1">
                                                    {pays.length > 0 ? (
                                                        pays.map((p) => (
                                                            <Badge key={p.id} variant={paymentTone(p.method)}>
                                                                {paymentLabel(p.method)}
                                                                {pays.length > 1 && (
                                                                    <span className="ml-1 font-normal opacity-70">
                                                                        {formatCurrency(p.amount)}
                                                                    </span>
                                                                )}
                                                            </Badge>
                                                        ))
                                                    ) : (
                                                        <Badge>{sale.payment_method}</Badge>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-3 py-3 text-sm truncate max-w-0">
                                                {sale.customers?.name && (
                                                    <span className="font-semibold text-gray-700">
                                                        {sale.customers.name}
                                                    </span>
                                                )}
                                                {sale.customers?.name && sale.note && (
                                                    <span className="text-gray-300"> · </span>
                                                )}
                                                <span className="text-gray-500">
                                                    {sale.note || (sale.customers?.name ? '' : '—')}
                                                </span>
                                            </td>
                                            <td className="px-3 py-3 text-right text-sm text-gray-600">
                                                {sale.item_count}
                                            </td>
                                            <td className="px-3 py-3 text-right">
                                                <span className="text-sm font-bold text-gray-900">
                                                    {formatCurrency(sale.total)}
                                                </span>
                                                {Number(sale.discount) > 0 && (
                                                    <p className="text-[11px] text-red-500">
                                                        −{formatCurrency(sale.discount)}
                                                    </p>
                                                )}
                                            </td>
                                            <td className="px-3 py-3">
                                                <InvoiceBadge invoice={invoices[sale.id]} offline={sale.sold_offline} />
                                            </td>
                                            <td className="px-3 py-3">
                                                <div className="flex items-center justify-end gap-0.5">
                                                    {busy ? (
                                                        <Loader2 className="h-4 w-4 animate-spin text-gray-400 mr-2" />
                                                    ) : (
                                                        <>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleReprint(sale); }}
                                                                className="h-8 w-8 rounded-lg flex items-center justify-center text-gray-300 hover:text-[#7E1A8B] hover:bg-[#7E1A8B]/5 transition-colors"
                                                                title={hasInvoice ? 'Reimprimir a nota' : 'Imprimir comprovante'}
                                                            >
                                                                <Printer className="h-4 w-4" />
                                                            </button>

                                                            {/* Nota autorizada não se emite de novo: seria
                                                                uma segunda nota para a mesma venda. */}
                                                            {!hasInvoice && (
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); handleEmit(sale); }}
                                                                    className="h-8 w-8 rounded-lg flex items-center justify-center text-gray-300 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                                                                    title="Emitir nota fiscal"
                                                                >
                                                                    <FileText className="h-4 w-4" />
                                                                </button>
                                                            )}
                                                        </>
                                                    )}

                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleDelete(sale); }}
                                                        className="h-8 w-8 rounded-lg flex items-center justify-center text-gray-300 hover:text-red-600 hover:bg-red-50 transition-colors"
                                                        title="Estornar venda"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>

                                        {isOpen && (
                                            <tr className="border-b border-gray-100 bg-gray-50/40">
                                                <td />
                                                <td colSpan={7} className="px-3 py-4">
                                                    {!items ? (
                                                        <div className="flex items-center gap-2 text-sm text-gray-400">
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                            Carregando itens...
                                                        </div>
                                                    ) : (
                                                        <div className="space-y-1.5 pr-8">
                                                            {items.map((item) => (
                                                                <div key={item.id} className="flex items-center justify-between text-sm">
                                                                    <span className="text-gray-700">
                                                                        <span className="font-semibold">{Number(item.quantity)}×</span>{' '}
                                                                        {item.product_name}
                                                                        <span className="text-gray-400 font-mono text-xs ml-2">
                                                                            {item.barcode || ''}
                                                                        </span>
                                                                    </span>
                                                                    <span className="text-gray-500">
                                                                        {formatCurrency(item.unit_price)} ={' '}
                                                                        <span className="font-bold text-gray-900">
                                                                            {formatCurrency(item.subtotal)}
                                                                        </span>
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}

/**
 * Situação fiscal da venda numa olhada.
 *
 * "Sem nota" não é erro: no mercadinho a maioria das vendas sai sem nota
 * porque o cliente não pede. Por isso ele é cinza e discreto — pintar de
 * vermelho faria a tela inteira parecer um problema.
 */
function InvoiceBadge({ invoice, offline }) {
    if (!invoice) {
        return (
            <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-400">sem nota</span>
                {offline && (
                    <span title="Venda registrada sem internet e sincronizada depois">
                        <CloudOff className="h-3.5 w-3.5 text-gray-300" />
                    </span>
                )}
            </div>
        );
    }

    const variant = {
        autorizada: 'success',
        processando: 'info',
        rejeitada: 'destructive',
        cancelada: 'warning',
        erro: 'destructive',
    }[invoice.status] ?? 'default';

    return (
        <Badge variant={variant} title={invoice.mensagem ?? undefined}>
            {invoice.status === 'autorizada' ? `nº ${invoice.numero}` : invoice.status}
        </Badge>
    );
}
