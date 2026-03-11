import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';

export function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const { resetPassword } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess(false);
        setLoading(true);

        try {
            await resetPassword(email);
            setSuccess(true);
        } catch (err) {
            console.error(err);
            setError('Falha ao enviar e-mail. Verifique se o endereço está correto.');
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
                        Recupere o acesso à sua conta
                    </h2>
                    <p className="text-purple-200 text-lg">
                        Enviaremos um link de recuperação para o seu e-mail cadastrado.
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
                        <Link 
                            to="/login" 
                            className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors mb-6"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            Voltar para o login
                        </Link>
                        <h2 className="text-3xl font-bold tracking-tight text-gray-900">
                            Esqueceu a senha?
                        </h2>
                        <p className="mt-2 text-sm text-gray-500">
                            Digite seu e-mail para receber as instruções de redefinição.
                        </p>
                    </div>

                    {success ? (
                        <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center animate-in fade-in zoom-in duration-300">
                            <div className="h-12 w-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                <CheckCircle className="h-6 w-6" />
                            </div>
                            <h3 className="text-lg font-semibold text-green-900 mb-2">E-mail enviado!</h3>
                            <p className="text-sm text-green-700 mb-6">
                                Verifique sua caixa de entrada e siga as instruções para redefinir sua senha.
                            </p>
                            <Link 
                                to="/login"
                                className="inline-flex justify-center w-full bg-white border border-green-200 text-green-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-50 transition-colors"
                            >
                                Voltar para o login
                            </Link>
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
                                    <label className="text-sm font-medium text-gray-700 ml-1">Email</label>
                                    <div className="relative group">
                                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#7E1A8B] transition-colors">
                                            <Mail className="h-5 w-5" />
                                        </div>
                                        <input
                                            type="email"
                                            required
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className="w-full h-12 pl-11 pr-4 rounded-xl bg-white border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#7E1A8B]/20 focus:border-[#7E1A8B] transition-all placeholder:text-gray-400 font-medium"
                                            placeholder="exemplo@email.com"
                                        />
                                    </div>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full h-12 bg-[#7E1A8B] text-white rounded-xl font-medium text-sm hover:bg-[#6a1675] focus:outline-none focus:ring-2 focus:ring-[#7E1A8B]/50 focus:ring-offset-2 transition-all disabled:opacity-70 disabled:cursor-not-allowed shadow-lg shadow-[#7E1A8B]/20 active:scale-[0.98]"
                            >
                                {loading ? 'Enviando...' : 'Enviar link de recuperação'}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
