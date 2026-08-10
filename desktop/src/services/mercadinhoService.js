import { supabase } from '../lib/supabase';
import { STORE_CREDIT as STORE_CREDIT_METHOD } from '../lib/payments';
import { cachedProductByBarcode, cachedSearchProducts, cachedCustomers } from '../lib/catalogCache';
import { enqueueSale } from '../lib/salesOutbox';

/**
 * A chamada falhou por falta de conexão (e não porque o servidor recusou)?
 *
 * A diferença decide o que a tela faz: sem conexão, o PDV segue pela cópia
 * local; recusa do servidor é erro de verdade e precisa aparecer.
 */
function isOffline(err) {
    const message = String(err?.message ?? '').toLowerCase();
    return (
        err?.name === 'TypeError' ||
        err?.name === 'AbortError' ||
        message.includes('fetch') ||
        message.includes('network') ||
        message.includes('failed to send') ||
        message.includes('timeout')
    );
}

// ---------------------------------------------------------------------------
// Produtos
// ---------------------------------------------------------------------------

/**
 * Catalogo completo.
 *
 * `withCost` decide a fonte: a tabela (so administrador) ou a view sem custo.
 * O funcionario precisa consultar preco e estoque no balcao, mas a tabela
 * `products` nao devolve nada para ele — sem a view, a tela viria vazia.
 */
export async function listProducts({ includeInactive = false, withCost = true } = {}) {
    // `suppliers` so no caminho do administrador: a view de PDV nao tem relacao
    // declarada, e o funcionario nao precisa saber de quem se compra.
    const columns = withCost ? '*, suppliers(id, name)' : '*';

    let query = supabase
        .from(productSource(withCost))
        .select(columns)
        .order('name', { ascending: true });

    if (!includeInactive) query = query.eq('active', true);

    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
}

/**
 * De onde ler o catalogo.
 *
 * `products_pos` e uma view sem a coluna de custo, liberada para todo mundo
 * logado. A tabela `products` so o administrador enxerga. Por isso o caminho
 * padrao e a view: ela atende os dois papeis. `withCost` e para as telas do
 * administrador que precisam do custo (entrada de estoque, cadastro).
 */
const productSource = (withCost) => (withCost ? 'products' : 'products_pos');

/**
 * Busca exata pelo codigo de barras. Retorna null se nao existir.
 *
 * Sem conexao, responde pela copia local do catalogo — e o que mantem o leitor
 * funcionando no balcao com a internet fora. O caminho do administrador
 * (`withCost`) nao tem essa volta: a copia local nao guarda custo de compra,
 * e cadastro de produto offline nao existe.
 */
export async function findProductByBarcode(barcode, { withCost = false } = {}) {
    try {
        const { data, error } = await supabase
            .from(productSource(withCost))
            .select('*')
            .eq('barcode', barcode)
            .eq('active', true)
            .maybeSingle();

        if (error) throw error;
        return data;
    } catch (err) {
        if (withCost || !isOffline(err)) throw err;
        return cachedProductByBarcode(barcode);
    }
}

export async function searchProducts(term, { withCost = false } = {}) {
    try {
        const { data, error } = await supabase
            .from(productSource(withCost))
            .select('*')
            .eq('active', true)
            .or(`name.ilike.%${term}%,barcode.ilike.%${term}%`)
            .order('name')
            .limit(20);

        if (error) throw error;
        return data ?? [];
    } catch (err) {
        if (withCost || !isOffline(err)) throw err;
        return cachedSearchProducts(term);
    }
}

