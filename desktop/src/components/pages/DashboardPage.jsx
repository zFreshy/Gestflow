import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from 'recharts';
import {
    ShoppingCart, TrendingUp, TrendingDown, Wallet, Loader2, AlertTriangle,
    HandCoins, Receipt, RefreshCw, PackageX, ArrowRight, Percent,
    CircleDollarSign, FileWarning,
} from 'lucide-react';
import { StatCard } from '../molecules/StatCard';
import { PaymentDonut } from '../molecules/PaymentDonut';
import { PeriodFilter, PERIOD_PRESETS } from '../molecules/PeriodFilter';
import { SalesHeatmap } from '../organisms/SalesHeatmap';
import { PeakHoursChart } from '../organisms/PeakHoursChart';
import { ProductRanking } from '../organisms/ProductRanking';
import { Button } from '../atoms/Button';
import {
    cn, formatCurrency, marginPercent, toISODate,
    dayStartInstant, dayEndInstant,
} from '../../lib/utils';
import {
    getDashboardTotals, getDashboardDaily, getDashboardHourly,
    getDashboardPaymentMix, getDashboardTopProducts,
    listStockEntries, listLowStock, listCustomerBalances, getOpenCashSession,
} from '../../services/mercadinhoService';

/** Quantos dias o termômetro cobre. 12 semanas é o mesmo recorte do site. */
const HEATMAP_DAYS = 84;

