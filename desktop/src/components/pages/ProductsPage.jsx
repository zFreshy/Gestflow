import React, { useCallback, useEffect, useState } from 'react';
import {
    Package, Plus, Search, Pencil, Trash2, AlertTriangle, Loader2, ScanBarcode,
    FileSpreadsheet, FilterX, X, EyeOff,
} from 'lucide-react';
import { Button } from '../atoms/Button';
import { Input } from '../atoms/Input';
import { Select } from '../atoms/Select';
import { Badge } from '../atoms/Badge';
import { cn, formatCurrency, marginPercent } from '../../lib/utils';
import {
    listProducts, listProductCategories, deactivateProduct, deleteProduct,
} from '../../services/mercadinhoService';
import { usePagedList } from '../../hooks/usePagedList';
import { LoadMore } from '../molecules/LoadMore';
import { ProductFormModal } from '../organisms/ProductFormModal';
import { ImportProductsModal } from '../organisms/ImportProductsModal';
import { useBarcodeScanner } from '../../hooks/useBarcodeScanner';
import { useProfile } from '../../contexts/ProfileContext';

export function ProductsPage() {
    // Custo e margem são financeiro: o funcionário vê preço e estoque, só.
    const { isAdmin } = useProfile();
    const [search, setSearch] = useState('');
    // A busca vai para o banco, então esperar o operador parar de digitar evita
    // uma consulta por tecla.
    const [searchAplicada, setSearchAplicada] = useState('');
    const [categories, setCategories] = useState([]);
    const [showInactive, setShowInactive] = useState(false);
    const [category, setCategory] = useState('');
    const [situation, setSituation] = useState('todos'); // todos | baixo | zerado | semCodigo | semCusto
    const [modalOpen, setModalOpen] = useState(false);
    const [importOpen, setImportOpen] = useState(false);
    const [editing, setEditing] = useState(null);

    useEffect(() => {
        const t = setTimeout(() => setSearchAplicada(search), 300);
        return () => clearTimeout(t);
    }, [search]);

    // Funcionário lê a view sem custo; a tabela não devolve nada para ele.
    const buscarPagina = useCallback(({ limit, offset }) => listProducts({
        includeInactive: isAdmin && showInactive,
        withCost: isAdmin,
        limit,
        offset,
        search: searchAplicada,
        category,
        situation,
    }), [isAdmin, showInactive, searchAplicada, category, situation]);

    const {
        rows: products, total, loading, loadingMore, temMais, carregarMais, recarregar,
    } = usePagedList(
        buscarPagina,
        [isAdmin, showInactive, searchAplicada, category, situation],
    );

    const load = recarregar;

    // As categorias vêm à parte: tirá-las da página carregada mostraria só as
    // dos primeiros produtos.
    useEffect(() => {
        listProductCategories({ withCost: isAdmin })
            .then(setCategories)
            .catch(() => setCategories([]));
    }, [isAdmin]);

    // Bipar nesta tela joga o código na busca — jeito rápido de achar um produto.
    useBarcodeScanner((code) => setSearch(code));


    const hasFilters = search.trim() !== '' || category !== '' || situation !== 'todos' || showInactive;

    const clearFilters = () => {
        setSearch('');
        setCategory('');
        setSituation('todos');
        setShowInactive(false);
    };

    const SITUATIONS = [
        { id: 'todos', label: 'Todos' },
        // "Estoque baixo" sai da view `low_stock_products`, que o RLS devolve
        // vazia para o funcionário. Oferecer o filtro daria uma lista vazia sem
        // explicação nenhuma.
        ...(isAdmin ? [{ id: 'baixo', label: 'Estoque baixo' }] : []),
        { id: 'zerado', label: 'Sem estoque' },
        { id: 'semCodigo', label: 'Sem código' },
        { id: 'semCusto', label: 'Sem custo' },
    ];

    const handleDeactivate = async (product) => {
        const ok = window.confirm(
            `Desativar "${product.name}"?\n\n` +
            'Ele some do PDV e da lista, mas continua cadastrado e pode voltar depois.'
        );
        if (!ok) return;

        try {
            await deactivateProduct(product.id);
            load();
        } catch (err) {
            console.error(err);
            alert('Não consegui desativar o produto.');
        }
    };

    /**
     * Exclusão de verdade.
     *
     * O histórico não vai junto: venda, consumo e entrada de estoque guardam
     * nome e preço desde quando foram gravados, então faturamento e lucro
     * continuam iguais depois. O aviso diz isso porque, sem dizer, ninguém
     * clica com medo de apagar o passado.
     */
    const handleDelete = async (product) => {
        const ok = window.confirm(
            `Excluir "${product.name}" de vez?\n\n` +
            'O histórico de vendas NÃO é afetado — nome, quantidade e valor de cada '
            + 'venda antiga continuam como estão.\n\n'
            + `O código de barras${product.barcode ? ` (${product.barcode})` : ''} volta a ficar livre.\n\n`
            + 'Se for só para tirar da lista por um tempo, use Desativar.'
        );
        if (!ok) return;

        try {
            await deleteProduct(product.id);
            load();
        } catch (err) {
            console.error(err);
            alert(err?.message ?? 'Não consegui excluir o produto.');
        }
    };

    const openNew = () => { setEditing(null); setModalOpen(true); };
    const openEdit = (product) => { setEditing(product); setModalOpen(true); };

    return (
        <div className="space-y-6">
            {/* Cabeçalho */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Produtos</h1>
                    <p className="text-sm text-gray-500 mt-0.5">
                        {total.toLocaleString('pt-BR')} {total === 1 ? 'produto cadastrado' : 'produtos cadastrados'}
                    </p>
                </div>
                {/* Cadastrar e importar são bloqueados pelo RLS para o
                    funcionário; mostrar o botão só daria erro na cara dele. */}
                {isAdmin && (
                    <div className="flex items-center gap-3">
                        <Button variant="outline" onClick={() => setImportOpen(true)}>
                            <FileSpreadsheet className="h-4 w-4 mr-2" />
                            Importar planilha
                        </Button>
                        <Button variant="brand" onClick={openNew}>
                            <Plus className="h-4 w-4 mr-2" />
                            Novo produto
                        </Button>
                    </div>
                )}
            </div>

            {/* Filtros */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
                <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Buscar por nome, código ou categoria — ou é só bipar"
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

                    {categories.length > 0 && (
                        <div className="w-52">
                            <Select value={category} onChange={(e) => setCategory(e.target.value)}>
                                <option value="">Todas as categorias</option>
                                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                            </Select>
                        </div>
                    )}

                    {/* A view do funcionário só traz produto ativo. */}
                    {isAdmin && (
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-600 cursor-pointer select-none whitespace-nowrap">
                            <input
                                type="checkbox"
                                checked={showInactive}
                                onChange={(e) => setShowInactive(e.target.checked)}
                                className="h-4 w-4 rounded border-gray-300 accent-[#7E1A8B]"
                            />
                            Desativados
                        </label>
                    )}

                    {hasFilters && (
                        <Button variant="outline" onClick={clearFilters}>
                            <FilterX className="h-4 w-4 mr-2" />
                            Limpar
                        </Button>
                    )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-gray-500 mr-1">Situação:</span>
                    {SITUATIONS.map(({ id, label }) => (
                        <button
                            key={id}
                            onClick={() => setSituation(id)}
                            className={cn(
                                "px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors border",
                                situation === id
                                    ? "bg-[#7E1A8B] text-white border-[#7E1A8B]"
                                    : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                            )}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Lista */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="p-16 flex items-center justify-center text-gray-400">
                        <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                ) : products.length === 0 ? (
                    <div className="p-16 flex flex-col items-center text-center">
                        <div className="h-16 w-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-4">
                            {search ? <Search className="h-8 w-8 text-gray-300" /> : <Package className="h-8 w-8 text-gray-300" />}
                        </div>
                        <p className="font-semibold text-gray-500">
                            {search ? 'Nenhum produto encontrado' : 'Nenhum produto cadastrado'}
                        </p>
                        <p className="text-sm text-gray-400 mt-1">
                            {search
                                ? 'Tente outro termo ou cadastre este produto.'
                                : 'Cadastre o primeiro produto para começar a vender.'}
                        </p>
                        {search && (
                            <Button variant="brand" className="mt-5" onClick={openNew}>
                                <Plus className="h-4 w-4 mr-2" />
                                Cadastrar produto
                            </Button>
                        )}
                    </div>
                ) : (
                    <table className="w-full">
                        <thead className="bg-gray-50/80">
                            <tr className="text-[11px] uppercase tracking-wide text-gray-500">
                                <th className="text-left font-bold px-5 py-3">Produto</th>
                                <th className="text-left font-bold px-3 py-3 w-40">Código</th>
                                {isAdmin && <th className="text-right font-bold px-3 py-3 w-28">Custo</th>}
                                <th className="text-right font-bold px-3 py-3 w-28">Venda</th>
                                {isAdmin && <th className="text-right font-bold px-3 py-3 w-24">Margem</th>}
                                <th className="text-right font-bold px-3 py-3 w-32">Estoque</th>
                                <th className="w-24" />
                            </tr>
                        </thead>
                        <tbody>
                            {products.map((p) => {
                                const margin = marginPercent(p.sale_price, p.cost_price);
                                const low = p.min_stock > 0 && p.stock_quantity <= p.min_stock;

                                return (
                                    <tr key={p.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
                                        <td className="px-5 py-3">
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm font-semibold text-gray-900">{p.name}</p>
                                                {!p.active && <Badge>desativado</Badge>}
                                            </div>
                                            <p className="text-xs text-gray-400 mt-0.5">
                                                {[p.category, p.suppliers?.name].filter(Boolean).join(' · ') || '—'}
                                            </p>
                                        </td>
                                        <td className="px-3 py-3">
                                            <span className="text-xs font-mono text-gray-500">
                                                {p.barcode || '—'}
                                            </span>
                                        </td>
                                        {isAdmin && (
                                            <td className="px-3 py-3 text-right text-sm text-gray-600">
                                                {Number(p.cost_price) > 0
                                                    ? formatCurrency(p.cost_price)
                                                    : <span className="text-gray-300">—</span>}
                                            </td>
                                        )}
                                        <td className="px-3 py-3 text-right text-sm font-bold text-gray-900">
                                            {formatCurrency(p.sale_price)}
                                        </td>
                                        {isAdmin && (
                                        <td className="px-3 py-3 text-right">
                                            {/* Sem custo registrado a margem seria sempre 100%, o que
                                                enganaria. Melhor admitir que ainda não dá pra saber. */}
                                            {Number(p.cost_price) > 0 ? (
                                                <span className={cn(
                                                    "text-sm font-bold",
                                                    margin >= 30 ? "text-emerald-600"
                                                        : margin > 0 ? "text-amber-600"
                                                            : "text-red-600"
                                                )}>
                                                    {margin.toFixed(0)}%
                                                </span>
                                            ) : (
                                                <span
                                                    className="text-sm text-gray-300"
                                                    title="Sem custo registrado. Dê entrada deste produto na tela de Estoque."
                                                >
                                                    —
                                                </span>
                                            )}
                                        </td>
                                        )}
                                        <td className="px-3 py-3 text-right">
                                            <div className="flex items-center justify-end gap-1.5">
                                                {low && <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
                                                <span className={cn(
                                                    "text-sm font-bold",
                                                    p.stock_quantity <= 0 ? "text-red-600"
                                                        : low ? "text-amber-600"
                                                            : "text-gray-700"
                                                )}>
                                                    {Number(p.stock_quantity)} {p.unit}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-3 py-3">
                                            {isAdmin && (
                                                <div className="flex items-center justify-end gap-1">
                                                    <button
                                                        onClick={() => openEdit(p)}
                                                        className="h-8 w-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-[#7E1A8B] hover:bg-[#7E1A8B]/10 transition-colors"
                                                        title="Editar"
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                    </button>
                                                    {/* Desativar e excluir são coisas diferentes:
                                                        um esconde o produto que vai voltar, o
                                                        outro apaga o que não existe mais. */}
                                                    {p.active && (
                                                        <button
                                                            onClick={() => handleDeactivate(p)}
                                                            className="h-8 w-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                                                            title="Desativar (some da lista, volta depois)"
                                                        >
                                                            <EyeOff className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => handleDelete(p)}
                                                        className="h-8 w-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                                        title="Excluir de vez (histórico não é afetado)"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}

                <LoadMore
                    carregados={products.length}
                    total={total}
                    temMais={temMais}
                    carregando={loadingMore}
                    onCarregarMais={carregarMais}
                    nome="produtos"
                />
            </div>

            <p className="flex items-center gap-2 text-xs text-gray-400">
                <ScanBarcode className="h-3.5 w-3.5" />
                Dica: com esta tela aberta, passar o leitor num produto joga o código direto na busca.
            </p>

            <ProductFormModal
                isOpen={modalOpen}
                product={editing}
                onClose={() => setModalOpen(false)}
                onSaved={load}
            />

            <ImportProductsModal
                isOpen={importOpen}
                onClose={() => setImportOpen(false)}
                onImported={load}
            />
        </div>
    );
}
