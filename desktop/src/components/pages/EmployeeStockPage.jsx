import React, { useEffect, useState } from 'react';
import {
    PackagePlus, Search, Camera, Loader2, Check, Clock, ScanBarcode,
} from 'lucide-react';
import { Button } from '../atoms/Button';
import { Input } from '../atoms/Input';
import { Badge } from '../atoms/Badge';
import { formatDate } from '../../lib/utils';
import {
    findProductByBarcode, searchProducts,
    createStockEntryAsEmployee, listStockEntriesPos,
} from '../../services/mercadinhoService';
import { CameraScannerModal } from '../organisms/CameraScannerModal';

/** Aceita vírgula: produto por peso entra fracionado, e é o que se digita aqui. */
const parseQtd = (texto) => {
    const n = Number(String(texto ?? '').replace(',', '.'));
    return Number.isFinite(n) && n > 0 ? n : 0;
};

/**
 * Entrada de estoque para quem recebe a mercadoria.
 *
 * Quem está no balcão quando o entregador chega é o funcionário, e até aqui só
 * o administrador conseguia registrar isso — porque a tela de Estoque pede o
 * custo de compra, que é justamente o que ele não pode ver.
 *
 * Aqui ele informa **só a quantidade**. O custo é lido do produto pelo banco, e
 * a entrada fica marcada como "custo a confirmar" para o dono preencher o valor
 * pago depois. Assim a contagem da prateleira fica certa na hora, e o número do
 * gasto com reposição continua sendo responsabilidade de quem paga as contas.
 */
