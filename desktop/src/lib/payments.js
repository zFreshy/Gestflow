import {
    Banknote, Smartphone, CreditCard, Ticket, NotebookPen,
} from 'lucide-react';

/**
 * Formas de pagamento aceitas.
 *
 * `id` é o que vai para o banco — não mude sem migrar os dados já gravados.
 * `label` é só o texto na tela: "Cartão Créd." e "Crédito Loja" ficariam
 * parecidos demais lado a lado no caixa se ambos se chamassem "Crédito".
 */
export const PAYMENT_METHODS = [
    { id: 'Dinheiro',     label: 'Dinheiro',     icon: Banknote,    tone: 'success' },
    { id: 'PIX',          label: 'PIX',          icon: Smartphone,  tone: 'info' },
    { id: 'Débito',       label: 'Cartão Déb.',  icon: CreditCard,  tone: 'info' },
    { id: 'Crédito',      label: 'Cartão Créd.', icon: CreditCard,  tone: 'warning' },
    { id: 'Ticket',       label: 'Ticket/Vale',  icon: Ticket,      tone: 'brand' },
    { id: 'Crédito Loja', label: 'Crédito Loja', icon: NotebookPen, tone: 'destructive' },
];

/** Venda no fiado: exige saber de quem é para poder cobrar depois. */
export const STORE_CREDIT = 'Crédito Loja';

export const PAYMENT_BY_ID = Object.fromEntries(
    PAYMENT_METHODS.map((m) => [m.id, m])
);

export const paymentLabel = (id) => PAYMENT_BY_ID[id]?.label ?? id;
export const paymentTone = (id) => PAYMENT_BY_ID[id]?.tone ?? 'default';
