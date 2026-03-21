import React, { useState, useRef } from 'react';
import { TransactionList } from '../organisms/TransactionList';
import { MonthSelector } from '../molecules/MonthSelector';
import { cn } from '../../lib/utils';
import { Upload, Save, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

export function TransactionsPage({ transactions, onEdit, onDelete, onImportSuccess }) {
    const { user } = useAuth();
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [viewMode, setViewMode] = useState('month'); // 'month' | 'year'
    const [importedTransactions, setImportedTransactions] = useState([]);
    const [isSaving, setIsSaving] = useState(false);
    const fileInputRef = useRef(null);

    // Filter transactions by selected month or year
    const allTransactions = [...importedTransactions, ...transactions];
    
    const filteredTransactions = allTransactions.filter(t => {
        if (!t.date) return false;
        // Parse DD/MM/YYYY
        const [day, month, year] = t.date.split('/');
        const tDate = new Date(year, month - 1, day);
        
        const sameYear = tDate.getFullYear() === currentMonth.getFullYear();

        if (viewMode === 'year') {
            return sameYear;
        }

        return sameYear && tDate.getMonth() === currentMonth.getMonth();
    });

    const handleFileUpload = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        
        reader.onload = (e) => {
            const content = e.target.result;
            
            // O XML do FastReport separa os elementos visualmente em "bandas" (TfrxNullBand).
            // Analisando o trecho enviado, vemos que:
            // 1. As DATAS estão agrupadas em uma banda separada:
            // <TfrxNullBand ...><m32 l="0" t="0" u="01/02/2026"/><m32 l="0" t="19" u="02/02/2026"/>...
            // 2. Os VALORES de cada dia estão agrupados em bandas subsequentes (uma banda por dia):
            // <TfrxNullBand ...><m18 ... u="384,49"/>...<m22 l="612" t="0" u="1.118,88"/></TfrxNullBand>
            // O Sub-Total é SEMPRE a última tag <m22> (ou a tag com o maior 'l' / left) dentro da banda daquela linha.

            const newTransactions = [];
            
            // LOG DO CONTEÚDO XML PARA ANÁLISE COMPLETA
            console.log("=== INÍCIO DO CONTEÚDO XML ===");
            console.log(content);
            console.log("=== FIM DO CONTEÚDO XML ===");
            
            // Revertendo temporariamente para uma leitura super simples só para ver as datas e os blocos
            // Vamos apenas logar para você me mandar o print ou copiar o texto
            
            // Tenta encontrar o período do relatório para filtrar datas extras (como a data de geração do cabeçalho)
            let startDate = null;
            let endDate = null;
            const periodMatch = content.match(/(\d{2}\/\d{2}\/\d{4})\s*(?:a|até|ate|-|à)\s*(\d{2}\/\d{2}\/\d{4})/i);
            if (periodMatch) {
                const parseDate = (d) => { 
                    const [day, month, year] = d.split('/'); 
                    return new Date(year, month - 1, day).getTime(); 
                };
                startDate = parseDate(periodMatch[1]);
                endDate = parseDate(periodMatch[2]);
            }

            // Passo 1: Extrair todas as datas ordenadas da banda de datas (t=0, t=19, t=38...)
            const dateRegex = /<m32 l="0" t="\d+" u="(\d{2}\/\d{2}\/\d{4})"\/>/g;
            const dates = [];
            let dateMatch;
            while ((dateMatch = dateRegex.exec(content)) !== null) {
                const dateStr = dateMatch[1];
                if (!dates.includes(dateStr)) {
                    let isValid = true;
                    if (startDate && endDate) {
                        const [day, month, year] = dateStr.split('/');
                        const dTime = new Date(year, month - 1, day).getTime();
                        if (dTime < startDate || dTime > endDate) {
                            isValid = false;
                        }
                    }
                    if (isValid) {
                        dates.push(dateStr);
                    }
                }
            }

            // Mapeamento EXATO das colunas baseado no XML fornecido:
            // <m26 l="0" t="41" u="Dinheiro"/> -> L=0 (Mas os valores <m18> estão em L=87)
            // <m26 l="75" t="41" u="Cartão de Crédito"/> -> L=75 (Valores em L=162)
            // <m26 l="150" t="41" u="Cartão de Débito"/> -> L=150 (Valores em L=237)
            // <m26 l="225" t="41" u="Crédito Loja(fiado)"/> -> L=225 (Valores em L=312)
            // <m26 l="300" t="41" u="Vale Alimentação"/> -> L=300 (Valores em L=387)
            // <m26 l="375" t="41" u="Vale Combustível"/> -> L=375 (Valores em L=462)
            // <m26 l="450" t="41" u="PIX-Estático"/> -> L=450 (Valores em L=537)
            
            // Note que o L dos VALORES (tag m18) é sempre L_DO_CABEÇALHO + 87.
            // Exemplo: Cabeçalho Dinheiro = L:0 -> Valor Dinheiro = L:87.
            // Cabeçalho Cartão de Crédito = L:75 -> Valor Cartão = 75 + 87 = L:162.
            // Cabeçalho PIX = L:450 -> Valor PIX = 450 + 87 = L:537.
            
            // Portanto, podemos mapear EXATAMENTE as posições "L" que a tag <m18> terá para cada método de pagamento!
            const positionToMethodMap = {
                87: 'Dinheiro',
                162: 'Cartão de Crédito',
                237: 'Cartão de Débito',
                312: 'Crédito Loja (fiado)',
                387: 'Vale Alimentação',
                462: 'Vale Combustível',
                537: 'PIX',
            };

            // Passo 3: Extrair os valores das bandas <TfrxNullBand Height="19"...>
            // Separamos por essas bandas, pulando a primeira que é apenas o cabeçalho "Data"
            const rowBands = content.split('<TfrxNullBand Height="19"');
            const dataRows = rowBands.slice(1);
            
            // O número de linhas de dados (excluindo a linha de "TOTAL" geral, se houver) deve bater com as datas
            for (let i = 0; i < dataRows.length && i < dates.length; i++) {
                const rowContent = dataRows[i];
                
                // Dentro da linha, pegamos APENAS as tags <m18 ...> que são as de valores individuais.
                // A tag de sub-total é a <m22 l="612"...>, então não vamos nem capturá-la!
                const valueRegex = /<m18 l="(\d+)"[^>]*u="([\d.]+,\d{2})"\/>/g;
                let valueMatch;
                
                while ((valueMatch = valueRegex.exec(rowContent)) !== null) {
                    const lPos = parseInt(valueMatch[1], 10);
                    const valStr = valueMatch[2];
                    
                    const amountStr = valStr.replace(/\./g, '').replace(',', '.');
                    const amount = parseFloat(amountStr);
                    
                    if (!isNaN(amount) && amount > 0) {
                        // Encontra o método de pagamento baseado no L exato
                        // Usamos uma margem de tolerância pequena caso o gerador de relatórios mova 1 ou 2 pixels
                        let method = 'Diversos';
                        for (const [pos, methodName] of Object.entries(positionToMethodMap)) {
                            if (Math.abs(lPos - parseInt(pos, 10)) <= 5) {
                                method = methodName;
                                break;
                            }
                        }
                        
                        newTransactions.push({
                            id: `imported-${Date.now()}-${i}-${lPos}`,
                            description: `Vendas do dia (${method})`,
                            amount: amount,
                            type: 'income',
                            date: dates[i],
                            status: 'Pago',
                            expenseType: 'variable',
                            paymentMethod: method,
                            isImported: true
                        });
                    }
                }
            }
            
            if (newTransactions.length > 0) {
                setImportedTransactions(prev => [...newTransactions, ...prev]);
                alert(`Sucesso! ${newTransactions.length} transações (Receitas Diárias) importadas temporariamente para visualização.`);
            } else {
                alert('Não foi possível identificar os valores corretamente. Verifique se o arquivo segue o padrão de "PAGAMENTOS AGRUPADO POR DATA".');
                console.log("Datas encontradas:", dates);
                console.log("Linhas de dados encontradas:", dataRows.length);
            }
        };

        reader.readAsText(file);
        event.target.value = null;
    };

    const handleSaveImport = async () => {
        if (importedTransactions.length === 0) return;
        setIsSaving(true);
        try {
            const transactionsToSave = importedTransactions.map(t => {
                const [day, month, year] = t.date.split('/');
                const formattedDate = `${year}-${month}-${day}`;
                
                return {
                    description: t.description,
                    amount: t.amount,
                    type: t.type,
                    payment_method: t.paymentMethod,
                    date: formattedDate,
                    status: t.status,
                    expense_type: t.expenseType,
                    user_id: user.id
                };
            });

            const { error } = await supabase
                .from('transactions')
                .insert(transactionsToSave);

            if (error) throw error;

            alert('Importação salva com sucesso!');
            setImportedTransactions([]);
            if (onImportSuccess) onImportSuccess();
        } catch (error) {
            console.error('Erro ao salvar importação:', error);
            alert('Erro ao salvar transações importadas.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancelImport = () => {
        setImportedTransactions([]);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Transações</h2>
                    <p className="text-sm text-gray-500 mt-1">Gerencie todos os seus registros financeiros.</p>
                </div>
                
                <div className="flex items-center gap-2">
                    <input 
                        type="file" 
                        accept=".fp3" 
                        className="hidden" 
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                    />

                    {importedTransactions.length > 0 && (
                        <>
                            <button
                                onClick={handleSaveImport}
                                disabled={isSaving}
                                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white hover:bg-green-700 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                            >
                                <Save className="h-4 w-4" />
                                {isSaving ? 'Salvando...' : `Salvar (${importedTransactions.length})`}
                            </button>
                            <button
                                onClick={handleCancelImport}
                                disabled={isSaving}
                                className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 hover:bg-red-200 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                            >
                                <X className="h-4 w-4" />
                                Cancelar
                            </button>
                        </>
                    )}

                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 hover:bg-purple-200 rounded-lg text-sm font-semibold transition-colors"
                    >
                        <Upload className="h-4 w-4" />
                        Importar .FP3
                    </button>

                    <div className="bg-gray-100 p-1 rounded-lg flex items-center ml-2">
                        <button
                            onClick={() => setViewMode('month')}
                            className={cn(
                                "px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                                viewMode === 'month' 
                                    ? "bg-white text-gray-900 shadow-sm" 
                                    : "text-gray-500 hover:text-gray-900"
                            )}
                        >
                            Mensal
                        </button>
                        <button
                            onClick={() => setViewMode('year')}
                            className={cn(
                                "px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                                viewMode === 'year' 
                                    ? "bg-white text-gray-900 shadow-sm" 
                                    : "text-gray-500 hover:text-gray-900"
                            )}
                        >
                            Anual
                        </button>
                    </div>
                    <MonthSelector currentDate={currentMonth} onMonthChange={setCurrentMonth} viewMode={viewMode} />
                </div>
            </div>

            {/* Transactions Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <TransactionList 
                    transactions={filteredTransactions} 
                    onEdit={onEdit} 
                    onDelete={onDelete}
                    viewMode={viewMode}
                />
            </div>
        </div>
    );
}
