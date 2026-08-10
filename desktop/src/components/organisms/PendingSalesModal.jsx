import React, { useState } from 'react';
import {
    X, RefreshCw, CloudOff, AlertTriangle, Trash2, RotateCcw, Check,
} from 'lucide-react';
import { Button } from '../atoms/Button';
import { Badge } from '../atoms/Badge';
import { cn, formatCurrency, formatDateTime } from '../../lib/utils';
import { paymentLabel } from '../../lib/payments';
import { retryBlocked, discardQueued } from '../../lib/salesOutbox';
import { useConnection } from '../../contexts/ConnectionContext';
import { useProfile } from '../../contexts/ProfileContext';

/**
 * As vendas que ainda não chegaram no servidor.
 *
 * Existe para que "está tudo guardado" seja uma afirmação verificável, e não
 * uma promessa. Quem fechou a venda pode abrir aqui e ver a venda dela na
 * lista, com valor e hora.
 */
export function PendingSalesModal({ isOpen, onClose }) {
    const { queued, syncing, online, sync } = useConnection();
    const { isAdmin } = useProfile();
    const [busy, setBusy] = useState(null);

    if (!isOpen) return null;

    const totalOf = (entry) =>
        entry.payments.reduce((sum, p) => sum + Number(p.amount), 0);

    const handleRetry = async (entry) => {
        setBusy(entry.client_uuid);
        try {
            await retryBlocked(entry.client_uuid);
            await sync({ silent: false });
        } finally {
            setBusy(null);
        }
    };

    const handleDiscard = async (entry) => {
        const ok = window.confirm(
            `Descartar a venda de ${formatCurrency(totalOf(entry))} de ` +
            `${formatDateTime(entry.sold_at)}?\n\n` +
            'Ela nunca vai entrar no sistema. O dinheiro dessa venda vai faltar ' +
            'na conferência do caixa.'
        );
        if (!ok) return;

        setBusy(entry.client_uuid);
        try {
            await discardQueued(entry.client_uuid);
        } finally {
            setBusy(null);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div
                className="modal-content bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className={cn(
                            "h-10 w-10 rounded-xl flex items-center justify-center",
                            online ? "bg-blue-50" : "bg-amber-50"
                        )}>
                            <CloudOff className={cn("h-5 w-5", online ? "text-blue-600" : "text-amber-600")} />
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-900">Vendas aguardando envio</h3>
                            <p className="text-xs text-gray-500">
                                {online
                                    ? 'Conectado — o envio acontece sozinho'
                                    : 'Sem internet. Elas sobem quando a conexão voltar.'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="h-9 w-9 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-3">
                    {queued.length === 0 ? (
                        <div className="py-12 flex flex-col items-center text-center">
                            <div className="h-14 w-14 rounded-2xl bg-emerald-50 flex items-center justify-center mb-3">
                                <Check className="h-7 w-7 text-emerald-600" />
                            </div>
                            <p className="font-semibold text-gray-700">Nada pendente</p>
                            <p className="text-sm text-gray-400 mt-1">
                                Todas as vendas já estão no servidor.
                            </p>
                        </div>
                    ) : (
                        queued.map((entry) => (
                            <div
                                key={entry.client_uuid}
                                className={cn(
                                    "rounded-xl border p-4",
                                    entry.blocked ? "border-red-200 bg-red-50/50" : "border-gray-200"
                                )}
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-gray-900">
                                                {formatCurrency(totalOf(entry))}
                                            </span>
                                            {entry.blocked
                                                ? <Badge variant="destructive">recusada</Badge>
                                                : <Badge variant="info">na fila</Badge>}
                                        </div>
                                        <p className="text-xs text-gray-500 mt-0.5">
                                            {formatDateTime(entry.sold_at)} ·{' '}
                                            {entry.items.length}{' '}
                                            {entry.items.length === 1 ? 'produto' : 'produtos'} ·{' '}
                                            {entry.payments.map((p) => paymentLabel(p.method)).join(' + ')}
                                        </p>
                                        {entry.note && (
                                            <p className="text-xs text-gray-400 mt-0.5">{entry.note}</p>
                                        )}
                                    </div>

                                    {/* Descartar é do administrador: joga fora uma venda
                                        que já foi cobrada do cliente. */}
                                    {entry.blocked && isAdmin && (
                                        <div className="flex gap-1 shrink-0">
                                            <button
                                                onClick={() => handleRetry(entry)}
                                                disabled={busy === entry.client_uuid}
                                                className="h-8 w-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-emerald-600 hover:bg-emerald-50"
                                                title="Tentar de novo"
                                            >
                                                <RotateCcw className="h-4 w-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDiscard(entry)}
                                                disabled={busy === entry.client_uuid}
                                                className="h-8 w-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-100"
                                                title="Descartar"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {entry.blocked && (
                                    <div className="mt-3 flex gap-2 text-xs text-red-700 bg-red-100/60 rounded-lg p-2.5">
                                        <AlertTriangle className="h-4 w-4 shrink-0" />
                                        <span>
                                            O servidor recusou: {entry.last_error}
                                            {!isAdmin && ' — avise o responsável.'}
                                        </span>
                                    </div>
                                )}

                                <div className="mt-2 space-y-0.5">
                                    {entry.items.map((item, idx) => (
                                        <div key={idx} className="flex justify-between text-xs text-gray-500">
                                            <span>
                                                {Number(item.quantity)}× {item.product_name}
                                            </span>
                                            <span>{formatCurrency(item.quantity * item.unit_price)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
                    <Button variant="outline" className="flex-1" onClick={onClose}>
                        Fechar
                    </Button>
                    <Button
                        variant="brand"
                        className="flex-1"
                        onClick={() => sync({ silent: false })}
                        disabled={syncing || queued.length === 0}
                    >
                        <RefreshCw className={cn("h-4 w-4 mr-2", syncing && "animate-spin")} />
                        {syncing ? 'Enviando...' : 'Tentar enviar agora'}
                    </Button>
                </div>
            </div>
        </div>
    );
}
