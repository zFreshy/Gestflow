/**
 * Fila das vendas que ainda não chegaram no servidor.
 *
 * O caixa não pode parar porque a internet caiu. A venda é fechada na hora,
 * gravada em disco, e sobe sozinha quando a conexão voltar — mesmo que o app
 * tenha sido fechado e aberto no meio.
 *
 * Duas decisões seguram a corretude disso:
 *
 * 1. Cada venda nasce com um `client_uuid` gerado AQUI, antes da primeira
 *    tentativa. O banco tem índice único nessa coluna e o `create_sale`
 *    devolve o id que já existe em vez de gravar de novo. Sem isso, o caso
 *    mais comum de falha — o banco grava e a resposta se perde no caminho —
 *    viraria venda duplicada com estoque baixado duas vezes.
 *
 * 2. Nada sai da fila sem confirmação do servidor. Erro de rede mantém a venda
 *    na fila; erro de regra (o banco recusou) também mantém, marcado, para
 *    alguém olhar. Uma venda nunca é descartada em silêncio: ela é dinheiro
 *    que já entrou na gaveta.
 */

import { supabase } from './supabase';
import { createStore } from './localStore';

const store = createStore('vendas-pendentes.json');
const KEY = 'fila';

const listeners = new Set();

/** Avisa a interface que a fila mudou (contador no rodapé, aviso no PDV). */
export function subscribeOutbox(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

async function notify() {
    const queue = await listQueued();
    for (const fn of listeners) {
        try { fn(queue); } catch (err) { console.error(err); }
    }
}

export async function listQueued() {
    return (await store.get(KEY, [])) ?? [];
}

async function write(queue) {
    await store.set(KEY, queue);
    await notify();
}

/**
 * Põe a venda na fila. Só volta depois de o disco confirmar a gravação: se
 * falhar, quem chamou precisa saber que a venda NÃO está guardada em lugar
 * nenhum — dizer "venda registrada" nesse caso seria mentir para o operador.
 */
export async function enqueueSale(sale) {
    const entry = {
        // O identificador pode vir de fora: a venda online já nasce com um, e
        // reaproveitá-lo mantém uma só identidade para a mesma venda, tenha ela
        // chegado ao servidor ou caído aqui.
        client_uuid: sale.clientUuid ?? crypto.randomUUID(),
        sold_at: sale.soldAt ?? new Date().toISOString(),
        items: sale.items,
        payments: sale.payments,
        discount: sale.discount ?? 0,
        note: sale.note ?? null,
        customerId: sale.customerId ?? null,
        attempts: 0,
        last_error: null,
        blocked: false,
    };

    const queue = await listQueued();
    await write([...queue, entry]);
    return entry;
}

/** Erro de conexão, e não de regra: vale a pena tentar de novo mais tarde. */
function isNetworkError(err) {
    // O supabase-js embrulha a falha do fetch; a mensagem é o que sobra de
    // comum entre os casos (offline, DNS, timeout, servidor fora do ar).
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

/**
 * Tenta subir tudo que está na fila, na ordem em que foi vendido.
 *
 * Para no primeiro erro de rede: se a conexão caiu, insistir nas outras só
 * gastaria tempo e a ordem das vendas se perderia. Erro de regra não trava a
 * fila — aquela venda fica marcada e as seguintes seguem.
 */
export async function flushOutbox() {
    const queue = await listQueued();
    if (queue.length === 0) return { sent: 0, pending: 0, blocked: 0 };

    const remaining = [];
    let sent = 0;
    let stopped = false;

    for (const entry of queue) {
        if (stopped || entry.blocked) {
            remaining.push(entry);
            continue;
        }

        try {
            const { error } = await supabase.rpc('create_sale', {
                p_items: entry.items,
                p_payments: entry.payments,
                p_discount: entry.discount,
                p_note: entry.note,
                p_customer_id: entry.customerId,
                p_client_uuid: entry.client_uuid,
                p_sold_at: entry.sold_at,
            });

            if (error) throw error;
            sent++;
        } catch (err) {
            if (isNetworkError(err)) {
                // Ainda sem conexão. Devolve esta e todas as seguintes.
                stopped = true;
                remaining.push({ ...entry, attempts: entry.attempts + 1 });
            } else {
                // O banco recusou: produto apagado, cliente removido, algo assim.
                // Insistir não resolve, e jogar fora esconderia dinheiro que
                // entrou. Fica marcada para aparecer na tela.
                console.error('Venda recusada pelo servidor:', err);
                remaining.push({
                    ...entry,
                    attempts: entry.attempts + 1,
                    blocked: true,
                    last_error: err?.message ?? 'Recusada pelo servidor',
                });
            }
        }
    }

    await write(remaining);

    return {
        sent,
        pending: remaining.filter((e) => !e.blocked).length,
        blocked: remaining.filter((e) => e.blocked).length,
    };
}

/** Desmarca uma venda travada para tentar de novo (depois de corrigir a causa). */
export async function retryBlocked(clientUuid) {
    const queue = await listQueued();
    await write(queue.map((e) => (
        e.client_uuid === clientUuid ? { ...e, blocked: false, last_error: null } : e
    )));
}

/**
 * Descarta uma venda travada. Existe porque o contrário — fila entupida para
 * sempre por uma venda que nunca vai entrar — é pior. Só o administrador
 * alcança este caminho na interface, e a confirmação mostra o valor.
 */
export async function discardQueued(clientUuid) {
    const queue = await listQueued();
    await write(queue.filter((e) => e.client_uuid !== clientUuid));
}
