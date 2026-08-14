/**
 * Etiqueta de balança: o código de barras de peso variável.
 *
 * Quando o produto é pesado, a balança imprime uma etiqueta com um EAN-13
 * gerado na hora. Ele começa com **2** — prefixo que o padrão GS1 reserva para
 * uso interno da loja, justamente porque o número muda a cada pesagem e não
 * identifica um produto no mundo, só ali dentro.
 *
 * O miolo carrega o código do produto e um valor, e é aí que mora a pegadinha:
 * o valor pode ser o **preço total** já calculado pela balança, ou o **peso**,
 * para o PDV multiplicar pelo preço por quilo. Qual dos dois é configuração da
 * balança, muda de loja para loja, e ninguém costuma saber de cabeça.
 *
 * Por isso nada aqui é adivinhado: o formato é configurado, e a tela de
 * configuração mostra como uma etiqueta de verdade seria lida antes de entrar
 * em uso. Errar isso significa cobrar o valor errado do cliente.
 *
 * Layouts em uso no Brasil (Toledo, Filizola, Urano):
 *
 *   2 CCCCCC VVVVV D   código de 6, valor de 5   <- mais comum
 *   2 CCCCC VVVVVV D   código de 5, valor de 6
 *   2 CCCC VVVVVVV D   código de 4, valor de 7
 */

import { createStore } from './localStore';

export const MODOS = {
    preco: {
        label: 'Preço total (em centavos)',
        hint: 'A balança calcula o valor e embute na etiqueta',
    },
    peso: {
        label: 'Peso (em gramas)',
        hint: 'O PDV multiplica pelo preço por quilo do cadastro',
    },
};

export const DEFAULTS = {
    ativo: true,
    prefixo: '2',
    digitosCodigo: 6,
    modo: 'preco',
};

/** Um EAN-13 só é válido se o último dígito fechar a conta dos outros doze. */
export function digitoVerificadorEan13(doze) {
    if (!/^\d{12}$/.test(doze)) return null;

    let soma = 0;
    for (let i = 0; i < 12; i++) {
        // Posições pares (1-indexadas) pesam 3; ímpares pesam 1.
        soma += Number(doze[i]) * (i % 2 === 0 ? 1 : 3);
    }
    return (10 - (soma % 10)) % 10;
}

export function ean13Valido(codigo) {
    const s = String(codigo ?? '').trim();
    if (!/^\d{13}$/.test(s)) return false;
    return digitoVerificadorEan13(s.slice(0, 12)) === Number(s[12]);
}

/**
 * O código lido veio de uma balança?
 *
 * Só o prefixo, sem validar o dígito: a checagem completa fica para o `decodificar`,
 * que precisa distinguir "não é etiqueta" de "é etiqueta com defeito" — e são
 * coisas diferentes para quem está no caixa.
 */
export function pareceEtiqueta(codigo, config = DEFAULTS) {
    const s = String(codigo ?? '').trim();
    if (!config.ativo) return false;
    return /^\d{13}$/.test(s) && s.startsWith(String(config.prefixo ?? '2'));
}

/**
 * Lê a etiqueta.
 *
 * Devolve `{ codigoProduto, peso, precoTotal }`, com só um dos dois últimos
 * preenchido conforme o modo. `peso` vem em quilos e `precoTotal` em reais —
 * as unidades que o resto do app usa.
 *
 * Devolve `null` quando não é etiqueta de balança, e `{ erro }` quando é uma
 * mas veio corrompida: leitura ruim tem que aparecer, não virar venda errada.
 */
export function decodificar(codigo, config = DEFAULTS) {
    const s = String(codigo ?? '').trim();
    if (!pareceEtiqueta(s, config)) return null;

    if (!ean13Valido(s)) {
        return { erro: 'O código não fecha a conta de verificação. Bipe de novo.' };
    }

    const prefixo = String(config.prefixo ?? '2');
    const digitosCodigo = Number(config.digitosCodigo) || 6;

    // 13 = prefixo + código + valor + dígito verificador.
    const digitosValor = 13 - prefixo.length - digitosCodigo - 1;
    if (digitosValor < 3 || digitosValor > 8) {
        return { erro: 'A configuração da balança não fecha 13 dígitos.' };
    }

    const inicioValor = prefixo.length + digitosCodigo;
    // Zeros à esquerda saem fora: a balança preenche o campo todo, mas o
    // produto foi cadastrado como "123", não "000123".
    const codigoProduto = String(Number(s.slice(prefixo.length, inicioValor)));
    const valor = Number(s.slice(inicioValor, inicioValor + digitosValor));

    if (valor <= 0) {
        return { erro: 'A etiqueta veio com valor zerado.' };
    }

    return config.modo === 'peso'
        ? { codigoProduto, peso: valor / 1000, precoTotal: null }
        : { codigoProduto, peso: null, precoTotal: valor / 100 };
}

/**
 * Monta uma etiqueta de mentira, para a tela de teste.
 *
 * Serve para quem não tem a etiqueta em mãos conferir o formato: escolhe o
 * código e o valor, vê o número que sairia, e compara com o que a balança
 * imprime de verdade.
 */
export function gerarExemplo({ codigoProduto = 123, valor = 1099, config = DEFAULTS } = {}) {
    const prefixo = String(config.prefixo ?? '2');
    const digitosCodigo = Number(config.digitosCodigo) || 6;
    const digitosValor = 13 - prefixo.length - digitosCodigo - 1;
    if (digitosValor < 3) return null;

    const doze = prefixo
        + String(codigoProduto).padStart(digitosCodigo, '0').slice(-digitosCodigo)
        + String(valor).padStart(digitosValor, '0').slice(-digitosValor);

    const dv = digitoVerificadorEan13(doze);
    return dv === null ? null : doze + dv;
}

// ---------------------------------------------------------------------------
// Configuração, guardada nesta máquina
//
// Fica no computador e não no banco porque é característica da balança que está
// ali no balcão, não da loja. Uma loja com duas balanças diferentes em dois
// caixas configura cada uma no seu.
// ---------------------------------------------------------------------------

const store = createStore('balanca.json');
const KEY = 'config';

export async function getScaleConfig() {
    return { ...DEFAULTS, ...((await store.get(KEY, {})) ?? {}) };
}

export async function saveScaleConfig(config) {
    await store.set(KEY, { ...DEFAULTS, ...config });
}
