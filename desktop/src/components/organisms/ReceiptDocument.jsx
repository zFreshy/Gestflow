import React from 'react';
import { formatCurrency } from '../../lib/utils';
import { paymentLabel } from '../../lib/payments';

/**
 * O cupom que sai na bobina.
 *
 * Fica sempre montado no `id="cupom"`, invisível na tela e visível só na
 * impressão (ver o bloco `@media print` no index.css). Manter um único nó com
 * esse id no app inteiro é o que faz `window.print()` sair certo de qualquer
 * tela: quem quer imprimir só troca o conteúdo e chama a impressão.
 *
 * O layout segue o DANFE NFC-e do Manual de Padrões Técnicos: cabeçalho do
 * emitente, tabela de itens, totais, formas de pagamento, dados da nota,
 * chave de acesso e QR Code. Quando a venda não tem nota autorizada, o mesmo
 * corpo é impresso sob o título de comprovante, deixando explícito que aquele
 * papel não é documento fiscal — um cupom que se parece com nota sem ser é
 * pior do que nenhum.
 */
export function ReceiptDocument({ data, qr = null }) {
    if (!data) return <div id="cupom" />;

    const { store, sale, items, payments, invoice, change } = data;
    const authorized = invoice?.status === 'autorizada';

    return (
        <div id="cupom">
            <div style={{ textAlign: 'center' }}>
                <strong>{store?.razao_social || store?.nome_fantasia || 'MERCADINHO'}</strong>
                {store?.nome_fantasia && store?.razao_social && <div>{store.nome_fantasia}</div>}
                {store?.cnpj && <div>CNPJ {formatCnpj(store.cnpj)}</div>}
                {store?.inscricao_estadual && <div>IE {store.inscricao_estadual}</div>}
                {addressLine(store) && <div>{addressLine(store)}</div>}
                {cityLine(store) && <div>{cityLine(store)}</div>}
                {store?.telefone && <div>Fone {store.telefone}</div>}
            </div>

            <Divider />

            <div style={{ textAlign: 'center' }}>
                {authorized ? (
                    <strong>
                        DANFE NFC-e<br />
                        Documento Auxiliar da Nota Fiscal<br />
                        de Consumidor Eletrônica
                    </strong>
                ) : (
                    <strong>
                        COMPROVANTE DE VENDA<br />
                        NÃO É DOCUMENTO FISCAL
                    </strong>
                )}
            </div>

            <Divider />

            {/* Tabela de itens no formato do manual: uma linha de identificação
                e uma de valores, porque 72mm não comportam tudo lado a lado sem
                cortar o nome do produto. */}
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                    <tr>
                        <td colSpan={2}>CÓDIGO / DESCRIÇÃO</td>
                    </tr>
                    <tr>
                        <td colSpan={2}>QTD x UNIT = TOTAL</td>
                    </tr>
                </thead>
                <tbody>
                    {items.map((item, idx) => (
                        <tr key={item.id ?? idx}>
                            <td colSpan={2} style={{ paddingBottom: '2mm' }}>
                                <div>
                                    {String(idx + 1).padStart(3, '0')} {item.barcode || '-'}{' '}
                                    {item.product_name}
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    {formatQty(item.quantity)} x {formatCurrency(item.unit_price)} ={' '}
                                    <strong>
                                        {formatCurrency(item.subtotal ?? item.quantity * item.unit_price)}
                                    </strong>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <Divider />

            <Line label={`QTD. TOTAL DE ITENS`} value={String(items.length)} />
            <Line label="SUBTOTAL" value={formatCurrency(subtotalOf(items))} />
            {Number(sale.discount) > 0 && (
                <Line label="DESCONTO" value={`- ${formatCurrency(sale.discount)}`} />
            )}
            <div className="cupom-destaque" style={{ padding: '1mm', margin: '1mm 0' }}>
                <Line label="VALOR A PAGAR" value={formatCurrency(sale.total)} bold />
            </div>

            <div>FORMA DE PAGAMENTO</div>
            {payments.map((p, idx) => (
                <Line key={p.id ?? idx} label={paymentLabel(p.method)} value={formatCurrency(p.amount)} />
            ))}
            {Number(change) > 0 && <Line label="TROCO" value={formatCurrency(change)} />}

            <Divider />

            {/* Identificação do consumidor: obrigatória no DANFE mesmo quando
                ninguém informou o CPF — a linha em branco levantaria a dúvida
                de se o campo foi esquecido. */}
            <div>
                CONSUMIDOR:{' '}
                {invoice?.cpf
                    ? `CPF ${invoice.cpf}`
                    : sale.customer_name || 'NÃO IDENTIFICADO'}
            </div>

            {authorized ? (
                <>
                    <Divider />
                    <div style={{ textAlign: 'center' }}>
                        NFC-e nº {String(invoice.numero).padStart(9, '0')} Série {invoice.serie}
                        <br />
                        {formatStamp(invoice.emitted_at ?? sale.sold_at)}
                        <br />
                        Protocolo de autorização: {invoice.protocolo}
                    </div>

                    <Divider />
                    <div style={{ textAlign: 'center' }}>
                        Consulte pela Chave de Acesso em
                        <br />
                        {invoice.url_consulta || 'www.nfce.fazenda.gov.br/consulta'}
                        <br />
                        <span style={{ wordBreak: 'break-all' }}>{formatChave(invoice.chave)}</span>
                    </div>

                    {qr && (
                        <div style={{ textAlign: 'center', marginTop: '2mm' }}>
                            <img src={qr} alt="" style={{ width: '30mm', height: '30mm' }} />
                        </div>
                    )}

                    {invoice.ambiente === 'homologacao' && (
                        <div style={{ textAlign: 'center', marginTop: '2mm' }}>
                            <strong>
                                EMITIDA EM AMBIENTE DE HOMOLOGAÇÃO
                                <br />
                                SEM VALOR FISCAL
                            </strong>
                        </div>
                    )}
                </>
            ) : (
                <div style={{ textAlign: 'center', marginTop: '2mm' }}>
                    {formatStamp(sale.sold_at)}
                    {invoice?.status === 'rejeitada' && (
                        <div>
                            <br />
                            <strong>NOTA REJEITADA — {invoice.mensagem}</strong>
                        </div>
                    )}
                </div>
            )}

            {/* Espaço no fim para a lâmina de corte não comer a última linha. */}
            <div style={{ height: '10mm' }} />
        </div>
    );
}

const Divider = () => (
    <div style={{ borderTop: '1px dashed #000', margin: '1.5mm 0' }} />
);

function Line({ label, value, bold = false }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: bold ? 700 : 400 }}>
            <span>{label}</span>
            <span>{value}</span>
        </div>
    );
}

