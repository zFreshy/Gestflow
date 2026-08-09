import React, { useEffect, useState } from 'react';
import {
    Users, UserPlus, Loader2, Trash2, Pencil, ShieldCheck, Check, X,
} from 'lucide-react';
import { Button } from '../atoms/Button';
import { Input } from '../atoms/Input';
import { Badge } from '../atoms/Badge';
import { Avatar } from '../atoms/Avatar';
import { cn, formatDate } from '../../lib/utils';
import {
    listEmployeeProfiles, createEmployeeAccount,
    renameEmployeeProfile, setEmployeeProfileActive, deleteEmployeeProfile,
} from '../../services/mercadinhoService';

export function EmployeeProfilesPage() {
    const [profiles, setProfiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [newName, setNewName] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const [renaming, setRenaming] = useState(null);
    const [renameValue, setRenameValue] = useState('');

    const load = async () => {
        setLoading(true);
        try {
            setProfiles(await listEmployeeProfiles({ includeInactive: true }));
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const handleCreate = async (e) => {
        e.preventDefault();
        setError('');

        if (!newName.trim()) { setError('Digite o nome do funcionário.'); return; }
        // 6 é o mínimo do Supabase, e agora a conta é dele de verdade.
        if (newPassword.length < 6) { setError('A senha precisa de pelo menos 6 caracteres.'); return; }

        setSaving(true);
        try {
            await createEmployeeAccount({ name: newName, password: newPassword });
            setNewName('');
            setNewPassword('');
            setCreating(false);
            load();
        } catch (err) {
            console.error(err);
            setError(err.message || 'Não consegui criar o funcionário.');
        } finally {
            setSaving(false);
        }
    };

    const handleRename = async (profile) => {
        if (!renameValue.trim()) return;
        try {
            await renameEmployeeProfile(profile.id, renameValue);
            setRenaming(null);
            load();
        } catch (err) {
            console.error(err);
            alert('Não consegui renomear (talvez o nome já exista).');
        }
    };

    const handleToggleActive = async (profile) => {
        try {
            await setEmployeeProfileActive(profile.id, !profile.active);
            load();
        } catch (err) {
            console.error(err);
            alert('Não consegui mudar a situação do perfil.');
        }
    };

    const handleDelete = async (profile) => {
        const ok = window.confirm(
            `Apagar o perfil "${profile.name}"?\n\n` +
            'Os lançamentos de crédito da loja dele somem junto. ' +
            'Se ainda houver valor a descontar, desative em vez de apagar.'
        );
        if (!ok) return;

        try {
            await deleteEmployeeProfile(profile.id);
            load();
        } catch (err) {
            console.error(err);
            alert('Não consegui apagar o perfil.');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Perfis</h1>
                    <p className="text-sm text-gray-500 mt-0.5">
                        Funcionários que usam o app com um perfil próprio
                    </p>
                </div>
                {!creating && (
                    <Button variant="brand" onClick={() => { setCreating(true); setError(''); }}>
                        <UserPlus className="h-4 w-4 mr-2" />
                        Novo perfil
                    </Button>
                )}
            </div>

            {/* O que a separação garante */}
            <div className="flex items-start gap-3 rounded-2xl bg-emerald-50 border border-emerald-200 p-4">
                <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-sm text-emerald-800 leading-relaxed">
                    <p className="font-bold">Cada funcionário tem conta própria.</p>
                    <p className="mt-0.5">
                        Na tela ele digita só nome e senha, mas por baixo é um login de verdade. O
                        bloqueio do financeiro é feito pelo banco de dados, não pela interface:
                        mesmo tentando por fora do app, a conta dele não consegue ler vendas,
                        custos nem lucro. Ele também só enxerga o próprio crédito da loja.
                    </p>
                </div>
            </div>

            {/* Novo perfil */}
            {creating && (
                <form
                    onSubmit={handleCreate}
                    className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4"
                >
                    <div className="flex items-center justify-between">
                        <h2 className="font-bold text-gray-900">Novo perfil de funcionário</h2>
                        <button
                            type="button"
                            onClick={() => { setCreating(false); setError(''); }}
                            className="h-8 w-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>

                    {error && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm font-medium border border-red-100">
                            {error}
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700">Nome *</label>
                            <Input
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                placeholder="Ex.: Maria"
                                autoFocus
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700">Senha *</label>
                            <Input
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="Mínimo 4 caracteres"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-3">
                        <Button type="button" variant="outline" onClick={() => setCreating(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" variant="brand" disabled={saving}>
                            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                            Criar perfil
                        </Button>
                    </div>
                </form>
            )}

            {/* Lista */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="p-16 flex items-center justify-center text-gray-400">
                        <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                ) : profiles.length === 0 ? (
                    <div className="p-16 flex flex-col items-center text-center">
                        <div className="h-16 w-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-4">
                            <Users className="h-8 w-8 text-gray-300" />
                        </div>
                        <p className="font-semibold text-gray-500">Nenhum perfil criado</p>
                        <p className="text-sm text-gray-400 mt-1">
                            Crie um perfil para cada funcionário que usa o caixa.
                        </p>
                    </div>
                ) : (
                    profiles.map((p) => (
                        <div
                            key={p.id}
                            className="flex items-center gap-4 px-5 py-4 border-b border-gray-50 last:border-0"
                        >
                            <Avatar name={p.name} size="md" className={p.active ? '' : 'opacity-40'} />

                            <div className="flex-1 min-w-0">
                                {renaming === p.id ? (
                                    <div className="flex items-center gap-2">
                                        <Input
                                            value={renameValue}
                                            onChange={(e) => setRenameValue(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') { e.preventDefault(); handleRename(p); }
                                                if (e.key === 'Escape') setRenaming(null);
                                            }}
                                            className="h-9 max-w-xs"
                                            autoFocus
                                        />
                                        <Button size="sm" variant="brand" onClick={() => handleRename(p)}>
                                            <Check className="h-4 w-4" />
                                        </Button>
                                        <Button size="sm" variant="outline" onClick={() => setRenaming(null)}>
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex items-center gap-2">
                                            <p className={cn(
                                                "font-bold text-gray-900",
                                                !p.active && "text-gray-400 line-through"
                                            )}>
                                                {p.name}
                                            </p>
                                            {!p.active && <Badge>desativado</Badge>}
                                        </div>
                                        <p className="text-xs text-gray-400 mt-0.5">
                                            criado em {formatDate(p.created_at)}
                                        </p>
                                    </>
                                )}
                            </div>

                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => { setRenaming(p.id); setRenameValue(p.name); }}
                                    className="h-9 w-9 rounded-lg flex items-center justify-center text-gray-400 hover:text-[#7E1A8B] hover:bg-[#7E1A8B]/10 transition-colors"
                                    title="Renomear"
                                >
                                    <Pencil className="h-4 w-4" />
                                </button>
                                <button
                                    onClick={() => handleToggleActive(p)}
                                    className="h-9 px-3 rounded-lg text-xs font-semibold text-gray-500 hover:bg-gray-100 transition-colors"
                                >
                                    {p.active ? 'Desativar' : 'Reativar'}
                                </button>
                                <button
                                    onClick={() => handleDelete(p)}
                                    className="h-9 w-9 rounded-lg flex items-center justify-center text-gray-300 hover:text-red-600 hover:bg-red-50 transition-colors"
                                    title="Apagar"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
