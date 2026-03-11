import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Lock, ArrowRight, CheckCircle } from 'lucide-react';

export function UpdatePasswordPage() {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const { updatePassword } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        
        if (password !== confirmPassword) {
            return setError('As senhas não coincidem.');
        }

        if (password.length < 6) {
            return setError('A senha deve ter pelo menos 6 caracteres.');
        }

        setLoading(true);

        try {
            await updatePassword(password);
            setSuccess(true);
            setTimeout(() => {
                navigate('/login');
            }, 3000);
        } catch (err) {
            console.error(err);
            setError('Falha ao atualizar a senha. Tente novamente.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full flex bg-white">
            {/* Left Side - Branding & Decoration */}
            <div className="hidden lg:flex w-1/2 bg-[#7E1A8B] relative overflow-hidden flex-col justify-between p-12 text-white">
                {/* Abstract Pattern Overlay */}
                <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
                    <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full border-[60px] border-white/20"></div>
                    <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] rounded-full bg-white/10 blur-3xl"></div>
                </div>

                <div className="relative z-10">
                    <h1 className="text-4xl font-bold tracking-tight">Fornalha</h1>
                </div>

                <div className="relative z-10 max-w-lg">
                    <h2 className="text-3xl font-bold mb-4 leading-tight">
                        Defina sua nova senha
                    </h2>
                    <p className="text-purple-200 text-lg">
                        Escolha uma senha forte e segura para proteger sua conta.
                    </p>
                </div>

                <div className="relative z-10 text-sm text-purple-200/60">
                    © {new Date().getFullYear()} Fornalha System. Todos os direitos reservados.
                </div>
            </div>

            {/* Right Side - Form */}
            <div className="flex-1 flex flex-col items-center justify-center p-8 sm:p-12 lg:p-24 bg-gray-50">
                <div className="w-full max-w-sm space-y-8">
                    <div className="text-center lg:text-left">
                        <div className="lg:hidden mb-8 flex justify-center">
                            <span className="text-3xl font-bold text-[#7E1A8B]">Fornalha</span>
                        </div>
                        <h2 className="text-3xl font-bold tracking-tight text-gray-900">
                            Nova Senha
                        </h2>
                        <p className="mt-2 text-sm text-gray-500">
                            Digite sua nova senha abaixo.
                        </p>
                    </div>

                    {success ? (
                        <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center animate-in fade-in zoom-in duration-300">
                            <div className="h-12 w-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                <CheckCircle className="h-6 w-6" />
                            </div>
                            <h3 className="text-lg font-semibold text-green-900 mb-2">Senha Atualizada!</h3>
                            <p className="text-sm text-green-700 mb-6">
                                Sua senha foi alterada com sucesso. Você será redirecionado para o login em instantes...
                            </p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {error && (
                                <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm font-medium border border-red-100 flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                                    <span className="text-lg">⚠️</span> {error}
                                </div>
                            )}

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700 ml-1">Nova Senha</label>
                                    <div className="relative group">
                                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#7E1A8B] transition-colors">
                                            <Lock className="h-5 w-5" />
                                        </div>
                                        <input
                                            type="password"
                                            required
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="w-full h-12 pl-11 pr-4 rounded-xl bg-white border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#7E1A8B]/20 focus:border-[#7E1A8B] transition-all placeholder:text-gray-400 font-medium"
                                            placeholder="••••••••"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700 ml-1">Confirmar Senha</label>
                                    <div className="relative group">
                                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#7E1A8B] transition-colors">
                                            <Lock className="h-5 w-5" />
                                        </div>
                                        <input
                                            type="password"
                                            required
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            className="w-full h-12 pl-11 pr-4 rounded-xl bg-white border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#7E1A8B]/20 focus:border-[#7E1A8B] transition-all placeholder:text-gray-400 font-medium"
                                            placeholder="••••••••"
                                        />
                                    </div>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full h-12 bg-[#7E1A8B] text-white rounded-xl font-medium text-sm hover:bg-[#6a1675] focus:outline-none focus:ring-2 focus:ring-[#7E1A8B]/50 focus:ring-offset-2 transition-all disabled:opacity-70 disabled:cursor-not-allowed shadow-lg shadow-[#7E1A8B]/20 active:scale-[0.98] flex items-center justify-center gap-2"
                            >
                                {loading ? 'Atualizando...' : (
                                    <>
                                        Atualizar Senha
                                        <ArrowRight className="h-5 w-5" />
                                    </>
                                )}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
