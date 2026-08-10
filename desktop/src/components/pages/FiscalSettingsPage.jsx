import React, { useEffect, useState } from 'react';
import { FileText, Loader2, Check, AlertTriangle, ShieldCheck } from 'lucide-react';
import { Button } from '../atoms/Button';
import { Input } from '../atoms/Input';
import { Select } from '../atoms/Select';
import { getFiscalSettings, updateFiscalSettings } from '../../services/mercadinhoService';
import { useReceipt } from '../../contexts/ReceiptContext';

/**
 * Dados que vão na nota fiscal.
 *
 * O que NÃO está aqui, de propósito: o token do emissor e o certificado
 * digital. Os dois assinam nota em nome da loja, e este app roda na máquina do
 * balcão — qualquer campo de senha nesta tela guardaria o segredo num lugar de
 * onde ele pode ser lido. Eles vivem no servidor, e são configurados uma vez
 * pelo terminal (ver o cabeçalho da função `emit-nfce`).
 */
const FIELDS = [
    { key: 'cnpj', label: 'CNPJ', required: true, placeholder: '00.000.000/0001-00' },
    { key: 'inscricao_estadual', label: 'Inscrição estadual', required: true },
    { key: 'razao_social', label: 'Razão social', required: true, wide: true },
    { key: 'nome_fantasia', label: 'Nome fantasia', wide: true },
    { key: 'logradouro', label: 'Logradouro', required: true, wide: true },
    { key: 'numero', label: 'Número', required: true },
    { key: 'bairro', label: 'Bairro', required: true },
    { key: 'municipio', label: 'Município', required: true },
    {
        key: 'codigo_municipio', label: 'Código IBGE do município', required: true,
        hint: '7 dígitos — procure por "código IBGE" mais o nome da cidade',
    },
    { key: 'uf', label: 'UF', required: true, placeholder: 'SP' },
    { key: 'cep', label: 'CEP', required: true },
    { key: 'telefone', label: 'Telefone' },
];

const DEFAULTS = [
    {
        key: 'ncm_padrao', label: 'NCM padrão',
        hint: 'Usado no produto que não tem NCM próprio',
    },
    { key: 'cfop_padrao', label: 'CFOP padrão', hint: '5102 é venda dentro do estado' },
    { key: 'csosn_padrao', label: 'CSOSN padrão', hint: 'Simples Nacional' },
    { key: 'cst_padrao', label: 'CST padrão', hint: 'Regime normal' },
];

