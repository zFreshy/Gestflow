import React, { useMemo, useRef, useState } from 'react';
import {
    Upload, X, Loader2, FileSpreadsheet, AlertTriangle, CheckCircle2, ArrowRight,
} from 'lucide-react';
import { Button } from '../atoms/Button';
import { Select } from '../atoms/Select';
import { Badge } from '../atoms/Badge';
import { cn, formatCurrency } from '../../lib/utils';
import { parseCsv, parseNumber, guessMapping } from '../../lib/csv';
import { importProducts } from '../../services/mercadinhoService';

const FIELDS = [
    { key: 'barcode', label: 'Código de barras', required: false },
    { key: 'name', label: 'Nome do produto', required: true },
    { key: 'sale_price', label: 'Preço de venda', required: false },
    { key: 'cost_price', label: 'Preço de custo', required: false },
    { key: 'stock_quantity', label: 'Estoque atual', required: false },
    { key: 'unit', label: 'Unidade', required: false },
    { key: 'category', label: 'Categoria', required: false },
];

/**
 * Lê o arquivo como UTF-8 e, se aparecer o caractere de substituição (sinal de
 * que não era UTF-8), relê como Windows-1252. Exportação de sistema antigo
 * brasileiro quase sempre vem em Latin-1, e sem isso todo acento vira lixo.
 */
async function readTextSmart(file) {
    const buffer = await file.arrayBuffer();

    const utf8 = new TextDecoder('utf-8').decode(buffer);
    if (!utf8.includes('�')) return utf8;

    return new TextDecoder('windows-1252').decode(buffer);
}

