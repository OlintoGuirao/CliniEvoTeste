import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AppLoader } from '@/core/loaders/AppLoader';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { toast } from 'sonner';
import { Eye, EyeOff } from 'lucide-react';
import { z } from 'zod';

const emailSchema = z.string().email('E-mail inválido');
const passwordSchema = z.string().min(6, 'Senha deve ter no mínimo 6 caracteres');
const nameSchema = z.string().min(2, 'Nome deve ter no mínimo 2 caracteres');

export default function AuthSignup() {
  const navigate = useNavigate();
  const { user, signUp, loading } = useAuth();

  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');

  useEffect(() => {
    if (user && !loading) {
      navigate('/dashboard');
    }
  }, [user, loading, navigate]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      nameSchema.parse(signupName);
      emailSchema.parse(signupEmail);
      passwordSchema.parse(signupPassword);
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast.error(err.errors[0].message);
        return;
      }
    }

    if (signupPassword !== signupConfirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }

    setIsLoading(true);

    const { error } = await signUp(signupEmail, signupPassword, signupName);

    if (error) {
      if (error.message.includes('already registered') || error.message.includes('already been registered')) {
        toast.error('Este e-mail já está cadastrado.');
      } else if (error.message.includes('Email not confirmed') || error.message.includes('signup')) {
        toast.error('Conta criada! Verifique seu e-mail para confirmar antes de entrar.');
      } else {
        toast.error(error.message || 'Erro ao criar conta. Tente novamente.');
      }
    } else {
      toast.success('Conta criada! Confirme seu e-mail (se ativado no Supabase) e faça login.');
      const { data } = await supabase.auth.getSession();
      if (data.session) navigate('/dashboard');
      else navigate('/auth');
    }

    setIsLoading(false);
  };

  if (loading) {
    return <AppLoader message="Carregando..." className="bg-gradient-to-b from-secondary to-background" />;
  }

  return (
    <div className="min-h-screen min-h-dvh flex items-center justify-center bg-gradient-to-b from-secondary to-background p-4">
      <div className="w-full max-w-md animate-fade-in min-w-0">
        <div className="text-center mb-5 sm:mb-6">
          <div className="inline-flex items-center justify-center w-full max-w-[260px] sm:max-w-[300px] md:max-w-[360px] h-[120px] sm:h-[160px] md:h-[200px] mx-auto">
            <img src="/CliniEvo.png" alt="CliniEvo" className="w-full h-full object-contain" />
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">Criar nova conta (profissional)</p>
        </div>

        <Card className="shadow-lg border-0">
          <CardHeader>
            <h2 className="text-lg font-semibold text-center">Cadastrar novo profissional</h2>
            <p className="text-xs sm:text-sm text-muted-foreground text-center">
              Use esta página apenas para criar novas contas de acesso ao sistema.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSignup} className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="signup-name">Nome Completo</Label>
                <Input
                  id="signup-name"
                  type="text"
                  placeholder="Seu nome"
                  value={signupName}
                  onChange={(e) => setSignupName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-email">E-mail</Label>
                <Input
                  id="signup-email"
                  type="email"
                  placeholder="seu@email.com"
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-password">Senha</Label>
                <div className="relative">
                  <Input
                    id="signup-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
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

              <div className="space-y-2">
                <Label htmlFor="signup-confirm">Confirmar Senha</Label>
                <Input
                  id="signup-confirm"
                  type="password"
                  placeholder="••••••••"
                  value={signupConfirmPassword}
                  onChange={(e) => setSignupConfirmPassword(e.target.value)}
                  required
                />
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Criando conta...' : 'Criar Conta'}
              </Button>
            </form>

            <p className="text-center text-xs sm:text-sm text-muted-foreground mt-4">
              Já tem conta?{' '}
              <Link to="/auth" className="text-primary font-medium hover:underline">
                Entrar
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