export function FiscalSettingsPage() {
    const { forgetStore } = useReceipt();
    const [form, setForm] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        getFiscalSettings()
            .then((data) => setForm(data ?? {}))
            .catch((err) => {
                console.error(err);
                setError('Não consegui carregar a configuração fiscal.');
            })
            .finally(() => setLoading(false));
    }, []);

    const set = (key, value) => {
        setForm((prev) => ({ ...prev, [key]: value }));
        setSaved(false);
    };

    const missing = form
        ? FIELDS.filter((f) => f.required && !String(form[f.key] ?? '').trim())
        : [];

    const handleSave = async () => {
        setError('');
        setSaving(true);
        try {
            // `id` e `updated_at` não vão no update: um é a chave da linha e o
            // outro é carimbado pelo serviço.
            const changes = Object.fromEntries(
                Object.entries(form).filter(([key]) => key !== 'id' && key !== 'updated_at')
            );
            await updateFiscalSettings(changes);
            // O cupom guarda os dados da loja em memória para não ir ao
            // servidor a cada venda; depois de editar aqui, essa cópia mente.
            forgetStore();
            setSaved(true);
        } catch (err) {
            console.error(err);
            setError(err?.message ?? 'Não consegui salvar.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="p-16 flex items-center justify-center text-gray-400">
                <Loader2 className="h-6 w-6 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-4xl">
            <div>
                <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Nota fiscal</h1>
                <p className="text-sm text-gray-500 mt-0.5">
                    Dados do emitente usados na NFC-e e no cupom impresso
                </p>
            </div>

            {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm font-medium border border-red-100">
                    {error}
                </div>
            )}

            {/* Liga/desliga + ambiente */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
                <label className="flex items-start gap-3 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={Boolean(form.enabled)}
                        onChange={(e) => set('enabled', e.target.checked)}
                        className="h-5 w-5 mt-0.5 rounded border-gray-300 accent-[#7E1A8B]"
                    />
                    <div>
                        <p className="font-semibold text-gray-900">Emitir nota fiscal</p>
                        <p className="text-sm text-gray-500">
                            Com isto desligado o PDV continua vendendo e imprimindo o
                            comprovante — só o botão de emitir nota fica indisponível.
                        </p>
                    </div>
                </label>

                <div className="grid grid-cols-2 gap-5">
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-700">Ambiente</label>
                        <Select
                            value={form.environment ?? 'homologacao'}
                            onChange={(e) => set('environment', e.target.value)}
                        >
                            <option value="homologacao">Homologação (teste, sem valor fiscal)</option>
                            <option value="producao">Produção (nota vale de verdade)</option>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-700">Regime tributário</label>
                        <Select
                            value={form.regime_tributario ?? 'simples'}
                            onChange={(e) => set('regime_tributario', e.target.value)}
                        >
                            <option value="simples">Simples Nacional</option>
                            <option value="simples_excesso">Simples Nacional — excesso de receita</option>
                            <option value="normal">Regime normal</option>
                        </Select>
                    </div>
                </div>

                {form.environment === 'homologacao' && form.enabled && (
                    <div className="bg-amber-50 border border-amber-100 text-amber-800 p-3 rounded-xl text-sm flex gap-2">
                        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                        <span>
                            Em homologação as notas saem com o aviso "SEM VALOR FISCAL"
                            impresso. Troque para produção quando estiver tudo conferido.
                        </span>
                    </div>
                )}
            </div>

            {/* Emitente */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-[#7E1A8B]/10 flex items-center justify-center">
                        <FileText className="h-5 w-5 text-[#7E1A8B]" />
                    </div>
                    <h2 className="font-bold text-gray-900">Dados da loja</h2>
                </div>

                <div className="grid grid-cols-2 gap-5">
                    {FIELDS.map((field) => (
                        <div key={field.key} className={field.wide ? 'col-span-2 space-y-2' : 'space-y-2'}>
                            <label className="text-sm font-semibold text-gray-700">
                                {field.label} {field.required && <span className="text-red-500">*</span>}
                            </label>
                            <Input
                                value={form[field.key] ?? ''}
                                onChange={(e) => set(field.key, e.target.value)}
                                placeholder={field.placeholder}
                            />
                            {field.hint && <p className="text-xs text-gray-400">{field.hint}</p>}
                        </div>
                    ))}

                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-700">Série da NFC-e</label>
                        <Input
                            type="number" min="1"
                            value={form.serie ?? 1}
                            onChange={(e) => set('serie', Number(e.target.value) || 1)}
                        />
                    </div>
                </div>
            </div>

            {/* Padrões fiscais dos produtos */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
                <div>
                    <h2 className="font-bold text-gray-900">Padrões dos produtos</h2>
                    <p className="text-sm text-gray-500 mt-0.5">
                        Valem para o produto que não tiver classificação própria — sem
                        isso, cada item do mercadinho teria que ser classificado à mão
                        antes da primeira nota sair.
                    </p>
                </div>

                <div className="grid grid-cols-4 gap-4">
                    {DEFAULTS.map((field) => (
                        <div key={field.key} className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700">{field.label}</label>
                            <Input
                                value={form[field.key] ?? ''}
                                onChange={(e) => set(field.key, e.target.value)}
                            />
                            <p className="text-xs text-gray-400">{field.hint}</p>
                        </div>
                    ))}
                </div>

                <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 flex gap-3">
                    <ShieldCheck className="h-5 w-5 text-gray-400 shrink-0 mt-0.5" />
                    <div className="text-sm text-gray-600 space-y-1">
                        <p className="font-semibold text-gray-700">
                            O certificado digital e o token do emissor não ficam aqui.
                        </p>
                        <p>
                            Eles assinam nota em nome da loja e este app roda no balcão —
                            guardá-los na máquina seria entregá-los a quem abrisse o
                            programa. Ficam no servidor, configurados uma vez com o comando{' '}
                            <code className="bg-white px-1.5 py-0.5 rounded border border-gray-200 text-xs">
                                supabase secrets set FOCUS_NFE_TOKEN=...
                            </code>
                        </p>
                    </div>
                </div>
            </div>

            {/* Salvar */}
            <div className="sticky bottom-0 bg-white/90 backdrop-blur border border-gray-100 rounded-2xl shadow-sm p-4 flex items-center justify-between">
                <div className="text-sm">
                    {missing.length > 0 ? (
                        <span className="text-amber-700 font-medium">
                            Faltam para emitir: {missing.map((f) => f.label).join(', ')}
                        </span>
                    ) : saved ? (
                        <span className="text-emerald-700 font-semibold flex items-center gap-1.5">
                            <Check className="h-4 w-4" /> Salvo
                        </span>
                    ) : (
                        <span className="text-gray-400">Tudo preenchido</span>
                    )}
                </div>

                <Button variant="brand" size="lg" onClick={handleSave} disabled={saving}>
                    {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Salvar
                </Button>
            </div>
        </div>
    );
}
