import React, { useEffect, useState } from 'react';
import { UserPlus, Loader2, Check, X } from 'lucide-react';
import { Input } from '../atoms/Input';
import { Select } from '../atoms/Select';
import { Button } from '../atoms/Button';
import { listCustomers, createCustomer } from '../../services/mercadinhoService';

/**
 * Escolhe o cliente do fiado, com cadastro na hora.
 *
 * Cadastrar sem sair do caixa importa: sem isso, cliente novo no fiado obrigaria
 * a abandonar a venda no meio, e o atendente acabaria escolhendo outro nome
 * qualquer da lista só para conseguir fechar.
 */
export function CustomerPicker({ value, onChange, autoFocus = false }) {
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [newName, setNewName] = useState('');
    const [newPhone, setNewPhone] = useState('');

    const load = async () => {
        setLoading(true);
        try {
            setCustomers(await listCustomers());
        } catch (err) {
            console.error(err);
            setError('Não consegui carregar os clientes.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const handleCreate = async () => {
        const name = newName.trim();
        if (!name) { setError('Digite o nome do cliente.'); return; }

        setError('');
        setSaving(true);
        try {
            const created = await createCustomer({ name, phone: newPhone });
            setCustomers((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')));
            onChange(created.id);
            setCreating(false);
            setNewName('');
            setNewPhone('');
        } catch (err) {
            console.error(err);
            setError('Não consegui cadastrar o cliente.');
        } finally {
            setSaving(false);
        }
    };

    if (creating) {
        return (
            <div className="rounded-xl border-2 border-[#7E1A8B]/30 bg-[#7E1A8B]/[0.04] p-3 space-y-2">
                <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-gray-800">Novo cliente</span>
                    <button
                        type="button"
                        onClick={() => { setCreating(false); setError(''); }}
                        className="h-7 w-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-white hover:text-gray-600"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="flex gap-2">
                    <Input
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCreate(); } }}
                        placeholder="Nome *"
                        autoFocus
                    />
                    <Input
                        value={newPhone}
                        onChange={(e) => setNewPhone(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCreate(); } }}
                        placeholder="Telefone"
                        className="w-44"
                    />
                    <Button type="button" variant="brand" onClick={handleCreate} disabled={saving}>
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    </Button>
                </div>

                {error && <p className="text-xs font-medium text-red-600">{error}</p>}
            </div>
        );
    }

    return (
        <div className="space-y-1.5">
            <div className="flex gap-2">
                <div className="flex-1">
                    <Select
                        value={value ?? ''}
                        onChange={(e) => onChange(e.target.value || null)}
                        disabled={loading}
                        autoFocus={autoFocus}
                    >
                        <option value="">
                            {loading ? 'Carregando...' : 'Escolha o cliente'}
                        </option>
                        {customers.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.name}{c.phone ? ` — ${c.phone}` : ''}
                            </option>
                        ))}
                    </Select>
                </div>
                <Button
                    type="button"
                    variant="outline"
                    onClick={() => { setCreating(true); setError(''); }}
                    title="Cadastrar cliente novo"
                >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Novo
                </Button>
            </div>

            {error && <p className="text-xs font-medium text-red-600">{error}</p>}
        </div>
    );
}
