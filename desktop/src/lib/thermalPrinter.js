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
    return invoke('list_printers');
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
    const r = new Receipt({ width: config.width });
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
    if (shop?.municipio) r.line(`${shop.municipio}${shop.uf ? `/${shop.uf}` : ''}`);
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

/** Cupom de teste, para conferir a impressora sem precisar fazer uma venda. */
export async function printTestPage(config) {
    const r = new Receipt({ width: config.width });

    r.align('center').bold(true).line('TESTE DE IMPRESSAO').bold(false);
    r.line('Mercadinho').divider('=');
    r.align('left');
    r.line('Se voce esta lendo isto, a');
    r.line('impressora esta configurada.');
    r.line();
    r.line('Confira:');
    r.line('- os acentos: acao, pao, feijao');
    r.line('- a largura da linha abaixo');
    r.divider();
    r.columns('EXEMPLO DE VALOR', formatCurrency(12.99));
    r.bold(true).size(2).columns('TOTAL', formatCurrency(47.35)).size(1).bold(false);
    r.line();
    r.align('center');

    try {
        r.qrcode(qrMatrix('https://github.com/zFreshy/Gestflow'), config.width === 58 ? 3 : 4);
    } catch {
        r.line('(QR Code nao pode ser gerado)');
    }

    if (config.openDrawer) r.openDrawer();
    if (config.autoCut) r.cut(); else r.feed(5);

    return sendRaw(config.printer, r.build());
}
