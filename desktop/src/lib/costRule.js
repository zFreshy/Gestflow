/**
 * Regras do custo de compra digitado em reais ou em percentual.
 *
 * Separado do componente para ser usado tambem por quem so calcula (o lote de
 * confirmacao), sem montar campo nenhum.
 */

export const emptyCost = () => ({ mode: 'valor', amount: '' });

const parse = (text) => {
    const t = String(text ?? '').trim().replace(',', '.');
    if (t === '') return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : NaN;
};

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Custo unitário em reais, ou:
 * - `null` quando nada foi digitado (o custo é opcional);
 * - `NaN` quando o que foi digitado não dá um custo válido.
 */
export function resolveCost(cost, salePrice) {
    const n = parse(cost?.amount);
    if (n === null) return null;
    if (Number.isNaN(n) || n < 0) return NaN;

    if (cost.mode === 'valor') return round2(n);

    // Percentual: precisa de um preço de venda para partir, e passar de 100%
    // daria custo negativo.
    const venda = Number(salePrice);
    if (!(venda > 0) || n > 100) return NaN;
    return round2(venda * (1 - n / 100));
}
