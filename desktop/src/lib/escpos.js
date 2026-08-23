/**
 * Monta o cupom em comandos ESC/POS.
 *
 * ESC/POS é o dialeto que praticamente toda impressora térmica de bobina
 * entende — Bematech, Epson, Elgin, Daruma. São bytes de controle misturados
 * com o texto: em vez de desenhar uma página, você manda "centraliza",
 * "negrito", "corta o papel".
 *
 * É o que permite o cupom sair sozinho, sem o diálogo de impressão do Windows,
 * e é também a única forma de acionar a guilhotina e a gaveta — coisas que não
 * existem no modelo de imprimir documento.
 */

const ESC = 0x1b;
const GS = 0x1d;

/**
 * Acentos em CP850.
 *
 * A impressora não fala UTF-8: ela tem uma tabela de 256 caracteres e imprime
 * o desenho que estiver na posição do byte. Sem esta conversão, "Pão" sairia
 * como "PÃ£o" — dois bytes do UTF-8 lidos como dois caracteres.
 *
 * CP850 porque é a página padrão da maioria das térmicas vendidas no Brasil.
 */
const CP850 = {
    'á': 0xa0, 'é': 0x82, 'í': 0xa1, 'ó': 0xa2, 'ú': 0xa3,
    'â': 0x83, 'ê': 0x88, 'î': 0x8c, 'ô': 0x93, 'û': 0x96,
    'ã': 0xc6, 'õ': 0xe4, 'à': 0x85, 'è': 0x8a, 'ò': 0x95,
    'ç': 0x87, 'ü': 0x81, 'ñ': 0xa4,
    'Á': 0xb5, 'É': 0x90, 'Í': 0xd6, 'Ó': 0xe0, 'Ú': 0xe9,
    'Â': 0xb6, 'Ê': 0xd2, 'Ô': 0xe2, 'Ã': 0xc7, 'Õ': 0xe5,
    'À': 0xb7, 'Ç': 0x80, 'Ü': 0x9a, 'Ñ': 0xa5,
    'º': 0xa7, 'ª': 0xa6, '°': 0xf8, '§': 0x15,

    // Espaços invisíveis que o Intl.NumberFormat coloca sozinho: "R$ 5,49" do
    // pt-BR vem com espaço não-quebrável, não com espaço comum. Sem esta
    // linha o papel sairia "R$?5,49" em todo valor do cupom — e o bug só
    // apareceria depois de impresso.
    ' ': 0x20, ' ': 0x20, ' ': 0x20,
    // Travessão e aspas curvas, que às vezes entram por copiar e colar em
    // nome de produto ou observação.
    '–': 0x2d, '—': 0x2d, '’': 0x27, '‘': 0x27, '“': 0x22, '”': 0x22,
};

/**
 * CP437 é a outra tabela comum nas térmicas vendidas aqui, e é a padrão de
 * fábrica de várias Bematech. Ela não tem `ã` nem `õ`: nesses casos vale mais
 * imprimir "pao" do que um símbolo aleatório no meio da palavra.
 */
const CP437 = {
    ...CP850,
    'ã': 0x61, 'Ã': 0x41, 'õ': 0x6f, 'Õ': 0x4f,
    'â': 0x83, 'ê': 0x88, 'ô': 0x93, 'à': 0x85,
    'Â': 0x41, 'Ê': 0x45, 'Ô': 0x4f, 'À': 0x41,
    'Á': 0x41, 'É': 0x90, 'Í': 0x49, 'Ó': 0x4f, 'Ú': 0x55,
};

/**
 * Tabelas de caractere que a impressora pode estar usando.
 *
 * `nenhuma` não manda comando de página de código e derruba todo acento para a
 * letra sem acento. Serve para impressora que não entende `ESC t` — melhor um
 * cupom sem acento do que um cupom com símbolo estranho no meio das palavras.
 */
export const CODEPAGES = {
    cp850:   { command: 0x02, table: CP850, label: 'CP850 (padrão)' },
    cp437:   { command: 0x00, table: CP437, label: 'CP437' },
    nenhuma: { command: null, table: null,  label: 'Sem acentos' },
};

/** Larguras em caracteres na fonte A. É o que decide onde a linha quebra. */
export const COLUMNS = { 80: 48, 58: 32 };

export class Receipt {
    /**
     * `modo: 'texto'` não emite **nenhum** byte de controle — nem o de
     * inicializar. Existe para impressora que não está em modo ESC/POS: nela,
     * cada comando vira lixo impresso, e alguns bytes acabam interpretados como
     * "avança papel", o que produz bobina em branco saindo sem parar.
     *
     * O cupom perde negrito, centralização, corte e QR Code, e ganha a única
     * coisa que importa: sair impresso.
     */
    constructor({ width = 80, codepage = 'cp850', modo = 'escpos' } = {}) {
        this.cols = COLUMNS[width] ?? COLUMNS[80];
        this.plain = modo === 'texto';
        this.page = this.plain
            ? CODEPAGES.nenhuma
            : (CODEPAGES[codepage] ?? CODEPAGES.cp850);
        this.bytes = [];

        if (this.plain) return;

        this.raw(ESC, 0x40);        // inicializa: limpa formatação de outro cupom
        if (this.page.command !== null) {
            this.raw(ESC, 0x74, this.page.command);
        }
    }

    raw(...values) {
        this.bytes.push(...values);
        return this;
    }