export function DashboardPage() {
    const navigate = useNavigate();

    const [preset, setPreset] = useState('mes');
    const [customFrom, setCustomFrom] = useState(toISODate());
    const [customTo, setCustomTo] = useState(toISODate());

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState('');

    const range = useMemo(() => (
        preset === 'custom'
            ? { from: customFrom, to: customTo }
            : PERIOD_PRESETS[preset].range()
    ), [preset, customFrom, customTo]);

    /**
     * Período imediatamente anterior, do mesmo tamanho.
     *
     * É o que dá sentido aos números: "R$ 8.400 este mês" não informa nada
     * sozinho. Mesmo tamanho e coladinho antes — comparar 30 dias com 7 daria
     * uma queda de 75% que é só aritmética.
     */
    const previousRange = useMemo(() => {
        const from = new Date(`${range.from}T12:00:00`);
        const to = new Date(`${range.to}T12:00:00`);
        const days = Math.max(Math.round((to - from) / 86400000) + 1, 1);

        const prevTo = new Date(from);
        prevTo.setDate(prevTo.getDate() - 1);
        const prevFrom = new Date(prevTo);
        prevFrom.setDate(prevFrom.getDate() - (days - 1));

        return { from: toISODate(prevFrom), to: toISODate(prevTo) };
    }, [range.from, range.to]);

    const load = useCallback(async ({ silent = false } = {}) => {
        if (silent) setRefreshing(true); else setLoading(true);
        setError('');

        const from = dayStartInstant(range.from);
        const to = dayEndInstant(range.to);

        // Termômetro tem recorte próprio: ele responde "qual dia da semana
        // rende", e isso não se enxerga dentro de um filtro de um dia só.
        const heatStart = new Date();
        heatStart.setDate(heatStart.getDate() - (HEATMAP_DAYS - 1));

        try {
            const [
                totals, previous, daily, heatmap, hourly, payments, products,
                entries, lowStock, balances, cashSession,
            ] = await Promise.all([
                getDashboardTotals({ from, to }),
                getDashboardTotals({
                    from: dayStartInstant(previousRange.from),
                    to: dayEndInstant(previousRange.to),
                }),
                getDashboardDaily({ from: range.from, to: range.to }),
                getDashboardDaily({ from: toISODate(heatStart), to: toISODate() }),
                getDashboardHourly({ from, to }),
                getDashboardPaymentMix({ from, to }),
                getDashboardTopProducts({ from, to, limit: 8 }),
                listStockEntries({ from: range.from, to: range.to, limit: 1000 }),
                listLowStock(),
                listCustomerBalances(),
                getOpenCashSession(),
            ]);

            const debtors = balances.filter((c) => Number(c.balance) > 0);

            setData({
                totals,
                previous,
                daily,
                heatmap,
                hourly,
                payments,
                products,
                restock: entries.reduce((sum, e) => sum + Number(e.total_cost), 0),
                restockCount: entries.length,
                lowStock,
                debtors: {
                    total: debtors.reduce((sum, c) => sum + Number(c.balance), 0),
                    count: debtors.length,
                    top: [...debtors]
                        .sort((a, b) => Number(b.balance) - Number(a.balance))
                        .slice(0, 5),
                },
                cashSession,
            });
        } catch (err) {
            console.error(err);
            setError('Não consegui carregar os dados. Confira a conexão.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [range.from, range.to, previousRange.from, previousRange.to]);

    useEffect(() => { load(); }, [load]);

    /** Variação percentual contra o período anterior; null quando não dá para comparar. */
    const trend = (current, before) => {
        if (!before || before === 0) return null;
        return ((current - before) / Math.abs(before)) * 100;
    };

    /**
     * Avisos que valem uma ação hoje.
     *
     * Ficam no topo porque são o motivo de abrir o dashboard num dia corrido.
     * A lista é curta de propósito: aviso demais vira papel de parede e ninguém
     * lê mais nenhum.
     */
    const insights = useMemo(() => {
        if (!data) return [];
        const list = [];

        if (data.lowStock.length > 0) {
            list.push({
                tone: 'warning',
                icon: PackageX,
                text: `${data.lowStock.length} ${data.lowStock.length === 1 ? 'produto está' : 'produtos estão'} abaixo do estoque mínimo`,
                action: 'Ver estoque',
                to: '/estoque',
            });
        }

        if (data.debtors.count > 0) {
            list.push({
                tone: 'info',
                icon: HandCoins,
                text: `${formatCurrency(data.debtors.total)} em fiado a receber de ${data.debtors.count} ${data.debtors.count === 1 ? 'cliente' : 'clientes'}`,
                action: 'Cobrar',
                to: '/fiado',
            });
        }

        // Margem baixa importa mais que faturamento alto: dá para vender muito
        // e não sobrar nada, que é o jeito silencioso de quebrar.
        const margin = marginPercent(data.totals.revenue, data.totals.cost);
        if (data.totals.revenue > 0 && margin < 15) {
            list.push({
                tone: 'danger',
                icon: Percent,
                text: `Margem de ${margin.toFixed(0)}% no período — abaixo do que costuma pagar as contas`,
            });
        }

        if (!data.cashSession && data.totals.saleCount > 0) {
            list.push({
                tone: 'neutral',
                icon: Wallet,
                text: 'Nenhum caixa aberto — as vendas de hoje ficam sem conferência',
                action: 'Abrir caixa',
                to: '/caixa',
            });
        }

        const withoutInvoice = data.totals.saleCount - data.totals.invoicedCount;
        if (data.totals.invoicedCount > 0 && withoutInvoice > 0) {
            list.push({
                tone: 'neutral',
                icon: FileWarning,
                text: `${withoutInvoice} de ${data.totals.saleCount} vendas sem nota fiscal emitida`,
                action: 'Ver histórico',
                to: '/vendas',
            });
        }

        return list;
    }, [data]);

    const chartData = useMemo(() => (data?.daily ?? []).map((d) => ({
        dia: new Date(`${d.day}T12:00:00`).toLocaleDateString('pt-BR', {
            day: '2-digit', month: '2-digit',
        }),
        Faturamento: d.revenue,
        Lucro: d.profit,
    })), [data]);

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center text-gray-400">
                <Loader2 className="h-7 w-7 animate-spin" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="h-full flex flex-col items-center justify-center gap-4">
                <AlertTriangle className="h-10 w-10 text-amber-500" />
                <p className="text-gray-600 font-medium">{error}</p>
                <Button variant="outline" onClick={() => load()}>Tentar de novo</Button>
            </div>
        );
    }

    const { totals, previous } = data;
    const margin = marginPercent(totals.revenue, totals.cost);
    const prevMargin = marginPercent(previous.revenue, previous.cost);

    return (
        <div className="space-y-6 pb-4">
            {/* Cabeçalho + período */}
            <div className="flex items-start justify-between gap-6 flex-wrap">
                <div>
                    <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Dashboard</h1>
                    <p className="text-sm text-gray-500 mt-0.5">
                        {range.from === range.to
                            ? new Date(`${range.from}T12:00:00`).toLocaleDateString('pt-BR', {
                                weekday: 'long', day: '2-digit', month: 'long',
                            })
                            : `${new Date(`${range.from}T12:00:00`).toLocaleDateString('pt-BR')} a ${new Date(`${range.to}T12:00:00`).toLocaleDateString('pt-BR')}`}
                        <span className="text-gray-300 mx-1.5">·</span>
                        comparado com o período anterior
                    </p>
                </div>

                <button
                    onClick={() => load({ silent: true })}
                    disabled={refreshing}
                    className="h-9 px-3 rounded-lg border border-gray-200 bg-white flex items-center gap-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                    <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
                    Atualizar
                </button>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <PeriodFilter
                    preset={preset}
                    onPresetChange={setPreset}
                    from={customFrom}
                    to={customTo}
                    onFromChange={setCustomFrom}
                    onToChange={setCustomTo}
                />
            </div>

            {/* Avisos acionáveis */}
            {insights.length > 0 && (
                <div className="grid grid-cols-2 gap-3">
                    {insights.map((item, idx) => (
                        <InsightRow key={idx} {...item} onGo={item.to ? () => navigate(item.to) : null} />
                    ))}
                </div>
            )}

            {/* Indicadores */}
            <div className="grid grid-cols-4 gap-4">
                <StatCard
                    label="Faturamento"
                    value={formatCurrency(totals.revenue)}
                    hint={`${totals.saleCount} ${totals.saleCount === 1 ? 'venda' : 'vendas'}`}
                    icon={TrendingUp}
                    tone="brand"
                    trend={trend(totals.revenue, previous.revenue)}
                />
                <StatCard
                    label="Lucro bruto"
                    value={formatCurrency(totals.profit)}
                    hint={`margem de ${margin.toFixed(0)}%`}
                    icon={Wallet}
                    tone="success"
                    trend={trend(margin, prevMargin)}
                />
                <StatCard
                    label="Ticket médio"
                    value={formatCurrency(totals.avgTicket)}
                    hint={`${totals.saleCount > 0 ? (totals.itemCount / totals.saleCount).toFixed(1) : '0'} itens por venda`}
                    icon={ShoppingCart}
                    tone="info"
                    trend={trend(totals.avgTicket, previous.avgTicket)}
                />
                {/* Reposição sobe = gastou mais: verde aqui enganaria. */}
                <StatCard
                    label="Reposição"
                    value={formatCurrency(data.restock)}
                    hint={`${data.restockCount} ${data.restockCount === 1 ? 'compra' : 'compras'}`}
                    icon={TrendingDown}
                    tone="danger"
                    trendGood={false}
                    onClick={() => navigate('/estoque')}
                />
            </div>

            <div className="grid grid-cols-4 gap-4">
                <StatCard
                    label="Fiado a receber"
                    value={formatCurrency(data.debtors.total)}
                    hint={`${data.debtors.count} ${data.debtors.count === 1 ? 'cliente devendo' : 'clientes devendo'}`}
                    icon={HandCoins}
                    tone="warning"
                    onClick={() => navigate('/fiado')}
                />
                <StatCard
                    label="Desconto dado"
                    value={formatCurrency(totals.discount)}
                    hint={totals.revenue > 0
                        ? `${((totals.discount / (totals.revenue + totals.discount)) * 100).toFixed(1)}% do faturamento`
                        : '—'}
                    icon={CircleDollarSign}
                    tone="info"
                    trendGood={false}
                    trend={trend(totals.discount, previous.discount)}
                />
                <StatCard
                    label="Notas emitidas"
                    value={String(totals.invoicedCount)}
                    hint={`de ${totals.saleCount} ${totals.saleCount === 1 ? 'venda' : 'vendas'}`}
                    icon={Receipt}
                    tone="brand"
                    onClick={() => navigate('/vendas')}
                />
                {/* Caixa aberto é estado do agora, não do período — por isso não
                    tem comparação nem varia com o filtro. */}
                <StatCard
                    label={data.cashSession ? 'Esperado na gaveta' : 'Caixa'}
                    value={data.cashSession
                        ? formatCurrency(data.cashSession.expected_now)
                        : 'Fechado'}
                    hint={data.cashSession
                        ? `aberto às ${new Date(data.cashSession.opened_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
                        : 'nenhum turno aberto'}
                    icon={Wallet}
                    tone={data.cashSession ? 'success' : 'danger'}
                    onClick={() => navigate('/caixa')}
                />
            </div>

            {/* Gráfico principal + formas de pagamento */}
            <div className="grid grid-cols-3 gap-5">
                <div className="col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <h2 className="font-bold text-gray-900 mb-1">Faturamento e lucro</h2>
                    <p className="text-sm text-gray-400 mb-5">
                        A distância entre as duas linhas é o custo do que saiu da prateleira
                    </p>

                    <ResponsiveContainer width="100%" height={280}>
                        <AreaChart data={chartData} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                            <defs>
                                <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#7E1A8B" stopOpacity={0.28} />
                                    <stop offset="100%" stopColor="#7E1A8B" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="fillProfit" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.22} />
                                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 32% 91%)" vertical={false} />
                            <XAxis
                                dataKey="dia"
                                tickLine={false}
                                axisLine={false}
                                tick={{ fontSize: 11, fill: 'hsl(215 16% 47%)' }}
                                interval="preserveStartEnd"
                                minTickGap={24}
                            />
                            <YAxis
                                tickLine={false}
                                axisLine={false}
                                tick={{ fontSize: 11, fill: 'hsl(215 16% 47%)' }}
                                tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)}
                            />
                            <Tooltip
                                formatter={(v, name) => [formatCurrency(v), name]}
                                contentStyle={{
                                    borderRadius: 12,
                                    border: '1px solid hsl(214 32% 91%)',
                                    fontSize: 13,
                                }}
                            />
                            <Legend
                                iconType="circle"
                                wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                            />
                            <Area
                                type="monotone" dataKey="Faturamento"
                                stroke="#7E1A8B" strokeWidth={2.5} fill="url(#fillRevenue)"
                            />
                            <Area
                                type="monotone" dataKey="Lucro"
                                stroke="#10b981" strokeWidth={2.5} fill="url(#fillProfit)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                <PaymentDonut data={data.payments} />
            </div>

            {/* Termômetro + horário de pico */}
            <div className="grid grid-cols-3 gap-5">
                <div className="col-span-2">
                    <SalesHeatmap days={data.heatmap} />
                </div>
                <PeakHoursChart data={data.hourly} />
            </div>

            {/* Campeões + devedores */}
            <div className="grid grid-cols-3 gap-5">
                <div className="col-span-2">
                    <ProductRanking products={data.products} />
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col">
                    <div className="flex items-center gap-2 mb-1">
                        <HandCoins className="h-4 w-4 text-amber-500" />
                        <h2 className="font-bold text-gray-900">Maiores devedores</h2>
                    </div>
                    <p className="text-sm text-gray-400 mb-4">Fiado em aberto hoje</p>

                    {data.debtors.top.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-center py-10">
                            <HandCoins className="h-10 w-10 text-gray-200 mb-3" />
                            <p className="text-sm font-medium text-gray-400">Ninguém devendo 🎉</p>
                        </div>
                    ) : (
                        <>
                            <div className="space-y-2.5">
                                {data.debtors.top.map((c) => (
                                    <div key={c.id} className="flex items-center gap-3">
                                        <div className="h-8 w-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center text-xs font-extrabold shrink-0">
                                            {c.name.trim().charAt(0).toUpperCase()}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-semibold text-gray-900 truncate">
                                                {c.name}
                                            </p>
                                            {c.last_purchase_at && (
                                                <p className="text-[11px] text-gray-400">
                                                    última compra em{' '}
                                                    {new Date(c.last_purchase_at).toLocaleDateString('pt-BR')}
                                                </p>
                                            )}
                                        </div>
                                        <span className="text-sm font-extrabold text-amber-700 shrink-0">
                                            {formatCurrency(c.balance)}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            <Button
                                variant="outline"
                                className="w-full mt-auto"
                                onClick={() => navigate('/fiado')}
                            >
                                Ver todos e receber
                                <ArrowRight className="h-4 w-4 ml-2" />
                            </Button>
                        </>
                    )}
                </div>
            </div>

            {/* Estoque acabando */}
            {data.lowStock.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <div className="flex items-center justify-between gap-4 mb-4">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <AlertTriangle className="h-4 w-4 text-amber-500" />
                                <h2 className="font-bold text-gray-900">
                                    {data.lowStock.length} {data.lowStock.length === 1 ? 'produto acabando' : 'produtos acabando'}
                                </h2>
                            </div>
                            <p className="text-sm text-gray-400">Abaixo do estoque mínimo cadastrado</p>
                        </div>
                        <Button variant="outline" onClick={() => navigate('/estoque')}>
                            Dar entrada
                            <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {data.lowStock.slice(0, 18).map((p) => (
                            <div
                                key={p.id}
                                className="px-3 py-2 rounded-xl bg-amber-50/60 border border-amber-100"
                            >
                                <p className="text-sm font-semibold text-amber-900">{p.name}</p>
                                <p className="text-[11px] text-amber-600">
                                    restam {Number(p.stock_quantity)} {p.unit}
                                    <span className="text-amber-400"> · mínimo {Number(p.min_stock)}</span>
                                </p>
                            </div>
                        ))}
                        {data.lowStock.length > 18 && (
                            <div className="px-3 py-2 flex items-center text-sm font-medium text-amber-700">
                                +{data.lowStock.length - 18} outros
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

const INSIGHT_TONES = {
    warning: 'bg-amber-50 border-amber-200 text-amber-900',
    danger:  'bg-rose-50 border-rose-200 text-rose-900',
    info:    'bg-blue-50 border-blue-200 text-blue-900',
    neutral: 'bg-gray-50 border-gray-200 text-gray-700',
};

const INSIGHT_ICONS = {
    warning: 'text-amber-600',
    danger:  'text-rose-600',
    info:    'text-blue-600',
    neutral: 'text-gray-400',
};

function InsightRow({ tone, icon: Icon, text, action, onGo }) {
    return (
        <div className={cn(
            "rounded-xl border px-4 py-3 flex items-center gap-3",
            INSIGHT_TONES[tone]
        )}>
            <Icon className={cn("h-4 w-4 shrink-0", INSIGHT_ICONS[tone])} />
            <p className="text-sm font-medium flex-1 min-w-0">{text}</p>
            {onGo && (
                <button
                    onClick={onGo}
                    className="text-xs font-bold underline underline-offset-2 shrink-0 hover:opacity-70 transition-opacity"
                >
                    {action}
                </button>
            )}
        </div>
    );
}
