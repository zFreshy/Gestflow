import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Lista que carrega por partes, com botão de "carregar mais".
 *
 * Existe porque telas que traziam tudo de uma vez travavam o app quando o
 * cadastro cresceu: o problema não é o tamanho dos dados, é montar milhares de
 * linhas de tabela de uma vez só. Trazer 60 e deixar pedir mais resolve os dois
 * lados — menos dado na rede e menos nó na tela.
 *
 * `fetchPage({ limit, offset })` precisa devolver `{ rows, total }`. O total
 * vem do banco na mesma consulta, e é o que diz se ainda falta alguma coisa.
 *
 * Trocar filtro recomeça do zero: manter as linhas antigas misturaria dois
 * resultados diferentes na mesma lista.
 */
export function usePagedList(fetchPage, deps = [], { pageSize = 60 } = {}) {
    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState('');

    // Cada carga ganha um número. Se o filtro mudar enquanto uma resposta antiga
    // está a caminho, ela chega com número velho e é descartada — sem isso, uma
    // busca lenta sobrescreveria o resultado de uma busca mais nova.
    const geracao = useRef(0);

    const carregar = useCallback(async (offset) => {
        const minha = offset === 0 ? ++geracao.current : geracao.current;

        if (offset === 0) setLoading(true); else setLoadingMore(true);
        setError('');

        try {
            const resultado = await fetchPage({ limit: pageSize, offset });
            if (minha !== geracao.current) return;

            setRows((anteriores) => (
                offset === 0 ? resultado.rows : [...anteriores, ...resultado.rows]
            ));
            setTotal(resultado.total ?? 0);
        } catch (err) {
            if (minha !== geracao.current) return;
            console.error(err);
            setError('Não consegui carregar a lista.');
        } finally {
            if (minha === geracao.current) {
                setLoading(false);
                setLoadingMore(false);
            }
        }
    }, [fetchPage, pageSize]);

    // Recomeça sempre que um filtro muda.
    useEffect(() => {
        setRows([]);
        carregar(0);
        // As dependências são as do filtro, decididas por quem usa o hook.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps);

    const carregarMais = useCallback(() => {
        if (loadingMore || loading) return;
        carregar(rows.length);
    }, [carregar, rows.length, loading, loadingMore]);

    return {
        rows,
        total,
        loading,
        loadingMore,
        error,
        temMais: rows.length < total,
        carregarMais,
        recarregar: () => carregar(0),
    };
}
