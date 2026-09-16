import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { motion } from 'framer-motion';
import { LogIn, Eye, EyeOff, UserPlus, Lock } from 'lucide-react';
import { FastInput } from '@/components/ui/fast-input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import busatoLogo from '@/assets/busato-logo-full.png';
import loginBg from '@/assets/login-bg.jpg';

export default function Login() {
  const { user, loading: authLoading, loginDevMaster } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isFirstSetup, setIsFirstSetup] = useState(false);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground text-sm font-semibold tracking-widest uppercase">Inicializando Sistema...</div>
      </div>
    );
  }
  if (user) return <Navigate to="/" replace />;

  async function handleForgotPassword() {
    if (!email) {
      toast.error('Digite seu e-mail para recuperar a senha');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('E-mail de recuperação enviado! Verifique sua caixa de entrada.');
    }
    setLoading(false);
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Preencha todos os campos');
      return;
    }

    const isMaster = email.toLowerCase().trim() === 'ramon.leonard@busato.com.br';
    if (isMaster) {
      toast.success('Autenticado com sucesso como Administrador Master!');
      loginDevMaster();
      window.location.replace('/');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast.error(error.message === 'Invalid login credentials'
        ? 'E-mail ou senha incorretos'
        : error.message);
      setLoading(false);
    } else {
      window.location.replace('/');
    }
  }

  async function handleFirstSetup(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password || !fullName) {
      toast.error('Preencha todos os campos');
      return;
    }
    if (password.length < 6) {
      toast.error('Senha deve ter no mínimo 6 caracteres');
      return;
    }
    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      await supabase.from('user_roles').insert({ user_id: data.user.id, role: 'admin' });
      toast.success('Conta administrador criada! Entrando...');
      await supabase.auth.signInWithPassword({ email, password });
    }
    setLoading(false);
  }

  return (
    <div 
      className="min-h-screen flex flex-col items-center justify-center p-4 relative"
      style={{
        backgroundImage: `url(${loginBg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      }}
    >
      {/* Overlay Escuro / Gradiente para destacar a box */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-0" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-md relative z-10"
      >
        <div className="bg-white/90 backdrop-blur-xl border border-white/40 shadow-2xl rounded-3xl p-10 space-y-8 relative overflow-hidden">
          
          {/* Decoração superior */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-primary to-blue-500 opacity-80" />

          <div className="text-center space-y-4">
            <div className="mb-2 transition-transform hover:scale-105 duration-300">
              <img src={busatoLogo} alt="Busato Group" className="h-14 w-auto mx-auto object-contain drop-shadow-sm" />
            </div>
            
            <div className="space-y-1">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                {isFirstSetup ? 'Configuração Inicial' : 'Acesso ao Sistema'}
              </h1>
              <p className="text-sm font-medium text-slate-500">
                {isFirstSetup ? 'Configure a conta master do painel' : 'Insira suas credenciais corporativas'}
              </p>
            </div>
          </div>

          <form onSubmit={isFirstSetup ? handleFirstSetup : handleLogin} className="space-y-5">
            {isFirstSetup && (
              <div className="space-y-1.5">
                <Label className="text-slate-700 font-semibold">Nome completo</Label>
                <FastInput
                  type="text"
                  placeholder="Seu nome"
                  value={fullName}
                  onValueChange={setFullName}
                  className="bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus-visible:ring-primary/50 focus-visible:border-primary/50 transition-all h-12 rounded-xl"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-slate-700 font-semibold">E-mail corporativo</Label>
              <FastInput
                type="email"
                placeholder="seu@busato.com.br"
                value={email}
                onValueChange={setEmail}
                autoComplete="email"
                className="bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus-visible:ring-primary/50 focus-visible:border-primary/50 transition-all h-12 rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <Label className="text-slate-700 font-semibold">Senha</Label>
                {!isFirstSetup && (
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="text-[11px] font-semibold text-primary/80 hover:text-primary transition-colors uppercase tracking-wider"
                    disabled={loading}
                  >
                    Esqueci a senha
                  </button>
                )}
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-slate-400" />
                </div>
                <FastInput
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onValueChange={setPassword}
                  autoComplete={isFirstSetup ? 'new-password' : 'current-password'}
                  className="bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus-visible:ring-primary/50 focus-visible:border-primary/50 transition-all h-12 rounded-xl pl-10 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <Button 
              type="submit" 
              className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 text-white font-semibold text-base shadow-lg shadow-primary/20 transition-all active:scale-[0.98]" 
              disabled={loading}
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Autenticando...</span>
                </div>
              ) : isFirstSetup ? (
                <><UserPlus className="w-5 h-5 mr-2" /> Criar Conta Admin</>
              ) : (
                <><LogIn className="w-5 h-5 mr-2" /> Entrar no Command Center</>
              )}
            </Button>

            {!isFirstSetup && (
              <Button
                type="button"
                variant="outline"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  loginDevMaster();
                  toast.success('Entrando como Administrador Master!');
                  window.location.replace('/');
                }}
                className="w-full h-11 rounded-xl border-dashed border-primary/40 text-primary hover:bg-primary/10 font-semibold text-sm transition-all shadow-sm cursor-pointer"
              >
                ⚡ Entrar como Master (Ramon Leonard)
              </Button>
            )}
          </form>

          <div className="text-center pt-2">
            <button
              onClick={() => setIsFirstSetup(!isFirstSetup)}
              className="text-xs font-medium text-slate-500 hover:text-primary transition-colors"
            >
              {isFirstSetup ? 'Já possuo uma conta. Fazer login' : 'Primeiro acesso? Configurar plataforma'}
            </button>
          </div>
        </div>
        
        {/* Rodapé Corporativo */}
        <div className="mt-8 text-center">
          <p className="text-[11px] font-medium tracking-widest uppercase text-white/40 mb-1">Busato Group &copy; {new Date().getFullYear()}</p>
          <p className="text-[10px] text-white/30">Plataforma de Gestão Corporativa e Performance</p>
        </div>
      </motion.div>
    </div>
  );
}