const subtotalOf = (items) =>
    items.reduce((sum, i) => sum + Number(i.subtotal ?? i.quantity * i.unit_price), 0);

/** Peso vai com vírgula, como em toda etiqueta de balança do país. */
const formatQty = (q) => {
    const n = Number(q) || 0;
    return Number.isInteger(n) ? String(n) : n.toFixed(3).replace('.', ',');
};

const formatCep = (v) => {
    const d = String(v ?? '').replace(/\D/g, '');
    return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : v;
};

const formatCnpj = (v) => {
    const d = String(v).replace(/\D/g, '');
    if (d.length !== 14) return v;
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
};

/** A chave sai em grupos de 4 porque é digitada à mão no site da consulta. */
const formatChave = (chave) =>
    String(chave ?? '').replace(/(\d{4})(?=\d)/g, '$1 ');

const addressLine = (s) => {
    if (!s?.logradouro) return '';
    return [s.logradouro, s.numero, s.bairro].filter(Boolean).join(', ');
};

const cityLine = (s) => {
    if (!s?.municipio) return '';
    return [`${s.municipio}${s.uf ? `/${s.uf}` : ''}`, s.cep && formatCep(s.cep)]
        .filter(Boolean).join(' - ');
};

const formatStamp = (value) => {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR')}`;
};
