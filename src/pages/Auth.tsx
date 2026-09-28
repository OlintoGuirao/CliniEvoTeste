import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { toast } from 'sonner';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { z } from 'zod';

const emailSchema = z.string().email('E-mail inválido');
const passwordSchema = z.string().min(6, 'Senha deve ter no mínimo 6 caracteres');

export default function Auth() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signIn, loading } = useAuth();
  const hasRedirected = useRef(false);

  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Redireciona só quando autenticado de forma estável (evita loop /auth ↔ /dashboard).
  useEffect(() => {
    if (loading) return;
    if (!user) {
      hasRedirected.current = false;
      return;
    }
    if (location.pathname !== '/auth') return;
    if (hasRedirected.current) return;
    hasRedirected.current = true;
    if (user.email === 'admin@clinievo.com.br') {
      navigate('/admin/dashboard', { replace: true });
    } else {
      navigate('/dashboard', { replace: true });
    }
  }, [user, loading, navigate, location.pathname]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      emailSchema.parse(loginEmail);
      passwordSchema.parse(loginPassword);
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast.error(err.errors[0].message);
        return;
      }
    }
    
    setIsLoading(true);
    
    const { error } = await signIn(loginEmail, loginPassword);
    
    if (error) {
      if (error.message.includes('bloqueado')) {
        toast.error(error.message);
      } else if (error.message.includes('Invalid login credentials')) {
        toast.error('E-mail ou senha incorretos.');
      } else if (error.message.includes('Email not confirmed')) {
        toast.error('Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.');
      } else if (error.message.includes('Email logins are disabled')) {
        toast.error('Login por e-mail está desativado. No Supabase: Authentication → Providers → Email → ative o provider.');
      } else if (error.message.includes('invalid') && error.message.toLowerCase().includes('key')) {
        toast.error('Configuração do Supabase inválida. Verifique a chave no .env');
      } else {
        toast.error(error.message || 'Erro ao fazer login. Tente novamente.');
      }
    } else {
      toast.success('Login realizado com sucesso!');
      // O useEffect([user, loading]) redireciona para /dashboard quando o contexto atualizar
    }
    
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen min-h-dvh flex items-center justify-center bg-gradient-to-b from-secondary to-background p-4">
      <div className="w-full max-w-md animate-fade-in min-w-0 relative">
        {loading ? (
          <div
            className="absolute top-0 right-0 flex items-center gap-2 text-xs text-muted-foreground"
            aria-live="polite"
          >
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Verificando sessão…
          </div>
        ) : null}
        <div className="text-center mb-5 sm:mb-6">
          <div className="inline-flex items-center justify-center w-full max-w-[260px] sm:max-w-[300px] md:max-w-[360px] h-[120px] sm:h-[160px] md:h-[200px] leading-none mx-auto">
            <img src="/CliniEvo.png" alt="CliniEvo" className="w-full h-full object-contain block" />
          </div>
          <p className="text-primary font-medium text-base italic tracking-widest -mt-12 text-balance">
            Evoluir. <span className="text-muted-foreground">Cuidar.</span> Viver.
          </p>
        </div>
        
        <Card className="shadow-xl border border-primary/20 rounded-xl bg-card/95 backdrop-blur-sm font-sans antialiased">
          <CardHeader className="pb-2">
            <div className="mx-auto w-12 h-0.5 rounded-full bg-primary/40 mb-3" aria-hidden />
            <h2 className="font-serif text-2xl font-semibold text-center text-foreground tracking-tight">Entrar</h2>
            <p className="text-sm text-muted-foreground text-center mt-1">Acesse sua conta</p>
          </CardHeader>
          <CardContent className="pt-2 [&_label]:font-medium [&_label]:tracking-wide [&_input]:font-normal">
            <form onSubmit={handleLogin} className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="login-email">E-mail</Label>
                <Input
                  id="login-email"
                  type="email"
                  placeholder="seu@email.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="login-password">Senha</Label>
                <div className="relative">
                  <Input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={isLoading || loading}>
                {isLoading ? 'Entrando...' : 'Entrar'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Ao continuar, você concorda com nossos Termos de Uso e Política de Privacidade.
        </p>
      </div>
    </div>
  );
}
