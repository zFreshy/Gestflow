import React, { useEffect, useState } from 'react';
import { Package, X, Loader2, Camera, Info, Sparkles } from 'lucide-react';
import { Button } from '../atoms/Button';
import { Input } from '../atoms/Input';
import { Select } from '../atoms/Select';
import { formatCurrency } from '../../lib/utils';
import { createProduct, updateProduct, listSuppliers } from '../../services/mercadinhoService';
import { lookupBarcode } from '../../lib/productLookup';
import { CameraScannerModal } from './CameraScannerModal';

const UNITS = ['un', 'kg', 'g', 'l', 'ml', 'cx', 'pct'];

const EMPTY = {
    barcode: '',
    name: '',
    unit: 'un',
    sale_price: '',
    min_stock: '',
    category: '',
    supplier_id: '',
    scale_code: '',
    // Classificação fiscal. Vazio significa "usa o padrão da configuração
    // fiscal" — o mercadinho tem milhares de itens e classificar todos à mão
    // antes da primeira nota travaria o uso do sistema inteiro.
    ncm: '',
    cfop: '',
    cest: '',
    csosn: '',
    cst: '',
    origem: '',
};

/**
 * Cadastro/edicao de produto.
 *
 * `product` preenchido = edicao. `initialBarcode` = cadastro rapido a partir de
 * um bipe que nao achou nada no PDV.
 *
 * Nao tem campo de preco de custo de proposito: quem define o custo e a compra.
 * Cada entrada de estoque grava o valor pago e o trigger atualiza o produto,
 * entao digitar aqui so criaria uma segunda versao da verdade.
 */
