/**
 * Impressão do cupom na bobina térmica.
 *
 * Dois caminhos convivem de propósito:
 *
 * - **Direto (ESC/POS)**, quando há uma impressora escolhida na configuração.
 *   O cupom sai na hora, sem diálogo, corta o papel e abre a gaveta. É o
 *   comportamento da máquina que a loja já tinha.
 * - **Diálogo do Windows**, quando não há nada configurado. Funciona com
 *   qualquer impressora, inclusive folha A4, e é o que garante que dá para
 *   imprimir no primeiro dia, antes de configurar coisa nenhuma.
 *
 * Quem decide é a configuração, não o código de quem chama: as telas só pedem
 * "imprime esse cupom".
 */

import QRCode from 'qrcode';
import { Receipt } from './escpos';
import { createStore } from './localStore';
import { isTauri } from './authStorage';
import { formatCurrency } from './utils';
import { paymentLabel } from './payments';

const store = createStore('impressora.json');
const KEY = 'config';

const DEFAULTS = {
    printer: '',      // vazio = usa o diálogo do Windows
    width: 80,        // mm da bobina
    codepage: 'cp850',
    autoCut: true,
    openDrawer: false,
    copies: 1,
};

export async function getPrinterConfig() {
    return { ...DEFAULTS, ...((await store.get(KEY, {})) ?? {}) };
}

export async function savePrinterConfig(config) {
    await store.set(KEY, { ...DEFAULTS, ...config });
}

/** Impressoras instaladas no Windows. Fora do Tauri, lista vazia. */
export async function listPrinters() {
    if (!isTauri()) return [];
    const { invoke } = await import('@tauri-apps/api/core');
    const printers = await invoke('list_printers');
    return printers.map((p) => ({ ...p, virtual: isVirtualPrinter(p) }));
}

/**
 * É uma impressora de mentira?
 *
 * "Microsoft Print to PDF", "Salvar como XPS" e afins são drivers que geram
 * arquivo, não papel. Elas aparecem na lista do Windows igual às outras, e é
 * fácil escolher uma sem perceber — foi o que aconteceu no primeiro teste.
 *
 * O problema é que o cupom vai em modo RAW, que existe justamente para o
 * driver NÃO interpretar nada: os bytes passam direto para a porta. Numa
 * térmica isso é o que faz os comandos funcionarem; numa virtual, o arquivo
 * gerado recebe bytes ESC/POS crus e não abre em lugar nenhum.
 *
 * A porta é o sinal mais confiável — `PORTPROMPT:` é literalmente "pergunte
 * onde salvar". O driver entra como reforço, porque impressora virtual de
 * terceiro (PDFCreator, doPDF) usa porta própria.
 */
export function isVirtualPrinter({ port = '', driver = '', name = '' } = {}) {
    const haystack = `${port} ${driver} ${name}`.toLowerCase();

    return (
        /portprompt|^nul:|\bnul:|xpsport|shrfax|^file:/i.test(port)
        || /pdf|xps|onenote|fax|document writer|microsoft print to/.test(haystack)
    );
}

async function sendRaw(printer, bytes) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke('print_raw', { printer, data: bytes });
}

/** Matriz de 0/1 do QR, para a impressora desenhar ponto a ponto. */
function qrMatrix(text) {
    const qr = QRCode.create(text, { errorCorrectionLevel: 'M' });
    const { size, data } = qr.modules;

    return Array.from({ length: size }, (_, row) =>
        Array.from({ length: size }, (_, col) => data[row * size + col]));
}

const formatQty = (q) => {
    const n = Number(q) || 0;
    return Number.isInteger(n) ? String(n) : n.toFixed(3).replace('.', ',');
};

const formatCnpj = (v) => {
    const d = String(v ?? '').replace(/\D/g, '');
    if (d.length !== 14) return v ?? '';
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
};

/**
 * Desenha o cupom.
 *
 * Segue o mesmo conteúdo do DANFE NFC-e da versão em tela (`ReceiptDocument`),
 * para que reimprimir pelo histórico dê o mesmo papel. Venda sem nota sai sob o
 * título de comprovante — um cupom que se parece com nota fiscal sem ser é pior
 * do que nenhum.
 */
