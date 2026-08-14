import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
    return twMerge(clsx(inputs))
}

export function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(Number(value) || 0);
}

export function formatQuantity(value, unit = 'un') {
    const n = Number(value) || 0;
    // Peso e volume vao com casas decimais; unidade inteira nao.
    const decimals = ['kg', 'g', 'l', 'ml'].includes(unit) ? 3 : 0;
    return `${n.toLocaleString('pt-BR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: decimals,
    })} ${unit}`;
}

export function formatDate(value) {
    if (!value) return '';
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('pt-BR');
}

export function formatDateTime(value) {
    if (!value) return '';
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
    })}`;
}

/** Data local no formato YYYY-MM-DD, sem passar por UTC (que joga pro dia anterior). */
export function toISODate(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/** Primeiro dia do mês como YYYY-MM-DD — para colunas `date`. */
export function startOfMonthISO(date = new Date()) {
    return toISODate(new Date(date.getFullYear(), date.getMonth(), 1));
}

/**
 * Meia-noite do dia 1 no fuso local, convertida pro instante UTC — para
 * colunas `timestamptz`. Mandar "2026-08-01T00:00:00" cru seria lido como UTC
 * e traria junto as vendas do fim do dia 31.
 */
export function startOfMonthInstant(date = new Date()) {
    return new Date(date.getFullYear(), date.getMonth(), 1).toISOString();
}

/** Início do dia (00:00 local) de uma data YYYY-MM-DD, como instante UTC. */
export function dayStartInstant(isoDate) {
    const [y, m, d] = isoDate.split('-').map(Number);
    return new Date(y, m - 1, d, 0, 0, 0, 0).toISOString();
}

/** Fim do dia (23:59:59.999 local) de uma data YYYY-MM-DD, como instante UTC. */
export function dayEndInstant(isoDate) {
    const [y, m, d] = isoDate.split('-').map(Number);
    return new Date(y, m - 1, d, 23, 59, 59, 999).toISOString();
}

/** Margem de lucro em %, protegida contra divisao por zero. */
export function marginPercent(revenue, cost) {
    const r = Number(revenue) || 0;
    if (r === 0) return 0;
    return ((r - (Number(cost) || 0)) / r) * 100;
}

/**
 * Nome da loja, como aparece para quem usa.
 *
 * Numa constante e não solto pelas telas: ele aparece na barra lateral, no
 * login, na aba da janela e no cabeçalho do cupom. Espalhado, trocar o nome
 * vira caça ao texto esquecido em algum canto.
 *
 * O cupom impresso prefere a razão social cadastrada na tela de Nota fiscal —
 * este nome só entra quando não há nada preenchido lá.
 */
export const STORE_NAME = 'Mercadinho da Família';

/** Versão curta, para quando a barra lateral está recolhida. */
export const STORE_INITIALS = 'MF';