export function ProductFormModal({ isOpen, onClose, onSaved, product = null, initialBarcode = '' }) {
    const [form, setForm] = useState(EMPTY);
    const [suppliers, setSuppliers] = useState([]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [cameraOpen, setCameraOpen] = useState(false);
    const [lookingUp, setLookingUp] = useState(false);
    // Marca o nome que veio da base pública, para a pessoa saber que precisa
    // conferir — os nomes de lá são colaborativos e nem sempre batem com a
    // embalagem que está na mão dela.
    const [suggestedName, setSuggestedName] = useState('');

    const isEditing = Boolean(product);
    const cost = Number(product?.cost_price) || 0;

    useEffect(() => {
        if (!isOpen) return;

        setError('');
        setForm(product
            ? {
                barcode: product.barcode ?? '',
                name: product.name ?? '',
                unit: product.unit ?? 'un',
                sale_price: product.sale_price ?? '',
                min_stock: product.min_stock ?? '',
                category: product.category ?? '',
                supplier_id: product.supplier_id ?? '',
                scale_code: product.scale_code ?? '',
                ncm: product.ncm ?? '',
                cfop: product.cfop ?? '',
                cest: product.cest ?? '',
                csosn: product.csosn ?? '',
                cst: product.cst ?? '',
                origem: product.origem ?? '',
            }
            : { ...EMPTY, barcode: initialBarcode });

        setSuggestedName('');
        listSuppliers().then(setSuppliers).catch(() => setSuppliers([]));

        // Veio de um bipe que não achou nada no PDV: o código já está aqui, e
        // procurar o nome sozinho poupa a digitação com a fila esperando.
        if (!product && initialBarcode) buscarNome(initialBarcode);
    }, [isOpen, product, initialBarcode]);

    const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

    /**
     * Procura o nome do produto pelo código de barras.
     *
     * Só preenche campo vazio: se alguém já digitou o nome, ele manda. E o
     * resultado fica marcado como sugestão, porque a base é colaborativa.
     */
    const buscarNome = async (codigo) => {
        const clean = String(codigo ?? '').trim();
        if (!clean) return;

        setLookingUp(true);
        try {
            const nome = await lookupBarcode(clean);
            if (!nome) return;

            setForm((f) => (f.name.trim() ? f : { ...f, name: nome }));
            setSuggestedName(nome);
        } finally {
            setLookingUp(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!form.name.trim()) {
            setError('O nome do produto é obrigatório.');
            return;
        }

        setSaving(true);
        try {
            const payload = {
                barcode: form.barcode,
                name: form.name.trim(),
                unit: form.unit,
                sale_price: Number(form.sale_price) || 0,
                // cost_price fica de fora: na edicao, mandar 0 aqui apagaria o
                // custo que as entradas de estoque ja aprenderam.
                min_stock: Number(form.min_stock) || 0,
                category: form.category.trim() || null,
                supplier_id: form.supplier_id || null,
                // Nulo e nao string vazia: o indice unico permite varios
                // produtos sem codigo de balanca, mas nao dois com o mesmo.
                scale_code: form.scale_code.trim() || null,
                // Nulo e não string vazia: é assim que a emissão sabe que deve
                // cair no padrão da configuração fiscal.
                ncm: form.ncm.trim() || null,
                cfop: form.cfop.trim() || null,
                cest: form.cest.trim() || null,
                csosn: form.csosn.trim() || null,
                cst: form.cst.trim() || null,
                origem: form.origem === '' ? null : Number(form.origem),
            };

            const saved = isEditing
                ? await updateProduct(product.id, payload)
                : await createProduct(payload);

            onSaved?.(saved);
            onClose?.();
        } catch (err) {
            console.error(err);
            // 23505 = unique_violation: o indice do codigo de barras.
            setError(err?.code === '23505'
                ? 'Já existe um produto com esse código de barras.'
                : 'Não consegui salvar o produto. Tente de novo.');
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <>
            <div className="modal-overlay" onClick={onClose}>
                <div
                    className="modal-content bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-[#7E1A8B]/10 flex items-center justify-center">
                                <Package className="h-5 w-5 text-[#7E1A8B]" />
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-900">
                                    {isEditing ? 'Editar produto' : 'Novo produto'}
                                </h3>
                                <p className="text-xs text-gray-500">
                                    {isEditing
                                        ? 'Estoque e custo não são editados aqui — use a tela de Estoque.'
                                        : 'Estoque e custo entram na primeira compra, pela tela de Estoque.'}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="h-9 w-9 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="p-6 space-y-5">
                        {error && (
                            <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm font-medium border border-red-100">
                                {error}
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700">Código de barras</label>
                            <div className="flex gap-2">
                                <Input
                                    value={form.barcode}
                                    onChange={set('barcode')}
                                    // Ao sair do campo, e não a cada tecla: o leitor
                                    // "digita" o código inteiro, e buscar a cada
                                    // caractere daria 13 consultas por bipada.
                                    onBlur={(e) => buscarNome(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key !== 'Enter') return;
                                        e.preventDefault();
                                        buscarNome(e.currentTarget.value);
                                    }}
                                    placeholder="Bipe aqui ou digite (deixe vazio para granel)"
                                    className="font-mono"
                                    autoFocus={!isEditing && !initialBarcode}
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    title="Ler pela câmera"
                                    onClick={() => setCameraOpen(true)}
                                >
                                    <Camera className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-semibold text-gray-700">Nome *</label>
                                {lookingUp && (
                                    <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-400">
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                        procurando o nome...
                                    </span>
                                )}
                            </div>
                            <Input
                                value={form.name}
                                onChange={(e) => {
                                    set('name')(e);
                                    // Editou à mão: deixa de ser sugestão.
                                    if (suggestedName) setSuggestedName('');
                                }}
                                placeholder="Ex.: Arroz Tio João 5kg"
                                autoFocus={Boolean(initialBarcode)}
                            />

                            {/* A base é colaborativa: o nome pode vir estranho ou
                                de outro país. Dizer de onde veio é o que faz a
                                pessoa conferir a embalagem antes de salvar. */}
                            {suggestedName && form.name === suggestedName && (
                                <p className="flex items-start gap-1.5 text-xs text-[#7E1A8B]">
                                    <Sparkles className="h-3.5 w-3.5 shrink-0 mt-px" />
                                    <span>
                                        Nome sugerido pelo código de barras. Confira com a
                                        embalagem e ajuste se precisar.
                                    </span>
                                </p>
                            )}
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-700">Preço de venda</label>
                                <Input
                                    type="number" step="0.01" min="0"
                                    value={form.sale_price}
                                    onChange={set('sale_price')}
                                    placeholder="0,00"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-700">Unidade</label>
                                <Select value={form.unit} onChange={set('unit')}>
                                    {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                                </Select>
                            </div>
                            {/* Custo é só leitura: quem grava é a entrada de estoque. */}
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-700">Preço de custo</label>
                                <div className="h-10 flex items-center px-3 rounded-md bg-gray-50 border border-gray-100">
                                    {cost > 0 ? (
                                        <span className="text-sm font-semibold text-gray-700">
                                            {formatCurrency(cost)}
                                        </span>
                                    ) : (
                                        <span className="text-sm text-gray-400">
                                            vem da 1ª entrada
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-start gap-2.5 rounded-xl bg-gray-50 p-3.5">
                            <Info className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" />
                            <p className="text-xs text-gray-500 leading-relaxed">
                                O preço de custo não se digita aqui — ele é o valor pago na última
                                compra, registrado na tela de <span className="font-semibold">Estoque</span>.
                                Assim a margem sempre reflete o que você realmente pagou.
                            </p>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-700">Estoque mínimo</label>
                                <Input
                                    type="number" step="0.001" min="0"
                                    value={form.min_stock}
                                    onChange={set('min_stock')}
                                    placeholder="0"
                                />
                                <p className="text-[11px] text-gray-400">Avisa quando cair abaixo disso.</p>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-700">Categoria</label>
                                <Input
                                    value={form.category}
                                    onChange={set('category')}
                                    placeholder="Ex.: Bebidas"
                                />
                            </div>
                            {/* Só faz sentido em produto pesado: o código da
                                balança é o que liga a etiqueta impressa a este
                                cadastro. Em produto de unidade, o campo só
                                confundiria. */}
                            {['kg', 'g', 'l', 'ml'].includes(form.unit) && (
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-gray-700">
                                        Código na balança
                                    </label>
                                    <Input
                                        value={form.scale_code}
                                        onChange={set('scale_code')}
                                        placeholder="Ex.: 45"
                                        className="font-mono"
                                    />
                                    <p className="text-[11px] text-gray-400">
                                        O mesmo número cadastrado na balança para este produto.
                                    </p>
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-700">Fornecedor</label>
                                <Select value={form.supplier_id} onChange={set('supplier_id')}>
                                    <option value="">Nenhum</option>
                                    {suppliers.map((s) => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </Select>
                            </div>
                        </div>

                        {/* Classificação fiscal, recolhida.
                            Fica fechada porque a venda no balcão não depende
                            dela: sem preencher, a nota sai com o padrão da
                            configuração fiscal. Abrir só quando este produto
                            tributa diferente do resto da loja. */}
                        <details className="rounded-xl border border-gray-100 bg-gray-50/60">
                            <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-gray-700">
                                Classificação fiscal (opcional)
                            </summary>
                            <div className="px-4 pb-4 space-y-3">
                                <p className="text-[11px] text-gray-500">
                                    Em branco, vale o padrão definido na tela de Nota fiscal.
                                    Preencha só o que for diferente para este produto.
                                </p>
                                <div className="grid grid-cols-3 gap-3">
                                    {[
                                        { key: 'ncm', label: 'NCM', placeholder: '21069090' },
                                        { key: 'cfop', label: 'CFOP', placeholder: '5102' },
                                        { key: 'cest', label: 'CEST', placeholder: '—' },
                                        { key: 'csosn', label: 'CSOSN', placeholder: '102' },
                                        { key: 'cst', label: 'CST', placeholder: '00' },
                                    ].map((field) => (
                                        <div key={field.key} className="space-y-1.5">
                                            <label className="text-xs font-semibold text-gray-600">
                                                {field.label}
                                            </label>
                                            <Input
                                                value={form[field.key]}
                                                onChange={set(field.key)}
                                                placeholder={field.placeholder}
                                            />
                                        </div>
                                    ))}
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-gray-600">Origem</label>
                                        <Select value={String(form.origem)} onChange={set('origem')}>
                                            <option value="">Padrão</option>
                                            <option value="0">0 — Nacional</option>
                                            <option value="1">1 — Importação direta</option>
                                            <option value="2">2 — Adquirido no mercado interno</option>
                                        </Select>
                                    </div>
                                </div>
                            </div>
                        </details>

                        <div className="flex justify-end gap-3 pt-2">
                            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
                            <Button type="submit" variant="brand" disabled={saving}>
                                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                                {isEditing ? 'Salvar alterações' : 'Cadastrar produto'}
                            </Button>
                        </div>
                    </form>
                </div>
            </div>

            <CameraScannerModal
                isOpen={cameraOpen}
                onClose={() => setCameraOpen(false)}
                onDetect={(code) => {
                    setForm((f) => ({ ...f, barcode: code }));
                    setCameraOpen(false);
                    buscarNome(code);
                }}
            />
        </>
    );
}
