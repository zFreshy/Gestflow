import { supabase } from '../lib/supabase';
import { STORE_CREDIT as STORE_CREDIT_METHOD } from '../lib/payments';

// ---------------------------------------------------------------------------
// Produtos
// ---------------------------------------------------------------------------

export async function listProducts({ includeInactive = false } = {}) {
    let query = supabase
        .from('products')
        .select('*, suppliers(id, name)')
        .order('name', { ascending: true });

    if (!includeInactive) query = query.eq('active', true);

    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
}

/** Busca exata pelo codigo de barras. Retorna null se nao existir. */
export async function findProductByBarcode(barcode) {
    const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('barcode', barcode)
        .eq('active', true)
        .maybeSingle();

    if (error) throw error;
    return data;
}

export async function searchProducts(term) {
    const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('active', true)
        .or(`name.ilike.%${term}%,barcode.ilike.%${term}%`)
        .order('name')
        .limit(20);

    if (error) throw error;
    return data ?? [];
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

    const { data, error } = await supabase.rpc('create_sale', {
        p_items: itemPayload,
        p_payments: paymentPayload,
        p_discount: Number(discount) || 0,
        p_note: note,
        p_customer_id: customerId,
    });

    if (error) throw error;
    return data; // uuid da venda
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

export async function listCustomers({ includeInactive = false } = {}) {
    let query = supabase.from('customers').select('*').order('name');
    if (!includeInactive) query = query.eq('active', true);

    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
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

export async function createEmployeeProfile({ name, password }) {
    const { data, error } = await supabase.rpc('create_employee_profile', {
        p_name: name,
        p_password: password,
    });

    if (error) throw error;
    return data; // uuid do perfil
}

export async function verifyEmployeePassword(profileId, password) {
    const { data, error } = await supabase.rpc('verify_employee_password', {
        p_profile_id: profileId,
        p_password: password,
    });

    if (error) throw error;
    return data === true;
}

export async function setEmployeePassword(profileId, password) {
    const { error } = await supabase.rpc('set_employee_password', {
        p_profile_id: profileId,
        p_password: password,
    });

    if (error) throw error;
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

export async function createEmployeeCredit({
    employeeProfileId, product, quantity, takenAt, note,
}) {
    const qty = Number(quantity);
    const unitPrice = Number(product.sale_price) || 0;

    const { data, error } = await supabase
        .from('employee_credits')
        .insert([{
            employee_profile_id: employeeProfileId,
            product_id: product.id,
            barcode: product.barcode,
            product_name: product.name,
            quantity: qty,
            unit_price: unitPrice,
            total: Number((qty * unitPrice).toFixed(2)),
            taken_at: takenAt,
            note: note?.trim() || null,
        }])
        .select()
        .single();

    if (error) throw error;
    return data;
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
