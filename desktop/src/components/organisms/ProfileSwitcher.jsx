import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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

/**
 * Extrai um nome apresentável a partir do e-mail.
 *
 * Pega a parte antes do `@`, troca pontos e underscores por espaço e
 * capitaliza cada palavra. Ex: "joao.silva@gmail.com" → "Joao Silva".
 */
const nameFromEmail = (email) => {
    if (!email) return null;
    const local = String(email).split('@')[0];
    return local
        .replace(/[._]+/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
};

export function ProfileSwitcher({ collapsed }) {
    const { getUserEmail } = useAuth();
    const {
        profile, isAdmin, switchToEmployee, switchToAdmin,
        adminEmail: rememberedEmail,
    } = useProfile();
    const navigate = useNavigate();

    const [open, setOpen] = useState(false);
    const [menuPos, setMenuPos] = useState({});
    const triggerRef = useRef(null);
    const [profiles, setProfiles] = useState([]);
    const [target, setTarget] = useState(null); // null | 'admin' | perfil
    const [password, setPassword] = useState('');
    // Só aparece quando o app não sabe o e-mail do administrador — numa
    // máquina onde ele nunca entrou, por exemplo.
    const [typedEmail, setTypedEmail] = useState('');
    const [checking, setChecking] = useState(false);
    const [error, setError] = useState('');

    // Dentro de um perfil de funcionário, getUserEmail() é o e-mail sintético
    // dele — o nome do administrador tem que vir do que ficou lembrado.
    const adminEmail = isAdmin ? getUserEmail() : rememberedEmail;
    const adminName = nameFromEmail(adminEmail) || 'Administrador';
    const currentName = isAdmin ? adminName : (profile?.name ?? 'Funcionário');

    useEffect(() => {
        if (!open) return;
        listEmployeeProfiles().then(setProfiles).catch(() => setProfiles([]));
    }, [open]);

    /**
     * Abre o menu ancorado no botão. Ele sobe a partir do topo do botão porque
     * o gatilho fica no rodapé da sidebar — para baixo não haveria espaço.
     */
    const toggleMenu = () => {
        setOpen((v) => {
            if (v) return false;

            const rect = triggerRef.current?.getBoundingClientRect();
            if (rect) {
                setMenuPos({
                    left: rect.left,
                    bottom: window.innerHeight - rect.top + 8,
                    width: Math.max(rect.width, 256),
                });
            }
            return true;
        });
    };

    const startSwitch = (to) => {
        setTarget(to);
        setPassword('');
        setTypedEmail('');
        setError('');
        setOpen(false);
    };

    /** Voltando para o administrador sem o app saber quem ele é. */
    const needsEmail = target === 'admin' && !rememberedEmail;

    const confirmSwitch = async (e) => {
        e?.preventDefault();
        if (!password) { setError('Digite a senha.'); return; }

        const goingToAdmin = target === 'admin';
        // Só é exigido quando o app não sabe qual é — ver `needsEmail`.
        const email = typedEmail.trim() || rememberedEmail;

        if (goingToAdmin && !email) {
            setError('Digite o e-mail do administrador.');
            return;
        }

        setChecking(true);
        setError('');
        try {
            const result = goingToAdmin
                ? await switchToAdmin(password, email)
                : await switchToEmployee(target, password);

            if (!result.ok) {
                setError({
                    'sem-email': 'Não sei qual é a conta do administrador. Digite o e-mail dele.',
                    'sem-conexao': 'Sem internet. Trocar de perfil é um login, e ele precisa de conexão.',
                }[result.reason] ?? 'Senha incorreta.');
                return;
            }

            // A troca é um login de verdade, então tudo que estava em memória
            // pertence à sessão anterior.
            setProfiles([]);

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
                ref={triggerRef}
                onClick={toggleMenu}
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

            {/*
              Menu e camada de fechar vao JUNTOS no portal.

              Tentar deixar só a camada no portal não funciona: a sidebar tem
              backdrop-blur, que cria contexto de empilhamento próprio, então o
              `z-50` do menu só valia dentro da sidebar e a camada `z-40` do
              body ficava por cima dele. Todo clique acertava a camada e o menu
              fechava — parecia que os perfis não eram clicáveis.

              Estando os dois no mesmo contexto, a ordem volta a valer. Como
              fora da sidebar não há a que se ancorar, a posição é calculada a
              partir do botão.
            */}
            {open && createPortal(
                <>
                    <div className="fixed inset-0 z-[60]" onClick={() => setOpen(false)} />
                    <div
                        className="fixed z-[61] bg-white rounded-2xl border border-gray-200 shadow-2xl overflow-hidden"
                        style={menuPos}
                    >
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
                </>,
                document.body
            )}

            {/*
              Confirmação por senha, montada no <body> via portal.

              A sidebar usa `backdrop-blur`, e backdrop-filter cria containing
              block: dentro dela, `position: fixed` passa a se medir pela
              sidebar em vez da janela, e o modal ficava espremido no canto
              esquerdo. O portal tira o modal de dentro desse contexto.
            */}
            {target && createPortal(
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

                        {/* O e-mail só é pedido quando o app não sabe qual é:
                            numa máquina onde o administrador nunca entrou, ou
                            se o registro se perdeu. Nas outras vezes segue
                            valendo a ideia de "só a senha". */}
                        {needsEmail && (
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-700">
                                    E-mail do administrador
                                </label>
                                <Input
                                    type="email"
                                    value={typedEmail}
                                    onChange={(e) => setTypedEmail(e.target.value)}
                                    placeholder="dono@email.com"
                                    autoFocus
                                />
                                <p className="text-xs text-gray-400">
                                    Este computador ainda não sabe qual é a conta. Depois desta
                                    vez, só a senha basta.
                                </p>
                            </div>
                        )}

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
                                    autoFocus={!needsEmail}
                                />
                            </div>
                            {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
                        </div>

                        <Button type="submit" variant="brand" className="w-full" disabled={checking}>
                            {checking && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                            Entrar neste perfil
                        </Button>
                    </form>
                </div>,
                document.body
            )}
        </>
    );
}
