/**
 * Descobre o nome de um produto pelo código de barras.
 *
 * Consulta a base pública do Open Food Facts, um código por vez, na hora em que
 * alguém está cadastrando. É a alternativa ao caminho que parece óbvio e não
 * funciona: baixar a base inteira. O arquivo que eles publicam tem 12 GB e
 * ~4 milhões de produtos do mundo todo — 24 vezes maior que o limite de texto
 * do JavaScript, e sem preço nenhum, que é justamente o que a loja precisa.
 *
 * Aqui não se baixa nada: uma consulta por código, só quando o produto não
 * existe no cadastro.
 *
 * O nome que volta é **sugestão**, nunca verdade. A base é colaborativa e os
 * nomes vêm como alguém digitou ("União Refinado" para o açúcar de 1kg). Quem
 * confirma é a pessoa na tela.
 */

const BASE = 'https://world.openfoodfacts.org/api/v2/product';

/** Sem isso a tela ficaria pendurada quando a internet está ruim no balcão. */
const TIMEOUT_MS = 6000;

/** EAN-13, EAN-8, UPC e DUN-14 — o que aparece em embalagem de mercado. */
const isBarcode = (code) => /^\d{8,14}$/.test(String(code ?? '').trim());

/**
 * Nome do produto, ou null se não achar.
 *
 * Nunca lança: falha de rede aqui não pode atrapalhar o cadastro, que funciona
 * perfeitamente bem com a pessoa digitando o nome.
 */
export async function lookupBarcode(code) {
    const clean = String(code ?? '').trim();
    if (!isBarcode(clean)) return null;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
        // `fields` corta a resposta: o registro completo tem centenas de campos
        // de informação nutricional que não têm uso nenhum aqui.
        const res = await fetch(
            `${BASE}/${encodeURIComponent(clean)}`
            + '?fields=code,product_name,product_name_pt,brands,quantity',
            { signal: controller.signal, headers: { Accept: 'application/json' } },
        );

        if (!res.ok) return null;

        const body = await res.json();
        if (body?.status !== 1 || !body.product) return null;

        return montarNome(body.product);
    } catch {
        // Offline, tempo esgotado, base fora do ar. Silêncio é o certo: quem
        // está cadastrando digita o nome e segue.
        return null;
    } finally {
        clearTimeout(timer);
    }
}

/**
 * Junta marca, nome e peso no formato que se usa numa prateleira.
 *
 * A base guarda os três separados, e o nome sozinho costuma ser inútil no
 * balcão: "Refinado" não diz nada, "União Refinado 1 kg" diz.
 */
function montarNome(product) {
    const nome = limpar(product.product_name_pt) || limpar(product.product_name);
    if (!ehNomeUtil(nome)) return null;

    // A base aceita várias marcas separadas por vírgula, e a ordem não é
    // confiável: o açúcar União vem como "Tio João, União", provavelmente
    // porque alguém cadastrou os dois produtos na mesma conta.
    const marcas = limpar(product.brands)
        .split(',')
        .map((m) => m.trim())
        .filter(Boolean);

    const peso = limpar(product.quantity);
    const nomeMinusculo = nome.toLowerCase();

    const partes = [];
    // A marca só é acrescentada quando NENHUMA das listadas já aparece no
    // nome. Olhar só a primeira produzia "Tio João União Refinado" — marca de
    // arroz em pacote de açúcar.
    const jaTemMarca = marcas.some((m) => nomeMinusculo.includes(m.toLowerCase()));
    if (!jaTemMarca && marcas.length === 1) partes.push(marcas[0]);

    partes.push(nome);
    if (peso && !nome.toLowerCase().includes(peso.toLowerCase())) partes.push(peso);

    return partes.join(' ').replace(/\s+/g, ' ').trim().slice(0, 120);
}

/**
 * O que voltou serve como nome de produto?
 *
 * A base é preenchida por qualquer pessoa, e vem coisa que não é nome: um
 * código repetido, uma medida solta, um "2.0". Sugerir isso é pior do que não
 * sugerir nada — a pessoa aceita sem ler e o produto entra no catálogo com
 * nome de lixo, que só aparece semanas depois no cupom do cliente.
 *
 * Exige pelo menos três letras: descarta número solto e sobra qualquer nome de
 * verdade, inclusive os curtos ("Pão", "Uva").
 */
function ehNomeUtil(nome) {
    if (!nome || nome.length < 3) return false;
    const letras = nome.replace(/[^\p{L}]/gu, '');
    return letras.length >= 3;
}

const limpar = (valor) => {
    const s = String(valor ?? '').trim();
    return s && s.toLowerCase() !== 'null' ? s : '';
};
