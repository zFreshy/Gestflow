import React, { useEffect, useState } from 'react';
import { UserPlus, X, Loader2 } from 'lucide-react';
import { Button } from '../atoms/Button';
import { Input } from '../atoms/Input';
import { createCustomer, updateCustomer } from '../../services/mercadinhoService';

export function CustomerFormModal({ isOpen, onClose, onSaved, customer = null }) {
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [note, setNote] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const isEditing = Boolean(customer);

    useEffect(() => {
        if (!isOpen) return;
        setName(customer?.name ?? '');
        setPhone(customer?.phone ?? '');
        setNote(customer?.note ?? '');
        setError('');
    }, [isOpen, customer]);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!name.trim()) {
            setError('O nome é obrigatório.');
            return;
        }

        setError('');
        setSaving(true);
        try {
            if (isEditing) {
                await updateCustomer(customer.id, {
                    name: name.trim(),
                    phone: phone.trim() || null,
                    note: note.trim() || null,
                });
            } else {
                await createCustomer({ name, phone, note });
            }
            onSaved?.();
            onClose?.();
        } catch (err) {
            console.error(err);
            setError('Não consegui salvar o cliente.');
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={saving ? undefined : onClose}>
            <div
                className="modal-content bg-white rounded-2xl shadow-2xl w-full max-w-md"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-[#7E1A8B]/10 flex items-center justify-center">
                            <UserPlus className="h-5 w-5 text-[#7E1A8B]" />
                        </div>
                        <h3 className="font-bold text-gray-900">
                            {isEditing ? 'Editar cliente' : 'Novo cliente'}
                        </h3>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={saving}
                        className="h-9 w-9 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors disabled:opacity-40"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {error && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm font-medium border border-red-100">
                            {error}
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-700">Nome *</label>
                        <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Ex.: João da Silva"
                            autoFocus
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-700">Telefone</label>
                        <Input
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="(81) 99999-0000"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-700">Observação</label>
                        <Input
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="Opcional — endereço, referência..."
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-1">
                        <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
                            Cancelar
                        </Button>
                        <Button type="submit" variant="brand" disabled={saving}>
                            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                            {isEditing ? 'Salvar' : 'Cadastrar'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
