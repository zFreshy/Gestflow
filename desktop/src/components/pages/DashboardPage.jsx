import React, { useEffect, useMemo, useState } from 'react';
import {
    ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import {
    ShoppingCart, TrendingUp, TrendingDown, Wallet, Loader2, AlertTriangle,
    Trophy, Package, HandCoins,
} from 'lucide-react';
import { StatCard } from '../molecules/StatCard';
import { Badge } from '../atoms/Badge';
import {
    formatCurrency, marginPercent, startOfMonthISO, startOfMonthInstant, toISODate,
} from '../../lib/utils';
import {
    listSales, listSaleItemsByPeriod, listStockEntries, listLowStock,
    listCustomerBalances,
} from '../../services/mercadinhoService';

export function DashboardPage() {
    const [sales, setSales] = useState([]);
    const [items, setItems] = useState([]);
    const [entries, setEntries] = useState([]);
    const [lowStock, setLowStock] = useState([]);
    const [receivable, setReceivable] = useState({ total: 0, count: 0 });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const monthStart = startOfMonthInstant();

        Promise.all([
            listSales({ from: monthStart, limit: 1000 }),
            listSaleItemsByPeriod({ from: monthStart }),
            listStockEntries({ from: startOfMonthISO(), limit: 1000 }),
            listLowStock(),
            listCustomerBalances(),
        ])
            .then(([s, i, e, l, balances]) => {
                setSales(s);
                setItems(i);
                setEntries(e);
                setLowStock(l);

                const debtors = balances.filter((c) => Number(c.balance) > 0);
                setReceivable({
                    total: debtors.reduce((sum, c) => sum + Number(c.balance), 0),
                    count: debtors.length,
                });
            })
            .catch((err) => console.error(err))
            .finally(() => setLoading(false));
    }, []);

    const today = toISODate();

    const stats = useMemo(() => {
        const todaySales = sales.filter((s) => s.sold_at.slice(0, 10) === today);

        const revenueToday = todaySales.reduce((sum, s) => sum + Number(s.total), 0);
        const revenueMonth = sales.reduce((sum, s) => sum + Number(s.total), 0);
        const costMonth = sales.reduce((sum, s) => sum + Number(s.cost_total), 0);
        const restockMonth = entries.reduce((sum, e) => sum + Number(e.total_cost), 0);

        return {
            revenueToday,
            countToday: todaySales.length,
            revenueMonth,
            // Lucro bruto: o que entrou menos o custo do que saiu da prateleira.
            // Não é o mesmo que caixa do mês — a reposição aparece separada.
            grossProfit: revenueMonth - costMonth,
            margin: marginPercent(revenueMonth, costMonth),
            restockMonth,
            countMonth: sales.length,
        };
    }, [sales, entries, today]);

    // Faturamento por dia do mês
    const chartData = useMemo(() => {
        const byDay = new Map();
        for (const s of sales) {
            const day = s.sold_at.slice(0, 10);
            byDay.set(day, (byDay.get(day) ?? 0) + Number(s.total));
        }

        // Vai só até hoje: dias futuros zerados achatariam a linha à toa.
        const now = new Date();

        return Array.from({ length: now.getDate() }, (_, idx) => {
            const d = new Date(now.getFullYear(), now.getMonth(), idx + 1);
            const iso = toISODate(d);
            return { dia: String(idx + 1), total: byDay.get(iso) ?? 0 };
        });
    }, [sales]);

    // Ranking dos mais vendidos no mês
    const topProducts = useMemo(() => {
        const acc = new Map();

        for (const item of items) {
            const key = item.product_id ?? item.product_name;
            const current = acc.get(key) ?? { name: item.product_name, quantity: 0, revenue: 0 };
            current.quantity += Number(item.quantity);
            current.revenue += Number(item.subtotal);
            acc.set(key, current);
        }

        return [...acc.values()]
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 8);
    }, [items]);

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center text-gray-400">
                <Loader2 className="h-7 w-7 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Dashboard</h1>
                <p className="text-sm text-gray-500 mt-0.5">
                    Resumo de {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                </p>
            </div>

            {/* Indicadores */}
            <div className="grid grid-cols-5 gap-4">
                <StatCard
                    label="Vendas hoje"
                    value={formatCurrency(stats.revenueToday)}
                    hint={`${stats.countToday} ${stats.countToday === 1 ? 'venda' : 'vendas'}`}
                    icon={ShoppingCart}
                    tone="brand"
                />
                <StatCard
                    label="Faturamento do mês"
                    value={formatCurrency(stats.revenueMonth)}
                    hint={`${stats.countMonth} ${stats.countMonth === 1 ? 'venda' : 'vendas'}`}
                    icon={TrendingUp}
                    tone="info"
                />
                <StatCard
                    label="Lucro bruto do mês"
                    value={formatCurrency(stats.grossProfit)}
                    hint={`margem de ${stats.margin.toFixed(0)}%`}
                    icon={Wallet}
                    tone="success"
                />
                <StatCard
                    label="Reposição do mês"
                    value={formatCurrency(stats.restockMonth)}
                    hint={`${entries.length} ${entries.length === 1 ? 'compra' : 'compras'}`}
                    icon={TrendingDown}
                    tone="danger"
                />
                {/* Fiado em aberto não tem recorte de mês: é o que está na rua hoje. */}
                <StatCard
                    label="Fiado a receber"
                    value={formatCurrency(receivable.total)}
                    hint={`${receivable.count} ${receivable.count === 1 ? 'cliente devendo' : 'clientes devendo'}`}
                    icon={HandCoins}
                    tone="warning"
                />
            </div>

            {/* Estoque baixo */}
            {lowStock.length > 0 && (
                <div className="rounded-2xl bg-amber-50 border border-amber-200 p-5">
                    <div className="flex items-center gap-2 mb-3">
                        <AlertTriangle className="h-5 w-5 text-amber-600" />
                        <h2 className="font-bold text-amber-800">
                            {lowStock.length} {lowStock.length === 1 ? 'produto acabando' : 'produtos acabando'}
                        </h2>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {lowStock.slice(0, 12).map((p) => (
                            <span
                                key={p.id}
                                className="px-3 py-1.5 rounded-lg bg-white border border-amber-200 text-sm font-semibold text-amber-800"
                            >
                                {p.name}
                                <span className="ml-2 text-xs font-normal text-amber-600">
                                    {Number(p.stock_quantity)} {p.unit}
                                </span>
                            </span>
                        ))}
                        {lowStock.length > 12 && (
                            <span className="px-3 py-1.5 text-sm font-medium text-amber-700">
                                +{lowStock.length - 12} outros
                            </span>
                        )}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-3 gap-6">
                {/* Gráfico */}
                <div className="col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <h2 className="font-bold text-gray-900 mb-1">Faturamento por dia</h2>
                    <p className="text-sm text-gray-400 mb-5">Vendas realizadas ao longo do mês</p>

                    <ResponsiveContainer width="100%" height={280}>
                        <AreaChart data={chartData} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                            <defs>
                                <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#7E1A8B" stopOpacity={0.28} />
                                    <stop offset="100%" stopColor="#7E1A8B" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 32% 91%)" vertical={false} />
                            <XAxis
                                dataKey="dia"
                                tickLine={false}
                                axisLine={false}
                                tick={{ fontSize: 12, fill: 'hsl(215 16% 47%)' }}
                            />
                            <YAxis
                                tickLine={false}
                                axisLine={false}
                                tick={{ fontSize: 12, fill: 'hsl(215 16% 47%)' }}
                                tickFormatter={(v) => `R$${v}`}
                            />
                            <Tooltip
                                formatter={(v) => [formatCurrency(v), 'Faturamento']}
                                labelFormatter={(l) => `Dia ${l}`}
                                contentStyle={{
                                    borderRadius: 12,
                                    border: '1px solid hsl(214 32% 91%)',
                                    fontSize: 13,
                                }}
                            />
                            <Area
                                type="monotone"
                                dataKey="total"
                                stroke="#7E1A8B"
                                strokeWidth={2.5}
                                fill="url(#fillRevenue)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                {/* Mais vendidos */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <div className="flex items-center gap-2 mb-1">
                        <Trophy className="h-4 w-4 text-amber-500" />
                        <h2 className="font-bold text-gray-900">Mais vendidos</h2>
                    </div>
                    <p className="text-sm text-gray-400 mb-5">No mês atual</p>

                    {topProducts.length === 0 ? (
                        <div className="py-12 flex flex-col items-center text-center">
                            <Package className="h-10 w-10 text-gray-200 mb-3" />
                            <p className="text-sm font-medium text-gray-400">Nenhuma venda ainda</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {topProducts.map((p, idx) => (
                                <div key={p.name} className="flex items-center gap-3">
                                    <span className={
                                        idx === 0
                                            ? "h-7 w-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-extrabold shrink-0"
                                            : "h-7 w-7 rounded-lg bg-gray-50 text-gray-500 flex items-center justify-center text-xs font-bold shrink-0"
                                    }>
                                        {idx + 1}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-semibold text-gray-900 truncate">{p.name}</p>
                                        <p className="text-xs text-gray-400">{formatCurrency(p.revenue)}</p>
                                    </div>
                                    <Badge variant="brand">{p.quantity}</Badge>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
