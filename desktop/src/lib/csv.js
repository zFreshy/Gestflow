/**
 * Leitor de CSV feito à mão em vez de trazer uma biblioteca.
 *
 * O que sai de sistema de PDV brasileiro costuma ter três armadilhas que os
 * parsers ingênuos erram: separador `;` (padrão do Excel em português),
 * números com vírgula decimal, e acentuação em Latin-1. Todas tratadas aqui.
 */

/** Descobre o separador contando ocorrências fora de aspas na primeira linha. */
function detectDelimiter(text) {
    const firstLine = text.slice(0, text.indexOf('\n') + 1 || text.length);
    const candidates = [';', ',', '\t', '|'];

    let best = ';';
    let bestCount = -1;

    for (const d of candidates) {
        let count = 0;
        let inQuotes = false;

        for (let i = 0; i < firstLine.length; i++) {
            const ch = firstLine[i];
            if (ch === '"') inQuotes = !inQuotes;
            else if (ch === d && !inQuotes) count++;
        }

        if (count > bestCount) {
            bestCount = count;
            best = d;
        }
    }

    return best;
}

/**
 * Converte o texto do CSV em linhas de células.
 * Respeita aspas, aspas escapadas ("") e quebras de linha dentro do campo.
 */
export function parseCsv(text) {
    // Tira o BOM que o Excel gruda no começo do arquivo.
    let input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
    const delimiter = detectDelimiter(input);

    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;

    for (let i = 0; i < input.length; i++) {
        const ch = input[i];

        if (inQuotes) {
            if (ch === '"') {
                if (input[i + 1] === '"') { field += '"'; i++; }
                else inQuotes = false;
            } else {
                field += ch;
            }
            continue;
        }

        if (ch === '"') { inQuotes = true; }
        else if (ch === delimiter) { row.push(field); field = ''; }
        else if (ch === '\r') { /* ignora, o \n fecha a linha */ }
        else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
        else { field += ch; }
    }

    // Última linha sem quebra no fim do arquivo.
    if (field.length > 0 || row.length > 0) {
        row.push(field);
        rows.push(row);
    }

    // Fora linhas totalmente vazias.
    return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

/**
 * Interpreta número em formato brasileiro ou americano.
 * "1.234,56" -> 1234.56 | "1,234.56" -> 1234.56 | "12,5" -> 12.5
 */
export function parseNumber(raw) {
    if (raw === null || raw === undefined) return 0;

    let s = String(raw).trim();
    if (!s) return 0;

    // Descarta símbolo de moeda e espaços (inclusive o espaço fino do Excel).
    s = s.replace(/[R$\s ]/gi, '');
    if (!s) return 0;

    const lastComma = s.lastIndexOf(',');
    const lastDot = s.lastIndexOf('.');

    if (lastComma > -1 && lastDot > -1) {
        // O separador decimal é o que aparece por último.
        if (lastComma > lastDot) s = s.replace(/\./g, '').replace(',', '.');
        else s = s.replace(/,/g, '');
    } else if (lastComma > -1) {
        // Vírgula sozinha: decimal se tiver 1-2 casas depois, senão é milhar.
        const decimals = s.length - lastComma - 1;
        s = decimals > 0 && decimals <= 2
            ? s.replace(',', '.')
            : s.replace(/,/g, '');
    }

    const n = Number.parseFloat(s);
    return Number.isFinite(n) ? n : 0;
}

/** Normaliza cabeçalho para comparação: sem acento, minúsculo, sem pontuação. */
export function normalizeHeader(h) {
    return String(h ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
}

/**
 * Nomes de coluna que cada campo aceita, em ordem de prioridade.
 * A lista cobre as variações que sistemas de PDV costumam usar.
 */
const FIELD_ALIASES = {
    // Os nomes em inglês entram no fim de cada lista, depois dos em português:
    // planilha brasileira é o caso normal, e a ordem decide quem ganha quando
    // um arquivo tem as duas colunas.
    barcode: ['codigobarras', 'codbarras', 'codigodebarras', 'ean', 'gtin', 'barras', 'codbar', 'codigoean',
        'barcode', 'code'],
    name: ['descricao', 'nome', 'produto', 'descricaoproduto', 'nomeproduto', 'desc',
        'productname', 'name', 'title'],
    sale_price: ['precovenda', 'valorvenda', 'preco', 'precovarejo', 'vlrvenda', 'venda', 'precodevenda',
        'saleprice', 'price', 'sellingprice'],
    cost_price: ['precocusto', 'valorcusto', 'custo', 'vlrcusto', 'precodecusto', 'customedio',
        'costprice', 'cost'],
    stock_quantity: ['estoque', 'quantidade', 'qtd', 'qtde', 'saldo', 'estoqueatual', 'qtdestoque',
        'stock', 'stockquantity', 'qty'],
    unit: ['unidade', 'un', 'und', 'unidademedida', 'sigla', 'unit'],
    category: ['categoria', 'grupo', 'departamento', 'secao', 'familia',
        'category', 'categories'],
};

/**
 * Tenta adivinhar qual coluna do arquivo corresponde a cada campo.
 * Devolve { campo: índice da coluna | null } para o usuário conferir e ajustar.
 */
export function guessMapping(headers) {
    const normalized = headers.map(normalizeHeader);
    const mapping = {};
    const used = new Set();

    for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
        let found = null;

        // Primeiro nome exato, que é mais confiável que "contém".
        for (const alias of aliases) {
            const idx = normalized.findIndex((h, i) => h === alias && !used.has(i));
            if (idx !== -1) { found = idx; break; }
        }

        if (found === null) {
            for (const alias of aliases) {
                const idx = normalized.findIndex((h, i) => h.includes(alias) && !used.has(i));
                if (idx !== -1) { found = idx; break; }
            }
        }

        if (found !== null) used.add(found);
        mapping[field] = found;
    }

    return mapping;
}