export function renderReceipt({ store: shop, sale, items, payments, invoice, change }, config) {
    const r = new Receipt({ width: config.width, codepage: config.codepage });
    const authorized = invoice?.status === 'autorizada';

    // Cabeçalho do emitente
    r.align('center').bold(true);
    r.line(shop?.razao_social || shop?.nome_fantasia || 'MERCADINHO');
    r.bold(false);
    if (shop?.nome_fantasia && shop?.razao_social) r.line(shop.nome_fantasia);
    if (shop?.cnpj) r.line(`CNPJ ${formatCnpj(shop.cnpj)}`);
    if (shop?.inscricao_estadual) r.line(`IE ${shop.inscricao_estadual}`);
    if (shop?.logradouro) {
        r.wrap([shop.logradouro, shop.numero, shop.bairro].filter(Boolean).join(', '));
    }
    if (shop?.municipio) {
        const cep = String(shop.cep ?? '').replace(/\D/g, '');
        r.line(`${shop.municipio}${shop.uf ? `/${shop.uf}` : ''}`
            + (cep.length === 8 ? ` - ${cep.slice(0, 5)}-${cep.slice(5)}` : ''));
    }
    if (shop?.telefone) r.line(`Fone ${shop.telefone}`);

    r.divider('=');
    r.bold(true);
    if (authorized) {
        r.line('DANFE NFC-e');
        r.line('Documento Auxiliar da');
        r.line('Nota Fiscal de Consumidor Eletronica');
    } else {
        r.line('COMPROVANTE DE VENDA');
        r.line('NAO E DOCUMENTO FISCAL');
    }
    r.bold(false);
    r.divider('=');

    // Itens
    r.align('left');
    r.line('ITEM  DESCRICAO');
    r.line('QTD x UNITARIO           TOTAL');
    r.divider();

    items.forEach((item, idx) => {
        r.wrap(`${String(idx + 1).padStart(3, '0')}  ${item.product_name}`);
        const subtotal = Number(item.subtotal ?? item.quantity * item.unit_price);
        r.columns(
            `  ${formatQty(item.quantity)} x ${formatCurrency(item.unit_price)}`,
            formatCurrency(subtotal),
        );
    });

    r.divider();

    const subtotal = items.reduce(
        (sum, i) => sum + Number(i.subtotal ?? i.quantity * i.unit_price), 0);

    r.columns('QTD. TOTAL DE ITENS', String(items.length));
    r.columns('SUBTOTAL', formatCurrency(subtotal));
    if (Number(sale.discount) > 0) {
        r.columns('DESCONTO', `- ${formatCurrency(sale.discount)}`);
    }

    // O total em corpo dobrado: é o número que o cliente confere de longe.
    r.bold(true).size(2);
    r.columns('TOTAL', formatCurrency(sale.total));
    r.size(1).bold(false);

    r.line();
    r.line('FORMA DE PAGAMENTO');
    for (const p of payments) {
        r.columns(`  ${paymentLabel(p.method)}`, formatCurrency(p.amount));
    }
    if (Number(change) > 0) r.columns('  TROCO', formatCurrency(change));

    r.divider();
    r.line(`CONSUMIDOR: ${invoice?.cpf ? `CPF ${invoice.cpf}` : (sale.customer_name || 'NAO IDENTIFICADO')}`);

    if (authorized) {
        r.divider();
        r.align('center');
        r.line(`NFC-e no ${String(invoice.numero).padStart(9, '0')} Serie ${invoice.serie}`);
        r.line(stamp(invoice.emitted_at ?? sale.sold_at));
        r.wrap(`Protocolo: ${invoice.protocolo ?? ''}`);

        r.line();
        r.line('Consulte pela Chave de Acesso em');
        r.wrap(invoice.url_consulta || 'www.nfce.fazenda.gov.br/consulta');
        r.line();
        // Chave em grupos de 4: ela é digitada à mão no site da consulta.
        r.wrap(String(invoice.chave ?? '').replace(/(\d{4})(?=\d)/g, '$1 '));

        if (invoice.qrcode) {
            r.line();
            try {
                r.qrcode(qrMatrix(invoice.qrcode), config.width === 58 ? 3 : 4);
            } catch (err) {
                console.error('Não consegui gerar o QR Code:', err);
            }
        }

        if (invoice.ambiente === 'homologacao') {
            r.line();
            r.bold(true);
            r.line('EMITIDA EM HOMOLOGACAO');
            r.line('SEM VALOR FISCAL');
            r.bold(false);
        }
    } else {
        r.align('center');
        r.line(stamp(sale.sold_at));
    }

    if (config.openDrawer) r.openDrawer();
    if (config.autoCut) r.cut(); else r.feed(5);

    return r.build();
}

const stamp = (value) => {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR')}`;
};

