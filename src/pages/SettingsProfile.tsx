import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  BrowserTabs,
  BrowserTabsContent,
  BrowserTabsList,
  BrowserTabsTrigger,
} from '@/components/ui/browser-tabs';
import { User, Shield, LogOut, Upload, Eye, EyeOff, Stamp } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { SignaturePad } from '@/components/SignaturePad';
import { ProfessionalStampPreview } from '@/components/ProfessionalStampPreview';
import { useClinicMemberRole } from '@/hooks/use-clinic-member-role';
import { DateInputField } from '@/components/ui/date-input-field';
import {
  ClinicMemberRoleFields,
  memberRoleDraftFromProfile,
  resolveCouncilBody,
  resolveRegistryNumber,
  type ClinicMemberRoleDraft,
} from '@/components/clinic/ClinicMemberRoleFields';
import {
  createProfessionalStampDataUrl,
  formatProfessionalStampRegistry,
  formatProfessionalStampTitle,
} from '@/lib/professionalStamp';
import { parseLocalDate } from '@/lib/utils';
import { formatPhoneDisplay, normalizePhoneDigits } from '@/lib/phone';
import { format } from 'date-fns';

export default function SettingsProfile() {
  const {
    user,
    profile,
    signOut,
    updateProfile,
    updateAvatar,
    updateDefaultSignature,
    updateProfessionalClinicProfile,
    updateProfessionalStamp,
  } = useAuth();
  const { isClinicClinicalProfessional } = useClinicMemberRole();
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [savingDefaultSignature, setSavingDefaultSignature] = useState(false);
  const [savingStamp, setSavingStamp] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? '');
  /** Quando true, exibe o SignaturePad (não tem assinatura ou clicou em "Refazer assinatura") */
  const [showSignaturePad, setShowSignaturePad] = useState(() => !profile?.default_signature_data);
  const refazerSignatureClickedRef = useRef(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);

  const [dateOfBirth, setDateOfBirth] = useState<Date | undefined>(() =>
    profile?.date_of_birth ? parseLocalDate(profile.date_of_birth) : undefined
  );
  const [phone, setPhone] = useState(() => normalizePhoneDigits(profile?.phone ?? ''));
  const [roleDraft, setRoleDraft] = useState<ClinicMemberRoleDraft>(() =>
    memberRoleDraftFromProfile({
      councilBody: profile?.professional_registry_body,
      registryNumber: profile?.professional_registry_number,
      specialty: profile?.professional_specialty,
      staffTitle: null,
      systemRole: 'professional',
    })
  );
  const [savingClinicProfile, setSavingClinicProfile] = useState(false);
  useEffect(() => {
    if (profile?.default_signature_data && !refazerSignatureClickedRef.current) {
      setShowSignaturePad(false);
    }
  }, [profile?.default_signature_data]);

  useEffect(() => {
    setFullName(profile?.full_name ?? '');
  }, [profile?.full_name]);

  useEffect(() => {
    setAvatarUrl(profile?.avatar_url ?? '');
  }, [profile?.avatar_url]);

  useEffect(() => {
    setDateOfBirth(profile?.date_of_birth ? parseLocalDate(profile.date_of_birth) : undefined);
  }, [profile?.date_of_birth]);

  useEffect(() => {
    setPhone(normalizePhoneDigits(profile?.phone ?? ''));
  }, [profile?.phone]);

  useEffect(() => {
    if (!isClinicClinicalProfessional) return;
    setRoleDraft(
      memberRoleDraftFromProfile({
        councilBody: profile?.professional_registry_body,
        registryNumber: profile?.professional_registry_number,
        specialty: profile?.professional_specialty,
        staffTitle: null,
        systemRole: 'professional',
      })
    );
  }, [
    isClinicClinicalProfessional,
    profile?.professional_registry_body,
    profile?.professional_registry_number,
    profile?.professional_specialty,
  ]);

  const handleSaveName = async () => {
    const trimmed = fullName.trim();
    if (trimmed === (profile?.full_name ?? '')) return;
    setSaving(true);
    const { error } = await updateProfile(trimmed);
    setSaving(false);
    if (error) toast.error('Não foi possível atualizar o nome.');
    else toast.success('Nome atualizado.');
  };

  const clinicProfileDirty = (() => {
    if (!isClinicClinicalProfessional) return false;
    const savedDob = profile?.date_of_birth ?? null;
    const nextDob = dateOfBirth ? format(dateOfBirth, 'yyyy-MM-dd') : null;
    const savedPhone = normalizePhoneDigits(profile?.phone ?? '') || null;
    const nextPhone = normalizePhoneDigits(phone) || null;
    const nextBody = resolveCouncilBody(roleDraft);
    const nextNumber = nextBody ? resolveRegistryNumber(roleDraft) : null;
    const nextSpecialty = nextBody ? roleDraft.specialty.trim() || null : null;
    return (
      nextDob !== savedDob ||
      nextPhone !== savedPhone ||
      nextBody !== (profile?.professional_registry_body ?? null) ||
      nextNumber !== (profile?.professional_registry_number ?? null) ||
      nextSpecialty !== (profile?.professional_specialty ?? null)
    );
  })();

  const handleSaveClinicProfile = async () => {
    if (!isClinicClinicalProfessional) return;
    const nameChanged = fullName.trim() !== (profile?.full_name ?? '') && fullName.trim().length > 0;
    if (!clinicProfileDirty && !nameChanged) return;

    setSavingClinicProfile(true);
    if (nameChanged) {
      const { error: nameError } = await updateProfile(fullName.trim());
      if (nameError) {
        setSavingClinicProfile(false);
        toast.error('Não foi possível atualizar o nome.');
        return;
      }
    }
    if (clinicProfileDirty) {
      const nextBody = resolveCouncilBody(roleDraft);
      const { error } = await updateProfessionalClinicProfile({
        date_of_birth: dateOfBirth ? format(dateOfBirth, 'yyyy-MM-dd') : null,
        phone: normalizePhoneDigits(phone) || null,
        professional_registry_body: nextBody,
        professional_registry_number: nextBody ? resolveRegistryNumber(roleDraft) : null,
        professional_specialty: nextBody ? roleDraft.specialty.trim() || null : null,
      });
      setSavingClinicProfile(false);
      if (error) {
        toast.error(
          error.message?.includes('column') || error.message?.includes('schema cache')
            ? 'Coluna ausente no banco. Aplique as migrations de perfil (telefone / nascimento / carimbo) no Supabase.'
            : error.message || 'Não foi possível salvar o perfil na clínica.'
        );
        return;
      }
    } else {
      setSavingClinicProfile(false);
    }
    toast.success('Perfil atualizado.');
  };

  const getInitials = (name: string | null) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const handleSignOut = async () => {
    await signOut();
    toast.success('Você saiu da sua conta');
  };

  const handleSaveAvatar = async () => {
    setSavingAvatar(true);
    const { error } = await updateAvatar(avatarUrl.trim() || null);
    setSavingAvatar(false);
    if (error) toast.error('Não foi possível atualizar a foto.');
    else toast.success('Foto atualizada.');
  };

  const handleSaveDefaultSignature = async (dataUrl: string) => {
    setSavingDefaultSignature(true);
    const { error } = await updateDefaultSignature(dataUrl);
    setSavingDefaultSignature(false);
    if (error) toast.error('Não foi possível salvar a assinatura.');
    else {
      toast.success('Assinatura padrão salva. Use "Usar minha assinatura padrão" nas consultas.');
      refazerSignatureClickedRef.current = false;
      setShowSignaturePad(false);
    }
  };

  const stampRegistryLine = formatProfessionalStampRegistry(
    profile?.professional_registry_body || resolveCouncilBody(roleDraft),
    profile?.professional_registry_number || resolveRegistryNumber(roleDraft)
  );
  const stampTitleLine = formatProfessionalStampTitle(
    profile?.professional_registry_body || resolveCouncilBody(roleDraft),
    profile?.professional_specialty || roleDraft.specialty
  );

  const handleCreateStamp = async () => {
    if (!profile?.default_signature_data) {
      toast.error('Salve sua assinatura antes de criar o carimbo.');
      return;
    }
    if (!stampRegistryLine) {
      toast.error('Preencha o conselho, o nº de registro e o estado no perfil antes de criar o carimbo.');
      return;
    }
    setSavingStamp(true);
    try {
      const dataUrl = await createProfessionalStampDataUrl({
        signatureDataUrl: profile.default_signature_data,
        fullName: (profile.full_name || fullName || 'Profissional').trim(),
        registryLine: stampRegistryLine,
        titleLine: stampTitleLine,
      });
      const { error } = await updateProfessionalStamp(dataUrl);
      if (error) toast.error('Não foi possível salvar o carimbo.');
      else toast.success('Carimbo criado.');
    } catch {
      toast.error('Não foi possível gerar o carimbo.');
    } finally {
      setSavingStamp(false);
    }
  };

  const handleAvatarFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile?.id) return;
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
    if (!/^(jpe?g|png|gif|webp)$/.test(ext)) {
      toast.error('Use uma imagem (JPEG, PNG, GIF ou WebP).');
      return;
    }
    setUploadingAvatar(true);
    const path = `${profile.id}/avatar.${ext}`;
    const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, {
      cacheControl: '3600',
      upsert: true,
    });
    if (uploadError) {
      setUploadingAvatar(false);
      console.error('Avatar upload error:', uploadError);
      toast.error(`Não foi possível enviar a imagem. ${uploadError.message ?? ''}`.trim());
      return;
    }
    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
    const versionedUrl = `${publicUrl}?v=${Date.now()}`;
    setAvatarUrl(versionedUrl);
    setUploadingAvatar(false);
    setSavingAvatar(true);
    const { error } = await updateAvatar(versionedUrl);
    setSavingAvatar(false);
    if (error) {
      toast.error('Não foi possível salvar a foto no perfil.');
      return;
    }
    toast.success('Foto atualizada.');
    e.target.value = '';
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.email) return;
    if (newPassword.length < 6) {
      toast.error('A nova senha deve ter no mínimo 6 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('A nova senha e a confirmação não coincidem.');
      return;
    }
    setSavingPassword(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });
    if (signInError) {
      setSavingPassword(false);
      toast.error('Senha atual incorreta.');
      return;
    }
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPassword(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    if (updateError) {
      toast.error(updateError.message || 'Não foi possível alterar a senha.');
      return;
    }
    setShowPasswordForm(false);
    toast.success('Senha alterada com sucesso.');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5 animate-fade-in">
      <div className="pb-4 border-b border-border">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
          Conta
        </p>
        <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-foreground tracking-tight">
          Meu perfil
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Suas informações pessoais, identidade e preferências
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-3">
        <Avatar className="w-14 h-14 sm:w-16 sm:h-16 shrink-0">
          <AvatarImage src={avatarUrl || profile?.avatar_url || undefined} />
          <AvatarFallback className="bg-primary/10 text-primary text-lg sm:text-2xl">
            {getInitials(profile?.full_name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 text-center sm:text-left">
          <h3 className="font-semibold text-base sm:text-lg break-words line-clamp-2">
            {profile?.full_name || 'Usuário'}
          </h3>
          <p className="text-muted-foreground text-sm break-all">{profile?.email}</p>
        </div>
      </div>

      <BrowserTabs defaultValue="perfil" className="space-y-4">
        <BrowserTabsList>
          <BrowserTabsTrigger value="perfil" className="gap-1.5">
            <User className="h-3.5 w-3.5" />
            Perfil
          </BrowserTabsTrigger>
          <BrowserTabsTrigger value="carimbo" className="gap-1.5">
            <Stamp className="h-3.5 w-3.5" />
            Carimbo
          </BrowserTabsTrigger>
          <BrowserTabsTrigger value="seguranca" className="gap-1.5">
            <Shield className="h-3.5 w-3.5" />
            Segurança
          </BrowserTabsTrigger>
        </BrowserTabsList>

        <BrowserTabsContent value="perfil" className="space-y-5 mt-0">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Perfil
              </CardTitle>
              <CardDescription>Suas informações pessoais</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-3">
                <div>
                  <Label>Foto do profissional</Label>
                  <p className="text-xs text-muted-foreground">Escolha uma imagem para o seu perfil.</p>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    className="sr-only w-0 h-0"
                    id="avatar-file"
                    onChange={handleAvatarFileSelect}
                    disabled={uploadingAvatar}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => document.getElementById('avatar-file')?.click()}
                    disabled={uploadingAvatar}
                  >
                    <Upload className="w-4 h-4" />
                    {uploadingAvatar ? 'Enviando...' : 'Escolher do computador'}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleSaveAvatar}
                    disabled={savingAvatar || avatarUrl.trim() === (profile?.avatar_url ?? '')}
                  >
                    {savingAvatar ? 'Salvando...' : 'Salvar foto'}
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome Completo</Label>
                    <Input
                      id="name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Seu nome"
                      disabled={saving || savingClinicProfile}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail</Label>
                    <Input id="email" value={profile?.email ?? ''} disabled />
                  </div>
                  {isClinicClinicalProfessional ? (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="clinic-self-dob">Data de nascimento</Label>
                        <DateInputField
                          inputId="clinic-self-dob"
                          value={dateOfBirth}
                          onChange={setDateOfBirth}
                          maxDate={new Date()}
                          toYear={new Date().getFullYear()}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="clinic-self-phone">Telefone</Label>
                        <Input
                          id="clinic-self-phone"
                          type="tel"
                          inputMode="tel"
                          value={formatPhoneDisplay(phone)}
                          onChange={(e) => setPhone(normalizePhoneDigits(e.target.value))}
                          placeholder="(00) 00000-0000"
                          disabled={savingClinicProfile}
                        />
                      </div>
                    </>
                  ) : null}
                </div>

                {isClinicClinicalProfessional ? (
                  <ClinicMemberRoleFields
                    draft={roleDraft}
                    onChange={(patch) => setRoleDraft((prev) => ({ ...prev, ...patch }))}
                    idPrefix="clinic-self"
                    hideSystemAccess
                  />
                ) : null}

                {isClinicClinicalProfessional ? (
                  <Button
                    type="button"
                    onClick={handleSaveClinicProfile}
                    disabled={
                      savingClinicProfile ||
                      (!clinicProfileDirty && fullName.trim() === (profile?.full_name ?? ''))
                    }
                  >
                    {savingClinicProfile ? 'Salvando...' : 'Salvar perfil'}
                  </Button>
                ) : (
                  <>
                    <Button
                      onClick={handleSaveName}
                      disabled={saving || fullName.trim() === (profile?.full_name ?? '')}
                    >
                      {saving ? 'Salvando...' : 'Atualizar nome'}
                    </Button>
                    <p className="text-sm text-muted-foreground">
                      Altere o nome acima e clique em &quot;Atualizar nome&quot; para salvar no seu perfil.
                    </p>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </BrowserTabsContent>

        <BrowserTabsContent value="carimbo" className="space-y-5 mt-0">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Stamp className="w-5 h-5" />
                Carimbo
              </CardTitle>
              <CardDescription>
                Assinatura do profissional (pode ser digital) e carimbo com conselho
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-3 rounded-xl border p-4">
                <div>
                  <p className="text-sm font-semibold">Minha assinatura padrão</p>
                  <p className="text-xs text-muted-foreground">
                    Salve aqui para usar em consultas sem precisar assinar toda vez.
                  </p>
                </div>
                {profile?.default_signature_data && !showSignaturePad ? (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <img
                      src={profile.default_signature_data}
                      alt="Sua assinatura padrão"
                      className="h-16 w-auto max-w-full border rounded bg-muted/30 object-contain shrink-0"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        refazerSignatureClickedRef.current = true;
                        setShowSignaturePad(true);
                      }}
                    >
                      Refazer assinatura
                    </Button>
                  </div>
                ) : (
                  <>
                    <SignaturePad
                      label="Assinatura do profissional"
                      onSave={handleSaveDefaultSignature}
                      height={160}
                    />
                    {savingDefaultSignature && (
                      <p className="text-xs text-muted-foreground">Salvando...</p>
                    )}
                  </>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  onClick={handleCreateStamp}
                  disabled={
                    savingStamp ||
                    !profile?.default_signature_data ||
                    !stampRegistryLine
                  }
                >
                  {savingStamp ? 'Gerando...' : 'Criar carimbo'}
                </Button>
                {!profile?.default_signature_data || !stampRegistryLine ? (
                  <p className="text-xs text-muted-foreground">
                    {!profile?.default_signature_data
                      ? 'Salve a assinatura para liberar o carimbo.'
                      : 'Preencha conselho e nº de registro na aba Perfil.'}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold">Pré-visualização</p>
                <p className="text-xs text-muted-foreground">
                  Assim o carimbo aparece nos documentos (assinatura + nome + conselho).
                </p>
                <ProfessionalStampPreview
                  signatureDataUrl={profile?.default_signature_data}
                  fullName={(profile?.full_name || fullName || '').trim()}
                  registryLine={stampRegistryLine}
                  titleLine={stampTitleLine}
                  className="max-w-md"
                />
                {profile?.professional_stamp_data ? (
                  <div className="space-y-2 pt-2">
                    <p className="text-xs font-medium text-muted-foreground">Carimbo salvo</p>
                    <img
                      src={profile.professional_stamp_data}
                      alt="Carimbo profissional"
                      className="max-w-md w-full border rounded-xl bg-white object-contain"
                    />
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </BrowserTabsContent>

        <BrowserTabsContent value="seguranca" className="space-y-5 mt-0">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Segurança
              </CardTitle>
              <CardDescription>Configurações de segurança da sua conta</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!showPasswordForm ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowPasswordForm(true)}
                  className="gap-2"
                >
                  <Shield className="w-4 h-4" />
                  Trocar senha
                </Button>
              ) : (
                <form onSubmit={handleChangePassword} className="space-y-4 max-w-sm">
                  <div className="space-y-2">
                    <Label htmlFor="current-password">Senha atual</Label>
                    <div className="relative">
                      <Input
                        id="current-password"
                        type={showCurrentPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        required
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        aria-label={showCurrentPassword ? 'Ocultar senha' : 'Mostrar senha'}
                      >
                        {showCurrentPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-password">Nova senha</Label>
                    <div className="relative">
                      <Input
                        id="new-password"
                        type={showNewPassword ? 'text' : 'password'}
                        placeholder="Mín. 6 caracteres"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                        minLength={6}
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        aria-label={showNewPassword ? 'Ocultar senha' : 'Mostrar senha'}
                      >
                        {showNewPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirmar nova senha</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      autoComplete="new-password"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="submit" disabled={savingPassword}>
                      {savingPassword ? 'Alterando...' : 'Trocar senha'}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setShowPasswordForm(false);
                        setCurrentPassword('');
                        setNewPassword('');
                        setConfirmPassword('');
                        setShowCurrentPassword(false);
                        setShowNewPassword(false);
                      }}
                    >
                      Cancelar
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>

          <Card className="border-destructive/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <LogOut className="w-5 h-5" />
                Sair da Conta
              </CardTitle>
              <CardDescription>Encerre sua sessão atual</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="destructive" onClick={handleSignOut} className="gap-2">
                <LogOut className="w-4 h-4" />
                Sair
              </Button>
            </CardContent>
          </Card>
        </BrowserTabsContent>
      </BrowserTabs>
    </div>
  );
}
