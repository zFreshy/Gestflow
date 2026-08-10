// Emite a NFC-e (modelo 65) de uma venda.
//
// Existe como Edge Function pelo mesmo motivo do `create-employee`: o token do
// emissor assina nota em nome da loja. Ele nao pode viajar dentro de um app
// instalado na maquina do cliente — bastaria abrir o executavel para extrai-lo
// e emitir nota no CNPJ do mercadinho.
//
// Aqui o token fica no segredo do projeto, e o app so pede "emita a nota da
// venda X". Os valores da nota sao lidos do banco, nunca do corpo da
// requisicao: se viessem de fora, daria para emitir uma nota de R$ 1 para uma
// venda de R$ 300.
//
// Emissor: Focus NFe (https://focusnfe.com.br). A troca por outro emissor mexe
// so em `buildPayload` e `postNota` — o resto e o mesmo para qualquer um.
//
// Segredos necessarios:
//   supabase secrets set FOCUS_NFE_TOKEN=...
//
// Deploy:
//   supabase functions deploy emit-nfce

import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
        status,
        headers: { ...CORS, 'Content-Type': 'application/json' },
    });

/**
 * Formas de pagamento do app -> codigo `tPag` do layout 4.00 da NF-e.
 *
 * Esta tabela e o padrao nacional, nao uma escolha nossa: a SEFAZ rejeita a
 * nota com codigo fora da lista. "Ticket" entra como vale alimentacao (10) e
 * "Credito Loja" como credito de loja (05), que e literalmente o fiado.
 */
const TPAG: Record<string, string> = {
    'Dinheiro': '01',
    'PIX': '17',
    'Débito': '04',
    'Crédito': '03',
    'Ticket': '10',
    'Crédito Loja': '05',
};

const focusBase = (environment: string) =>
    environment === 'producao'
        ? 'https://api.focusnfe.com.br'
        : 'https://homologacao.focusnfe.com.br';

const auth = (token: string) => `Basic ${btoa(`${token}:`)}`;

interface Settings {
    enabled: boolean;
    environment: string;
    cnpj: string | null;
    razao_social: string | null;
    nome_fantasia: string | null;
    inscricao_estadual: string | null;
    regime_tributario: string;
    logradouro: string | null;
    numero: string | null;
    bairro: string | null;
    municipio: string | null;
    codigo_municipio: string | null;
    uf: string | null;
    cep: string | null;
    serie: number;
    ncm_padrao: string | null;
    cfop_padrao: string | null;
    csosn_padrao: string | null;
    cst_padrao: string | null;
    origem_padrao: number;
}

/** Falta alguma coisa para a nota sair? Diz o que falta, e nao so "erro". */
function missingSettings(s: Settings): string[] {
    const required: Array<[keyof Settings, string]> = [
        ['cnpj', 'CNPJ'],
        ['razao_social', 'razão social'],
        ['inscricao_estadual', 'inscrição estadual'],
        ['logradouro', 'logradouro'],
        ['numero', 'número'],
        ['bairro', 'bairro'],
        ['municipio', 'município'],
        ['codigo_municipio', 'código do município (IBGE)'],
        ['uf', 'UF'],
        ['cep', 'CEP'],
    ];
    return required.filter(([key]) => !s[key]).map(([, label]) => label);
}

const digits = (v: string | null | undefined) => String(v ?? '').replace(/\D/g, '');

