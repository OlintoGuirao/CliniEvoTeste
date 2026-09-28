import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { UserPlus } from 'lucide-react';
import { AdminCreateUserForm } from '@/components/admin/AdminCreateUserForm';

export default function AdminNewProfilePage() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Novo usuário</h1>
        <p className="text-muted-foreground text-sm mt-1">Adicionar novo usuário ao sistema</p>
      </div>

      <Card className="max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <UserPlus className="h-5 w-5" aria-hidden />
            Cadastrar Novo Usuário
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Preencha os dados. O usuário poderá acessar o sistema com o e-mail e a senha definidos.
          </p>
        </CardHeader>
        <CardContent>
          <AdminCreateUserForm
            onSuccess={() => navigate('/admin/users', { replace: true })}
            onCancel={() => navigate('/admin/users')}
          />
        </CardContent>
      </Card>
    </div>
  );
}