/**
 * Imprime direto, se houver impressora configurada.
 *
 * Devolve `false` quando não há — e aí quem chamou cai no diálogo do Windows.
 * Erro de verdade (impressora desligada, sem papel) sobe, porque a pessoa
 * precisa saber que o cupom não saiu.
 */
export async function printThermal(receipt) {
    if (!isTauri()) return false;

    const config = await getPrinterConfig();
    if (!config.printer) return false;

    const bytes = renderReceipt(receipt, config);
    for (let copy = 0; copy < Math.max(config.copies, 1); copy++) {
        await sendRaw(config.printer, bytes);
    }
    return true;
}

/**
 * Venda de mentira para conferir a impressão sem precisar vender de verdade.
 *
 * É uma só, usada pelos dois testes — o que sai na bobina e o que vira PDF.
 * Se fossem exemplos diferentes, a prévia em PDF poderia sair bonita enquanto o
 * papel sai torto, e o teste não provaria nada.
 *
 * Os itens são escolhidos a dedo para exercitar o que costuma quebrar: acento,
 * nome comprido que precisa quebrar linha, quantidade fracionada de balança e
 * pagamento dividido com troco.
 */
export function sampleReceipt() {
    return {
        store: {
            razao_social: 'PADARIA E MERCADINHO LTDA',
            nome_fantasia: 'Mercadinho',
            cnpj: '12345678000199',
            inscricao_estadual: '110042490114',
            logradouro: 'Rua das Flores', numero: '250', bairro: 'Centro',
            municipio: 'Campinas', uf: 'SP', cep: '13010100',
            telefone: '(19) 3232-1010',
        },
        // Os números fecham de propósito: itens somam 49,36, menos 2,00 de
        // desconto dá 47,36, e os pagamentos somam exatamente isso. Um exemplo
        // que não fecha treina a pessoa a ignorar o total do cupom.
        sale: {
            total: 47.36,
            discount: 2.00,
            sold_at: new Date().toISOString(),
            customer_name: null,
        },
        items: [
            { barcode: '7891000315507', product_name: 'Leite Integral 1L', quantity: 2, unit_price: 5.49, subtotal: 10.98 },
            { barcode: '7896005800011', product_name: 'Pão de Forma Tradicional Integral', quantity: 1, unit_price: 12.99, subtotal: 12.99 },
            { barcode: null, product_name: 'Banana Prata (granel)', quantity: 1.235, unit_price: 8.90, subtotal: 10.99 },
            { barcode: '7891910000197', product_name: 'Açúcar Refinado 1kg', quantity: 3, unit_price: 4.80, subtotal: 14.40 },
        ],
        payments: [
            { method: 'Dinheiro', amount: 30.00 },
            { method: 'PIX', amount: 17.36 },
        ],
        change: 5.00,
        invoice: null,
    };
}

/** Manda o cupom de teste para a bobina. */
export async function printTestPage(config) {
    const bytes = renderReceipt(sampleReceipt(), config);
    return sendRaw(config.printer, bytes);
}

/**
 * Teste cru: texto ASCII e quebras de linha, mais nada.
 *
 * Nenhum comando ESC/POS — nem o de inicializar. Serve para separar dois
 * problemas que parecem iguais no papel em branco:
 *
 * - **Sai texto aqui, mas o cupom sai em branco**: o caminho até a impressora
 *   funciona, e o que ela não engoliu foi algum comando. Aí a saída é trocar a
 *   tabela de acentos ou desligar o corte automático.
 * - **Sai branco aqui também**: o problema é antes do ESC/POS — driver que não
 *   repassa dados brutos, porta errada, ou a bobina colocada com o lado térmico
 *   virado para baixo, que é a causa mais comum e não tem nada de software.
 */
export async function printPlainTest(config) {
    const linhas = [
        '================================',
        '     TESTE DE TEXTO SIMPLES',
        '================================',
        '',
        'Se voce esta lendo esta linha,',
        'a impressora recebe dados brutos',
        'e o caminho ate ela funciona.',
        '',
        '0123456789012345678901234567890123456789012345678',
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvw',
        '',
        'A regua acima mostra onde a linha',
        'corta: conte ate onde ela aparece',
        'e escolha a largura por isso.',
        '',
        '',
        '',
        '',
    ];

    // Só ASCII: qualquer byte acima de 127 dependeria de tabela de caractere,
    // que é justamente uma das coisas que este teste quer descartar.
    const bytes = [];
    for (const linha of linhas) {
        for (const char of linha) {
            const code = char.charCodeAt(0);
            bytes.push(code < 128 ? code : 0x3f);
        }
        bytes.push(0x0a);
    }

    return sendRaw(config.printer, bytes);
}
