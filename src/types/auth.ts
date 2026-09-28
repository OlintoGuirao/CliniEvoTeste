/**
 * Tipos de autenticação e perfil — usados por AuthContext e api/profiles.
 */

export type ThemePreference = 'light' | 'dark' | 'system';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  /** Sincroniza o "Limpar notificações" entre dispositivos (APK/Web). */
  notifications_cleared_at?: string | null;
  is_blocked?: boolean;
  blocked_at?: string | null;
  blocked_reason?: string | null;
  /** Tipo de conta (Admin): solo | clinic | salon */
  account_type?: 'solo' | 'clinic' | 'salon' | null;
  organization_id?: string | null;
  theme?: ThemePreference | null;
  accent_color?: string | null;
  theme_palette?: string | null;
  app_name?: string | null;
  app_description?: string | null;
  app_logo_url?: string | null;
  professional_registry_body?: string | null;
  professional_registry_number?: string | null;
  professional_specialty?: string | null;
  /** Data de nascimento do profissional (YYYY-MM-DD). */
  date_of_birth?: string | null;
  /** Telefone do profissional (dígitos). */
  phone?: string | null;
  default_signature_data?: string | null;
  /** Carimbo digital (assinatura + nome + conselho), data URL. */
  professional_stamp_data?: string | null;
  work_start_time?: string | null;
  work_end_time?: string | null;
  work_days?: number[] | null;
  lunch_start_time?: string | null;
  lunch_end_time?: string | null;
  lunch_breaks?: LunchBreak[] | null;
  updated_at?: string | null;
}

export type LunchBreak = {
  start: string;
  end: string;
};