function buildPayload(
    settings: Settings,
    sale: Record<string, unknown>,
    items: Array<Record<string, unknown>>,
    payments: Array<Record<string, unknown>>,
    products: Map<string, Record<string, unknown>>,
    cpf: string | null,
) {
    // Simples Nacional usa CSOSN; regime normal usa CST. Mandar os dois, ou o
    // errado para o regime, e rejeicao na hora.
    const simples = settings.regime_tributario !== 'normal';

    const nfeItems = items.map((item, index) => {
        const product = item.product_id ? products.get(String(item.product_id)) : undefined;

        const icms = simples
            ? { icms_situacao_tributaria: String(product?.csosn ?? settings.csosn_padrao ?? '102') }
            : { icms_situacao_tributaria: String(product?.cst ?? settings.cst_padrao ?? '00') };

        return {
            numero_item: index + 1,
            // Sem codigo de barras cadastrado, o proprio id do item serve de
            // codigo interno. O campo e obrigatorio e nao pode repetir na nota.
            codigo_produto: String(item.barcode ?? item.product_id ?? index + 1),
            descricao: String(item.product_name),
            codigo_ncm: String(product?.ncm ?? settings.ncm_padrao ?? '21069090'),
            cfop: String(product?.cfop ?? settings.cfop_padrao ?? '5102'),
            unidade_comercial: String(product?.unit ?? 'un'),
            quantidade_comercial: Number(item.quantity),
            valor_unitario_comercial: Number(item.unit_price),
            valor_bruto: Number(item.subtotal),
            unidade_tributavel: String(product?.unit ?? 'un'),
            quantidade_tributavel: Number(item.quantity),
            valor_unitario_tributavel: Number(item.unit_price),
            // `true` = o valor do item entra no total da nota. Sem isso a soma
            // dos itens nao bateria com o total e a nota seria rejeitada.
            inclui_no_total: true,
            origem: Number(product?.origem ?? settings.origem_padrao ?? 0),
            ...icms,
            pis_situacao_tributaria: simples ? '49' : '01',
            cofins_situacao_tributaria: simples ? '49' : '01',
        };
    });

    return {
        natureza_operacao: 'Venda ao consumidor',
        data_emissao: new Date(String(sale.sold_at)).toISOString(),
        // 1 = operacao presencial. E o caso do balcao, e o que a NFC-e admite.
        presenca_comprador: '1',
        modalidade_frete: '9',                 // sem frete
        local_destino: '1',                    // operacao interna (mesma UF)
        finalidade_emissao: '1',               // normal
        consumidor_final: '1',
        tipo_documento: '1',                   // saida
        serie: settings.serie,

        cnpj_emitente: digits(settings.cnpj),
        nome_emitente: settings.razao_social,
        nome_fantasia_emitente: settings.nome_fantasia ?? settings.razao_social,
        inscricao_estadual_emitente: digits(settings.inscricao_estadual),
        regime_tributario_emitente: settings.regime_tributario === 'normal' ? '3'
            : settings.regime_tributario === 'simples_excesso' ? '2' : '1',
        logradouro_emitente: settings.logradouro,
        numero_emitente: settings.numero,
        bairro_emitente: settings.bairro,
        municipio_emitente: settings.municipio,
        codigo_municipio_emitente: digits(settings.codigo_municipio),
        uf_emitente: settings.uf,
        cep_emitente: digits(settings.cep),

        // CPF na nota so quando o cliente pede. "Consumidor nao identificado" e
        // o caso normal do mercadinho e e valido na NFC-e.
        ...(cpf ? { cpf_destinatario: digits(cpf) } : {}),

        valor_produtos: Number(sale.total) + Number(sale.discount ?? 0),
        valor_desconto: Number(sale.discount ?? 0),
        valor_total: Number(sale.total),

        items: nfeItems,
        formas_pagamento: payments.map((p) => ({
            forma_pagamento: TPAG[String(p.method)] ?? '99',
            valor_pagamento: Number(p.amount),
        })),
    };
}

