/**
 * Cópia local do catálogo, para o PDV continuar bipando sem internet.
 *
 * Sem isto, "vender offline" não existiria: o leitor bipa um código e o app
 * precisa saber o nome e o preço daquele produto para montar o carrinho. Esse
 * dado mora no servidor.
 *
 * A cópia vem de `products_pos`, a mesma view que o funcionário já enxerga —
 * sem custo de compra. O arquivo fica na máquina da loja, e não faz sentido
 * gravar nele o que nem na tela aparece.
 *
 * O preço guardado aqui é o que vai para a venda offline, e é o que o cliente
 * pagou. Quando a fila subir, o banco grava esse valor, e não o preço de
 * quando a conexão voltou.
 */

import { supabase } from './supabase';
import { createStore } from './localStore';

const store = createStore('catalogo.json');
const PRODUCTS_KEY = 'produtos';
const UPDATED_KEY = 'atualizado_em';
const CUSTOMERS_KEY = 'clientes';

let memory = null;

/** Baixa o catálogo inteiro e grava em disco. Chamado no boot e ao reconectar. */
export async function refreshCatalog() {
    const [products, customers] = await Promise.all([
        supabase
            .from('products_pos')
            .select('id, barcode, scale_code, name, unit, sale_price, stock_quantity, category')
            .eq('active', true)
            .order('name'),
        supabase.from('customers').select('id, name, phone').eq('active', true).order('name'),
    ]);

    if (products.error) throw products.error;
    if (customers.error) throw customers.error;

    memory = products.data ?? [];

    await store.set(PRODUCTS_KEY, memory);
    await store.set(CUSTOMERS_KEY, customers.data ?? []);
    await store.set(UPDATED_KEY, new Date().toISOString());

    return memory.length;
}

async function products() {
    if (!memory) memory = (await store.get(PRODUCTS_KEY, [])) ?? [];
    return memory;
}

export async function cachedCustomers() {
    return (await store.get(CUSTOMERS_KEY, [])) ?? [];
}

export async function catalogUpdatedAt() {
    return store.get(UPDATED_KEY, null);
}

export async function cachedProductByBarcode(barcode) {
    const list = await products();
    return list.find((p) => p.barcode === barcode) ?? null;
}

/** Mesma busca pelo codigo interno da balanca, para etiqueta lida offline. */
export async function cachedProductByScaleCode(scaleCode) {
    const list = await products();
    return list.find((p) => p.scale_code === scaleCode) ?? null;
}

/**
 * Fallback para etiqueta de balanca: busca por prefixo do codigo de barras.
 *
 * Quando o produto nao tem scale_code preenchido mas foi cadastrado com o
 * barcode "base" da balanca (ex: 2000001000000), esta busca encontra pelo
 * prefixo que identifica o produto (ex: "2000001").
 */
export async function cachedProductByBarcodePrefix(prefix) {
    const list = await products();
    return list.find((p) => p.barcode && p.barcode.startsWith(prefix)) ?? null;
}

/** Mesma busca da tela online: por nome ou por código, sem diferenciar acento. */
export async function cachedSearchProducts(term) {
    const list = await products();
    const needle = normalize(term);
    if (!needle) return [];

    return list
        .filter((p) => normalize(p.name).includes(needle) || (p.barcode ?? '').includes(term))
        .slice(0, 20);
}

const normalize = (text) =>
    String(text ?? '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .trim();
