import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    PackagePlus, ScanBarcode, Search, Trash2, Loader2, AlertTriangle,
    TrendingDown, Camera, Check, FilterX, X, Clock, Boxes, ClipboardList, Percent,
} from 'lucide-react';
import { Button } from '../atoms/Button';
import { Input } from '../atoms/Input';
import { Select } from '../atoms/Select';
import { Badge } from '../atoms/Badge';
import { cn, formatCurrency, formatDate, toISODate } from '../../lib/utils';
import { PeriodFilter, PERIOD_PRESETS } from '../molecules/PeriodFilter';
import { CostField } from '../molecules/CostField';
import { emptyCost, resolveCost } from '../../lib/costRule';
import {
    findProductByBarcode, searchProducts, createStockEntry, confirmStockEntryCost,
    listStockEntries, deleteStockEntry, listSuppliers, listLowStock, listAwaitingCostEntries,
} from '../../services/mercadinhoService';
import { useProfile } from '../../contexts/ProfileContext';
import { CameraScannerModal } from '../organisms/CameraScannerModal';
import { ProductFormModal } from '../organisms/ProductFormModal';
import { BulkCostModal } from '../organisms/BulkCostModal';
import { InventoryView } from '../organisms/InventoryView';

const PAYMENT_METHODS = ['Dinheiro', 'PIX', 'Débito', 'Crédito', 'Boleto', 'A prazo'];

const TABS = [
    { id: 'entradas', label: 'Entradas', icon: ClipboardList },
    { id: 'estoque', label: 'Estoque', icon: Boxes },
];

/**
 * Estoque: duas telas numa.
 *
 * "Entradas" é o registro do que chegou. "Estoque" é a foto do que está na
 * prateleira agora — quanto vale, o que tem mais, o que está acabando.
 *
 * As duas servem ao administrador e ao funcionário: quem recebe a mercadoria no
 * balcão é o funcionário, e ele precisa ver o que tem para saber o que pedir.
 */
