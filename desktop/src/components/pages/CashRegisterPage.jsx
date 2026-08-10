import React, { useEffect, useMemo, useState } from 'react';
import {
    Wallet, Loader2, LockOpen, Lock, ArrowDownLeft, ArrowUpRight,
    ChevronDown, ChevronRight, Scale, Banknote,
} from 'lucide-react';
import { Button } from '../atoms/Button';
import { Input } from '../atoms/Input';
import { Badge } from '../atoms/Badge';
import { PeriodFilter, PERIOD_PRESETS } from '../molecules/PeriodFilter';
import {
    cn, formatCurrency, formatDateTime, dayStartInstant, dayEndInstant, toISODate,
} from '../../lib/utils';
import {
    getOpenCashSession, listCashSessions, listCashMovements,
    openCashSession, closeCashSession, addCashMovement,
} from '../../services/mercadinhoService';

/**
 * Caixa: abertura, sangria e fechamento.
 *
 * Tela de administrador. O funcionário continua vendendo normalmente e as
 * vendas dele entram no turno aberto sozinhas — ele só não abre, não sangra e
 * não confere, que é onde o dinheiro é manuseado fora da venda.
 */
export function CashRegisterPage() {
    const [session, setSession] = useState(null);
    const [movements, setMovements] = useState([]);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const [preset, setPreset] = useState('mes');
    const [customFrom, setCustomFrom] = useState(toISODate());
    const [customTo, setCustomTo] = useState(toISODate());
    const [expanded, setExpanded] = useState(null);
    const [expandedMovements, setExpandedMovements] = useState({});

    // Formulários
    const [openingAmount, setOpeningAmount] = useState('');
    const [openingNote, setOpeningNote] = useState('');
    const [movementKind, setMovementKind] = useState('sangria');
    const [movementAmount, setMovementAmount] = useState('');
    const [movementReason, setMovementReason] = useState('');
    const [counted, setCounted] = useState('');
    const [closingNote, setClosingNote] = useState('');
    const [closing, setClosing] = useState(false);

    const range = useMemo(() => (
        preset === 'custom'
            ? { from: customFrom, to: customTo }
            : PERIOD_PRESETS[preset].range()
    ), [preset, customFrom, customTo]);

    const load = async () => {
        setLoading(true);
        try {
            const open = await getOpenCashSession();
            setSession(open);
            setMovements(open ? await listCashMovements(open.id) : []);
            setHistory(await listCashSessions({
                from: dayStartInstant(range.from),
                to: dayEndInstant(range.to),
            }));
        } catch (err) {
            console.error(err);
            setError('Não consegui carregar o caixa.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [range.from, range.to]);

    const run = async (action, onDone) => {
        setError('');
        setBusy(true);
        try {
            await action();
            onDone?.();
            await load();
        } catch (err) {
            console.error(err);
            // A mensagem do banco é escrita para ser lida ("Já existe um caixa
            // aberto..."), então vale mais que um texto genérico daqui.
            setError(err?.message ?? 'Não consegui concluir.');
        } finally {
            setBusy(false);
        }
    };

    const handleOpen = () => run(
        () => openCashSession({ openingAmount: openingAmount || 0, note: openingNote || null }),
        () => { setOpeningAmount(''); setOpeningNote(''); }
    );

    const handleMovement = () => run(
        () => addCashMovement({
            kind: movementKind,
            amount: movementAmount,
            reason: movementReason,
        }),
        () => { setMovementAmount(''); setMovementReason(''); }
    );

    const handleClose = () => run(
        () => closeCashSession({ countedAmount: counted, note: closingNote || null }),
        () => { setCounted(''); setClosingNote(''); setClosing(false); }
    );

    const difference = useMemo(() => {
        if (!session || counted === '') return null;
        return Number(counted) - Number(session.expected_now ?? 0);
    }, [counted, session]);

    const toggleHistory = async (row) => {
        if (expanded === row.id) { setExpanded(null); return; }
        setExpanded(row.id);
        if (!expandedMovements[row.id]) {
            try {
                const list = await listCashMovements(row.id);
                setExpandedMovements((prev) => ({ ...prev, [row.id]: list }));
            } catch (err) {
                console.error(err);
            }
        }
    };

    if (loading) {
        return (
            <div className="p-16 flex items-center justify-center text-gray-400">
                <Loader2 className="h-6 w-6 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Caixa</h1>
                <p className="text-sm text-gray-500 mt-0.5">
                    Abertura, sangria e conferência do dinheiro da gaveta
                </p>
            </div>

            {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm font-medium border border-red-100">
                    {error}
                </div>
            )}

            {!session ? (
                /* ----------------------------------------------------------
                 * Caixa fechado
                 * -------------------------------------------------------- */
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 max-w-xl">
                    <div className="flex items-center gap-3 mb-5">
                        <div className="h-11 w-11 rounded-xl bg-[#7E1A8B]/10 flex items-center justify-center">
                            <LockOpen className="h-5 w-5 text-[#7E1A8B]" />
                        </div>
                        <div>
                            <h2 className="font-bold text-gray-900">Abrir o caixa</h2>
                            <p className="text-xs text-gray-500">
                                Informe o troco que está entrando na gaveta agora
                            </p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700">
                                Troco inicial (R$)
                            </label>
                            <Input
                                type="number" step="0.01" min="0"
                                value={openingAmount}
                                onChange={(e) => setOpeningAmount(e.target.value)}
                                placeholder="0,00"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700">Observação</label>
                            <Input
                                value={openingNote}
                                onChange={(e) => setOpeningNote(e.target.value)}
                                placeholder="Opcional"
                            />
                        </div>
                        <Button
                            variant="brand" size="lg" className="w-full"
                            onClick={handleOpen} disabled={busy}
                        >
                            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Abrir caixa
                        </Button>
                    </div>

                    <p className="text-xs text-gray-400 mt-4 text-center">
                        Enquanto o caixa está fechado o PDV continua vendendo — as vendas
                        só não entram em nenhuma conferência.
                    </p>
                </div>
            ) : (
                /* ----------------------------------------------------------
                 * Caixa aberto
                 * -------------------------------------------------------- */
                <>
                    <div className="grid grid-cols-4 gap-4">
                        <Stat
                            icon={Banknote} tone="brand" label="Troco de abertura"
                            value={formatCurrency(session.opening_amount)}
                        />
                        <Stat
                            icon={Wallet} tone="success" label="Vendas em dinheiro"
                            value={formatCurrency(session.cash_sales)}
                        />
                        <Stat
                            icon={ArrowDownLeft} tone="warning" label="Sangrias"
                            value={formatCurrency(session.withdrawals)}
                        />
                        <Stat
                            icon={Scale} tone="default" label="Esperado na gaveta"
                            value={formatCurrency(session.expected_now)}
                        />
                    </div>

                    <div className="flex gap-6 items-start">
                        {/* Sangria / suprimento */}
                        <div className="w-[380px] shrink-0 bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
                            <h2 className="font-bold text-gray-900">Movimentar a gaveta</h2>

                            <div className="grid grid-cols-2 gap-2">
                                {[
                                    { id: 'sangria', label: 'Sangria', icon: ArrowDownLeft, hint: 'sai' },
                                    { id: 'suprimento', label: 'Suprimento', icon: ArrowUpRight, hint: 'entra' },
                                ].map(({ id, label, icon: Icon, hint }) => (
                                    <button
                                        key={id}
                                        onClick={() => setMovementKind(id)}
                                        className={cn(
                                            "flex flex-col items-center gap-1 py-3 rounded-xl border-2 transition-all",
                                            movementKind === id
                                                ? "border-[#7E1A8B] bg-[#7E1A8B]/[0.06] text-[#7E1A8B]"
                                                : "border-gray-100 text-gray-500 hover:border-gray-200"
                                        )}
                                    >
                                        <Icon className="h-5 w-5" />
                                        <span className="text-xs font-semibold">{label}</span>
                                        <span className="text-[10px] opacity-60">dinheiro {hint}</span>
                                    </button>
                                ))}
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-700">Valor (R$)</label>
                                <Input
                                    type="number" step="0.01" min="0"
                                    value={movementAmount}
                                    onChange={(e) => setMovementAmount(e.target.value)}
                                    placeholder="0,00"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-700">Motivo *</label>
                                <Input
                                    value={movementReason}
                                    onChange={(e) => setMovementReason(e.target.value)}
                                    placeholder="Levado ao cofre, pago ao entregador..."
                                />
                                <p className="text-xs text-gray-400">
                                    Obrigatório: é o único registro de para onde o dinheiro foi.
                                </p>
                            </div>

                            <Button
                                variant="outline" className="w-full"
                                onClick={handleMovement}
                                disabled={busy || !movementAmount || !movementReason.trim()}
                            >
                                Registrar {movementKind}
                            </Button>

                            {movements.length > 0 && (
                                <div className="pt-2 space-y-1.5 max-h-64 overflow-y-auto">
                                    {movements.map((m) => (
                                        <div key={m.id} className="flex items-start justify-between gap-2 text-sm">
                                            <div className="min-w-0">
                                                <p className="text-gray-700 truncate">{m.reason}</p>
                                                <p className="text-[11px] text-gray-400">
                                                    {formatDateTime(m.happened_at)}
                                                </p>
                                            </div>
                                            <span className={cn(
                                                "font-bold shrink-0",
                                                m.kind === 'sangria' ? "text-red-600" : "text-emerald-600"
                                            )}>
                                                {m.kind === 'sangria' ? '−' : '+'}{formatCurrency(m.amount)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Fechamento */}
                        <div className="flex-1 bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-xl bg-gray-100 flex items-center justify-center">
                                    <Lock className="h-5 w-5 text-gray-500" />
                                </div>
                                <div>
                                    <h2 className="font-bold text-gray-900">Fechar o caixa</h2>
                                    <p className="text-xs text-gray-500">
                                        Aberto em {formatDateTime(session.opened_at)}
                                        {session.opened_by_email && ` por ${session.opened_by_email}`}
                                    </p>
                                </div>
                            </div>

                            {!closing ? (
                                <Button
                                    variant="outline" size="lg" className="w-full"
                                    onClick={() => setClosing(true)}
                                >
                                    Conferir e fechar
                                </Button>
                            ) : (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-gray-700">
                                            Quanto foi contado na gaveta (R$) *
                                        </label>
                                        <Input
                                            type="number" step="0.01" min="0"
                                            value={counted}
                                            onChange={(e) => setCounted(e.target.value)}
                                            placeholder="0,00"
                                            autoFocus
                                        />
                                        {/* O esperado aparece só depois de digitar o
                                            contado. Mostrar antes convidaria a repetir
                                            o número em vez de contar o dinheiro. */}
                                        {counted !== '' && (
                                            <div className={cn(
                                                "rounded-xl p-4 space-y-1",
                                                Math.abs(difference) < 0.01 ? "bg-emerald-50"
                                                    : difference > 0 ? "bg-blue-50" : "bg-red-50"
                                            )}>
                                                <div className="flex justify-between text-sm text-gray-600">
                                                    <span>Esperado</span>
                                                    <span className="font-semibold">
                                                        {formatCurrency(session.expected_now)}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between text-sm text-gray-600">
                                                    <span>Contado</span>
                                                    <span className="font-semibold">
                                                        {formatCurrency(counted)}
                                                    </span>
                                                </div>
                                                <div className="h-px bg-black/5" />
                                                <div className="flex justify-between items-baseline">
                                                    <span className="font-bold text-gray-900">
                                                        {Math.abs(difference) < 0.01 ? 'Bateu certo'
                                                            : difference > 0 ? 'Sobra' : 'Falta'}
                                                    </span>
                                                    <span className={cn(
                                                        "text-xl font-extrabold",
                                                        Math.abs(difference) < 0.01 ? "text-emerald-700"
                                                            : difference > 0 ? "text-blue-700" : "text-red-700"
                                                    )}>
                                                        {formatCurrency(Math.abs(difference))}
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-gray-700">
                                            Observação do fechamento
                                        </label>
                                        <Input
                                            value={closingNote}
                                            onChange={(e) => setClosingNote(e.target.value)}
                                            placeholder="Opcional"
                                        />
                                    </div>

                                    <div className="flex gap-3">
                                        <Button
                                            variant="outline" className="flex-1"
                                            onClick={() => { setClosing(false); setCounted(''); }}
                                        >
                                            Voltar
                                        </Button>
                                        <Button
                                            variant="success" className="flex-[2]"
                                            onClick={handleClose}
                                            disabled={busy || counted === ''}
                                        >
                                            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                            Fechar caixa
                                        </Button>
                                    </div>
                                </div>
                            )}

                            <div className="pt-2 grid grid-cols-2 gap-3 text-sm">
                                <div className="rounded-xl bg-gray-50 p-3">
                                    <p className="text-xs text-gray-500">Vendas no turno</p>
                                    <p className="font-bold text-gray-900">
                                        {session.sales_count} · {formatCurrency(session.sales_total)}
                                    </p>
                                </div>
                                <div className="rounded-xl bg-gray-50 p-3">
                                    <p className="text-xs text-gray-500">Suprimentos</p>
                                    <p className="font-bold text-gray-900">
                                        {formatCurrency(session.deposits)}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* ------------------------------------------------------------
             * Turnos anteriores
             * ---------------------------------------------------------- */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <PeriodFilter
                    preset={preset}
                    onPresetChange={setPreset}
                    from={customFrom}
                    to={customTo}
                    onFromChange={setCustomFrom}
                    onToChange={setCustomTo}
                />
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {history.filter((h) => h.closed_at).length === 0 ? (
                    <div className="p-14 flex flex-col items-center text-center">
                        <div className="h-14 w-14 rounded-2xl bg-gray-50 flex items-center justify-center mb-3">
                            <Wallet className="h-7 w-7 text-gray-300" />
                        </div>
                        <p className="font-semibold text-gray-500">Nenhum caixa fechado no período</p>
                    </div>
                ) : (
                    <table className="w-full">
                        <thead className="bg-gray-50/80">
                            <tr className="text-[11px] uppercase tracking-wide text-gray-500">
                                <th className="w-10" />
                                <th className="text-left font-bold px-3 py-3">Abertura</th>
                                <th className="text-left font-bold px-3 py-3">Fechamento</th>
                                <th className="text-right font-bold px-3 py-3 w-28">Vendas</th>
                                <th className="text-right font-bold px-3 py-3 w-32">Esperado</th>
                                <th className="text-right font-bold px-3 py-3 w-32">Contado</th>
                                <th className="text-right font-bold px-3 py-3 w-36">Diferença</th>
                            </tr>
                        </thead>
                        <tbody>
                            {history.filter((h) => h.closed_at).map((row) => {
                                const isOpen = expanded === row.id;
                                const diff = Number(row.difference ?? 0);

                                return (
                                    <React.Fragment key={row.id}>
                                        <tr
                                            onClick={() => toggleHistory(row)}
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
                                            <td className="px-3 py-3 text-sm text-gray-700">
                                                {formatDateTime(row.opened_at)}
                                            </td>
                                            <td className="px-3 py-3 text-sm text-gray-700">
                                                {formatDateTime(row.closed_at)}
                                            </td>
                                            <td className="px-3 py-3 text-right text-sm text-gray-600">
                                                {row.sales_count}
                                            </td>
                                            <td className="px-3 py-3 text-right text-sm text-gray-600">
                                                {formatCurrency(row.expected_amount)}
                                            </td>
                                            <td className="px-3 py-3 text-right text-sm font-semibold text-gray-900">
                                                {formatCurrency(row.counted_amount)}
                                            </td>
                                            <td className="px-3 py-3 text-right">
                                                <Badge variant={
                                                    Math.abs(diff) < 0.01 ? 'success'
                                                        : diff > 0 ? 'info' : 'destructive'
                                                }>
                                                    {Math.abs(diff) < 0.01 ? 'bateu'
                                                        : `${diff > 0 ? 'sobra' : 'falta'} ${formatCurrency(Math.abs(diff))}`}
                                                </Badge>
                                            </td>
                                        </tr>

                                        {isOpen && (
                                            <tr className="border-b border-gray-100 bg-gray-50/40">
                                                <td />
                                                <td colSpan={6} className="px-3 py-4 space-y-2">
                                                    <div className="grid grid-cols-4 gap-4 text-sm">
                                                        <Detail label="Troco de abertura" value={formatCurrency(row.opening_amount)} />
                                                        <Detail label="Vendas em dinheiro" value={formatCurrency(row.cash_sales)} />
                                                        <Detail label="Sangrias" value={formatCurrency(row.withdrawals)} />
                                                        <Detail label="Suprimentos" value={formatCurrency(row.deposits)} />
                                                    </div>
                                                    {row.closing_note && (
                                                        <p className="text-sm text-gray-500">
                                                            Observação: {row.closing_note}
                                                        </p>
                                                    )}
                                                    {(expandedMovements[row.id] ?? []).length > 0 && (
                                                        <div className="pt-2 space-y-1">
                                                            {expandedMovements[row.id].map((m) => (
                                                                <div key={m.id} className="flex justify-between text-sm">
                                                                    <span className="text-gray-600">
                                                                        {m.kind === 'sangria' ? 'Sangria' : 'Suprimento'} · {m.reason}
                                                                        <span className="text-gray-400 ml-2">
                                                                            {m.user_email}
                                                                        </span>
                                                                    </span>
                                                                    <span className={cn(
                                                                        "font-semibold",
                                                                        m.kind === 'sangria' ? "text-red-600" : "text-emerald-600"
                                                                    )}>
                                                                        {m.kind === 'sangria' ? '−' : '+'}{formatCurrency(m.amount)}
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

const TONES = {
    brand: 'bg-[#7E1A8B]/10 text-[#7E1A8B]',
    success: 'bg-emerald-50 text-emerald-600',
    warning: 'bg-amber-50 text-amber-600',
    default: 'bg-gray-50 text-gray-400',
};

function Stat({ icon: Icon, tone, label, value }) {
    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
            <div className={cn("h-11 w-11 rounded-xl flex items-center justify-center shrink-0", TONES[tone])}>
                <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide truncate">
                    {label}
                </p>
                <p className="text-2xl font-extrabold text-gray-900 mt-0.5">{value}</p>
            </div>
        </div>
    );
}

const Detail = ({ label, value }) => (
    <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="font-semibold text-gray-900">{value}</p>
    </div>
);
