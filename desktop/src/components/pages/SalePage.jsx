import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ScanBarcode, Search, Trash2, Plus, Minus, Camera, Loader2,
    AlertTriangle, PackageX, ShoppingCart,
} from 'lucide-react';
import { Button } from '../atoms/Button';
import { Input } from '../atoms/Input';
import { Badge } from '../atoms/Badge';
import { cn, formatCurrency } from '../../lib/utils';
import {
    findProductByBarcode, findProductByScaleCode, searchProducts,
} from '../../services/mercadinhoService';
import { decodificar, getScaleConfig, DEFAULTS as SCALE_DEFAULTS } from '../../lib/scaleLabel';
import { CameraScannerModal } from '../organisms/CameraScannerModal';
import { ProductFormModal } from '../organisms/ProductFormModal';
import { CheckoutModal } from '../organisms/CheckoutModal';
import { WeightPromptModal } from '../organisms/WeightPromptModal';

/**
 * Unidades que se vendem por peso ou volume.
 *
 * Para elas, "1" quase nunca é a quantidade certa: quem leva 300 g de queijo
 * não leva 1 kg. Bipar um desses abre o campo de quantidade em vez de somar
 * uma unidade.
 */
const PESADOS = new Set(['kg', 'g', 'l', 'ml']);

export function SalePage() {
    const [cart, setCart] = useState([]);
    const [scanValue, setScanValue] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [busy, setBusy] = useState(false);
    const [flashId, setFlashId] = useState(null);
    const [notFoundCode, setNotFoundCode] = useState('');
    const [cameraOpen, setCameraOpen] = useState(false);
    const [quickAddOpen, setQuickAddOpen] = useState(false);
    const [checkoutOpen, setCheckoutOpen] = useState(false);
    const [toast, setToast] = useState('');
    // Produto por peso esperando a quantidade; null quando não há nenhum.
    const [pesando, setPesando] = useState(null);
    const [scaleConfig, setScaleConfig] = useState(SCALE_DEFAULTS);

    useEffect(() => { getScaleConfig().then(setScaleConfig); }, []);

    const scanRef = useRef(null);

    const focusScan = useCallback(() => {
        // O campo de bipe tem que estar sempre pronto: o leitor USB "digita"
        // no que estiver focado, e se o foco escapar o codigo se perde.
        requestAnimationFrame(() => scanRef.current?.focus());
    }, []);

    /**
     * Devolve o foco pro campo de bipe, mas só quando ele iria para o nada.
     * Sem essa checagem, clicar na busca ou na quantidade devolveria o foco
     * na mesma hora e seria impossível digitar nesses campos.
     */
    const refocusIfIdle = useCallback((e) => {
        const next = e.relatedTarget;
        if (next && (
            next.tagName === 'INPUT' ||
            next.tagName === 'TEXTAREA' ||
            next.tagName === 'SELECT' ||
            next.tagName === 'BUTTON'
        )) return;
        focusScan();
    }, [focusScan]);

    useEffect(() => { focusScan(); }, [focusScan]);

    const showToast = (msg) => {
        setToast(msg);
        setTimeout(() => setToast(''), 2500);
    };

    // -----------------------------------------------------------------------
    // Carrinho
    // -----------------------------------------------------------------------

    /**
     * Põe o produto no carrinho.
     *
     * `precoTotal` só aparece na etiqueta de balança que já traz o valor
     * fechado. Nesse caso o preço unitário é recalculado a partir dele, para
     * que quantidade × unitário bata exatamente com o que a balança imprimiu —
     * arredondar por conta própria faria o cupom fechar um centavo diferente da
     * etiqueta colada no pacote.
     */
    const addProduct = useCallback((product, quantity = 1, { precoTotal } = {}) => {
        const unitPrice = precoTotal !== undefined && quantity > 0
            ? precoTotal / quantity
            : Number(product.sale_price) || 0;

        setCart((prev) => {
            const idx = prev.findIndex((i) => i.product_id === product.id);

            if (idx >= 0) {
                const next = [...prev];
                next[idx] = { ...next[idx], quantity: next[idx].quantity + quantity };
                return next;
            }

            return [...prev, {
                key: product.id,
                product_id: product.id,
                barcode: product.barcode,
                product_name: product.name,
                unit: product.unit || 'un',
                quantity,
                unit_price: unitPrice,
                unit_cost: Number(product.cost_price) || 0,
                stock_quantity: Number(product.stock_quantity) || 0,
            }];
        });

        setFlashId(product.id);
        setTimeout(() => setFlashId(null), 700);
        focusScan();
    }, [focusScan]);

    const changeQuantity = (key, delta) => {
        setCart((prev) => prev
            .map((i) => (i.key === key ? { ...i, quantity: i.quantity + delta } : i))
            .filter((i) => i.quantity > 0));
        focusScan();
    };

    const setQuantity = (key, value) => {
        // Vírgula: é o que se digita aqui, e é como o campo mostra o peso.
        const q = Number(String(value).replace(',', '.'));
        if (Number.isNaN(q) || q < 0) return;
        setCart((prev) => prev.map((i) => (i.key === key ? { ...i, quantity: q } : i)));
    };

    const removeItem = (key) => {
        setCart((prev) => prev.filter((i) => i.key !== key));
        focusScan();
    };

    const clearCart = () => {
        setCart([]);
        focusScan();
    };

    // -----------------------------------------------------------------------
    // Leitura de código
    // -----------------------------------------------------------------------

    const handleCode = useCallback(async (rawCode) => {
        const code = rawCode.trim();
        if (!code) return;

        setBusy(true);
        setNotFoundCode('');

        try {
            // Etiqueta de balança primeiro: ela é um EAN-13 como qualquer
            // outro, e procurá-la no cadastro não acharia nada — o número muda
            // a cada pesagem.
            const etiqueta = decodificar(code, scaleConfig);

            if (etiqueta?.erro) {
                showToast(etiqueta.erro);
                return;
            }

            if (etiqueta) {
                const produto = await findProductByScaleCode(etiqueta.codigoProduto);
                if (!produto) {
                    showToast(
                        `Etiqueta de balança do produto ${etiqueta.codigoProduto}, `
                        + 'que não está cadastrado com esse código.'
                    );
                    return;
                }

                if (etiqueta.peso !== null) {
                    // Peso na etiqueta: o valor sai do preço por quilo.
                    addProduct(produto, etiqueta.peso);
                } else {
                    // Preço na etiqueta: a balança já fechou a conta. O peso é
                    // deduzido para o cupom mostrar "1,235 kg" em vez de "1".
                    const precoKg = Number(produto.sale_price) || 0;
                    const peso = precoKg > 0
                        ? Math.round((etiqueta.precoTotal / precoKg) * 1000) / 1000
                        : 1;
                    addProduct(produto, peso, { precoTotal: etiqueta.precoTotal });
                }
                return;
            }

            const product = await findProductByBarcode(code);
            if (!product) { setNotFoundCode(code); return; }

            // Produto vendido por peso sem etiqueta: o cliente pesa no caixa.
            // Entrar com 1 seria cobrar 1 kg de quem levou 300 g.
            if (PESADOS.has(product.unit)) {
                setPesando(product);
                return;
            }

            addProduct(product);
        } catch (err) {
            console.error(err);
            showToast('Erro ao buscar o produto. Confira a conexão.');
        } finally {
            setBusy(false);
            setScanValue('');
            focusScan();
        }
    }, [addProduct, focusScan, scaleConfig]);

    // Busca por nome, com atraso pra não disparar a cada tecla.
    useEffect(() => {
        const term = searchTerm.trim();
        if (term.length < 2) {
            setSearchResults([]);
            return;
        }

        const timer = setTimeout(() => {
            searchProducts(term).then(setSearchResults).catch(() => setSearchResults([]));
        }, 250);

        return () => clearTimeout(timer);
    }, [searchTerm]);

    // -----------------------------------------------------------------------
    // Totais
    // -----------------------------------------------------------------------

    const subtotal = useMemo(
        () => cart.reduce((sum, i) => sum + i.quantity * i.unit_price, 0),
        [cart]
    );

    const itemCount = useMemo(
        () => cart.reduce((sum, i) => sum + i.quantity, 0),
        [cart]
    );

    // F2 fecha a venda sem tirar a mão do leitor.
    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'F2' && cart.length > 0 && !checkoutOpen) {
                e.preventDefault();
                setCheckoutOpen(true);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [cart.length, checkoutOpen]);

    return (
        <div className="flex gap-6 h-full">
            {/* Coluna principal */}
            <div className="flex-1 min-w-0 flex flex-col gap-5">
                {/* Campo de bipe */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <div className="flex items-center gap-3">
                        <div className="relative flex-1">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#7E1A8B]">
                                {busy
                                    ? <Loader2 className="h-6 w-6 animate-spin" />
                                    : <ScanBarcode className="h-6 w-6" />}
                            </div>
                            <input
                                ref={scanRef}
                                value={scanValue}
                                onChange={(e) => setScanValue(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleCode(scanValue);
                                    }
                                }}
                                onBlur={refocusIfIdle}
                                placeholder="Passe o leitor no código de barras..."
                                className="w-full h-16 pl-14 pr-4 rounded-xl bg-gray-50 border-2 border-[#7E1A8B]/20 text-lg font-mono font-semibold focus:outline-none focus:border-[#7E1A8B] focus:bg-white transition-all placeholder:font-sans placeholder:font-normal placeholder:text-gray-400"
                            />
                        </div>
                        <Button
                            variant="outline"
                            className="h-16 px-5"
                            onClick={() => setCameraOpen(true)}
                            title="Ler pela câmera"
                        >
                            <Camera className="h-5 w-5 mr-2" />
                            Câmera
                        </Button>
                    </div>

                    {/* Código não cadastrado */}
                    {notFoundCode && (
                        <div className="mt-4 flex items-center justify-between gap-4 rounded-xl bg-amber-50 border border-amber-200 p-4">
                            <div className="flex items-center gap-3">
                                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                                <div>
                                    <p className="text-sm font-semibold text-amber-800">
                                        Código não cadastrado
                                    </p>
                                    <p className="text-xs text-amber-700 font-mono">{notFoundCode}</p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <Button size="sm" variant="outline" onClick={() => { setNotFoundCode(''); focusScan(); }}>
                                    Ignorar
                                </Button>
                                <Button size="sm" variant="brand" onClick={() => setQuickAddOpen(true)}>
                                    Cadastrar agora
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Busca por nome */}
                    <div className="mt-4 relative">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Ou procure pelo nome (para produto sem código, granel...)"
                                className="pl-10"
                            />
                        </div>

                        {searchResults.length > 0 && (
                            <div className="absolute z-20 mt-2 w-full bg-white rounded-xl border border-gray-200 shadow-xl max-h-72 overflow-y-auto">
                                {searchResults.map((p) => (
                                    <button
                                        key={p.id}
                                        onClick={() => {
                                            // Mesma regra do bipe: produto por
                                            // peso pergunta a quantidade.
                                            if (PESADOS.has(p.unit)) setPesando(p);
                                            else addProduct(p);
                                            setSearchTerm('');
                                            setSearchResults([]);
                                        }}
                                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors text-left border-b border-gray-50 last:border-0"
                                    >
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-gray-900 truncate">{p.name}</p>
                                            <p className="text-xs text-gray-500 font-mono">
                                                {p.barcode || 'sem código'} · estoque {Number(p.stock_quantity)}
                                            </p>
                                        </div>
                                        <span className="text-sm font-bold text-[#7E1A8B] shrink-0 ml-4">
                                            {formatCurrency(p.sale_price)}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Carrinho */}
                <div className="flex-1 min-h-0 bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                        <div className="flex items-center gap-2">
                            <ShoppingCart className="h-5 w-5 text-gray-400" />
                            <h2 className="font-bold text-gray-900">Carrinho</h2>
                            {cart.length > 0 && (
                                <Badge variant="brand">{itemCount} {itemCount === 1 ? 'item' : 'itens'}</Badge>
                            )}
                        </div>
                        {cart.length > 0 && (
                            <button
                                onClick={clearCart}
                                className="text-xs font-semibold text-gray-400 hover:text-red-600 transition-colors"
                            >
                                Limpar tudo
                            </button>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        {cart.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-center p-10">
                                <div className="h-16 w-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-4">
                                    <PackageX className="h-8 w-8 text-gray-300" />
                                </div>
                                <p className="font-semibold text-gray-500">Nenhum item ainda</p>
                                <p className="text-sm text-gray-400 mt-1">
                                    Passe o leitor no primeiro produto para começar.
                                </p>
                            </div>
                        ) : (
                            <table className="w-full">
                                <thead className="sticky top-0 bg-gray-50/90 backdrop-blur">
                                    <tr className="text-[11px] uppercase tracking-wide text-gray-500">
                                        <th className="text-left font-bold px-5 py-2.5">Produto</th>
                                        <th className="text-center font-bold px-3 py-2.5 w-40">Qtd</th>
                                        <th className="text-right font-bold px-3 py-2.5 w-28">Unit.</th>
                                        <th className="text-right font-bold px-3 py-2.5 w-32">Subtotal</th>
                                        <th className="w-14" />
                                    </tr>
                                </thead>
                                <tbody>
                                    {cart.map((item) => {
                                        const insufficient = item.quantity > item.stock_quantity;

                                        return (
                                            <tr
                                                key={item.key}
                                                className={cn(
                                                    "border-b border-gray-50 last:border-0",
                                                    flashId === item.product_id && "scan-flash"
                                                )}
                                            >
                                                <td className="px-5 py-3">
                                                    <p className="text-sm font-semibold text-gray-900">{item.product_name}</p>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className="text-xs text-gray-400 font-mono">
                                                            {item.barcode || 'sem código'}
                                                        </span>
                                                        {insufficient && (
                                                            <Badge variant="warning">
                                                                estoque {item.stock_quantity}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-3 py-3">
                                                    <div className="flex items-center justify-center gap-1">
                                                        {/* Produto por peso anda de 100 em 100 g:
                                                            somar 1 kg por clique num queijo é o
                                                            passo errado. */}
                                                        <button
                                                            onClick={() => changeQuantity(item.key, -pesoPasso(item))}
                                                            className="h-7 w-7 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors"
                                                        >
                                                            <Minus className="h-3.5 w-3.5" />
                                                        </button>
                                                        <div className="relative">
                                                            <input
                                                                value={formatarQtd(item.quantity)}
                                                                onChange={(e) => setQuantity(item.key, e.target.value)}
                                                                onBlur={refocusIfIdle}
                                                                className={cn(
                                                                    "h-7 text-center text-sm font-bold rounded-lg border border-gray-200 focus:outline-none focus:border-[#7E1A8B]",
                                                                    PESADOS.has(item.unit) ? "w-20 pr-6" : "w-14"
                                                                )}
                                                            />
                                                            {PESADOS.has(item.unit) && (
                                                                <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-400 pointer-events-none">
                                                                    {item.unit}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <button
                                                            onClick={() => changeQuantity(item.key, pesoPasso(item))}
                                                            className="h-7 w-7 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors"
                                                        >
                                                            <Plus className="h-3.5 w-3.5" />
                                                        </button>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-3 text-right text-sm text-gray-600">
                                                    {formatCurrency(item.unit_price)}
                                                </td>
                                                <td className="px-3 py-3 text-right text-sm font-bold text-gray-900">
                                                    {formatCurrency(item.quantity * item.unit_price)}
                                                </td>
                                                <td className="px-3 py-3">
                                                    <button
                                                        onClick={() => removeItem(item.key)}
                                                        className="h-8 w-8 rounded-lg flex items-center justify-center text-gray-300 hover:text-red-600 hover:bg-red-50 transition-colors"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>

            {/* Painel lateral de fechamento */}
            <div className="w-[340px] shrink-0">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sticky top-0 space-y-5">
                    <div>
                        <p className="text-sm font-semibold text-gray-500">Total da venda</p>
                        <p className="text-4xl font-extrabold text-gray-900 tracking-tight mt-1">
                            {formatCurrency(subtotal)}
                        </p>
                        <p className="text-sm text-gray-400 mt-1">
                            {itemCount} {itemCount === 1 ? 'item' : 'itens'} no carrinho
                        </p>
                    </div>

                    <div className="h-px bg-gray-100" />

                    <Button
                        variant="brand"
                        size="xl"
                        className="w-full"
                        disabled={cart.length === 0}
                        onClick={() => setCheckoutOpen(true)}
                    >
                        Fechar venda
                    </Button>

                    <p className="text-center text-xs text-gray-400">
                        Atalho: <kbd className="px-1.5 py-0.5 rounded bg-gray-100 font-semibold">F2</kbd> fecha a venda
                    </p>
                </div>
            </div>

            {/* Toast */}
            {toast && (
                <div className="fixed bottom-6 right-6 z-50 bg-gray-900 text-white px-5 py-3 rounded-xl shadow-2xl text-sm font-medium">
                    {toast}
                </div>
            )}

            {/* `key` no id: cada produto monta o modal do zero, então o campo
                nasce vazio sem ninguém precisar limpá-lo. */}
            {pesando && (
                <WeightPromptModal
                    key={pesando.id}
                    product={pesando}
                    onConfirm={(produto, quantidade) => {
                        addProduct(produto, quantidade);
                        setPesando(null);
                    }}
                    onCancel={() => { setPesando(null); focusScan(); }}
                />
            )}

            <CameraScannerModal
                isOpen={cameraOpen}
                onClose={() => { setCameraOpen(false); focusScan(); }}
                onDetect={(code) => {
                    setCameraOpen(false);
                    handleCode(code);
                }}
            />

            <ProductFormModal
                isOpen={quickAddOpen}
                initialBarcode={notFoundCode}
                onClose={() => { setQuickAddOpen(false); focusScan(); }}
                onSaved={(product) => {
                    setNotFoundCode('');
                    addProduct(product);
                    showToast(`${product.name} cadastrado e adicionado.`);
                }}
            />

            <CheckoutModal
                isOpen={checkoutOpen}
                cart={cart}
                subtotal={subtotal}
                onClose={() => { setCheckoutOpen(false); focusScan(); }}
                // O modal continua aberto de propósito: a tela seguinte é a do
                // cupom e da nota fiscal. Quem fecha é o "Próxima venda".
                onCompleted={({ queued }) => {
                    clearCart();
                    showToast(queued
                        ? 'Sem internet — venda guardada para enviar depois.'
                        : 'Venda registrada com sucesso.');
                }}
            />
        </div>
    );
}

/**
 * De quanto em quanto o botão anda.
 *
 * Peso vai de 100 g por clique; unidade vai de 1. Um botão que soma 1 kg de
 * queijo por toque erra por um fator de dez em quase toda venda.
 */
const pesoPasso = (item) => (PESADOS.has(item.unit) ? 0.1 : 1);

/**
 * Mostra a quantidade sem casas decimais inúteis.
 *
 * 2 aparece como "2", e 0,35 como "0,35". Somar 0.1 repetidas vezes em ponto
 * flutuante produz coisas como 0.30000000000000004 — arredondar na exibição
 * evita isso aparecer no meio de uma venda.
 */
const formatarQtd = (n) => {
    const v = Math.round((Number(n) || 0) * 1000) / 1000;
    return Number.isInteger(v) ? String(v) : String(v).replace('.', ',');
};