export function StockPage() {
    const [tab, setTab] = useState('entradas');

    return (
        <div className="space-y-6">
            <div className="flex items-end justify-between gap-6">
                <div>
                    <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Estoque</h1>
                    <p className="text-sm text-gray-500 mt-0.5">
                        {tab === 'entradas'
                            ? 'Registre as compras de reposição. O estoque sobe sozinho a cada entrada.'
                            : 'Tudo o que está na loja agora, e quanto isso vale.'}
                    </p>
                </div>

                <div className="flex p-1 rounded-2xl bg-white border border-gray-100 shadow-sm">
                    {TABS.map(({ id, label, icon: Icon }) => (
                        <button
                            key={id}
                            onClick={() => setTab(id)}
                            className={cn(
                                "flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all",
                                tab === id
                                    ? "bg-[#7E1A8B] text-white shadow-md shadow-[#7E1A8B]/20"
                                    : "text-gray-500 hover:text-gray-800 hover:bg-gray-50"
                            )}
                        >
                            <Icon className="h-4 w-4" />
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {tab === 'entradas' ? <StockEntriesView /> : <InventoryView />}
        </div>
    );
}

const emptyForm = () => ({
    product: null,
    quantity: '',
    cost: emptyCost(),
    supplier_id: '',
    entry_date: toISODate(),
    payment_method: 'Dinheiro',
    note: '',
});

/** "maria@funcionario.local" → "maria". Para o dono, o e-mail inteiro diz menos que o nome. */
const quemLancou = (email) => {
    if (!email) return '';
    const nome = email.split('@')[0];
    return nome.charAt(0).toUpperCase() + nome.slice(1);
};

function StockEntriesView() {
    const { isAdmin } = useProfile();

    // Entrada esperando o valor real da compra.
    const [confirmando, setConfirmando] = useState(null);
    const [custoConfirmado, setCustoConfirmado] = useState(emptyCost);
    const [confirmandoSalvando, setConfirmandoSalvando] = useState(false);
    const [loteAberto, setLoteAberto] = useState(false);
    const [pendentes, setPendentes] = useState(0);

    const [form, setForm] = useState(emptyForm);
    const [entries, setEntries] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [lowStock, setLowStock] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [cameraOpen, setCameraOpen] = useState(false);
    const [quickAddOpen, setQuickAddOpen] = useState(false);
    const [notFoundCode, setNotFoundCode] = useState('');

    const scanRef = useRef(null);
    const focusScan = useCallback(() => {
        requestAnimationFrame(() => scanRef.current?.focus());
    }, []);

    // Filtros do histórico de entradas
    const [preset, setPreset] = useState('mes');
    const [customFrom, setCustomFrom] = useState(toISODate());
    const [customTo, setCustomTo] = useState(toISODate());
    const [filterSupplier, setFilterSupplier] = useState('');
    const [filterText, setFilterText] = useState('');

    const range = useMemo(() => (
        preset === 'custom'
            ? { from: customFrom, to: customTo }
            : PERIOD_PRESETS[preset].range()
    ), [preset, customFrom, customTo]);

    const load = async () => {
        setLoading(true);
        try {
            // entry_date é coluna `date`, então compara direto com YYYY-MM-DD.
            const [e, s, l, p] = await Promise.all([
                listStockEntries({ from: range.from, to: range.to, limit: 1000 }),
                // Fornecedor é detalhe: se a lista não vier, a entrada continua.
                listSuppliers().catch(() => []),
                listLowStock(),
                // Pendentes de qualquer data, e não só do período: a entrada
                // esquecida do mês passado é justamente a que mais precisa aparecer.
                listAwaitingCostEntries(),
            ]);
            setEntries(e);
            setSuppliers(s);
            setLowStock(l);
            setPendentes(p.length);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { load(); }, [range.from, range.to]);

    const abrirConfirmacao = (entry) => {
        setConfirmando(entry);
        setCustoConfirmado(emptyCost());
    };

    /**
     * Confirma quanto foi pago numa entrada que ficou com custo estimado.
     *
     * Passa pelo banco porque o custo do produto anda junto: corrigir só a
     * linha deixaria `products.cost_price` com a estimativa antiga, e a margem
     * do dashboard continuaria errada sem nada na tela indicando isso.
     */
    const confirmarCusto = async () => {
        const valor = resolveCost(custoConfirmado, confirmando.products?.sale_price);
        if (valor === null || Number.isNaN(valor)) return;

        setConfirmandoSalvando(true);
        try {
            await confirmStockEntryCost({ entryId: confirmando.id, unitCost: valor });
            setConfirmando(null);
            load();
        } catch (err) {
            console.error(err);
            alert(err?.message ?? 'Não consegui confirmar o custo.');
        } finally {
            setConfirmandoSalvando(false);
        }
    };

    const visibleEntries = useMemo(() => {
        const term = filterText.trim().toLowerCase();

        return entries.filter((e) => {
            if (filterSupplier && e.supplier_id !== filterSupplier) return false;
            if (term) {
                const haystack = [e.product_name, e.barcode ?? '', e.note ?? '']
                    .join(' ').toLowerCase();
                if (!haystack.includes(term)) return false;
            }
            return true;
        });
    }, [entries, filterSupplier, filterText]);

    const hasFilters = filterSupplier !== '' || filterText.trim() !== '';

    const clearFilters = () => {
        setFilterSupplier('');
        setFilterText('');
    };

    // Busca de produto para a entrada
    useEffect(() => {
        const term = searchTerm.trim();
        if (term.length < 2) {
            setSearchResults([]);
            return;
        }
        const timer = setTimeout(() => {
            // withCost: o último custo pago aparece como sugestão.
            searchProducts(term, { withCost: true })
                .then(setSearchResults)
                .catch(() => setSearchResults([]));
        }, 250);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const selectProduct = (product) => {
        setForm((f) => ({
            ...f,
            product,
            // O custo NÃO vem preenchido. Preencher com o último custo faria
            // quem não sabe o valor confirmar sem querer um preço antigo — e a
            // entrada deixaria de aparecer como "a confirmar". O último custo
            // fica à vista, com um clique para usar.
            cost: emptyCost(),
            supplier_id: f.supplier_id || product.supplier_id || '',
        }));
        setSearchTerm('');
        setSearchResults([]);
        setNotFoundCode('');
    };

    const handleCode = async (code) => {
        const clean = code.trim();
        if (!clean) return;

        try {
            const product = await findProductByBarcode(clean, { withCost: true });
            if (product) selectProduct(product);
            else setNotFoundCode(clean);
        } catch (err) {
            console.error(err);
            setError('Erro ao buscar o produto.');
        }
    };

    const unitCost = resolveCost(form.cost, form.product?.sale_price);
    const totalCost = (Number(form.quantity) || 0) * (Number.isNaN(unitCost) ? 0 : (unitCost ?? 0));

    const periodTotal = useMemo(
        () => visibleEntries.reduce((sum, e) => sum + Number(e.total_cost), 0),
        [visibleEntries]
    );

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (!form.product) {
            setError('Escolha o produto primeiro (bipe ou busque pelo nome).');
            return;
        }
        if (!(Number(form.quantity) > 0)) {
            setError('Informe a quantidade que entrou.');
            return;
        }
        if (Number.isNaN(unitCost)) {
            setError(form.cost.mode === 'percent'
                ? 'O percentual precisa estar entre 0 e 100.'
                : 'Confira o custo digitado.');
            return;
        }

        setSaving(true);
        try {
            await createStockEntry({
                product_id: form.product.id,
                barcode: form.product.barcode,
                product_name: form.product.name,
                quantity: form.quantity,
                unit_cost: unitCost,
                supplier_id: form.supplier_id,
                entry_date: form.entry_date,
                payment_method: form.payment_method,
                note: form.note,
            });

            setSuccess(`Entrada registrada: ${form.quantity} × ${form.product.name}`
                + (unitCost === null ? ' (custo a confirmar).' : '.'));
            setForm(emptyForm());
            focusScan();
            load();
            setTimeout(() => setSuccess(''), 3500);
        } catch (err) {
            console.error(err);
            setError('Não consegui registrar a entrada. Tente de novo.');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (entry) => {
        const ok = window.confirm(
            `Excluir a entrada de ${entry.quantity} × ${entry.product_name}?\n\n` +
            'O estoque volta ao que era antes desta entrada.'
        );
        if (!ok) return;

        try {
            await deleteStockEntry(entry.id);
            load();
        } catch (err) {
            console.error(err);
            alert('Não consegui excluir a entrada.');
        }
    };

    const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

    const custoConfirmadoValor = confirmando
        ? resolveCost(custoConfirmado, confirmando.products?.sale_price)
        : null;
    const custoConfirmadoOk = custoConfirmadoValor !== null && !Number.isNaN(custoConfirmadoValor);

    return (
        <div className="space-y-6">
            {/* Entradas esperando custo */}
            {pendentes > 0 && (
                <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-amber-100 flex items-center justify-center">
                            <Clock className="h-5 w-5 text-amber-600" />
                        </div>
                        <div>
                            <p className="font-bold text-amber-900">
                                {pendentes} {pendentes === 1 ? 'entrada está' : 'entradas estão'} com custo a confirmar
                            </p>
                            <p className="text-xs text-amber-700">
                                Foram lançadas sem o valor pago. Dá para confirmar todas de uma vez, por percentual.
                            </p>
                        </div>
                    </div>
                    <Button variant="brand" onClick={() => setLoteAberto(true)}>
                        <Percent className="h-4 w-4 mr-2" />
                        Confirmar em lote
                    </Button>
                </div>
            )}

            {/* Alerta de estoque baixo */}
            {lowStock.length > 0 && (
                <div className="rounded-2xl bg-amber-50 border border-amber-200 p-5">
                    <div className="flex items-center gap-2 mb-3">
                        <AlertTriangle className="h-5 w-5 text-amber-600" />
                        <h2 className="font-bold text-amber-800">
                            {lowStock.length} {lowStock.length === 1 ? 'produto precisa' : 'produtos precisam'} de reposição
                        </h2>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {lowStock.map((p) => (
                            <button
                                key={p.id}
                                onClick={() => selectProduct(p)}
                                className="px-3 py-1.5 rounded-lg bg-white border border-amber-200 text-sm font-semibold text-amber-800 hover:bg-amber-100 transition-colors"
                                title="Clique para dar entrada neste produto"
                            >
                                {p.name}
                                <span className="ml-2 text-xs font-normal text-amber-600">
                                    {Number(p.stock_quantity)}/{Number(p.min_stock)} {p.unit}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div className="flex gap-6 items-start">
                {/* Formulário de entrada */}
                <form
                    onSubmit={handleSubmit}
                    className="w-[420px] shrink-0 bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5"
                >
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-[#7E1A8B]/10 flex items-center justify-center">
                            <PackagePlus className="h-5 w-5 text-[#7E1A8B]" />
                        </div>
                        <h2 className="font-bold text-gray-900">Nova entrada</h2>
                    </div>

                    {error && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm font-medium border border-red-100">
                            {error}
                        </div>
                    )}
                    {success && (
                        <div className="bg-emerald-50 text-emerald-700 p-3 rounded-xl text-sm font-medium border border-emerald-100 flex items-center gap-2">
                            <Check className="h-4 w-4 shrink-0" /> {success}
                        </div>
                    )}

                    {/* Produto */}
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-700">Produto *</label>

                        {form.product ? (
                            <div className="flex items-center justify-between gap-3 rounded-xl border-2 border-[#7E1A8B]/30 bg-[#7E1A8B]/[0.04] p-3">
                                <div className="min-w-0">
                                    <p className="text-sm font-bold text-gray-900 truncate">{form.product.name}</p>
                                    <p className="text-xs text-gray-500 font-mono">
                                        {form.product.barcode || 'sem código'} · estoque {Number(form.product.stock_quantity)}
                                        {' · venda '}{formatCurrency(form.product.sale_price)}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setForm((f) => ({ ...f, product: null }))}
                                    className="text-xs font-semibold text-gray-400 hover:text-red-600 shrink-0"
                                >
                                    trocar
                                </button>
                            </div>
                        ) : (
                            <>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                        <Input
                                            ref={scanRef}
                                            autoFocus
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key !== 'Enter') return;
                                                e.preventDefault();

                                                const term = searchTerm.trim();
                                                // Leitor USB manda Enter no fim, e código de barras é
                                                // sempre numérico. Se for texto, o Enter escolhe o
                                                // primeiro resultado da busca por nome.
                                                if (/^\d{6,}$/.test(term)) handleCode(term);
                                                else if (searchResults.length > 0) selectProduct(searchResults[0]);
                                            }}
                                            placeholder="Bipe ou busque pelo nome"
                                            className="pl-10"
                                        />
                                    </div>
                                    <Button type="button" variant="outline" size="icon" onClick={() => setCameraOpen(true)}>
                                        <Camera className="h-4 w-4" />
                                    </Button>
                                </div>

                                {searchResults.length > 0 && (
                                    <div className="rounded-xl border border-gray-200 shadow-sm max-h-56 overflow-y-auto">
                                        {searchResults.map((p) => (
                                            <button
                                                key={p.id}
                                                type="button"
                                                onClick={() => selectProduct(p)}
                                                className="w-full text-left px-3 py-2.5 hover:bg-gray-50 border-b border-gray-50 last:border-0"
                                            >
                                                <p className="text-sm font-semibold text-gray-900 truncate">{p.name}</p>
                                                <p className="text-xs text-gray-400 font-mono">
                                                    {p.barcode || 'sem código'}
                                                </p>
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {notFoundCode && (
                                    <div className="flex items-center justify-between gap-2 rounded-xl bg-amber-50 border border-amber-200 p-3">
                                        <p className="text-xs text-amber-800">
                                            <span className="font-mono font-semibold">{notFoundCode}</span> não cadastrado
                                        </p>
                                        <Button type="button" size="sm" variant="brand" onClick={() => setQuickAddOpen(true)}>
                                            Cadastrar
                                        </Button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-700">Quantidade *</label>
                        <Input
                            type="number" step="0.001" min="0"
                            value={form.quantity}
                            onChange={set('quantity')}
                            placeholder="0"
                        />
                        {form.product && Number(form.quantity) > 0 && (
                            <p className="text-xs font-semibold text-emerald-600">
                                Estoque ficará em {Number(form.product.stock_quantity) + Number(form.quantity)} {form.product.unit}
                            </p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-baseline justify-between">
                            <label className="text-sm font-semibold text-gray-700">Custo unitário</label>
                            <span className="text-xs text-gray-400">opcional</span>
                        </div>
                        <CostField
                            value={form.cost}
                            onChange={(cost) => setForm((f) => ({ ...f, cost }))}
                            salePrice={form.product?.sale_price}
                        />
                        {form.product && Number(form.product.cost_price) > 0 && form.cost.amount === '' && (
                            <button
                                type="button"
                                onClick={() => setForm((f) => ({
                                    ...f,
                                    cost: { mode: 'valor', amount: String(f.product.cost_price) },
                                }))}
                                className="text-xs text-[#7E1A8B] font-semibold hover:underline"
                            >
                                Usar o último custo: {formatCurrency(form.product.cost_price)}
                            </button>
                        )}
                        {form.cost.amount === '' && (
                            <p className="text-xs text-gray-400">
                                Sem o valor, a entrada fica como “custo a confirmar” para alguém preencher depois.
                            </p>
                        )}
                    </div>

                    {totalCost > 0 && (
                        <div className="rounded-xl bg-gray-50 p-4 flex justify-between items-baseline">
                            <span className="text-sm font-semibold text-gray-600">Total da compra</span>
                            <span className="text-2xl font-extrabold text-gray-900">
                                {formatCurrency(totalCost)}
                            </span>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700">Data</label>
                            <Input type="date" value={form.entry_date} onChange={set('entry_date')} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700">Pagamento</label>
                            <Select value={form.payment_method} onChange={set('payment_method')}>
                                {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-700">Fornecedor</label>
                        <Select value={form.supplier_id} onChange={set('supplier_id')}>
                            <option value="">Nenhum</option>
                            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-700">Observação</label>
                        <Input value={form.note} onChange={set('note')} placeholder="Opcional" />
                    </div>

                    <Button type="submit" variant="brand" size="lg" className="w-full" disabled={saving}>
                        {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                        Registrar entrada
                    </Button>
                </form>

                {/* Histórico de entradas */}
                <div className="flex-1 min-w-0 space-y-4">
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="h-11 w-11 rounded-xl bg-red-50 flex items-center justify-center">
                                <TrendingDown className="h-5 w-5 text-red-600" />
                            </div>
                            <div>
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                    Gasto com reposição no período
                                </p>
                                <p className="text-2xl font-extrabold text-gray-900">
                                    {formatCurrency(periodTotal)}
                                </p>
                            </div>
                        </div>
                        <Badge variant="default">
                            {visibleEntries.length} {visibleEntries.length === 1 ? 'entrada' : 'entradas'}
                        </Badge>
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

                        <div className="flex items-center gap-3">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <Input
                                    value={filterText}
                                    onChange={(e) => setFilterText(e.target.value)}
                                    placeholder="Buscar por produto, código ou observação"
                                    className="pl-10 pr-9"
                                />
                                {filterText && (
                                    <button
                                        onClick={() => setFilterText('')}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 rounded flex items-center justify-center text-gray-400 hover:text-gray-600"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                )}
                            </div>

                            <div className="w-56">
                                <Select
                                    value={filterSupplier}
                                    onChange={(e) => setFilterSupplier(e.target.value)}
                                >
                                    <option value="">Todos os fornecedores</option>
                                    {suppliers.map((s) => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </Select>
                            </div>

                            {hasFilters && (
                                <Button variant="outline" onClick={clearFilters}>
                                    <FilterX className="h-4 w-4 mr-2" />
                                    Limpar
                                </Button>
                            )}
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="px-5 py-4 border-b border-gray-100">
                            <h2 className="font-bold text-gray-900">Entradas do período</h2>
                        </div>

                        {loading ? (
                            <div className="p-16 flex items-center justify-center text-gray-400">
                                <Loader2 className="h-6 w-6 animate-spin" />
                            </div>
                        ) : visibleEntries.length === 0 ? (
                            <div className="p-16 flex flex-col items-center text-center">
                                <div className="h-16 w-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-4">
                                    <PackagePlus className="h-8 w-8 text-gray-300" />
                                </div>
                                <p className="font-semibold text-gray-500">
                                    {entries.length === 0
                                        ? 'Nenhuma entrada neste período'
                                        : 'Nenhuma entrada com esses filtros'}
                                </p>
                                <p className="text-sm text-gray-400 mt-1">
                                    {entries.length === 0
                                        ? 'Registre a primeira compra no formulário ao lado.'
                                        : `${entries.length} ${entries.length === 1 ? 'entrada foi escondida' : 'entradas foram escondidas'} pelos filtros.`}
                                </p>
                                {entries.length > 0 && (
                                    <Button variant="outline" className="mt-5" onClick={clearFilters}>
                                        <FilterX className="h-4 w-4 mr-2" />
                                        Limpar filtros
                                    </Button>
                                )}
                            </div>
                        ) : (
                            <div className="max-h-[520px] overflow-y-auto">
                                <table className="w-full">
                                    <thead className="sticky top-0 bg-gray-50/90 backdrop-blur">
                                        <tr className="text-[11px] uppercase tracking-wide text-gray-500">
                                            <th className="text-left font-bold px-5 py-2.5">Produto</th>
                                            <th className="text-left font-bold px-3 py-2.5 w-28">Data</th>
                                            <th className="text-right font-bold px-3 py-2.5 w-20">Qtd</th>
                                            <th className="text-right font-bold px-3 py-2.5 w-28">Unit.</th>
                                            <th className="text-right font-bold px-3 py-2.5 w-28">Total</th>
                                            <th className="w-20" />
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {visibleEntries.map((e) => (
                                            <tr key={e.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
                                                <td className="px-5 py-3">
                                                    <p className="text-sm font-semibold text-gray-900">{e.product_name}</p>
                                                    <p className="text-xs text-gray-400">
                                                        {[
                                                            e.suppliers?.name,
                                                            e.payment_method,
                                                            e.user_email && `por ${quemLancou(e.user_email)}`,
                                                        ].filter(Boolean).join(' · ') || '—'}
                                                    </p>
                                                    {e.awaiting_cost && (
                                                        <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border bg-amber-50 text-amber-700 border-amber-200">
                                                            <Clock className="h-3 w-3" />
                                                            custo a confirmar
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-3 text-sm text-gray-600">
                                                    {formatDate(`${e.entry_date}T00:00:00`)}
                                                </td>
                                                <td className="px-3 py-3 text-right text-sm text-gray-600">
                                                    {Number(e.quantity)}
                                                </td>
                                                <td className={cn(
                                                    "px-3 py-3 text-right text-sm",
                                                    e.awaiting_cost ? "text-gray-400 italic" : "text-gray-600"
                                                )}>
                                                    {formatCurrency(e.unit_cost)}
                                                </td>
                                                <td className={cn(
                                                    "px-3 py-3 text-right text-sm font-bold",
                                                    e.awaiting_cost ? "text-gray-400 italic" : "text-gray-900"
                                                )}>
                                                    {formatCurrency(e.total_cost)}
                                                </td>
                                                <td className="px-3 py-3">
                                                  <div className="flex items-center justify-end gap-0.5">
                                                    {/* O valor gravado é o custo que o produto já
                                                        tinha, não o que foi pago. Confirmar corrige
                                                        os dois de uma vez. */}
                                                    {e.awaiting_cost && (
                                                        <button
                                                            onClick={() => abrirConfirmacao(e)}
                                                            className="h-8 w-8 rounded-lg flex items-center justify-center text-amber-500 hover:text-amber-700 hover:bg-amber-50 transition-colors"
                                                            title="Confirmar quanto foi pago"
                                                        >
                                                            <Clock className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                    {/* Excluir tira do estoque: fica com o dono. */}
                                                    {isAdmin && (
                                                        <button
                                                            onClick={() => handleDelete(e)}
                                                            className="h-8 w-8 rounded-lg flex items-center justify-center text-gray-300 hover:text-red-600 hover:bg-red-50 transition-colors"
                                                            title="Excluir entrada"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                  </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    <p className="flex items-center gap-2 text-xs text-gray-400">
                        <ScanBarcode className="h-3.5 w-3.5" />
                        Cada entrada com valor também atualiza o preço de custo do produto.
                    </p>
                </div>
            </div>

            {confirmando && (
                <div className="modal-overlay" onClick={() => setConfirmando(null)}>
                    <div
                        className="modal-content bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5"
                        onClick={(ev) => ev.stopPropagation()}
                    >
                        <div>
                            <h3 className="font-bold text-gray-900">Confirmar o custo</h3>
                            <p className="text-sm text-gray-500 mt-0.5">
                                {confirmando.product_name} · {Number(confirmando.quantity)}{' '}
                                {Number(confirmando.quantity) === 1 ? 'unidade' : 'unidades'}
                            </p>
                        </div>

                        <div className="bg-amber-50 border border-amber-100 text-amber-900 p-3 rounded-xl text-sm">
                            Esta entrada foi registrada sem o valor. O que está gravado é o custo
                            antigo do produto ({formatCurrency(confirmando.unit_cost)}), só uma estimativa.
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700">
                                Quanto foi pago por unidade?
                            </label>
                            <CostField
                                value={custoConfirmado}
                                onChange={setCustoConfirmado}
                                salePrice={confirmando.products?.sale_price}
                                autoFocus
                                big
                            />
                            {custoConfirmadoOk && (
                                <p className="text-center text-sm text-gray-500">
                                    Total da compra:{' '}
                                    <strong className="text-gray-800">
                                        {formatCurrency(Number(confirmando.quantity) * custoConfirmadoValor)}
                                    </strong>
                                </p>
                            )}
                        </div>

                        <div className="flex gap-3">
                            <Button
                                variant="outline" className="flex-1"
                                onClick={() => setConfirmando(null)}
                            >
                                Depois
                            </Button>
                            <Button
                                variant="success" className="flex-[2]"
                                onClick={confirmarCusto}
                                disabled={confirmandoSalvando || !custoConfirmadoOk}
                            >
                                {confirmandoSalvando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                Confirmar
                            </Button>
                        </div>

                        <p className="text-xs text-gray-400 text-center">
                            Isso também passa a valer como o custo do produto.
                        </p>
                    </div>
                </div>
            )}

            {loteAberto && (
                <BulkCostModal
                    onClose={() => setLoteAberto(false)}
                    onDone={(n) => {
                        setLoteAberto(false);
                        setSuccess(`${n} ${n === 1 ? 'custo confirmado' : 'custos confirmados'}.`);
                        setTimeout(() => setSuccess(''), 3500);
                        load();
                    }}
                />
            )}

            <CameraScannerModal
                isOpen={cameraOpen}
                onClose={() => setCameraOpen(false)}
                onDetect={(code) => { setCameraOpen(false); handleCode(code); }}
            />

            <ProductFormModal
                isOpen={quickAddOpen}
                initialBarcode={notFoundCode}
                onClose={() => setQuickAddOpen(false)}
                onSaved={(product) => { selectProduct(product); load(); }}
            />
        </div>
    );
}