/** Traduz a resposta do emissor para o formato que a tabela guarda. */
function mapResponse(body: Record<string, unknown>, environment: string) {
    const status = String(body.status ?? '');

    const mapped =
        status === 'autorizado' ? 'autorizada'
            : status === 'cancelado' ? 'cancelada'
                : status === 'processando_autorizacao' ? 'processando'
                    : status === 'erro_autorizacao' ? 'rejeitada'
                        : 'erro';

    return {
        status: mapped,
        numero: body.numero ? Number(body.numero) : null,
        serie: body.serie ? Number(body.serie) : null,
        chave: (body.chave_nfe as string) ?? null,
        protocolo: (body.protocolo as string) ?? (body.numero_protocolo as string) ?? null,
        qrcode: (body.qrcode as string) ?? (body.qrcode_url as string) ?? null,
        url_consulta: (body.url_consulta_nf as string) ?? null,
        xml_url: (body.caminho_xml_nota_fiscal as string) ?? null,
        danfe_url: (body.caminho_danfe as string) ?? null,
        mensagem: (body.mensagem_sefaz as string)
            ?? (body.mensagem as string)
            ?? (body.erros ? JSON.stringify(body.erros) : null),
        ambiente: environment,
        emitted_at: mapped === 'autorizada' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
    };
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

    try {
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) return json({ error: 'Sem autenticação.' }, 401);

        const url = Deno.env.get('SUPABASE_URL')!;

        // Confere que quem chamou esta logado de verdade. O funcionario tambem
        // emite — ele acabou de fazer a venda e o cliente quer a nota.
        const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
            global: { headers: { Authorization: authHeader } },
        });

        const { data: { user }, error: userError } = await caller.auth.getUser();
        if (userError || !user) return json({ error: 'Sessão inválida.' }, 401);

        const token = Deno.env.get('FOCUS_NFE_TOKEN');
        if (!token) {
            return json({
                error: 'A emissão de nota ainda não foi configurada no servidor '
                    + '(falta o token do emissor).',
            }, 400);
        }

        // Poderes de servico daqui pra baixo: precisa ler a venda inteira, que
        // o funcionario nao alcanca, e gravar em fiscal_invoices.
        const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

        const { data: settings, error: settingsError } = await admin
            .from('fiscal_settings').select('*').eq('id', 1).single();

        if (settingsError || !settings) {
            return json({ error: 'Configuração fiscal não encontrada.' }, 400);
        }

        const body = await req.json();
        const base = focusBase(settings.environment);

        // ------------------------------------------------------------------
        // Reconsulta: a autorizacao da SEFAZ leva alguns segundos, entao a
        // primeira resposta quase sempre e "processando".
        // ------------------------------------------------------------------
        if (body.action === 'status') {
            const { data: invoice, error } = await admin
                .from('fiscal_invoices').select('*').eq('id', body.invoice_id).single();

            if (error || !invoice) return json({ error: 'Nota não encontrada.' }, 404);

            const res = await fetch(`${base}/v2/nfce/${invoice.ref}`, {
                headers: { Authorization: auth(token) },
            });
            const payload = await res.json();

            const { data: updated } = await admin
                .from('fiscal_invoices')
                .update(mapResponse(payload, settings.environment))
                .eq('id', invoice.id)
                .select()
                .single();

            return json({ invoice: updated });
        }

        // ------------------------------------------------------------------
        // Emissao
        // ------------------------------------------------------------------
        if (!settings.enabled) {
            return json({ error: 'A emissão de nota está desligada na configuração fiscal.' }, 400);
        }

        const missing = missingSettings(settings as Settings);
        if (missing.length > 0) {
            return json({
                error: `Preencha na configuração fiscal: ${missing.join(', ')}.`,
            }, 400);
        }

        const saleId = body.sale_id;
        if (!saleId) return json({ error: 'Venda não informada.' }, 400);

        // Nota que ja existe e foi autorizada nao se emite de novo: seria uma
        // segunda nota para a mesma venda, com imposto em dobro e cancelamento
        // para resolver. Reimprimir usa esta mesma linha.
        const { data: existing } = await admin
            .from('fiscal_invoices')
            .select('*')
            .eq('sale_id', saleId)
            .order('created_at', { ascending: false });

        const authorized = (existing ?? []).find((i) => i.status === 'autorizada');
        if (authorized) return json({ invoice: authorized, reused: true });

        const pending = (existing ?? []).find((i) => i.status === 'processando');
        if (pending) return json({ invoice: pending, reused: true });

        const { data: sale, error: saleError } = await admin
            .from('sales').select('*').eq('id', saleId).single();

        if (saleError || !sale) return json({ error: 'Venda não encontrada.' }, 404);

        const [{ data: items }, { data: payments }] = await Promise.all([
            admin.from('sale_items').select('*').eq('sale_id', saleId).order('created_at'),
            admin.from('sale_payments').select('*').eq('sale_id', saleId),
        ]);

        if (!items || items.length === 0) {
            return json({ error: 'Venda sem itens.' }, 400);
        }

        // Dados fiscais dos produtos numa ida so.
        const productIds = items.map((i) => i.product_id).filter(Boolean);
        const products = new Map<string, Record<string, unknown>>();
        if (productIds.length > 0) {
            const { data: rows } = await admin
                .from('products')
                .select('id, unit, ncm, cfop, cest, csosn, cst, origem')
                .in('id', productIds);
            for (const row of rows ?? []) products.set(row.id, row);
        }

        // A referencia e unica no emissor e e o que impede nota duplicada: se a
        // conexao cair depois de enviar, reenviar a mesma ref devolve a nota que
        // ja foi criada em vez de criar outra. Tentativa que deu rejeicao ganha
        // sufixo, porque o emissor nao reaproveita ref queimada.
        const attempt = (existing ?? []).length;
        const ref = attempt === 0 ? `venda-${saleId}` : `venda-${saleId}-${attempt + 1}`;

        const payload = buildPayload(
            settings as Settings, sale, items, payments ?? [], products, body.cpf ?? null,
        );

        const res = await fetch(`${base}/v2/nfce?ref=${encodeURIComponent(ref)}`, {
            method: 'POST',
            headers: { Authorization: auth(token), 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        const responseBody = await res.json().catch(() => ({}));
        const mapped = mapResponse(responseBody, settings.environment);

        const { data: invoice, error: insertError } = await admin
            .from('fiscal_invoices')
            // `serie` depois do spread: enquanto a nota esta processando o
            // emissor ainda nao devolveu a serie, e o nulo dele apagaria a que
            // veio da configuracao.
            .insert({
                sale_id: saleId,
                ref,
                cpf: body.cpf ? digits(body.cpf) : null,
                ...mapped,
                serie: mapped.serie ?? settings.serie,
            })
            .select()
            .single();

        if (insertError) {
            console.error(insertError);
            return json({ error: 'A nota foi enviada, mas não consegui registrar aqui.' }, 500);
        }

        return json({ invoice });
    } catch (err) {
        console.error(err);
        return json({ error: 'Erro inesperado ao emitir a nota.' }, 500);
    }
});
