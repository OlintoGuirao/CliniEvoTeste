export type MasterDashboardPeriodPreset = 'hoje' | 'semana' | 'mes' | '6meses' | 'personalizado';

export interface MasterDashboardFilters {
  dataInicio: string;
  dataFim: string;
  branchId?: string | null;
  professionalId?: string | null;
  procedureId?: string | null;
  status?: string | null;
}

export interface MasterDashboardComparison {
  value: number;
  previousValue: number;
  deltaPercent: number | null;
  trend: 'up' | 'down' | 'neutral';
}

export interface MasterDashboardKpi {
  total: number;
  today?: number;
  comparison: MasterDashboardComparison;
}

export interface MasterDashboardMoneyKpi {
  total: number;
  comparison: MasterDashboardComparison;
}

export interface MasterDashboardConversion {
  ratePercent: number | null;
  numerator: number;
  denominator: number;
  formula: string;
}

export interface MasterDashboardTopTreatment {
  procedureId: string | null;
  name: string;
  value: number;
  quantity: number;
  sharePercent: number;
}

export interface MasterDashboardSalesEvolutionPoint {
  key: string;
  label: string;
  value: number;
}

export interface MasterDashboardStatusSlice {
  status: string;
  label: string;
  value: number;
  amount: number;
}

export interface MasterDashboardBranchMetrics {
  branchId: string;
  branchName: string;
  appointments: number;
  evaluations: number;
  closings: number;
  revenue: number;
  expenses: number;
  conversionPercent: number | null;
  ticketMedio: number | null;
}

export interface MasterDashboardInsight {
  id: string;
  type: 'success' | 'warning' | 'info' | 'opportunity';
  title: string;
  description: string;
}

export interface MasterDashboardGoalProgress {
  hasGoal: boolean;
  target: number | null;
  achieved: number;
  percent: number | null;
}

export interface MasterDashboardDetailRow {
  id: string;
  date: string;
  label: string;
  secondary?: string;
  amount?: number | null;
  status?: string | null;
  branchName?: string | null;
  professionalName?: string | null;
}

export interface MasterDashboardResponse {
  organization: { id: string; name: string };
  user: { id: string; name: string };
  branches: Array<{ id: string; name: string }>;
  filters: MasterDashboardFilters;
  kpis: {
    appointments: MasterDashboardKpi;
    evaluations: MasterDashboardKpi;
    closings: MasterDashboardKpi;
    revenue: MasterDashboardMoneyKpi;
    expenses: MasterDashboardMoneyKpi;
    ticketMedio: MasterDashboardMoneyKpi;
  };
  conversion: MasterDashboardConversion;
  topTreatment: MasterDashboardTopTreatment | null;
  topTreatments: MasterDashboardTopTreatment[];
  salesEvolution: MasterDashboardSalesEvolutionPoint[];
  salesByStatus: MasterDashboardStatusSlice[];
  branchComparison: MasterDashboardBranchMetrics[];
  branchRanking: MasterDashboardBranchMetrics[];
  goalProgress: MasterDashboardGoalProgress;
  insights: MasterDashboardInsight[];
  details: {
    appointments: MasterDashboardDetailRow[];
    evaluations: MasterDashboardDetailRow[];
    closings: MasterDashboardDetailRow[];
    revenue: MasterDashboardDetailRow[];
    expenses: MasterDashboardDetailRow[];
  };
  generatedAt: string;
}

export type MasterDashboardDetailKind =
  | 'appointments'
  | 'evaluations'
  | 'closings'
  | 'revenue'
  | 'expenses';
