import React, { useCallback, useEffect, useState } from 'react';
import {
    Tag, Wallet, TrendingUp, Boxes, Search, Loader2, PackageX, AlertTriangle,
    CircleSlash, BadgeDollarSign, ArrowUpNarrowWide, ArrowDownNarrowWide, X,
} from 'lucide-react';
import { StatCard } from '../molecules/StatCard';
import { LoadMore } from '../molecules/LoadMore';
import { Input } from '../atoms/Input';
import { Select } from '../atoms/Select';
import { Badge } from '../atoms/Badge';
import { cn, formatCurrency, formatQuantity, marginPercent } from '../../lib/utils';
import { usePagedList } from '../../hooks/usePagedList';
import { getInventoryOverview, listInventory } from '../../services/mercadinhoService';

const SITUACOES = [
    { id: 'todos', label: 'Todos os produtos' },
    { id: 'comEstoque', label: 'Com estoque' },
    { id: 'zerado', label: 'Zerados ou negativos' },
    { id: 'baixo', label: 'Abaixo do mínimo' },
    { id: 'semCusto', label: 'Sem custo' },
];

const ORDENS = [
    { id: 'maisValor', label: 'Mais valor em venda' },
    { id: 'maisCusto', label: 'Mais valor em custo' },
    { id: 'maisEstoque', label: 'Mais estoque' },
    { id: 'menosEstoque', label: 'Menos estoque' },
    { id: 'nome', label: 'Nome' },
];

/**
 * A foto do que está na prateleira: quanto vale, pelo que foi pago e pelo que
 * entra se tudo for vendido, e onde está cada coisa.
 *
 * Os totais vêm somados do banco — o cadastro tem milhares de produtos, e
 * baixar todos para somar aqui é exatamente o que travava a tela de Produtos.
 * A tabela embaixo carrega por partes.
 */
