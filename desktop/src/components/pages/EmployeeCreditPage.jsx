import React, { useEffect, useMemo, useState } from 'react';
import {
    ShoppingBasket, Search, Camera, Loader2, Trash2, Check, FilterX, X,
    CircleCheck, Wallet,
} from 'lucide-react';
import { Button } from '../atoms/Button';
import { Input } from '../atoms/Input';
import { Select } from '../atoms/Select';
import { Badge } from '../atoms/Badge';
import { PeriodFilter, PERIOD_PRESETS } from '../molecules/PeriodFilter';
import { cn, formatCurrency, formatDate, toISODate } from '../../lib/utils';
import { useProfile } from '../../contexts/ProfileContext';
import {
    findProductByBarcode, searchProducts, createEmployeeCredit,
    listEmployeeCredits, deleteEmployeeCredit, settleEmployeeCredits,
    unsettleEmployeeCredits, listEmployeeProfiles,
} from '../../services/mercadinhoService';
import { CameraScannerModal } from '../organisms/CameraScannerModal';

export function EmployeeCreditPage() {
    const { profile, isAdmin } = useProfile();

    const [credits, setCredits] = useState([]);
    const [profiles, setProfiles] = useState([]);
    const [loading, setLoading] = useState(true);

    // Filtros
    const [preset, setPreset] = useState('mes');
    const [customFrom, setCustomFrom] = useState(toISODate());
    const [customTo, setCustomTo] = useState(toISODate());
    const [filterProfile, setFilterProfile] = useState('');
    const [filterText, setFilterText] = useState('');
    const [onlyOpen, setOnlyOpen] = useState(false);

    // Lançamento (só no perfil de funcionário)
    const [product, setProduct] = useState(null);
    const [quantity, setQuantity] = useState('1');
    const [takenAt, setTakenAt] = useState(toISODate());
    const [note, setNote] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [cameraOpen, setCameraOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const range = useMemo(() => (
        preset === 'custom'
            ? { from: customFrom, to: customTo }
            : PERIOD_PRESETS[preset].range()
    ), [preset, customFrom, customTo]);

    const load = async () => {
        setLoading(true);
        try {
            const [data, profs] = await Promise.all([
                listEmployeeCredits({
                    // No perfil de funcionário só entra o que é dele: ninguém
                    // precisa ver o que o colega pegou.
                    // `profile?.id`: sem internet o app pode estar valendo-se do
                    // papel lembrado e ainda não ter carregado o perfil. Sem o
                    // `?`, a tela quebrava justamente na abertura offline.
                    profileId: isAdmin ? (filterProfile || undefined) : profile?.id,
                    from: range.from,
                    to: range.to,
                }),
                isAdmin ? listEmployeeProfiles({ includeInactive: true }) : Promise.resolve([]),
            ]);
            setCredits(data);
            setProfiles(profs);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [range.from, range.to, filterProfile, isAdmin, profile?.id]);

    // Busca de produto
    useEffect(() => {
        const term = searchTerm.trim();
        if (term.length < 2) { setSearchResults([]); return; }

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
                setError(`Código ${clean} não cadastrado.`);
            }
        } catch (err) {
            console.error(err);
            setError('Erro ao buscar o produto.');
        }
    };

    const total = useMemo(
        () => (Number(quantity) || 0) * (Number(product?.sale_price) || 0),
        [quantity, product]
    );

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (!product) { setError('Escolha o produto que você pegou.'); return; }
        if (!(Number(quantity) > 0)) { setError('Informe a quantidade.'); return; }

        setSaving(true);
        try {
            await createEmployeeCredit({
                employeeProfileId: profile.id,
                product,
                quantity,
                takenAt,
                note,
            });
            setSuccess(`Anotado: ${quantity} × ${product.name}.`);
            setProduct(null);
            setQuantity('1');
            setNote('');
            load();
            setTimeout(() => setSuccess(''), 3500);
        } catch (err) {
            console.error(err);
            setError('Não consegui anotar. Tente de novo.');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (credit) => {
        const ok = window.confirm(
            `Apagar ${Number(credit.quantity)} × ${credit.product_name}?\n\n` +
            'O produto volta para o estoque.'
        );
        if (!ok) return;

        try {
            await deleteEmployeeCredit(credit.id);
            load();
        } catch (err) {
            console.error(err);
            alert('Não consegui apagar o lançamento.');
        }
    };

    const visible = useMemo(() => {
        const term = filterText.trim().toLowerCase();
        return credits.filter((c) => {
            if (onlyOpen && c.settled_at) return false;
            if (term && !`${c.product_name} ${c.note ?? ''}`.toLowerCase().includes(term)) return false;
            return true;
        });
    }, [credits, filterText, onlyOpen]);

    const totals = useMemo(() => ({
        open: visible.filter((c) => !c.settled_at).reduce((s, c) => s + Number(c.total), 0),
        settled: visible.filter((c) => c.settled_at).reduce((s, c) => s + Number(c.total), 0),
        all: visible.reduce((s, c) => s + Number(c.total), 0),
    }), [visible]);

    const openIds = useMemo(
        () => visible.filter((c) => !c.settled_at).map((c) => c.id),
        [visible]
    );

    const handleSettleAll = async () => {
        const ok = window.confirm(
            `Marcar ${openIds.length} ${openIds.length === 1 ? 'lançamento' : 'lançamentos'} ` +
            `(${formatCurrency(totals.open)}) como descontados no pagamento?`
        );
        if (!ok) return;

        try {
            await settleEmployeeCredits(openIds, toISODate());
            load();
        } catch (err) {
            console.error(err);
            alert('Não consegui marcar como descontado.');
        }
    };

    const handleUnsettle = async (credit) => {
        try {
            await unsettleEmployeeCredits([credit.id]);
            load();
        } catch (err) {
            console.error(err);
            alert('Não consegui desfazer.');
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">
                    {isAdmin ? 'Crédito da loja' : 'Meu crédito'}
                </h1>
                <p className="text-sm text-gray-500 mt-0.5">
                    {isAdmin
                        ? 'O que cada funcionário pegou para descontar no pagamento'
                        : 'Produtos que você pegou e serão descontados no fim do mês'}
                </p>
            </div>

            {/* Totais */}
            <div className="grid grid-cols-3 gap-4">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
                    <div className="h-11 w-11 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                        <Wallet className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">A descontar</p>
                        <p className="text-2xl font-extrabold text-gray-900 mt-0.5">
                            {formatCurrency(totals.open)}
                        </p>
                    </div>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
                    <div className="h-11 w-11 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                        <CircleCheck className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Já descontado</p>
                        <p className="text-2xl font-extrabold text-gray-900 mt-0.5">
                            {formatCurrency(totals.settled)}
                        </p>
                    </div>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
                    <div className="h-11 w-11 rounded-xl bg-gray-50 flex items-center justify-center shrink-0">
                        <ShoppingBasket className="h-5 w-5 text-gray-400" />
                    </div>
                    <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Itens no período</p>
                        <p className="text-2xl font-extrabold text-gray-900 mt-0.5">{visible.length}</p>
                    </div>
                </div>
            </div>

            <div className={cn("flex gap-6 items-start", isAdmin && "flex-col")}>
                {/* Lançamento: só dentro de um perfil de funcionário */}
                {!isAdmin && (
                    <form
                        onSubmit={handleSubmit}
                        className="w-[420px] shrink-0 bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5"
                    >
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-[#7E1A8B]/10 flex items-center justify-center">
                                <ShoppingBasket className="h-5 w-5 text-[#7E1A8B]" />
                            </div>
                            <h2 className="font-bold text-gray-900">Anotar produto</h2>
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
                                            {formatCurrency(product.sale_price)} · {product.barcode || 'sem código'}
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
                                                    if (/^\d{6,}$/.test(t)) handleCode(t);
                                                    else if (searchResults.length > 0) {
                                                        setProduct(searchResults[0]);
                                                        setSearchTerm('');
                                                        setSearchResults([]);
                                                    }
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
                                                    onClick={() => {
                                                        setProduct(p);
                                                        setSearchTerm('');
                                                        setSearchResults([]);
                                                    }}
                                                    className="w-full text-left px-3 py-2.5 hover:bg-gray-50 border-b border-gray-50 last:border-0 flex justify-between gap-3"
                                                >
                                                    <span className="text-sm font-semibold text-gray-900 truncate">{p.name}</span>
                                                    <span className="text-sm font-bold text-[#7E1A8B] shrink-0">
                                                        {formatCurrency(p.sale_price)}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-700">Quantidade *</label>
                                <Input
                                    type="number" step="0.001" min="0"
                                    value={quantity}
                                    onChange={(e) => setQuantity(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-700">Data</label>
                                <Input type="date" value={takenAt} onChange={(e) => setTakenAt(e.target.value)} />
                            </div>
                        </div>

                        {total > 0 && (
                            <div className="rounded-xl bg-gray-50 p-4 flex justify-between items-baseline">
                                <span className="text-sm font-semibold text-gray-600">Vai descontar</span>
                                <span className="text-2xl font-extrabold text-gray-900">{formatCurrency(total)}</span>
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700">Observação</label>
                            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Opcional" />
                        </div>

                        <Button type="submit" variant="brand" size="lg" className="w-full" disabled={saving}>
                            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                            Anotar
                        </Button>

                        <p className="text-xs text-gray-400 text-center">
                            O produto sai do estoque, igual a uma venda.
                        </p>
                    </form>
                )}

                {/* Histórico */}
                <div className="flex-1 min-w-0 w-full space-y-4">
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
                                    placeholder="Buscar produto"
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

                            {isAdmin && (
                                <div className="w-52">
                                    <Select value={filterProfile} onChange={(e) => setFilterProfile(e.target.value)}>
                                        <option value="">Todos os funcionários</option>
                                        {profiles.map((p) => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </Select>
                                </div>
                            )}

                            <label className="flex items-center gap-2 text-sm font-medium text-gray-600 cursor-pointer select-none whitespace-nowrap">
                                <input
                                    type="checkbox"
                                    checked={onlyOpen}
                                    onChange={(e) => setOnlyOpen(e.target.checked)}
                                    className="h-4 w-4 rounded border-gray-300 accent-[#7E1A8B]"
                                />
                                Só em aberto
                            </label>

                            {isAdmin && openIds.length > 0 && (
                                <Button variant="success" onClick={handleSettleAll}>
                                    <CircleCheck className="h-4 w-4 mr-2" />
                                    Marcar como descontado
                                </Button>
                            )}
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        {loading ? (
                            <div className="p-16 flex items-center justify-center text-gray-400">
                                <Loader2 className="h-6 w-6 animate-spin" />
                            </div>
                        ) : visible.length === 0 ? (
                            <div className="p-16 flex flex-col items-center text-center">
                                <div className="h-16 w-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-4">
                                    <ShoppingBasket className="h-8 w-8 text-gray-300" />
                                </div>
                                <p className="font-semibold text-gray-500">
                                    {credits.length === 0 ? 'Nada anotado no período' : 'Nada com esses filtros'}
                                </p>
                                {credits.length > 0 && (
                                    <Button
                                        variant="outline"
                                        className="mt-5"
                                        onClick={() => { setFilterText(''); setOnlyOpen(false); }}
                                    >
                                        <FilterX className="h-4 w-4 mr-2" />
                                        Limpar filtros
                                    </Button>
                                )}
                            </div>
                        ) : (
                            <table className="w-full">
                                <thead className="bg-gray-50/80">
                                    <tr className="text-[11px] uppercase tracking-wide text-gray-500">
                                        <th className="text-left font-bold px-5 py-3">Produto</th>
                                        {isAdmin && <th className="text-left font-bold px-3 py-3 w-36">Funcionário</th>}
                                        <th className="text-left font-bold px-3 py-3 w-28">Data</th>
                                        <th className="text-right font-bold px-3 py-3 w-20">Qtd</th>
                                        <th className="text-right font-bold px-3 py-3 w-28">Valor</th>
                                        <th className="text-left font-bold px-3 py-3 w-36">Situação</th>
                                        <th className="w-12" />
                                    </tr>
                                </thead>
                                <tbody>
                                    {visible.map((c) => (
                                        <tr key={c.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
                                            <td className="px-5 py-3">
                                                <p className="text-sm font-semibold text-gray-900">{c.product_name}</p>
                                                {c.note && <p className="text-xs text-gray-400 mt-0.5">{c.note}</p>}
                                            </td>
                                            {isAdmin && (
                                                <td className="px-3 py-3 text-sm text-gray-600">
                                                    {c.employee_profiles?.name ?? '—'}
                                                </td>
                                            )}
                                            <td className="px-3 py-3 text-sm text-gray-600">
                                                {formatDate(`${c.taken_at}T00:00:00`)}
                                            </td>
                                            <td className="px-3 py-3 text-right text-sm text-gray-600">
                                                {Number(c.quantity)}
                                            </td>
                                            <td className="px-3 py-3 text-right text-sm font-bold text-gray-900">
                                                {formatCurrency(c.total)}
                                            </td>
                                            <td className="px-3 py-3">
                                                {c.settled_at ? (
                                                    <button
                                                        onClick={isAdmin ? () => handleUnsettle(c) : undefined}
                                                        disabled={!isAdmin}
                                                        className="disabled:cursor-default"
                                                        title={isAdmin ? 'Clique para desfazer' : undefined}
                                                    >
                                                        <Badge variant="success">
                                                            descontado {formatDate(`${c.settled_at}T00:00:00`)}
                                                        </Badge>
                                                    </button>
                                                ) : (
                                                    <Badge variant="warning">em aberto</Badge>
                                                )}
                                            </td>
                                            <td className="px-3 py-3">
                                                {/* Já descontado não se apaga: mexeria numa conta fechada. */}
                                                {!c.settled_at && (
                                                    <button
                                                        onClick={() => handleDelete(c)}
                                                        className="h-8 w-8 rounded-lg flex items-center justify-center text-gray-300 hover:text-red-600 hover:bg-red-50 transition-colors"
                                                        title="Apagar"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
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
