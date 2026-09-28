import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { adminCreateUser, logAdminActivity } from '@/services/api/adminApi';
import {
  ACCOUNT_TYPE_LABELS,
  isSharedOrgAccount,
  normalizeAccountType,
  type AccountType,
} from '@/lib/accountType';
import { getAdminCreateCopy } from '@/lib/uiCopy';
import { Eye, EyeOff } from 'lucide-react';
import { z } from 'zod';

const emailSchema = z.string().email('E-mail inválido');
const passwordSchema = z.string().min(8, 'Senha deve ter no mínimo 8 caracteres.');
const nameSchema = z.string().min(2, 'Nome deve ter no mínimo 2 caracteres');

export type CreatedAdminUser = {
  id: string;
  email: string;
  full_name: string | null;
  account_type: AccountType;
};

function getPasswordStrength(pwd: string): { score: number; label: string } {
  if (!pwd) return { score: 0, label: '' };
  let score = 0;
  if (pwd.length >= 8) score += 25;
  if (pwd.length >= 12) score += 15;
  if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score += 20;
  if (/\d/.test(pwd)) score += 20;
  if (/[^a-zA-Z0-9]/.test(pwd)) score += 20;
  if (score >= 70) return { score: 100, label: 'Forte' };
  if (score >= 40) return { score: 66, label: 'Média' };
  return { score: 33, label: 'Fraca' };
}

type AdminCreateUserFormProps = {
  idPrefix?: string;
  onSuccess: (created: CreatedAdminUser) => void;
  onCancel?: () => void;
  showCancel?: boolean;
  submitLabel?: string;
};

export function AdminCreateUserForm({
  idPrefix = 'admin-new',
  onSuccess,
  onCancel,
  showCancel = true,
  submitLabel = 'Criar usuário',
}: AdminCreateUserFormProps) {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [accountType, setAccountType] = useState<AccountType>('solo');
  const [organizationName, setOrganizationName] = useState('');
  const passwordStrength = getPasswordStrength(password);
  const copy = getAdminCreateCopy(accountType);
  const isShared = isSharedOrgAccount(accountType);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      nameSchema.parse(fullName);
      emailSchema.parse(email);
      passwordSchema.parse(password);
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast.error(err.errors[0].message);
        return;
      }
    }
    if (password !== confirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }

    setIsLoading(true);
    try {
      const data = await adminCreateUser({
        email: email.trim(),
        password,
        full_name: fullName.trim(),
        account_type: accountType,
        organization_name: isShared ? organizationName.trim() || fullName.trim() : null,
      });
      const createdId = data?.user?.id ?? '';
      const createdType = normalizeAccountType(data?.account_type ?? accountType);
      await logAdminActivity({
        action: 'create',
        entity_type: 'user',
        entity_id: createdId || undefined,
        details: { email: email.trim(), account_type: createdType },
        admin_email: user?.email ?? '',
      }).catch(() => {});
      toast.success(
        createdType === 'salon'
          ? copy.createdToast
          : createdType === 'clinic'
            ? 'Clínica criada com sucesso (Master da conta).'
            : 'Profissional único criado com sucesso.'
      );
      onSuccess({
        id: createdId,
        email: email.trim(),
        full_name: fullName.trim(),
        account_type: createdType,
      });
      setFullName('');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setAccountType('solo');
      setOrganizationName('');
      setShowPassword(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar perfil. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-account-type`}>Tipo de conta</Label>
        <Select
          value={accountType}
          onValueChange={(value) => setAccountType(normalizeAccountType(value))}
        >
          <SelectTrigger id={`${idPrefix}-account-type`}>
            <SelectValue placeholder="Selecione o tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="solo">{ACCOUNT_TYPE_LABELS.solo}</SelectItem>
            <SelectItem value="clinic">{ACCOUNT_TYPE_LABELS.clinic}</SelectItem>
            <SelectItem value="salon">{ACCOUNT_TYPE_LABELS.salon}</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {accountType === 'salon'
            ? 'Cria o Admin do salão. Ele pode atender e também adicionar outros profissionais.'
            : accountType === 'clinic'
              ? 'Cria o Master da clínica. Filiais, profissionais e atendentes entram nas próximas fases.'
              : 'Conta isolada como hoje: 1 login = 1 profissional.'}
        </p>
      </div>

      {isShared ? (
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-org-name`}>{copy.orgNameLabel}</Label>
          <Input
            id={`${idPrefix}-org-name`}
            type="text"
            placeholder={copy.orgNamePlaceholder}
            value={organizationName}
            onChange={(e) => setOrganizationName(e.target.value)}
            autoComplete="organization"
          />
          <p className="text-xs text-muted-foreground">
            Se vazio, usa o nome completo do {accountType === 'salon' ? 'Admin' : 'Master'}.
          </p>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-name`}>
          {isShared ? copy.masterName : 'Nome completo (obrigatório)'}
        </Label>
        <Input
          id={`${idPrefix}-name`}
          type="text"
          placeholder="Nome completo"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
          minLength={2}
          autoComplete="name"
        />
        {fullName.length > 0 && fullName.length < 2 && (
          <p className="text-xs text-destructive">Nome deve ter no mínimo 2 caracteres.</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-email`}>E-mail (obrigatório)</Label>
        <Input
          id={`${idPrefix}-email`}
          type="email"
          placeholder="email@exemplo.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-password`}>Senha (obrigatório)</Label>
        <div className="relative">
          <Input
            id={`${idPrefix}-password`}
            type={showPassword ? 'text' : 'password'}
            placeholder="Mín. 8 caracteres"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {password.length > 0 && (
          <>
            <Progress value={passwordStrength.score} className="h-2 mt-1" aria-hidden />
            <p className="text-xs text-muted-foreground">
              Força: {passwordStrength.label || '—'}. Recomendado: 8+ caracteres, letras maiúsculas,
              minúsculas, números e símbolos.
            </p>
          </>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-confirm`}>Confirmar senha (obrigatório)</Label>
        <Input
          id={`${idPrefix}-confirm`}
          type="password"
          placeholder="••••••••"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          autoComplete="new-password"
        />
        {confirmPassword && password !== confirmPassword && (
          <p className="text-xs text-destructive">As senhas não coincidem.</p>
        )}
      </div>
      <div className="flex flex-wrap gap-2 pt-2">
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Criando...' : submitLabel}
        </Button>
        {showCancel && onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
            Cancelar
          </Button>
        ) : null}
      </div>
    </form>
  );
}