export function ImportProductsModal({ isOpen, onClose, onImported }) {
    const [step, setStep] = useState('pick'); // pick | map | done
    const [fileName, setFileName] = useState('');
    const [headers, setHeaders] = useState([]);
    const [rows, setRows] = useState([]);
    const [mapping, setMapping] = useState({});
    const [updateExisting, setUpdateExisting] = useState(true);
    const [importStock, setImportStock] = useState(true);
    const [importing, setImporting] = useState(false);
    const [error, setError] = useState('');
    const [result, setResult] = useState(null);

    const inputRef = useRef(null);

    const reset = () => {
        setStep('pick');
        setFileName('');
        setHeaders([]);
        setRows([]);
        setMapping({});
        setImporting(false);
        setError('');
        setResult(null);
    };

    const handleClose = () => {
        reset();
        onClose?.();
    };

    const handleFile = async (file) => {
        if (!file) return;
        setError('');

        // O arquivo vira uma string única na memória, e o JavaScript não guarda
        // string maior que 512 MB — nem o computador ajuda, é limite do motor.
        // Sem esta checagem a leitura estourava e a tela dizia "precisa estar
        // salvo como CSV", mandando conferir um formato que estava certo.
        //
        // O limite aqui é bem menor de propósito: catálogo de mercadinho com
        // 50 mil itens dá uns 5 MB. Passou de 80, ou o arquivo não é um
        // catálogo, ou vai travar o app antes de terminar.
        const MAX_MB = 80;
        if (file.size > MAX_MB * 1024 * 1024) {
            const gb = file.size / 1024 / 1024 / 1024;
            const tamanho = gb >= 1
                ? `${gb.toFixed(1).replace('.', ',')} GB`
                : `${Math.round(file.size / 1024 / 1024)} MB`;

            setError(
                `Esse arquivo tem ${tamanho} e não cabe na memória do app (o limite é ${MAX_MB} MB). `
                + 'Bases públicas de produtos, como a do Open Food Facts, têm milhões de itens '
                + 'do mundo todo e nenhum preço — não servem como catálogo de loja. '
                + 'Para não digitar tudo: cadastre o produto normalmente e o nome é '
                + 'preenchido sozinho a partir do código de barras.'
            );
            return;
        }

        try {
            const text = await readTextSmart(file);
            const parsed = parseCsv(text);

            if (parsed.length < 2) {
                setError('O arquivo precisa ter uma linha de cabeçalho e pelo menos um produto.');
                return;
            }

            const [head, ...body] = parsed;
            setFileName(file.name);
            setHeaders(head);
            setRows(body);
            setMapping(guessMapping(head));
            setStep('map');
        } catch (err) {
            console.error(err);
            setError('Não consegui ler esse arquivo. Ele precisa estar salvo como CSV.');
        }
    };

    // Converte as linhas cruas usando o mapeamento escolhido.
    const preview = useMemo(() => {
        if (step !== 'map') return [];

        const pick = (row, field) => {
            const idx = mapping[field];
            return idx === null || idx === undefined ? '' : (row[idx] ?? '').trim();
        };

        return rows.map((row) => ({
            barcode: pick(row, 'barcode') || null,
            name: pick(row, 'name'),
            sale_price: parseNumber(pick(row, 'sale_price')),
            cost_price: parseNumber(pick(row, 'cost_price')),
            stock_quantity: parseNumber(pick(row, 'stock_quantity')),
            unit: pick(row, 'unit').toLowerCase() || 'un',
            category: pick(row, 'category') || null,
        }));
    }, [rows, mapping, step]);

    // Sem nome não dá para cadastrar; essas linhas são puladas.
    const validRows = useMemo(() => preview.filter((p) => p.name), [preview]);
    const skipped = preview.length - validRows.length;

    const handleImport = async () => {
        setError('');
        setImporting(true);

        try {
            const res = await importProducts(validRows, { updateExisting, importStock });
            setResult(res);
            setStep('done');
            onImported?.();
        } catch (err) {
            console.error(err);
            setError('Falha ao importar. Nada foi gravado pela metade — pode tentar de novo.');
        } finally {
            setImporting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={importing ? undefined : handleClose}>
            <div
                className="modal-content bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-[#7E1A8B]/10 flex items-center justify-center">
                            <FileSpreadsheet className="h-5 w-5 text-[#7E1A8B]" />
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-900">Importar produtos de planilha</h3>
                            <p className="text-xs text-gray-500">
                                {fileName || 'Traga a lista de produtos do sistema antigo'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleClose}
                        disabled={importing}
                        className="h-9 w-9 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors disabled:opacity-40"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-5">
                    {error && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm font-medium border border-red-100 flex items-start gap-2">
                            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /> {error}
                        </div>
                    )}

                    {/* Passo 1: escolher o arquivo */}
                    {step === 'pick' && (
                        <>
                            <button
                                onClick={() => inputRef.current?.click()}
                                className="w-full rounded-2xl border-2 border-dashed border-gray-200 hover:border-[#7E1A8B] hover:bg-[#7E1A8B]/[0.03] transition-all py-14 flex flex-col items-center gap-3"
                            >
                                <div className="h-14 w-14 rounded-2xl bg-gray-50 flex items-center justify-center">
                                    <Upload className="h-6 w-6 text-gray-400" />
                                </div>
                                <div className="text-center">
                                    <p className="font-semibold text-gray-700">Escolher arquivo CSV</p>
                                    <p className="text-sm text-gray-400 mt-0.5">
                                        No Excel: Arquivo → Salvar como → CSV
                                    </p>
                                </div>
                            </button>

                            <input
                                ref={inputRef}
                                type="file"
                                accept=".csv,text/csv,text/plain"
                                className="hidden"
                                onChange={(e) => handleFile(e.target.files?.[0])}
                            />

                            <div className="rounded-xl bg-gray-50 p-4 text-sm text-gray-600 space-y-1.5">
                                <p className="font-semibold text-gray-700">O que o arquivo precisa ter</p>
                                <p>
                                    Uma linha de cabeçalho e uma coluna com o nome do produto. Todo o
                                    resto é opcional — código de barras, preços, estoque, categoria.
                                </p>
                                <p className="text-gray-500">
                                    Os nomes das colunas são reconhecidos sozinhos, e dá para corrigir
                                    na tela seguinte se algum sair errado.
                                </p>
                            </div>
                        </>
                    )}

                    {/* Passo 2: conferir o mapeamento */}
                    {step === 'map' && (
                        <>
                            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                                {FIELDS.map((field) => (
                                    <div key={field.key} className="space-y-1.5">
                                        <label className="text-sm font-semibold text-gray-700">
                                            {field.label}
                                            {field.required && <span className="text-red-500 ml-1">*</span>}
                                        </label>
                                        <Select
                                            value={mapping[field.key] ?? ''}
                                            onChange={(e) => setMapping((m) => ({
                                                ...m,
                                                [field.key]: e.target.value === '' ? null : Number(e.target.value),
                                            }))}
                                        >
                                            <option value="">— não importar —</option>
                                            {headers.map((h, i) => (
                                                <option key={i} value={i}>{h || `Coluna ${i + 1}`}</option>
                                            ))}
                                        </Select>
                                    </div>
                                ))}
                            </div>

                            <div className="h-px bg-gray-100" />

                            {/* Prévia */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="font-bold text-gray-900">
                                        Prévia
                                        <span className="ml-2 text-sm font-normal text-gray-400">
                                            {validRows.length} de {preview.length} linhas
                                        </span>
                                    </h4>
                                    {skipped > 0 && (
                                        <Badge variant="warning">
                                            {skipped} sem nome {skipped === 1 ? 'será ignorada' : 'serão ignoradas'}
                                        </Badge>
                                    )}
                                </div>

                                <div className="rounded-xl border border-gray-200 overflow-hidden">
                                    <table className="w-full">
                                        <thead className="bg-gray-50">
                                            <tr className="text-[11px] uppercase tracking-wide text-gray-500">
                                                <th className="text-left font-bold px-4 py-2">Produto</th>
                                                <th className="text-left font-bold px-3 py-2 w-36">Código</th>
                                                <th className="text-right font-bold px-3 py-2 w-24">Custo</th>
                                                <th className="text-right font-bold px-3 py-2 w-24">Venda</th>
                                                <th className="text-right font-bold px-3 py-2 w-20">Estoque</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {validRows.slice(0, 6).map((p, i) => (
                                                <tr key={i} className="border-t border-gray-100">
                                                    <td className="px-4 py-2 text-sm font-medium text-gray-900 truncate max-w-0">
                                                        {p.name}
                                                    </td>
                                                    <td className="px-3 py-2 text-xs font-mono text-gray-500">
                                                        {p.barcode || '—'}
                                                    </td>
                                                    <td className="px-3 py-2 text-right text-sm text-gray-600">
                                                        {formatCurrency(p.cost_price)}
                                                    </td>
                                                    <td className="px-3 py-2 text-right text-sm font-semibold text-gray-900">
                                                        {formatCurrency(p.sale_price)}
                                                    </td>
                                                    <td className="px-3 py-2 text-right text-sm text-gray-600">
                                                        {p.stock_quantity} {p.unit}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {validRows.length > 6 && (
                                        <div className="px-4 py-2 bg-gray-50 text-xs text-gray-500 border-t border-gray-100">
                                            e mais {validRows.length - 6} produtos
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="flex items-start gap-3 rounded-xl bg-gray-50 p-4 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={updateExisting}
                                        onChange={(e) => setUpdateExisting(e.target.checked)}
                                        className="h-4 w-4 mt-0.5 rounded border-gray-300 accent-[#7E1A8B]"
                                    />
                                    <span className="text-sm text-gray-600">
                                        <span className="font-semibold text-gray-800">
                                            Atualizar produtos que já existem
                                        </span>
                                        <br />
                                        Produtos com o mesmo código de barras têm nome e preços
                                        atualizados. Desmarcado, eles são pulados.
                                    </span>
                                </label>

                                <label className={cn(
                                    "flex items-start gap-3 rounded-xl p-4 cursor-pointer select-none",
                                    mapping.stock_quantity === null || mapping.stock_quantity === undefined
                                        ? "bg-gray-50 opacity-50 cursor-not-allowed"
                                        : "bg-gray-50"
                                )}>
                                    <input
                                        type="checkbox"
                                        checked={importStock}
                                        disabled={mapping.stock_quantity === null || mapping.stock_quantity === undefined}
                                        onChange={(e) => setImportStock(e.target.checked)}
                                        className="h-4 w-4 mt-0.5 rounded border-gray-300 accent-[#7E1A8B]"
                                    />
                                    <span className="text-sm text-gray-600">
                                        <span className="font-semibold text-gray-800">
                                            Trazer o estoque atual da planilha
                                        </span>
                                        <br />
                                        Grava o saldo da planilha como estoque inicial. Só vale para
                                        produtos novos.
                                        <br />
                                        <span className="text-gray-400">
                                            Em produto que já existe aqui o estoque nunca é tocado — senão
                                            reimportar o mesmo arquivo apagaria as vendas registradas depois.
                                        </span>
                                    </span>
                                </label>
                            </div>
                        </>
                    )}

                    {/* Passo 3: resultado */}
                    {step === 'done' && result && (
                        <div className="py-8 flex flex-col items-center text-center">
                            <div className="h-16 w-16 rounded-2xl bg-emerald-50 flex items-center justify-center mb-4">
                                <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                            </div>
                            <h4 className="text-lg font-bold text-gray-900">Importação concluída</h4>

                            <div className="flex gap-8 mt-6">
                                <div>
                                    <p className="text-3xl font-extrabold text-emerald-600">{result.inserted}</p>
                                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-1">
                                        cadastrados
                                    </p>
                                </div>
                                <div>
                                    <p className="text-3xl font-extrabold text-blue-600">{result.updated}</p>
                                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-1">
                                        atualizados
                                    </p>
                                </div>
                                <div>
                                    <p className="text-3xl font-extrabold text-gray-400">{result.skipped}</p>
                                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-1">
                                        pulados
                                    </p>
                                </div>
                            </div>

                            {result.inserted > 0 && (
                                <p className="text-sm text-gray-500 mt-6 max-w-md">
                                    {importStock
                                        ? 'Confira o estoque na tela de Produtos e ajuste o que estiver diferente da prateleira.'
                                        : 'Os produtos entraram com estoque zero. Use a tela de Estoque para dar entrada nas quantidades reais.'}
                                </p>
                            )}
                        </div>
                    )}
                </div>

                {/* Rodapé */}
                <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
                    {step === 'map' && (
                        <>
                            <Button variant="outline" onClick={reset} disabled={importing}>
                                Trocar arquivo
                            </Button>
                            <Button
                                variant="brand"
                                onClick={handleImport}
                                disabled={importing || validRows.length === 0}
                            >
                                {importing
                                    ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    : <ArrowRight className="h-4 w-4 mr-2" />}
                                Importar {validRows.length} produtos
                            </Button>
                        </>
                    )}
                    {step !== 'map' && (
                        <Button variant={step === 'done' ? 'brand' : 'outline'} onClick={handleClose}>
                            {step === 'done' ? 'Pronto' : 'Cancelar'}
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}