export async function createProduct(product) {
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
        .from('products')
        .insert([{
            ...product,
            barcode: product.barcode?.trim() || null,
            user_id: user?.id ?? null,
            user_email: user?.email ?? null,
        }])
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function updateProduct(id, changes) {
    // stock_quantity fica de fora de proposito: quem mexe no estoque sao os
    // triggers de venda e de entrada. Editar na mao aqui dessincronizaria.
    const { stock_quantity, ...safeChanges } = changes;

    const { data, error } = await supabase
        .from('products')
        .update({
            ...safeChanges,
            barcode: safeChanges.barcode?.trim() || null,
            updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;
    return data;
}

/** Desativa em vez de apagar: senao o historico de vendas perde a referencia. */
export async function deactivateProduct(id) {
    const { error } = await supabase
        .from('products')
        .update({ active: false, updated_at: new Date().toISOString() })
        .eq('id', id);

    if (error) throw error;
}

/**
 * Importa produtos vindos de planilha.
 *
 * Não usa upsert do PostgREST de propósito: o índice de código de barras é
 * parcial (`where barcode is not null`), e ON CONFLICT não consegue inferir
 * índice parcial de forma confiável. Aqui a separação entre novo e existente é
 * feita explicitamente, em lotes.
 *
 * `importStock` grava o saldo da planilha como estoque inicial, e só em produto
 * novo. É a exceção à regra de que só o banco mexe no estoque: numa migração o
 * saldo que já existe na loja precisa entrar de algum jeito. Produto que já
 * existe aqui nunca tem o estoque tocado, senão uma reimportação do mesmo
 * arquivo apagaria as vendas e entradas registradas desde a primeira vez.
 */
export async function importProducts(items, { updateExisting = true, importStock = false } = {}) {
    const { data: { user } } = await supabase.auth.getUser();

    const withBarcode = items.filter((i) => i.barcode);
    const barcodes = [...new Set(withBarcode.map((i) => i.barcode))];

    // Descobre quais códigos já existem. Em lotes, senão a URL do GET estoura
    // com uma lista de milhares de códigos.
    const existing = new Map();
    const LOOKUP_CHUNK = 200;

    for (let i = 0; i < barcodes.length; i += LOOKUP_CHUNK) {
        const chunk = barcodes.slice(i, i + LOOKUP_CHUNK);
        const { data, error } = await supabase
            .from('products')
            .select('id, barcode')
            .in('barcode', chunk);

        if (error) throw error;
        for (const row of data ?? []) existing.set(row.barcode, row.id);
    }

    const toInsert = [];
    const toUpdate = [];
    const seen = new Set();
    let skipped = 0;

    for (const item of items) {
        // Código repetido dentro do próprio arquivo: vale a primeira linha.
        if (item.barcode) {
            if (seen.has(item.barcode)) { skipped++; continue; }
            seen.add(item.barcode);
        }

        const existingId = item.barcode ? existing.get(item.barcode) : undefined;

        if (existingId) {
            if (!updateExisting) { skipped++; continue; }
            toUpdate.push({ id: existingId, item });
        } else {
            toInsert.push({
                barcode: item.barcode,
                name: item.name,
                unit: item.unit || 'un',
                sale_price: item.sale_price ?? 0,
                cost_price: item.cost_price ?? 0,
                stock_quantity: importStock ? (item.stock_quantity ?? 0) : 0,
                min_stock: 0,
                category: item.category,
                active: true,
                user_id: user?.id ?? null,
                user_email: user?.email ?? null,
            });
        }
    }

    const INSERT_CHUNK = 500;
    for (let i = 0; i < toInsert.length; i += INSERT_CHUNK) {
        const { error } = await supabase
            .from('products')
            .insert(toInsert.slice(i, i + INSERT_CHUNK));
        if (error) throw error;
    }

    for (const { id, item } of toUpdate) {
        const { error } = await supabase
            .from('products')
            .update({
                name: item.name,
                unit: item.unit || 'un',
                sale_price: item.sale_price ?? 0,
                cost_price: item.cost_price ?? 0,
                category: item.category,
                active: true,
                updated_at: new Date().toISOString(),
            })
            .eq('id', id);
        if (error) throw error;
    }

    return { inserted: toInsert.length, updated: toUpdate.length, skipped };
}

export async function listLowStock() {
    const { data, error } = await supabase
        .from('low_stock_products')
        .select('*')
        .order('missing_quantity', { ascending: false });

    if (error) throw error;
    return data ?? [];
}

// ---------------------------------------------------------------------------
// Vendas
// ---------------------------------------------------------------------------

/**
 * Fecha a venda inteira numa chamada so (RPC no banco).
 * Ou grava venda + itens + pagamentos + baixa de estoque, ou nao grava nada.
 *
 * `payments`: [{ method, amount }] - um item no pagamento simples, varios no
 * combinado. Os valores sao o que entrou na venda, sem o troco. O banco recusa
 * se a soma nao fechar com o total.
 */
export async function createSale({ items, payments, discount = 0, note = null, customerId = null }) {
    const itemPayload = items.map((item) => ({
        product_id: item.product_id ?? null,
        barcode: item.barcode ?? null,
        product_name: item.product_name,
        quantity: Number(item.quantity),
        unit_price: Number(item.unit_price),
        unit_cost: Number(item.unit_cost ?? 0),
    }));

    const paymentPayload = payments.map((p) => ({
        method: p.method,
        amount: Number(Number(p.amount).toFixed(2)),
    }));

    // `client_uuid` sai daqui mesmo na venda online. Se a conexão cair depois
    // de o banco gravar mas antes de a resposta chegar, este identificador é o
    // que permite reenviar sem duplicar — e é exatamente esse o caso em que a
    // venda cai na fila logo abaixo.
    const clientUuid = crypto.randomUUID();
    const soldAt = new Date().toISOString();

    try {
        const { data, error } = await supabase.rpc('create_sale', {
            p_items: itemPayload,
            p_payments: paymentPayload,
            p_discount: Number(discount) || 0,
            p_note: note,
            p_customer_id: customerId,
            p_client_uuid: clientUuid,
            p_sold_at: soldAt,
        });

        if (error) throw error;
        return { saleId: data, queued: false, clientUuid, soldAt };
    } catch (err) {
        // Recusa do servidor (carrinho vazio, pagamento que não fecha) tem que
        // aparecer na tela. Só falta de conexão vira fila.
        if (!isOffline(err)) throw err;

        const entry = await enqueueSale({
            items: itemPayload,
            payments: paymentPayload,
            discount: Number(discount) || 0,
            note,
            customerId,
            clientUuid,
            soldAt,
        });

        return { saleId: null, queued: true, clientUuid: entry.client_uuid, soldAt: entry.sold_at };
    }
}

export async function listSalePayments(saleId) {
    const { data, error } = await supabase
        .from('sale_payments')
        .select('*')
        .eq('sale_id', saleId)
        .order('created_at');

    if (error) throw error;
    return data ?? [];
}

/**
 * Vendas do periodo, ja com o detalhe de pagamentos embutido.
 *
 * O `sale_payments(...)` traz tudo numa ida so. Sem isso, filtrar por forma de
 * pagamento teria que ser feito em cima do resumo `payment_method`, onde
 * "Credito" casaria com "Credito Loja" por ser prefixo.
 */
export async function listSales({ from, to, limit = 500 } = {}) {
    let query = supabase
        .from('sales')
        .select('*, sale_payments(id, method, amount), customers(id, name)')
        .order('sold_at', { ascending: false })
        .limit(limit);

    if (from) query = query.gte('sold_at', from);
    if (to) query = query.lte('sold_at', to);

    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
}

export async function listSaleItems(saleId) {
    const { data, error } = await supabase
        .from('sale_items')
        .select('*')
        .eq('sale_id', saleId)
        .order('created_at');

    if (error) throw error;
    return data ?? [];
}

/** Estorna a venda. O cascade apaga os itens e o trigger devolve o estoque. */
export async function deleteSale(saleId) {
    const { error } = await supabase.from('sales').delete().eq('id', saleId);
    if (error) throw error;
}

/**
 * Itens vendidos num periodo. O `sales!inner` filtra pela data da venda-mae,
 * evitando ter que buscar os ids das vendas antes.
 */
export async function listSaleItemsByPeriod({ from, to } = {}) {
    let query = supabase
        .from('sale_items')
        .select('*, sales!inner(sold_at)');

    if (from) query = query.gte('sales.sold_at', from);
    if (to) query = query.lte('sales.sold_at', to);

    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
}

// ---------------------------------------------------------------------------
// Entradas de estoque (despesas de reestoque)
// ---------------------------------------------------------------------------

export async function createStockEntry(entry) {
    const { data: { user } } = await supabase.auth.getUser();

    const quantity = Number(entry.quantity);
    const unitCost = Number(entry.unit_cost);

    const { data, error } = await supabase
        .from('stock_entries')
        .insert([{
            product_id: entry.product_id ?? null,
            barcode: entry.barcode ?? null,
            product_name: entry.product_name,
            quantity,
            unit_cost: unitCost,
            total_cost: Number((quantity * unitCost).toFixed(2)),
            supplier_id: entry.supplier_id || null,
            entry_date: entry.entry_date,
            payment_method: entry.payment_method || null,
            note: entry.note || null,
            user_id: user?.id ?? null,
            user_email: user?.email ?? null,
        }])
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function listStockEntries({ from, to, limit = 100 } = {}) {
    let query = supabase
        .from('stock_entries')
        .select('*, suppliers(id, name)')
        .order('entry_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(limit);

    if (from) query = query.gte('entry_date', from);
    if (to) query = query.lte('entry_date', to);

    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
}

export async function deleteStockEntry(id) {
    const { error } = await supabase.from('stock_entries').delete().eq('id', id);
    if (error) throw error;
}

// ---------------------------------------------------------------------------
// Clientes e fiado (Credito Loja)
// ---------------------------------------------------------------------------

/**
 * Clientes cadastrados.
 *
 * Sem conexao responde pela copia local, porque vender fiado offline exige
 * escolher de quem e a divida — fiado sem dono e divida que ninguem cobra.
 * Cadastrar cliente novo offline nao entra nessa volta: o cliente precisa de um
 * id do banco para a venda apontar, e inventar um aqui daria dois cadastros da
 * mesma pessoa assim que a fila subisse.
 */
export async function listCustomers({ includeInactive = false } = {}) {
    try {
        let query = supabase.from('customers').select('*').order('name');
        if (!includeInactive) query = query.eq('active', true);

        const { data, error } = await query;
        if (error) throw error;
        return data ?? [];
    } catch (err) {
        if (!isOffline(err)) throw err;
        return cachedCustomers();
    }
}

export async function createCustomer({ name, phone = null, note = null }) {
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
        .from('customers')
        .insert([{
            name: name.trim(),
            phone: phone?.trim() || null,
            note: note?.trim() || null,
            user_id: user?.id ?? null,
            user_email: user?.email ?? null,
        }])
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function updateCustomer(id, changes) {
    const { data, error } = await supabase
        .from('customers')
        .update({ ...changes, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;
    return data;
}

/** Saldo devedor por cliente. Calculado pela view, nunca guardado. */
export async function listCustomerBalances() {
    const { data, error } = await supabase
        .from('customer_credit_balance')
        .select('*')
        .order('balance', { ascending: false });

    if (error) throw error;
    return data ?? [];
}

/** Compras do cliente que geraram fiado, com o valor que ficou devendo em cada. */
export async function listCustomerCreditSales(customerId) {
    const { data, error } = await supabase
        .from('sales')
        .select('id, sold_at, total, note, payment_method, item_count, sale_payments(method, amount)')
        .eq('customer_id', customerId)
        .order('sold_at', { ascending: false });

    if (error) throw error;

    // Só interessa a parte fiada: numa venda combinada, o que foi pago em
    // dinheiro na hora não é dívida.
    return (data ?? [])
        .map((sale) => ({
            ...sale,
            credit_amount: (sale.sale_payments ?? [])
                .filter((p) => p.method === STORE_CREDIT_METHOD)
                .reduce((sum, p) => sum + Number(p.amount), 0),
        }))
        .filter((sale) => sale.credit_amount > 0);
}

export async function listCreditPayments(customerId) {
    const { data, error } = await supabase
        .from('credit_payments')
        .select('*')
        .eq('customer_id', customerId)
        .order('paid_at', { ascending: false })
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data ?? [];
}

export async function createCreditPayment({ customerId, amount, method, paidAt, note }) {
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
        .from('credit_payments')
        .insert([{
            customer_id: customerId,
            amount: Number(Number(amount).toFixed(2)),
            method: method || 'Dinheiro',
            paid_at: paidAt,
            note: note?.trim() || null,
            user_id: user?.id ?? null,
            user_email: user?.email ?? null,
        }])
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function deleteCreditPayment(id) {
    const { error } = await supabase.from('credit_payments').delete().eq('id', id);
    if (error) throw error;
}

// ---------------------------------------------------------------------------
// Perfis de funcionario
//
// A senha nunca trafega nem e comparada aqui: quem cria e confere e o banco,
// por RPC. A tabela em si nao pode ser lida pela API — a listagem vem da view
// `employee_profiles_public`, que nao tem a coluna do hash.
// ---------------------------------------------------------------------------

export async function listEmployeeProfiles({ includeInactive = false } = {}) {
    let query = supabase
        .from('employee_profiles_public')
        .select('*')
        .order('name');

    if (!includeInactive) query = query.eq('active', true);

    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
}

/**
 * Cria a conta do funcionario.
 *
 * Vai pela Edge Function porque criar usuario exige a service_role key, que
 * nao pode existir dentro de um app instalado na maquina do cliente. A funcao
 * confere no servidor se quem chamou e administrador.
 */
export async function createEmployeeAccount({ name, password }) {
    const { data, error } = await supabase.functions.invoke('create-employee', {
        body: { name, password },
    });

    // Erro HTTP vem embrulhado: a mensagem util esta no corpo da resposta.
    if (error) {
        let message = 'Não consegui criar o funcionário.';
        try {
            const body = await error.context?.json?.();
            if (body?.error) message = body.error;
        } catch {
            // Sem corpo legível — fica a mensagem genérica.
        }
        throw new Error(message);
    }

    if (data?.error) throw new Error(data.error);
    return data?.profile;
}

/** Quem esta logado e administrador? Quem decide e o banco. */
export async function checkIsAdmin() {
    const { data, error } = await supabase.rpc('is_admin');
    if (error) throw error;
    return data === true;
}

/** Perfil do funcionario logado, ou null se for administrador. */
export async function getMyEmployeeProfile() {
    const { data, error } = await supabase
        .from('employee_profiles')
        .select('id, name, active')
        .maybeSingle();

    if (error) throw error;
    return data;
}

export async function setEmployeeProfileActive(profileId, active) {
    const { error } = await supabase
        .from('employee_profiles')
        .update({ active, updated_at: new Date().toISOString() })
        .eq('id', profileId);

    if (error) throw error;
}

export async function renameEmployeeProfile(profileId, name) {
    const { error } = await supabase
        .from('employee_profiles')
        .update({ name: name.trim(), updated_at: new Date().toISOString() })
        .eq('id', profileId);

    if (error) throw error;
}

export async function deleteEmployeeProfile(profileId) {
    const { error } = await supabase
        .from('employee_profiles')
        .delete()
        .eq('id', profileId);

    if (error) throw error;
}

// ---------------------------------------------------------------------------
// Credito da loja (consumo do funcionario)
// ---------------------------------------------------------------------------

/**
 * Anota um produto que o funcionario pegou para descontar no pagamento.
 *
 * O preco NAO vai daqui: quem le e o banco, no instante do lancamento. O app
 * manda so o produto e a quantidade.
 *
 * Antes o valor era calculado aqui e gravado direto na tabela — o que deixava
 * o proprio funcionario escolher quanto o consumo dele custaria, bastando
 * chamar a API com outro numero. Do lado do banco, o valor gravado fica
 * congelado: se o produto subir de preco no mes seguinte, o desconto continua
 * sendo o do dia em que ele pegou.
 */
export async function createEmployeeCredit({
    employeeProfileId, product, quantity, takenAt, note,
}) {
    const { data, error } = await supabase.rpc('create_employee_credit', {
        p_product_id: product.id,
        p_quantity: Number(quantity),
        p_taken_at: takenAt,
        p_note: note?.trim() || null,
        p_profile_id: employeeProfileId ?? null,
    });

    if (error) throw error;
    return data; // uuid do lancamento
}

export async function listEmployeeCredits({ profileId, from, to } = {}) {
    let query = supabase
        .from('employee_credits')
        .select('*, employee_profiles(id, name)')
        .order('taken_at', { ascending: false })
        .order('created_at', { ascending: false });

    if (profileId) query = query.eq('employee_profile_id', profileId);
    if (from) query = query.gte('taken_at', from);
    if (to) query = query.lte('taken_at', to);

    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
}

export async function deleteEmployeeCredit(id) {
    const { error } = await supabase.from('employee_credits').delete().eq('id', id);
    if (error) throw error;
}

/** Marca os lancamentos como descontados no pagamento. So o admin faz isso. */
export async function settleEmployeeCredits(ids, settledAt) {
    const { error } = await supabase
        .from('employee_credits')
        .update({ settled_at: settledAt })
        .in('id', ids);

    if (error) throw error;
}

export async function unsettleEmployeeCredits(ids) {
    const { error } = await supabase
        .from('employee_credits')
        .update({ settled_at: null })
        .in('id', ids);

    if (error) throw error;
}

// ---------------------------------------------------------------------------
// Caixa: abertura, sangria e fechamento
//
// Tudo passa por RPC de proposito. O valor esperado na gaveta e calculado pelo
// banco a partir das vendas em dinheiro do turno — calculado aqui, seria um
// numero informado pela mesma pessoa que esta sendo conferida.
// ---------------------------------------------------------------------------

/** Turno aberto agora, ou null se ninguem abriu o caixa. */
export async function getOpenCashSession() {
    const { data, error } = await supabase
        .from('cash_session_summary')
        .select('*')
        .is('closed_at', null)
        .maybeSingle();

    if (error) throw error;
    return data;
}

export async function listCashSessions({ from, to, limit = 100 } = {}) {
    let query = supabase
        .from('cash_session_summary')
        .select('*')
        .order('opened_at', { ascending: false })
        .limit(limit);

    if (from) query = query.gte('opened_at', from);
    if (to) query = query.lte('opened_at', to);

    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
}

export async function listCashMovements(sessionId) {
    const { data, error } = await supabase
        .from('cash_movements')
        .select('*')
        .eq('session_id', sessionId)
        .order('happened_at', { ascending: false });

    if (error) throw error;
    return data ?? [];
}

export async function openCashSession({ openingAmount = 0, note = null } = {}) {
    const { data, error } = await supabase.rpc('open_cash_session', {
        p_opening_amount: Number(openingAmount) || 0,
        p_note: note,
    });

    if (error) throw error;
    return data;
}

export async function closeCashSession({ countedAmount, note = null }) {
    const { data, error } = await supabase.rpc('close_cash_session', {
        p_counted_amount: Number(countedAmount),
        p_note: note,
    });

    if (error) throw error;
    return data;
}

/** `kind`: 'sangria' (sai da gaveta) ou 'suprimento' (entra). */
export async function addCashMovement({ kind, amount, reason }) {
    const { data, error } = await supabase.rpc('add_cash_movement', {
        p_kind: kind,
        p_amount: Number(amount),
        p_reason: reason,
    });

    if (error) throw error;
    return data;
}

// ---------------------------------------------------------------------------
// Nota fiscal (NFC-e)
//
// A emissao NAO sai daqui direto para a SEFAZ nem para o emissor: vai pela
// Edge Function `emit-nfce`. O token do emissor assina nota em nome da loja, e
// nao pode viajar dentro de um app instalado na maquina do cliente — mesmo
// motivo da service_role key em `create-employee`.
// ---------------------------------------------------------------------------

export async function getFiscalSettings() {
    const { data, error } = await supabase
        .from('fiscal_settings')
        .select('*')
        .eq('id', 1)
        .maybeSingle();

    if (error) throw error;
    return data;
}

export async function updateFiscalSettings(changes) {
    const { data, error } = await supabase
        .from('fiscal_settings')
        .update({ ...changes, updated_at: new Date().toISOString() })
        .eq('id', 1)
        .select()
        .single();

    if (error) throw error;
    return data;
}

/** Nota de uma venda, se ja houver. Uma venda tem no maximo uma autorizada. */
export async function getInvoiceForSale(saleId) {
    const { data, error } = await supabase
        .from('fiscal_invoices')
        .select('*')
        .eq('sale_id', saleId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) throw error;
    return data;
}

export async function listInvoicesForSales(saleIds) {
    if (saleIds.length === 0) return {};

    const { data, error } = await supabase
        .from('fiscal_invoices')
        .select('*')
        .in('sale_id', saleIds);

    if (error) throw error;

    // Uma por venda, a mais recente. A tela so precisa saber "esta venda tem
    // nota?" e, se tiver, qual — o historico de tentativas nao interessa ali.
    const byId = {};
    for (const invoice of data ?? []) {
        const current = byId[invoice.sale_id];
        if (!current || new Date(invoice.created_at) > new Date(current.created_at)) {
            byId[invoice.sale_id] = invoice;
        }
    }
    return byId;
}

/**
 * Emite a NFC-e de uma venda.
 *
 * Chamar de novo para a mesma venda nao emite outra: a funcao usa a venda como
 * referencia unica no emissor e devolve a nota que ja existe. Emitir em
 * duplicidade custaria um cancelamento junto a SEFAZ.
 */
export async function emitInvoice(saleId, { cpf = null } = {}) {
    const { data, error } = await supabase.functions.invoke('emit-nfce', {
        body: { sale_id: saleId, cpf },
    });

    if (error) {
        let message = 'Não consegui emitir a nota.';
        try {
            const body = await error.context?.json?.();
            if (body?.error) message = body.error;
        } catch {
            // Sem corpo legível — fica a mensagem genérica.
        }
        throw new Error(message);
    }

    if (data?.error) throw new Error(data.error);
    return data?.invoice;
}

/** Reconsulta o emissor: a autorizacao da SEFAZ leva alguns segundos. */
export async function refreshInvoice(invoiceId) {
    const { data, error } = await supabase.functions.invoke('emit-nfce', {
        body: { invoice_id: invoiceId, action: 'status' },
    });

    if (error) throw new Error('Não consegui consultar a nota.');
    if (data?.error) throw new Error(data.error);
    return data?.invoice;
}

// ---------------------------------------------------------------------------
// Fornecedores (tabela ja existente, compartilhada com o site)
// ---------------------------------------------------------------------------

export async function listSuppliers() {
    const { data, error } = await supabase
        .from('suppliers')
        .select('id, name')
        .order('name');

    if (error) throw error;
    return data ?? [];
}
