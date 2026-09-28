import { useQuery } from '@tanstack/react-query';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useClinicMaster } from '@/hooks/use-clinic-master';
import { useClinicMemberRole } from '@/hooks/use-clinic-member-role';
import { useBranchBranding } from '@/hooks/use-branch-branding';
import { queryKeys } from '@/api/queryKeys';
import { supabase } from '@/integrations/supabase/client';
import { getProceduresForProfile } from '@/lib/proceduresForProfile';
import {
  Tag,
  Activity,
  Droplet,
  Flame,
  Scissors,
  Sparkle,
  Smile,
  Snowflake,
  Waves,
  Wind,
  Zap,
  Plus,
  ClipboardList,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ProcedureForMenu {
  id: string;
  name: string;
  slug: string;
}

/** @deprecated Use queryKeys.menuProcedures / queryKeys.menuProceduresForProfile */
export const MENU_PROCEDURES_QUERY_KEY = queryKeys.menuProcedures;

const PROCEDURE_ICON_BY_SLUG: Record<string, typeof Tag> = {
  'emagrecimento-reducao-medidas': Activity,
  botox: Sparkle,
  'limpeza-de-pele': Droplet,
  'microagulhamento-facial': Zap,
  microagulhamento: Zap,
  'peeling-quimico': Flame,
  peeling: Flame,
  'preenchimento-facial': Smile,
  'rejuvenescimento-facial': Sparkle,
  'tratamento-acne': Droplet,
  'tratamento-manchas': Droplet,
  'tratamento-manchas-melasma': Droplet,
  'depilacao-laser': Scissors,
  'laser-luz-pulsada': Zap,
  'led-terapia': Waves,
  'drenagem-linfatica': Wind,
  'criolipolise': Snowflake,
  'radiofrequencia-corporal': Waves,
  'ultrassom-cavitacional': Waves,
  'ultrassom-microfocado': Waves,
  'ultrassom-macrofocado': Waves,
  endolaser: Zap,
  'fios-pdo': Activity,
  'fios-aptos': Activity,
  'bioestimulador-colageno': Droplet,
  'lipo-papada-enzimatica': Droplet,
  'lipo-enzimatica-gordura-localizada': Activity,
  lipoenzimatica: Activity,
  enzimas: Droplet,
  'i-lipo': Flame,
  ozonio: Waves,
  'depilacao-laser': Zap,
  'depilacao-definitiva-feminina': Zap,
  'depilacao-definitiva-masculina': Zap,
  'acelerador-metabolico': Flame,
  avaliacao: ClipboardList,
  'harmonizacao-glutea': Smile,
  'endermologia': Wind,
  'massagem-relaxante': Wind,
  'massagem-modeladora': Wind,
  'tratamento-capilar': Droplet,
  'terapia-capilar': Droplet,
  'microagulhamento-capilar': Zap,
  'prp-capilar': Droplet,
  'skinbooster': Droplet,
};

export function getProcedureIcon(slug: string) {
  return PROCEDURE_ICON_BY_SLUG[slug] ?? Tag;
}

export function ProceduresSidebar() {
  const { profile } = useAuth();
  const location = useLocation();
  const { isMaster: isClinicMaster, isClinicAccount } = useClinicMaster();
  const { isFrontDeskStaff, isClinicClinicalProfessional } = useClinicMemberRole();
  const { appName, appDescription, appLogoUrl } = useBranchBranding();

  const { data: menuProcedures = [] } = useQuery({
    queryKey: queryKeys.menuProceduresForProfile(profile?.id ?? ''),
    queryFn: async (): Promise<ProcedureForMenu[]> => {
      if (!profile?.id) return [];
      const [procs, upRes] = await Promise.all([
        getProceduresForProfile(profile.id),
        supabase
          .from('user_procedures')
          .select('procedure_id, is_active, show_in_menu')
          .eq('user_id', profile.id),
      ]);
      const prefs = (upRes.data ?? []) as { procedure_id: string; is_active: boolean; show_in_menu: boolean }[];
      const prefsMap = new Map(prefs.map((p) => [p.procedure_id, p]));
      return procs.filter((p) => {
        const up = prefsMap.get(p.id);
        if (!up) return true;
        return up.is_active !== false && up.show_in_menu !== false;
      });
    },
    enabled: !!profile?.id && !isClinicMaster,
  });

  if (isClinicMaster || isFrontDeskStaff || isClinicClinicalProfessional) return null;

  const isProcedureActive = (slug: string) =>
    location.pathname === `/procedures/${slug}` || location.pathname.startsWith(`/procedures/${slug}/`);

  return (
    <aside className="hidden lg:flex flex-col w-44 xl:w-52 bg-primary shadow-[2px_0_8px_rgba(0,0,0,0.06)] fixed left-0 top-16 bottom-0 z-40">
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-white/95 flex items-center justify-center overflow-hidden shadow-sm">
            {appLogoUrl ? (
              <img src={appLogoUrl} alt="" className="h-full w-full object-contain p-1.5" />
            ) : (
              <Sparkle className="h-4 w-4 text-primary" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white break-words line-clamp-2">
              {appName}
            </p>
            <p className="text-[11px] text-white/80 break-words line-clamp-2">
              {appDescription}
            </p>
          </div>
        </div>
      </div>
      <div className="h-px bg-white/10 mx-2" />
      <nav className="flex-1 overflow-y-auto py-4 space-y-1 px-3 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
        {menuProcedures.map((proc) => {
          const ProcIcon = getProcedureIcon(proc.slug);
          const active = isProcedureActive(proc.slug);
          return (
            <Link
              key={proc.id}
              to={`/procedures/${proc.slug}`}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-300 text-left",
                active
                  ? "bg-white text-primary shadow-md"
                  : "text-white/90 hover:text-white hover:bg-white/15"
              )}
            >
              <ProcIcon className="w-5 h-5 shrink-0" />
              <span className="text-sm font-medium break-words line-clamp-2">{proc.name}</span>
            </Link>
          );
        })}
      </nav>
      <div className="h-px bg-white/10 mx-2" />
      {/* Gerenciar procedimentos = Configurações: só profissional único (não funcionários da filial) */}
      {!isClinicAccount && (
        <div className="p-3">
          <Link
            to="/settings"
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-white/90 hover:text-white hover:bg-white/15 transition-all duration-300"
          >
            <Plus className="w-5 h-5 shrink-0" />
            <span className="text-sm font-medium">Gerenciar Procedimentos</span>
          </Link>
        </div>
      )}
    </aside>
  );
}