export function InventoryView() {
    const [overview, setOverview] = useState(null);
    const [overviewError, setOverviewError] = useState('');

    const [busca, setBusca] = useState('');
    const [buscaAplicada, setBuscaAplicada] = useState('');
    const [categoria, setCategoria] = useState('');
    const [situacao, setSituacao] = useState('todos');
    const [ordem, setOrdem] = useState('maisValor');

    useEffect(() => {
        getInventoryOverview()
            .then(setOverview)
            .catch((err) => {
                console.error(err);
                setOverviewError('Não consegui calcular o resumo do estoque.');
            });
    }, []);

    // Busca no banco: espera parar de digitar para não fazer uma consulta por tecla.
    useEffect(() => {
        const t = setTimeout(() => setBuscaAplicada(busca), 300);
        return () => clearTimeout(t);
    }, [busca]);

    const buscarPagina = useCallback(({ limit, offset }) => listInventory({
        limit, offset, search: buscaAplicada, category: categoria, situation: situacao, order: ordem,
    }), [buscaAplicada, categoria, situacao, ordem]);

    const {
        rows, total, loading, loadingMore, error, temMais, carregarMais,
    } = usePagedList(buscarPagina, [buscaAplicada, categoria, situacao, ordem], { pageSize: 50 });

    const filtrarPor = (id) => {
        setSituacao(id);
        document.getElementById('tabela-estoque')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const o = overview;
    const lucro = o ? Number(o.sale_value) - Number(o.cost_value) : 0;
    const categorias = (o?.by_category ?? []).filter((c) => c.category !== 'Sem categoria');
    const maiorCategoria = Math.max(1, ...(o?.by_category ?? []).map((c) => Number(c.sale_value)));

    return (
        <div className="space-y-6">
            {overviewError && (
                <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm font-medium border border-red-100">
                    {overviewError}
                </div>
            )}

            {/* Números grandes */}
            <div className="grid grid-cols-4 gap-4">
                <StatCard
                    icon={Tag} tone="success"
                    label="Estoque a preço de venda"
                    value={o ? formatCurrency(o.sale_value) : '…'}
                    hint="O que entra se tudo for vendido"
                />
                <StatCard
                    icon={Wallet} tone="info"
                    label="Estoque a preço de custo"
                    value={o ? formatCurrency(o.cost_value) : '…'}
                    hint="O que foi pago pelo que está na loja"
                />
                <StatCard
                    icon={TrendingUp} tone="brand"
                    label="Lucro possível"
                    value={o ? formatCurrency(lucro) : '…'}
                    hint={o ? `Margem de ${marginPercent(o.sale_value, o.cost_value).toFixed(0)}% sobre a venda` : ''}
                />
                <StatCard
                    icon={Boxes} tone="warning"
                    label="Produtos"
                    value={o ? Number(o.products).toLocaleString('pt-BR') : '…'}
                    hint={o ? [
                        `${Number(o.with_stock).toLocaleString('pt-BR')} com estoque`,
                        `${formatQuantity(o.units, 'un')}`,
                        Number(o.kg) > 0 ? formatQuantity(o.kg, 'kg') : null,
                    ].filter(Boolean).join(' · ') : ''}
                />
            </div>

            {/* O que precisa de atenção. Cada um filtra a tabela. */}
            {o && (
                <div className="grid grid-cols-4 gap-3">
                    <Alerta
                        icon={PackageX} tone="gray" n={o.zero} texto="zerados"
                        onClick={() => filtrarPor('zerado')}
                    />
                    <Alerta
                        icon={AlertTriangle} tone="amber" n={o.low} texto="abaixo do mínimo"
                        onClick={() => filtrarPor('baixo')}
                    />
                    <Alerta
                        icon={CircleSlash} tone="red" n={o.negative} texto="com estoque negativo"
                        dica="Vendeu mais do que deu entrada: falta lançar alguma entrada."
                        onClick={() => filtrarPor('zerado')}
                    />
                    <Alerta
                        icon={BadgeDollarSign} tone="blue" n={o.no_cost} texto="sem custo cadastrado"
                        dica="O lucro possível desses sai inflado: custo zero conta como 100% de margem."
                        onClick={() => filtrarPor('semCusto')}
                    />
                </div>
            )}

            {/* Rankings */}
            {o && (
                <div className="grid grid-cols-3 gap-4">
                    <Ranking
                        titulo="Mais estoque" icon={ArrowUpNarrowWide}
                        itens={o.most}
                        valor={(p) => formatQuantity(p.stock_quantity, p.unit)}
                    />
                    <Ranking
                        titulo="Menos estoque" icon={ArrowDownNarrowWide}
                        subtitulo="Entre os que ainda têm"
                        itens={o.least}
                        valor={(p) => formatQuantity(p.stock_quantity, p.unit)}
                        alerta={(p) => Number(p.min_stock) > 0 && Number(p.stock_quantity) <= Number(p.min_stock)}
                    />
                    <Ranking
                        titulo="Onde o dinheiro está parado" icon={Tag}
                        subtitulo="Valor em venda"
                        itens={o.top_value}
                        valor={(p) => formatCurrency(p.sale_value)}
                        detalhe={(p) => `custo ${formatCurrency(p.cost_value)}`}
                    />
                </div>
            )}

            {/* Por categoria */}
            {o && o.by_category.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="font-bold text-gray-900">Por categoria</h2>
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span className="flex items-center gap-1.5">
                                <span className="h-2.5 w-2.5 rounded-sm bg-[#7E1A8B]/25" /> venda
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span className="h-2.5 w-2.5 rounded-sm bg-[#7E1A8B]" /> custo
                            </span>
                        </div>
                    </div>
                    <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                        {o.by_category.map((c) => {
                            const venda = Number(c.sale_value);
                            const custo = Number(c.cost_value);
                            return (
                                <button
                                    key={c.category}
                                    type="button"
                                    disabled={c.category === 'Sem categoria'}
                                    onClick={() => { setCategoria(c.category); filtrarPor('todos'); }}
                                    className="w-full text-left group disabled:cursor-default"
                                >
                                    <div className="flex items-baseline justify-between gap-3 mb-1">
                                        <span className="text-sm font-semibold text-gray-800 truncate group-enabled:group-hover:text-[#7E1A8B]">
                                            {c.category}
                                            <span className="ml-2 text-xs font-normal text-gray-400">
                                                {c.products} {Number(c.products) === 1 ? 'produto' : 'produtos'}
                                            </span>
                                        </span>
                                        <span className="text-sm font-bold text-gray-900 shrink-0">
                                            {formatCurrency(venda)}
                                            <span className="ml-2 text-xs font-normal text-gray-400">
                                                custo {formatCurrency(custo)}
                                            </span>
                                        </span>
                                    </div>
                                    <div className="relative h-2.5 rounded-full bg-gray-100 overflow-hidden">
                                        <div
                                            className="absolute inset-y-0 left-0 rounded-full bg-[#7E1A8B]/25"
                                            style={{ width: `${(venda / maiorCategoria) * 100}%` }}
                                        />
                                        <div
                                            className="absolute inset-y-0 left-0 rounded-full bg-[#7E1A8B]"
                                            style={{ width: `${(Math.min(custo, venda || custo) / maiorCategoria) * 100}%` }}
                                        />
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Tabela completa */}
            <div id="tabela-estoque" className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden scroll-mt-4">
                <div className="p-5 border-b border-gray-100 flex items-center gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                            value={busca}
                            onChange={(e) => setBusca(e.target.value)}
                            placeholder="Buscar produto ou código"
                            className="pl-10 pr-9"
                        />
                        {busca && (
                            <button
                                onClick={() => setBusca('')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 rounded flex items-center justify-center text-gray-400 hover:text-gray-600"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>
                    <div className="w-48">
                        <Select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
                            <option value="">Todas as categorias</option>
                            {categorias.map((c) => (
                                <option key={c.category} value={c.category}>{c.category}</option>
                            ))}
                        </Select>
                    </div>
                    <div className="w-52">
                        <Select value={situacao} onChange={(e) => setSituacao(e.target.value)}>
                            {SITUACOES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                        </Select>
                    </div>
                    <div className="w-52">
                        <Select value={ordem} onChange={(e) => setOrdem(e.target.value)}>
                            {ORDENS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                        </Select>
                    </div>
                </div>

                {error && <p className="p-5 text-sm text-red-600">{error}</p>}

                {loading ? (
                    <div className="p-16 flex items-center justify-center text-gray-400">
                        <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                ) : rows.length === 0 ? (
                    <div className="p-16 text-center">
                        <p className="font-semibold text-gray-500">Nenhum produto com esses filtros</p>
                    </div>
                ) : (
                    <>
                        <table className="w-full">
                            <thead className="bg-gray-50/80">
                                <tr className="text-[11px] uppercase tracking-wide text-gray-500">
                                    <th className="text-left font-bold px-5 py-2.5">Produto</th>
                                    <th className="text-right font-bold px-3 py-2.5 w-32">Estoque</th>
                                    <th className="text-right font-bold px-3 py-2.5 w-24">Custo un.</th>
                                    <th className="text-right font-bold px-3 py-2.5 w-24">Venda un.</th>
                                    <th className="text-right font-bold px-3 py-2.5 w-32">Valor custo</th>
                                    <th className="text-right font-bold px-3 py-2.5 w-32">Valor venda</th>
                                    <th className="text-right font-bold px-5 py-2.5 w-32">Lucro</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((p) => {
                                    const qtd = Number(p.stock_quantity);
                                    return (
                                        <tr key={p.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                                            <td className="px-5 py-2.5">
                                                <p className="text-sm font-semibold text-gray-900">{p.name}</p>
                                                <p className="text-xs text-gray-400">
                                                    {[p.barcode, p.category].filter(Boolean).join(' · ') || 'sem código'}
                                                </p>
                                            </td>
                                            <td className="px-3 py-2.5 text-right">
                                                <span className={cn(
                                                    "text-sm font-bold",
                                                    qtd < 0 ? "text-red-600" : qtd === 0 ? "text-gray-400"
                                                        : p.is_low ? "text-amber-600" : "text-gray-900"
                                                )}>
                                                    {formatQuantity(qtd, p.unit)}
                                                </span>
                                                {p.is_low && qtd > 0 && (
                                                    <p className="text-[10px] text-amber-600">mín. {Number(p.min_stock)}</p>
                                                )}
                                            </td>
                                            <td className="px-3 py-2.5 text-right text-sm text-gray-600">
                                                {Number(p.cost_price) > 0
                                                    ? formatCurrency(p.cost_price)
                                                    : <Badge variant="info">sem custo</Badge>}
                                            </td>
                                            <td className="px-3 py-2.5 text-right text-sm text-gray-600">
                                                {formatCurrency(p.sale_price)}
                                            </td>
                                            <td className="px-3 py-2.5 text-right text-sm text-gray-700">
                                                {formatCurrency(p.cost_value)}
                                            </td>
                                            <td className="px-3 py-2.5 text-right text-sm font-bold text-gray-900">
                                                {formatCurrency(p.sale_value)}
                                            </td>
                                            <td className={cn(
                                                "px-5 py-2.5 text-right text-sm font-semibold",
                                                Number(p.profit_value) < 0 ? "text-red-600" : "text-emerald-600"
                                            )}>
                                                {formatCurrency(p.profit_value)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        <LoadMore
                            carregados={rows.length} total={total} temMais={temMais}
                            carregando={loadingMore} onCarregarMais={carregarMais} nome="produtos"
                        />
                    </>
                )}
            </div>
        </div>
    );
}

const ALERTA_TONS = {
    gray: 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100',
    red: 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100',
    blue: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100',
};

function Alerta({ icon: Icon, tone, n, texto, dica, onClick }) {
    const zero = Number(n) === 0;
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={zero}
            title={dica}
            className={cn(
                "rounded-xl border px-4 py-3 flex items-center gap-3 text-left transition-colors",
                zero ? "bg-white border-gray-100 text-gray-400 cursor-default" : ALERTA_TONS[tone]
            )}
        >
            <Icon className="h-5 w-5 shrink-0" />
            <span className="text-2xl font-extrabold">{Number(n).toLocaleString('pt-BR')}</span>
            <span className="text-sm font-semibold leading-tight">{texto}</span>
        </button>
    );
}

function Ranking({ titulo, subtitulo, icon: Icon, itens, valor, detalhe, alerta }) {
    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-1">
                <Icon className="h-4 w-4 text-[#7E1A8B]" />
                <h2 className="font-bold text-gray-900">{titulo}</h2>
            </div>
            {subtitulo && <p className="text-xs text-gray-400 mb-3">{subtitulo}</p>}
            {itens.length === 0 ? (
                <p className="text-sm text-gray-400 py-6 text-center">Nada por aqui</p>
            ) : (
                <ol className={cn("space-y-2", !subtitulo && "mt-3")}>
                    {itens.map((p, i) => (
                        <li key={p.id} className="flex items-center gap-3">
                            <span className="h-6 w-6 rounded-lg bg-gray-50 text-[11px] font-bold text-gray-400 flex items-center justify-center shrink-0">
                                {i + 1}
                            </span>
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-gray-800 truncate">{p.name}</p>
                                {detalhe && <p className="text-[11px] text-gray-400">{detalhe(p)}</p>}
                            </div>
                            <span className={cn(
                                "text-sm font-bold shrink-0",
                                alerta?.(p) ? "text-amber-600" : "text-gray-900"
                            )}>
                                {valor(p)}
                            </span>
                        </li>
                    ))}
                </ol>
            )}
        </div>
    );
}