    /**
     * Texto com os acentos convertidos para a tabela da impressora.
     *
     * O que não estiver na tabela cai para a letra sem acento — nunca para '?'.
     * Um '?' no meio do nome do produto parece defeito do sistema; "Acucar"
     * parece só um cupom sem acento, que é o que é.
     */
    text(value) {
        for (const char of String(value ?? '')) {
            const code = char.charCodeAt(0);

            if (code < 128) {
                this.bytes.push(code);
                continue;
            }

            const mapped = this.page.table?.[char];
            if (mapped !== undefined) {
                this.bytes.push(mapped);
                continue;
            }

            // NFD separa a letra do acento; ficando só a letra, ela é ASCII.
            const plain = char.normalize('NFD').replace(/[̀-ͯ]/g, '');
            const fallback = plain.charCodeAt(0);
            this.bytes.push(fallback < 128 ? fallback : 0x20);
        }
        return this;
    }

    line(value = '') {
        return this.text(value).raw(0x0a);
    }

    align(where) {
        if (this.plain) return this;
        return this.raw(ESC, 0x61, { left: 0, center: 1, right: 2 }[where] ?? 0);
    }

    bold(on = true) {
        if (this.plain) return this;
        return this.raw(ESC, 0x45, on ? 1 : 0);
    }

    /** `size(2)` dobra largura e altura. Usado só no total, que é o que se lê de longe. */
    size(multiplier = 1) {
        if (this.plain) return this;
        const n = Math.min(Math.max(multiplier, 1), 4) - 1;
        return this.raw(GS, 0x21, (n << 4) | n);
    }

    /** Régua de separação, na largura do papel. */
    divider(char = '-') {
        return this.line(char.repeat(this.cols));
    }

    /**
     * Rótulo à esquerda, valor à direita, preenchido com espaço no meio.
     *
     * É como um cupom se lê: os valores alinhados numa coluna à direita. Quando
     * os dois não cabem, o rótulo é cortado — perder letra do nome do produto
     * é melhor do que empurrar o valor para a linha de baixo.
     */
    columns(label, value) {
        const right = String(value ?? '');
        const room = this.cols - right.length - 1;
        const left = String(label ?? '').slice(0, Math.max(room, 0));
        const gap = Math.max(this.cols - left.length - right.length, 1);
        return this.line(left + ' '.repeat(gap) + right);
    }

    /** Quebra texto longo respeitando a palavra, para nome de produto não picar. */
    wrap(value, indent = 0) {
        const limit = this.cols - indent;
        const pad = ' '.repeat(indent);
        let current = '';

        for (const word of String(value ?? '').split(/\s+/)) {
            if (current && (current + ' ' + word).length > limit) {
                this.line(pad + current);
                current = word;
            } else {
                current = current ? `${current} ${word}` : word;
            }
        }
        if (current) this.line(pad + current);
        return this;
    }

    feed(lines = 1) {
        // Quebras de linha comuns em vez do comando de avanço: a quebra de
        // linha é o único "comando" que toda impressora entende, esteja no
        // modo que estiver.
        if (this.plain) {
            for (let i = 0; i < lines; i++) this.bytes.push(0x0a);
            return this;
        }
        return this.raw(ESC, 0x64, lines);
    }

    /**
     * QR Code como imagem, e não pelo comando nativo de QR.
     *
     * O comando nativo (GS ( k) existe, mas cada fabricante implementa uma
     * variação e algumas ignoram em silêncio — o cupom sairia sem o código e
     * ninguém perceberia até o cliente tentar consultar a nota. Imagem
     * rasterizada é o denominador comum: toda térmica sabe imprimir pontos.
     *
     * `matrix` é uma matriz quadrada de 0/1 vinda do gerador de QR.
     */
    qrcode(matrix, scale = 4) {
        // A imagem do QR são ~2 mil bytes crus. Numa impressora que não entende
        // `GS v 0`, eles saem impressos como caracteres — páginas de lixo.
        // Sem QR o cliente ainda consulta a nota pela chave, que sai em texto.
        if (this.plain) return this;

        const modules = matrix.length;
        const pixels = modules * scale;
        const bytesPerRow = Math.ceil(pixels / 8);

        const data = new Uint8Array(bytesPerRow * pixels);
        for (let y = 0; y < pixels; y++) {
            const row = matrix[Math.floor(y / scale)];
            for (let x = 0; x < pixels; x++) {
                if (!row[Math.floor(x / scale)]) continue;
                data[y * bytesPerRow + (x >> 3)] |= 0x80 >> (x & 7);
            }
        }

        // GS v 0: modo normal, largura em bytes, altura em pontos.
        this.raw(GS, 0x76, 0x30, 0x00);
        this.raw(bytesPerRow & 0xff, (bytesPerRow >> 8) & 0xff);
        this.raw(pixels & 0xff, (pixels >> 8) & 0xff);
        this.bytes.push(...data);
        return this;
    }

    /** Guilhotina. Avança antes de cortar, senão a lâmina come a última linha. */
    cut() {
        // Sem guilhotina no modo texto: só espaço para destacar na serrilha.
        if (this.plain) return this.feed(6);
        return this.feed(4).raw(GS, 0x56, 0x42, 0x00);
    }

    /** Pulso na gaveta de dinheiro, quando houver uma ligada na impressora. */
    openDrawer() {
        if (this.plain) return this;
        return this.raw(ESC, 0x70, 0x00, 0x19, 0xfa);
    }

    build() {
        return this.bytes;
    }
}
