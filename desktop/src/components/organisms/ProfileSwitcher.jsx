import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ChevronsUpDown, ShieldCheck, User, Lock, Loader2, X, Check, Settings,
} from 'lucide-react';
import { Avatar } from '../atoms/Avatar';
import { Button } from '../atoms/Button';
import { Input } from '../atoms/Input';
import { cn } from '../../lib/utils';
import { useAuth } from '../../contexts/AuthContext';
import { useProfile } from '../../contexts/ProfileContext';
import { listEmployeeProfiles } from '../../services/mercadinhoService';

const NAMES_BY_EMAIL = {
    'ecarneirodemelo@gmail.com': 'Nal',
    'esthermenezes90@gmail.com': 'Esther',
    'matheusv090807@gmail.com': 'Matheus',
};

export function ProfileSwitcher({ collapsed }) {
    const { getUserEmail } = useAuth();
    const { profile, isAdmin, switchToEmployee, switchToAdmin } = useProfile();
    const navigate = useNavigate();

    const [open, setOpen] = useState(false);
    const [profiles, setProfiles] = useState([]);
    const [target, setTarget] = useState(null); // null | 'admin' | perfil
    const [password, setPassword] = useState('');
    const [checking, setChecking] = useState(false);
    const [error, setError] = useState('');

    const adminName = NAMES_BY_EMAIL[getUserEmail()] || 'Administrador';
    const currentName = isAdmin ? adminName : profile.name;

    useEffect(() => {
        if (!open) return;
        listEmployeeProfiles().then(setProfiles).catch(() => setProfiles([]));
    }, [open]);

    const startSwitch = (to) => {
        setTarget(to);
        setPassword('');
        setError('');
        setOpen(false);
    };

    const confirmSwitch = async (e) => {
        e?.preventDefault();
        if (!password) { setError('Digite a senha.'); return; }

        setChecking(true);
        setError('');
        try {
            const ok = target === 'admin'
                ? await switchToAdmin(password)
                : await switchToEmployee(target, password);

            if (!ok) {
                setError('Senha incorreta.');
                return;
            }

            setTarget(null);
            setPassword('');
            // Sai de qualquer tela que o novo perfil talvez não possa ver.
            navigate('/venda', { replace: true });
        } catch (err) {
            console.error(err);
            setError('Não consegui trocar de perfil.');
        } finally {
            setChecking(false);
        }
    };

    return (
        <>
            {/* Botão do perfil atual */}
            <button
                onClick={() => setOpen((v) => !v)}
                className={cn(
                    "w-full flex items-center gap-3 rounded-2xl transition-colors relative z-10",
                    collapsed ? "flex-col p-2 hover:bg-gray-50" : "bg-white p-3 border border-gray-100 shadow-sm hover:bg-gray-50"
                )}
                title={collapsed ? currentName : undefined}
            >
                <Avatar name={currentName} size="md" className="ring-2 ring-white shadow-sm" />

                {!collapsed && (
                    <>
                        <div className="flex flex-col flex-1 min-w-0 text-left">
                            <span className="text-sm font-bold text-gray-900 truncate">{currentName}</span>
                            <span className={cn(
                                "text-xs font-semibold truncate flex items-center gap-1",
                                isAdmin ? "text-[#7E1A8B]" : "text-gray-500"
                            )}>
                                {isAdmin
                                    ? <><ShieldCheck className="h-3 w-3" /> Administrador</>
                                    : <><User className="h-3 w-3" /> Funcionário</>}
                            </span>
                        </div>
                        <ChevronsUpDown className="h-4 w-4 text-gray-400 shrink-0" />
                    </>
                )}
            </button>

            {/* Lista de perfis */}
            {open && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
                    <div className={cn(
                        "absolute z-50 bg-white rounded-2xl border border-gray-200 shadow-2xl overflow-hidden",
                        collapsed ? "left-[88px] bottom-4 w-64" : "left-5 right-5 bottom-24"
                    )}>
                        <p className="px-4 pt-3 pb-2 text-[11px] font-bold text-gray-400 uppercase tracking-wide">
                            Trocar de perfil
                        </p>

                        {/* Administrador */}
                        <button
                            onClick={() => (isAdmin ? setOpen(false) : startSwitch('admin'))}
                            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors text-left"
                        >
                            <Avatar name={adminName} size="sm" />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-900 truncate">{adminName}</p>
                                <p className="text-[11px] text-gray-400">Administrador</p>
                            </div>
                            {isAdmin
                                ? <Check className="h-4 w-4 text-[#7E1A8B] shrink-0" />
                                : <Lock className="h-3.5 w-3.5 text-gray-300 shrink-0" />}
                        </button>

                        {profiles.length > 0 && <div className="h-px bg-gray-100 mx-4 my-1" />}

                        {profiles.map((p) => {
                            const isCurrent = profile?.id === p.id;
                            return (
                                <button
                                    key={p.id}
                                    onClick={() => (isCurrent ? setOpen(false) : startSwitch(p))}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors text-left"
                                >
                                    <Avatar name={p.name} size="sm" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-gray-900 truncate">{p.name}</p>
                                        <p className="text-[11px] text-gray-400">Funcionário</p>
                                    </div>
                                    {isCurrent
                                        ? <Check className="h-4 w-4 text-[#7E1A8B] shrink-0" />
                                        : <Lock className="h-3.5 w-3.5 text-gray-300 shrink-0" />}
                                </button>
                            );
                        })}

                        {isAdmin && (
                            <>
                                <div className="h-px bg-gray-100 mx-4 my-1" />
                                <button
                                    onClick={() => { setOpen(false); navigate('/perfis'); }}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors text-left text-gray-500"
                                >
                                    <div className="h-8 w-8 rounded-full bg-gray-50 flex items-center justify-center shrink-0">
                                        <Settings className="h-4 w-4" />
                                    </div>
                                    <span className="text-sm font-semibold">Gerenciar perfis</span>
                                </button>
                            </>
                        )}
                    </div>
                </>
            )}

            {/* Confirmação por senha */}
            {target && (
                <div className="modal-overlay" onClick={checking ? undefined : () => setTarget(null)}>
                    <form
                        onSubmit={confirmSwitch}
                        className="modal-content bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                                <Avatar name={target === 'admin' ? adminName : target.name} size="lg" />
                                <div>
                                    <p className="font-bold text-gray-900">
                                        {target === 'admin' ? adminName : target.name}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                        {target === 'admin' ? 'Administrador' : 'Funcionário'}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setTarget(null)}
                                disabled={checking}
                                className="h-8 w-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 disabled:opacity-40"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700">
                                {target === 'admin' ? 'Senha da conta de administrador' : 'Senha do perfil'}
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <Input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="pl-10"
                                    autoFocus
                                />
                            </div>
                            {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
                        </div>

                        <Button type="submit" variant="brand" className="w-full" disabled={checking}>
                            {checking && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                            Entrar neste perfil
                        </Button>
                    </form>
                </div>
            )}
        </>
    );
}
