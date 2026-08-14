import React from 'react';
import { Loader2, ChevronDown } from 'lucide-react';
import { Button } from '../atoms/Button';

/**
 * Rodapé de lista paginada.
 *
 * Diz sempre quanto já apareceu de quanto existe. Sem esse número, "carregar
 * mais" não informa se falta uma linha ou mil, e quem procura um produto
 * específico não sabe se vale continuar clicando ou se é melhor usar a busca.
 */
export function LoadMore({ carregados, total, temMais, carregando, onCarregarMais, nome = 'itens' }) {
    if (total === 0) return null;

    return (
        <div className="flex flex-col items-center gap-3 py-6 border-t border-gray-50">
            <p className="text-xs font-medium text-gray-400">
                {temMais
                    ? `${carregados.toLocaleString('pt-BR')} de ${total.toLocaleString('pt-BR')} ${nome}`
                    : `${total.toLocaleString('pt-BR')} ${nome}`}
            </p>

            {temMais && (
                <Button variant="outline" onClick={onCarregarMais} disabled={carregando}>
                    {carregando
                        ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        : <ChevronDown className="h-4 w-4 mr-2" />}
                    Carregar mais
                </Button>
            )}
        </div>
    );
}
