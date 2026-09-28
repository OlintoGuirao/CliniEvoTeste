import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ShieldAlert } from 'lucide-react';

export default function ContaBloqueadaPage() {
  const navigate = useNavigate();
  const { signOut, user } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth', { replace: true });
  };

  if (!user) {
    navigate('/auth', { replace: true });
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 mb-2">
            <ShieldAlert className="h-8 w-8 text-destructive" />
          </div>
          <h1 className="text-xl font-semibold">Conta Bloqueada</h1>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-muted-foreground">
            Seu acesso ao sistema foi bloqueado. Entre em contato com o suporte.
          </p>
          <Button variant="outline" onClick={handleSignOut} className="w-full">
            Sair
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
