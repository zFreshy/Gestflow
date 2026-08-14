import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Lock, Mail, Loader2, ArrowRight, Eye, EyeOff, CheckCircle2 } from 'lucide-react';

export function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [info, setInfo] = useState('');
    const { signIn, resetPassword } = useAuth();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setInfo('');
        setLoading(true);

        try {
            await signIn(email, password);
            // O AuthProvider troca a tela sozinho quando a sessão aparece.
        } catch (err) {
            console.error(err);
            setError('Falha no login. Verifique o e-mail e a senha.');
        } finally {
            setLoading(false);
        }
    };

    const handleForgot = async () => {
        setError('');
        setInfo('');

        if (!email) {
            setError('Digite seu e-mail primeiro para receber o link.');
            return;
        }

        try {
            await resetPassword(email);
            setInfo('Link de recuperação enviado. Confira seu e-mail e troque a senha pelo site.');
        } catch (err) {
            console.error(err);
            setError('Não consegui enviar o e-mail de recuperação.');
        }
    };

    return (
        <div className="min-h-screen w-full flex bg-white">
            {/* Lado esquerdo - marca */}
            <div className="hidden lg:flex w-1/2 bg-[#7E1A8B] relative overflow-hidden flex-col justify-between p-12 text-white">
                <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
                    <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full border-[60px] border-white/20" />
                    <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] rounded-full bg-white/10 blur-3xl" />
                </div>

                <div className="relative z-10">
                    <h1 className="text-4xl font-bold tracking-tight leading-none">Mercadinho</h1>
                    <p className="mt-2 text-sm font-bold uppercase tracking-[0.32em] text-purple-200/80">
                        da Família
                    </p>
                </div>

                <div className="relative z-10 max-w-lg">
                    <h2 className="text-3xl font-bold mb-4 leading-tight">
                        Bipe, venda e controle o estoque sem complicação.
                    </h2>
                    <p className="text-purple-200 text-lg">
                        Passe o leitor no código de barras, feche a venda e o estoque se ajusta sozinho.
                    </p>
                </div>

                <div className="relative z-10 text-sm text-purple-200/60">
                    © {new Date().getFullYear()} Gestflow. Todos os direitos reservados.
                </div>
            </div>

            {/* Lado direito - formulário */}
            <div className="flex-1 flex flex-col items-center justify-center p-8 sm:p-12 lg:p-24 bg-gray-50">
                <div className="w-full max-w-sm space-y-8">
                    <div className="text-center lg:text-left">
                        <div className="lg:hidden mb-8 flex flex-col items-center">
                            <span className="text-3xl font-bold text-[#7E1A8B] leading-none">Mercadinho</span>
                            <span className="mt-1.5 text-[11px] font-bold uppercase tracking-[0.28em] text-[#7E1A8B]/55">
                                da Família
                            </span>
                        </div>
                        <h2 className="text-3xl font-bold tracking-tight text-gray-900">Acesse sua conta</h2>
                        <p className="mt-2 text-sm text-gray-500">
                            Use o mesmo login do Gestflow.
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {error && (
                            <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm font-medium border border-red-100 flex items-center gap-3">
                                <span className="text-lg">⚠️</span> {error}
                            </div>
                        )}
                        {info && (
                            <div className="bg-emerald-50 text-emerald-700 p-4 rounded-xl text-sm font-medium border border-emerald-100 flex items-start gap-3">
                                <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" /> {info}
                            </div>
                        )}

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 ml-1">E-mail</label>
                                <div className="relative group">
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#7E1A8B] transition-colors">
                                        <Mail className="h-5 w-5" />
                                    </div>
                                    <input
                                        type="email"
                                        required
                                        autoFocus
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full h-12 pl-11 pr-4 rounded-xl bg-white border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#7E1A8B]/20 focus:border-[#7E1A8B] transition-all placeholder:text-gray-400 font-medium"
                                        placeholder="exemplo@email.com"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between ml-1">
                                    <label className="text-sm font-medium text-gray-700">Senha</label>
                                    <button
                                        type="button"
                                        onClick={handleForgot}
                                        className="text-xs font-medium text-[#7E1A8B] hover:text-[#6a1675] hover:underline transition-colors"
                                    >
                                        Esqueceu a senha?
                                    </button>
                                </div>
                                <div className="relative group">
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#7E1A8B] transition-colors">
                                        <Lock className="h-5 w-5" />
                                    </div>
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full h-12 pl-11 pr-12 rounded-xl bg-white border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#7E1A8B]/20 focus:border-[#7E1A8B] transition-all placeholder:text-gray-400 font-medium"
                                        placeholder="••••••••"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#7E1A8B] transition-colors focus:outline-none"
                                    >
                                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full h-12 bg-[#7E1A8B] hover:bg-[#6a1675] text-white font-semibold rounded-xl transition-all shadow-lg shadow-purple-900/10 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed active:scale-[0.98]"
                        >
                            {loading ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                                <>
                                    Entrar
                                    <ArrowRight className="h-5 w-5" />
                                </>
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