export function EmployeeStockPage() {
    const [product, setProduct] = useState(null);
    const [quantity, setQuantity] = useState('');
    const [note, setNote] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [cameraOpen, setCameraOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [recentes, setRecentes] = useState([]);

    const carregarRecentes = () => {
        listStockEntriesPos({ limit: 20 }).then(setRecentes).catch(() => setRecentes([]));
    };

    useEffect(() => { carregarRecentes(); }, []);

    // Busca por nome, com atraso pra não disparar a cada tecla.
    useEffect(() => {
        const term = searchTerm.trim();
        if (term.length < 2) { setSearchResults([]); return undefined; }

        const timer = setTimeout(() => {
            searchProducts(term).then(setSearchResults).catch(() => setSearchResults([]));
        }, 250);

        return () => clearTimeout(timer);
    }, [searchTerm]);

    const handleCode = async (code) => {
        const clean = code.trim();
        if (!clean) return;

        try {
            const found = await findProductByBarcode(clean);
            if (found) {
                setProduct(found);
                setSearchTerm('');
                setSearchResults([]);
                setError('');
            } else {
                setError(`Código ${clean} não está cadastrado.`);
            }
        } catch (err) {
            console.error(err);
            setError('Erro ao buscar o produto.');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (!product) { setError('Escolha o produto que chegou.'); return; }

        const qtd = parseQtd(quantity);
        if (qtd <= 0) { setError('Informe quantas unidades chegaram.'); return; }

        setSaving(true);
        try {
            await createStockEntryAsEmployee({
                productId: product.id,
                quantity: qtd,
                note,
            });

            setSuccess(`Entrada registrada: ${qtd} × ${product.name}.`);
            setProduct(null);
            setQuantity('');
            setNote('');
            carregarRecentes();
            setTimeout(() => setSuccess(''), 4000);
        } catch (err) {
            console.error(err);
            setError(err?.message ?? 'Não consegui registrar a entrada.');
        } finally {
            setSaving(false);
        }
    };

    const qtdDigitada = parseQtd(quantity);
    const unidade = product?.unit && product.unit !== 'un' ? product.unit : 'unidades';

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">
                    Entrada de estoque
                </h1>
                <p className="text-sm text-gray-500 mt-0.5">
                    Registre o que chegou para o estoque bater com a prateleira
                </p>
            </div>

            <div className="flex gap-6 items-start">
                <form
                    onSubmit={handleSubmit}
                    className="w-[440px] shrink-0 bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5"
                >
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-[#7E1A8B]/10 flex items-center justify-center">
                            <PackagePlus className="h-5 w-5 text-[#7E1A8B]" />
                        </div>
                        <h2 className="font-bold text-gray-900">O que chegou</h2>
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

                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-700">Produto *</label>

                        {product ? (
                            <div className="flex items-center justify-between gap-3 rounded-xl border-2 border-[#7E1A8B]/30 bg-[#7E1A8B]/[0.04] p-3">
                                <div className="min-w-0">
                                    <p className="text-sm font-bold text-gray-900 truncate">{product.name}</p>
                                    <p className="text-xs text-gray-500">
                                        {product.barcode || 'sem código'} · tem{' '}
                                        {Number(product.stock_quantity)} {product.unit || 'un'}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setProduct(null)}
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
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key !== 'Enter') return;
                                                e.preventDefault();
                                                const t = searchTerm.trim();
                                                // Código de barras vem do leitor; nome vem da busca.
                                                if (/^[0-9]{6,}$/.test(t)) handleCode(t);
                                                else if (searchResults.length > 0) {
                                                    setProduct(searchResults[0]);
                                                    setSearchTerm('');
                                                    setSearchResults([]);
                                                }
                                            }}
                                            placeholder="Bipe ou busque pelo nome"
                                            className="pl-10"
                                            autoFocus
                                        />
                                    </div>
                                    <Button
                                        type="button" variant="outline" size="icon"
                                        onClick={() => setCameraOpen(true)}
                                        title="Ler pela câmera"
                                    >
                                        <Camera className="h-4 w-4" />
                                    </Button>
                                </div>

                                {searchResults.length > 0 && (
                                    <div className="rounded-xl border border-gray-200 shadow-sm max-h-56 overflow-y-auto">
                                        {searchResults.map((p) => (
                                            <button
                                                key={p.id}
                                                type="button"
                                                onClick={() => {
                                                    setProduct(p);
                                                    setSearchTerm('');
                                                    setSearchResults([]);
                                                }}
                                                className="w-full text-left px-3 py-2.5 hover:bg-gray-50 border-b border-gray-50 last:border-0 flex justify-between gap-3"
                                            >
                                                <span className="text-sm font-semibold text-gray-900 truncate">
                                                    {p.name}
                                                </span>
                                                <span className="text-xs text-gray-400 shrink-0">
                                                    tem {Number(p.stock_quantity)}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-700">
                            Quantas {unidade} chegaram? *
                        </label>
                        <Input
                            value={quantity}
                            onChange={(e) => setQuantity(e.target.value)}
                            inputMode="decimal"
                            placeholder="Ex.: 24"
                            className="text-2xl font-extrabold h-16 text-center"
                        />

                        {/* O número que a pessoa confere com a prateleira. */}
                        {product && qtdDigitada > 0 && (
                            <p className="text-center text-sm text-gray-500">
                                O estoque vai de{' '}
                                <strong className="text-gray-700">
                                    {Number(product.stock_quantity)}
                                </strong>{' '}
                                para{' '}
                                <strong className="text-emerald-700">
                                    {Number(product.stock_quantity) + qtdDigitada}
                                </strong>
                            </p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-700">Observação</label>
                        <Input
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="Opcional — ex.: nota do fornecedor na gaveta"
                        />
                    </div>

                    <Button type="submit" variant="brand" size="lg" className="w-full" disabled={saving}>
                        {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                        Registrar entrada
                    </Button>

                    <p className="text-xs text-gray-400 text-center">
                        O valor pago fica com o administrador — aqui você informa só a quantidade.
                    </p>
                </form>

                {/* Últimas entradas, sem valor nenhum: é o que o funcionário pode ler. */}
                <div className="flex-1 min-w-0 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100">
                        <h2 className="font-bold text-gray-900">Últimas entradas</h2>
                        <p className="text-xs text-gray-400 mt-0.5">
                            O que foi registrado recentemente
                        </p>
                    </div>

                    {recentes.length === 0 ? (
                        <div className="p-14 flex flex-col items-center text-center">
                            <div className="h-14 w-14 rounded-2xl bg-gray-50 flex items-center justify-center mb-3">
                                <ScanBarcode className="h-7 w-7 text-gray-300" />
                            </div>
                            <p className="font-semibold text-gray-500">Nada registrado ainda</p>
                            <p className="text-sm text-gray-400 mt-1">
                                Bipe o produto que chegou para começar.
                            </p>
                        </div>
                    ) : (
                        <table className="w-full">
                            <thead className="bg-gray-50/80">
                                <tr className="text-[11px] uppercase tracking-wide text-gray-500">
                                    <th className="text-left font-bold px-5 py-3">Produto</th>
                                    <th className="text-right font-bold px-3 py-3 w-24">Qtd</th>
                                    <th className="text-left font-bold px-3 py-3 w-28">Data</th>
                                    <th className="text-left font-bold px-3 py-3 w-36">Quem</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentes.map((e) => (
                                    <tr key={e.id} className="border-b border-gray-50 last:border-0">
                                        <td className="px-5 py-3">
                                            <p className="text-sm font-semibold text-gray-900">
                                                {e.product_name}
                                            </p>
                                            {e.awaiting_cost && (
                                                <Badge variant="warning">
                                                    <Clock className="h-3 w-3 mr-1" />
                                                    custo a confirmar
                                                </Badge>
                                            )}
                                        </td>
                                        <td className="px-3 py-3 text-right text-sm font-bold text-emerald-700">
                                            +{Number(e.quantity)}
                                        </td>
                                        <td className="px-3 py-3 text-sm text-gray-600">
                                            {formatDate(`${e.entry_date}T00:00:00`)}
                                        </td>
                                        <td className="px-3 py-3 text-xs text-gray-400 truncate">
                                            {(e.user_email ?? '').split('@')[0] || '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            <CameraScannerModal
                isOpen={cameraOpen}
                onClose={() => setCameraOpen(false)}
                onDetect={(code) => { setCameraOpen(false); handleCode(code); }}
            />
        </div>
    );
}
