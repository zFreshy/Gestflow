import { useCallback, useState } from 'react';

/**
 * Mostra a lista aos poucos, sem mexer no que foi carregado.
 *
 * Serve para tela que precisa de **todas** as linhas para somar corretamente —
 * histórico de vendas, fiado em aberto — mas não pode montá-las todas de uma
 * vez. Travar não é culpa do volume de dados: mil vendas em JSON são uns
 * duzentos kilobytes, e o navegador engole isso sem piscar. O que ele não
 * engole é montar mil linhas de tabela ao mesmo tempo.
 *
 * Então o cálculo continua vendo tudo, e só a tela vê um pedaço. É o contrário
 * do `usePagedList`, que corta no banco — lá não há total para preservar, aqui
 * há, e um resumo que só conta o que está à vista mente.
 */
export function useVisibleSlice(rows, { pageSize = 50 } = {}) {
    const [visiveis, setVisiveis] = useState(pageSize);
    const [listaAnterior, setListaAnterior] = useState(rows);

    // Filtro novo, lista nova: volta ao começo, senão a pessoa filtra e continua
    // vendo a rolagem gigante da consulta anterior.
    //
    // O ajuste é feito durante o render, e não num efeito: é o padrão que o
    // React recomenda para "corrigir estado quando a entrada muda". Num efeito,
    // a tela chegaria a pintar uma vez com a contagem antiga antes de corrigir.
    if (rows !== listaAnterior) {
        setListaAnterior(rows);
        setVisiveis(pageSize);
    }

    const carregarMais = useCallback(
        () => setVisiveis((n) => n + pageSize),
        [pageSize],
    );

    return {
        visiveis: rows.slice(0, visiveis),
        temMais: rows.length > visiveis,
        carregarMais,
        mostrando: Math.min(visiveis, rows.length),
    };
}
