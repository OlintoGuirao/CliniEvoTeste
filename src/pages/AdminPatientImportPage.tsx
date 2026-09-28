import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { Loader2, Upload, Download } from 'lucide-react';
import type { PostgrestError } from '@supabase/supabase-js';

import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { fetchAdminUsers } from '@/services/api/adminApi';

import type { Profile } from '@/services/api/adminApi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const ADMIN_EMAIL = 'admin@clinievo.com.br';

type PatientImportRow = {
  // Canonical fields (matches supabase columns / useCreatePatient payload)
  full_name: string;
  phone: string | null;
  cpf: string | null;
  date_of_birth: string | null; // YYYY-MM-DD
  sex: 'male' | 'female' | 'other' | null;
  profession: string | null;
  address: string | null;
  city: string | null;
  referred_by: string | null;
  treatment_start_date: string | null; // YYYY-MM-DD
  consultation_objective: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  general_notes: string | null;
  // Import metadata
  rowNumber: number; // 1-based (header is row 1)
  keyType: 'phone' | 'cpf';
  key: string;
  errors: string[];
};

function normalizeHeader(s: unknown) {
  return String(s ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function normalizePhone(phone: unknown): string | null {
  const digits = String(phone ?? '').replace(/[^\d]/g, '');
  return digits ? digits : null;
}

function normalizeCpf(cpf: unknown): string | null {
  const digits = String(cpf ?? '').replace(/[^\d]/g, '');
  return digits ? digits : null;
}

function parsePtBrDateToYmd(s: unknown): string | null {
  const raw = String(s ?? '').trim();
  if (!raw) return null;

  // Accept already-normalized ISO date
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  // DD/MM/YYYY
  const m = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  return `${yyyy}-${mm}-${dd}`;
}

function parseSex(value: unknown): PatientImportRow['sex'] {
  const v = String(value ?? '').trim().toLowerCase();
  if (!v) return null;
  if (v === 'm' || v === 'male' || v === 'masculino') return 'male';
  if (v === 'f' || v === 'female' || v === 'feminino') return 'female';
  if (v === 'other' || v === 'outro') return 'other';
  return null;
}

function downloadTemplateCsv() {
  const header = [
    'Nome Completo',
    'Telefone',
    'CPF',
    'Data de nascimento', // DD/MM/YYYY
    'Sexo', // male|female|other (ou M/F/masculino/feminino/outro)
    'Profissão',
    'Endereço',
    'Cidade',
    'Indicado por',
    'Data de tratamento', // DD/MM/YYYY
    'Objetivo da consulta',
    'Contato de emergência - Nome',
    'Contato de emergência - Telefone',
    'Observações',
  ].join(',');

  // One empty example row
  const example = [
    'Maria Oliveira',
    '11 99999-9999',
    '',
    '20/05/1990',
    'feminino',
    'Médico(a)',
    'Rua Exemplo, 123',
    'São Paulo',
    'João da Silva',
    '01/01/2026',
    'Objetivo da consulta',
    'Contato Emergência',
    '11 98888-8888',
    'Observações',
  ]
    .map((v) => (v ?? '').toString().replaceAll('"', '""'))
    .map((v) => `"${v}"`)
    .join(',');

  const csv = `${header}\n${example}\n`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'modelo_import_pacientes.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function AdminPatientImportPage({ embedded = false }: { embedded?: boolean }) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const isAdmin = user?.email === ADMIN_EMAIL;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [professionalId, setProfessionalId] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [parsedRows, setParsedRows] = useState<PatientImportRow[]>([]);
  const [fileParseError, setFileParseError] = useState<string | null>(null);

  const [importResult, setImportResult] = useState<{ created: number; updated: number; skipped: number; errors: number } | null>(null);
  const [importBatch, setImportBatch] = useState<{
    professionalId: string;
    createdPatientIds: string[];
    updatedPatientIds: string[];
    createdAtIso: string;
  } | null>(null);

  useEffect(() => {
    if (user === null) return;
    if (!isAdmin) navigate('/dashboard', { replace: true });
  }, [user, isAdmin, navigate]);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetchAdminUsers();
        if (cancelled) return;
        // Profissionais (remove o admin)
        const procs = (res ?? []).filter((p) => p.email !== ADMIN_EMAIL);
        setProfiles(procs as Profile[]);
        setProfessionalId((prev) => prev || (procs[0]?.id ?? ''));
      } catch (e) {
        if (!cancelled) toast.error(e instanceof Error ? e.message : 'Erro ao carregar perfis');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  const headerAliases = useMemo(() => {
    return {
      full_name: ['full_name', 'nome', 'nome_completo', 'nomecompleto', 'full name', 'full-name', 'nome completo'],
      phone: ['phone', 'telefone', 'telefones', 'whatsapp', 'whatsapp_phone', 'telefone_whatsapp'],
      cpf: ['cpf', 'documento', 'cpf_cnpj', 'cpf_campo'],
      date_of_birth: ['date_of_birth', 'nascimento', 'data_nascimento', 'data_de_nascimento', 'birth_date'],
      sex: ['sex', 'sexo'],
      profession: ['profession', 'profissao', 'ocupacao'],
      address: ['address', 'endereco', 'endereço'],
      city: ['city', 'cidade'],
      referred_by: ['referred_by', 'indicado_por', 'indicado', 'referido_por'],
      treatment_start_date: [
        'treatment_start_date',
        'treatment_start',
        'data_inicio',
        'data_tratamento',
        'data_de_tratamento',
        'start_date',
      ],
      consultation_objective: ['consultation_objective', 'objetivo', 'objetivo_consulta', 'objetivo_da_consulta', 'objective'],
      emergency_contact_name: ['emergency_contact_name', 'contato_emergencia_nome', 'contato_de_emergencia_nome', 'emergency_name'],
      emergency_contact_phone: [
        'emergency_contact_phone',
        'contato_emergencia_telefone',
        'contato_de_emergencia_telefone',
        'emergency_phone',
      ],
      general_notes: ['general_notes', 'notes', 'observacoes', 'observações', 'general_note', 'observacoes_gerais'],
    } as Record<string, string[]>;
  }, []);

  const normalizeAliasIndex = (headers: string[]) => {
    const aliasIndex = new Map<string, string>(); // normalizedHeader -> canonicalKey
    for (const canonicalKey of Object.keys(headerAliases)) {
      for (const alias of headerAliases[canonicalKey as keyof typeof headerAliases]!) {
        aliasIndex.set(normalizeHeader(alias), canonicalKey);
      }
    }

    const headerMap = new Map<string, string>(); // canonicalKey -> actualHeader
    for (const h of headers) {
      const normalized = normalizeHeader(h);
      const canonical = aliasIndex.get(normalized);
      if (canonical) headerMap.set(canonical, h);
    }
    return headerMap;
  };

  const cellValue = (row: Record<string, unknown>, headerMap: Map<string, string>, key: string) => {
    const h = headerMap.get(key);
    if (!h) return undefined;
    return row[h];
  };

  const buildImportRows = (rawRows: Record<string, unknown>[]) => {
    const allHeaders = Array.from(new Set(rawRows.flatMap((r) => Object.keys(r))));
    const headerMap = normalizeAliasIndex(allHeaders);

    // Required: full_name + (phone OR cpf) (phone has priority)
    const canonicalFullNameHeader = headerMap.get('full_name');
    if (!canonicalFullNameHeader) {
      setFileParseError('Coluna obrigatória `full_name` não encontrada no arquivo.');
      return [];
    }

    const importNowIso = new Date().toISOString();

    const out: PatientImportRow[] = [];
    for (let i = 0; i < rawRows.length; i++) {
      const rowNumber = i + 2; // header is row 1
      const r = rawRows[i] ?? {};

      const full_name = String(cellValue(r, headerMap, 'full_name') ?? '').trim();
      const phoneRaw = cellValue(r, headerMap, 'phone');
      const cpfRaw = cellValue(r, headerMap, 'cpf');

      const phone = normalizePhone(phoneRaw);
      const cpf = normalizeCpf(cpfRaw);

      const errors: string[] = [];
      if (full_name.length < 2) errors.push('full_name inválido');
      if (!phone && !cpf) errors.push('É necessário `phone` ou `cpf` para deduplicação.');

      let keyType: PatientImportRow['keyType'] = 'phone';
      let key = '';
      if (phone) {
        keyType = 'phone';
        key = phone;
      } else if (cpf) {
        keyType = 'cpf';
        key = cpf;
      }

      const date_of_birth = parsePtBrDateToYmd(cellValue(r, headerMap, 'date_of_birth'));
      const sex = parseSex(cellValue(r, headerMap, 'sex'));
      const profession = String(cellValue(r, headerMap, 'profession') ?? '').trim() || null;
      const address = String(cellValue(r, headerMap, 'address') ?? '').trim() || null;
      const city = String(cellValue(r, headerMap, 'city') ?? '').trim() || null;
      const referred_by = String(cellValue(r, headerMap, 'referred_by') ?? '').trim() || null;
      const treatment_start_date = parsePtBrDateToYmd(cellValue(r, headerMap, 'treatment_start_date'));
      const consultation_objective = String(cellValue(r, headerMap, 'consultation_objective') ?? '').trim() || null;
      const emergency_contact_name = String(cellValue(r, headerMap, 'emergency_contact_name') ?? '').trim() || null;
      const emergency_contact_phone = normalizePhone(cellValue(r, headerMap, 'emergency_contact_phone'));
      const general_notes = String(cellValue(r, headerMap, 'general_notes') ?? '').trim() || null;

      out.push({
        full_name,
        phone,
        cpf,
        date_of_birth,
        sex,
        profession,
        address,
        city,
        referred_by,
        treatment_start_date,
        consultation_objective,
        emergency_contact_name,
        emergency_contact_phone,
        general_notes,
        rowNumber,
        keyType,
        key: key || '',
        errors,
      });

      // Prevent unused var in case TypeScript complains (kept for clarity when building payloads)
      void importNowIso;
    }

    return out;
  };

  const parseFile = async (file: File) => {
    setFileParseError(null);
    setImportResult(null);
    setParsedRows([]);
    setFileName(file.name);

    try {
      const ext = file.name.toLowerCase().split('.').pop();
      if (!ext) throw new Error('Arquivo sem extensão.');

      if (ext === 'csv') {
        const text = await file.text();
        const parsed = Papa.parse<Record<string, unknown>>(text, { header: true, skipEmptyLines: true });
        if (parsed.errors?.length) {
          throw new Error(parsed.errors[0]?.message ?? 'Erro ao ler CSV.');
        }
        const data = (parsed.data ?? []).filter((r) => r && Object.keys(r).length > 0);
        const rows = buildImportRows(data as Record<string, unknown>[]);
        setParsedRows(rows);
        return;
      }

      if (ext === 'xlsx') {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
        const rows = buildImportRows(json);
        setParsedRows(rows);
        return;
      }

      throw new Error('Extensão não suportada. Use CSV ou XLSX.');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro ao processar arquivo.';
      setFileParseError(msg);
      toast.error(msg);
    }
  };

  const importPatients = async () => {
    if (!professionalId) {
      toast.error('Selecione o profissional.');
      return;
    }
    if (parsedRows.length === 0) {
      toast.error('Faça upload de uma planilha antes.');
      return;
    }

    setSaving(true);
    setImportResult(null);
    setImportBatch(null);
    try {
      const validRaw = parsedRows.filter((r) => r.errors.length === 0);

      // Evita inserts duplicados quando a planilha vier com linhas repetidas
      const deduped = new Map<string, PatientImportRow>();
      for (const r of validRaw) {
        const k = `${r.keyType}:${r.key}`;
        if (!deduped.has(k)) deduped.set(k, r);
      }
      const valid = Array.from(deduped.values());
      const invalidCount = parsedRows.length - valid.length;

      if (valid.length === 0) {
        toast.error('Nenhuma linha válida para importar.');
        setImportResult({ created: 0, updated: 0, skipped: invalidCount, errors: invalidCount });
        return;
      }

      const nowIso = new Date().toISOString();
      const phones = Array.from(new Set(valid.filter((r) => !!r.phone).map((r) => r.phone!)));
      const cpfs = Array.from(new Set(valid.filter((r) => !!r.cpf).map((r) => r.cpf!)));

      const [byPhoneRes, byCpfRes] = await Promise.all([
        phones.length
          ? supabase
              .from('patients')
              .select('id, full_name, phone, cpf')
              .eq('professional_id', professionalId)
              .in('phone', phones)
          : Promise.resolve({ data: [] as Array<{ id: string; full_name: string; phone: string | null; cpf: string | null }>, error: null as PostgrestError | null }),
        cpfs.length
          ? supabase
              .from('patients')
              .select('id, full_name, phone, cpf')
              .eq('professional_id', professionalId)
              .in('cpf', cpfs)
          : Promise.resolve({ data: [] as Array<{ id: string; full_name: string; phone: string | null; cpf: string | null }>, error: null as PostgrestError | null }),
      ]);

      if (byPhoneRes.error) throw new Error((byPhoneRes.error as PostgrestError).message);
      if (byCpfRes.error) throw new Error((byCpfRes.error as PostgrestError).message);

      const existing = [...(byPhoneRes.data ?? []), ...(byCpfRes.data ?? [])] as Array<{
        id: string;
        full_name: string;
        phone: string | null;
        cpf: string | null;
      }>;

      const existingByPhone = new Map<string, { id: string; full_name: string; phone: string | null; cpf: string | null }>();
      const existingByCpf = new Map<string, { id: string; full_name: string; phone: string | null; cpf: string | null }>();
      for (const p of existing) {
        if (p.phone) existingByPhone.set(p.phone, p);
        if (p.cpf) existingByCpf.set(p.cpf, p);
      }

      let created = 0;
      let createdIds: string[] = [];
      let updated = 0;
      let skipped = invalidCount;
      let errors = invalidCount;

      const inserts: Array<Record<string, unknown>> = [];
      const updates: Array<{ id: string; payload: Record<string, unknown> }> = [];

      for (const row of valid) {
        const insertPayload: Record<string, unknown> = {
          professional_id: professionalId,
          full_name: row.full_name,
          phone: row.phone,
          cpf: row.cpf,
          date_of_birth: row.date_of_birth,
          sex: row.sex,
          profession: row.profession,
          address: row.address,
          city: row.city,
          referred_by: row.referred_by,
          treatment_start_date: row.treatment_start_date,
          consultation_objective: row.consultation_objective,
          emergency_contact_name: row.emergency_contact_name,
          emergency_contact_phone: row.emergency_contact_phone,
          general_notes: row.general_notes,
          registration_completed_at: nowIso,
          is_active: true,
        };

        // Em updates, não "apagamos" campos existentes quando a coluna veio vazia no arquivo.
        const updatePayload: Record<string, unknown> = {
          professional_id: professionalId,
          full_name: row.full_name,
          registration_completed_at: nowIso,
          is_active: true,
        };
        if (row.phone) updatePayload.phone = row.phone;
        if (row.cpf) updatePayload.cpf = row.cpf;
        if (row.date_of_birth) updatePayload.date_of_birth = row.date_of_birth;
        if (row.sex) updatePayload.sex = row.sex;
        if (row.profession) updatePayload.profession = row.profession;
        if (row.address) updatePayload.address = row.address;
        if (row.city) updatePayload.city = row.city;
        if (row.referred_by) updatePayload.referred_by = row.referred_by;
        if (row.treatment_start_date) updatePayload.treatment_start_date = row.treatment_start_date;
        if (row.consultation_objective) updatePayload.consultation_objective = row.consultation_objective;
        if (row.emergency_contact_name) updatePayload.emergency_contact_name = row.emergency_contact_name;
        if (row.emergency_contact_phone) updatePayload.emergency_contact_phone = row.emergency_contact_phone;
        if (row.general_notes) updatePayload.general_notes = row.general_notes;

        const existingPatient =
          row.phone && existingByPhone.get(row.phone) ? existingByPhone.get(row.phone) : row.cpf && existingByCpf.get(row.cpf) ? existingByCpf.get(row.cpf) : null;

        if (!existingPatient) {
          inserts.push(insertPayload);
        } else {
          updates.push({
            id: existingPatient.id,
            payload: updatePayload,
          });
        }
      }

      const updatedIds = updates.map((u) => u.id);

      if (inserts.length) {
        const { data: insertedData, error } = await supabase
          .from('patients')
          .insert(inserts)
          .select('id');
        if (error) throw new Error(error.message);
        createdIds = (insertedData ?? []).map((p: { id: string }) => p.id).filter(Boolean);
        created = createdIds.length;
      }

      // Updates are done row-by-row (Supabase doesn't support multi-row update with different values)
      for (const u of updates) {
        const { error } = await supabase.from('patients').update(u.payload).eq('id', u.id);
        if (error) {
          errors++;
          skipped++;
          // Continue with next row; show a summary at end.
          continue;
        }
        updated++;
      }

      const total = parsedRows.length;
      const result = { created, updated, skipped: Math.max(0, total - created - updated), errors };
      setImportResult(result);
      setImportBatch({
        professionalId,
        createdPatientIds: createdIds,
        updatedPatientIds: updatedIds,
        createdAtIso: nowIso,
      });
      toast.success(`Importação concluída. Criados: ${created}, atualizados: ${updated}.`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro ao importar pacientes.';
      toast.error(msg);
      setImportResult(null);
      setImportBatch(null);
    } finally {
      setSaving(false);
    }
  };

  const deleteCreatedPatientsFromLastImport = async () => {
    if (!importBatch) {
      toast.error('Nenhuma importação concluída para deletar.');
      return;
    }

    const ids = importBatch.createdPatientIds;
    if (!ids.length) {
      toast.error('Nesta importação não houve pacientes criados para deletar.');
      return;
    }

    const ok = window.confirm(`Deletar ${ids.length} pacientes criados nesta importação?`);
    if (!ok) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('patients')
        .delete()
        .in('id', ids)
        .eq('professional_id', importBatch.professionalId);
      if (error) throw new Error(error.message);

      toast.success('Pacientes deletados com sucesso.');
      setImportResult(null);
      setImportBatch(null);
      setParsedRows([]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao deletar pacientes.');
    } finally {
      setSaving(false);
    }
  };

  const stats = useMemo(() => {
    const total = parsedRows.length;
    const invalid = parsedRows.filter((r) => r.errors.length > 0).length;
    const valid = total - invalid;
    return { total, invalid, valid };
  }, [parsedRows]);

  if (!isAdmin) return null;

  return (
    <div className={embedded ? 'space-y-4' : 'space-y-6'}>
      {!embedded ? (
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Importar pacientes</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Envie uma planilha para cadastrar pacientes do profissional selecionado.
          </p>
        </div>
      ) : null}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Seleção e arquivo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Profissional</Label>
              <Select value={professionalId} onValueChange={setProfessionalId} disabled={loading || saving}>
                <SelectTrigger className="rounded-xl h-10">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name || p.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Arquivo (CSV ou XLSX)</Label>
              <Input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx"
                disabled={loading || saving}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  void parseFile(file);
                }}
              />
              {fileName ? <p className="text-xs text-muted-foreground break-all">{fileName}</p> : null}
            </div>

            <div className="flex items-end">
              <div className="flex flex-col w-full gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={downloadTemplateCsv}
                  disabled={loading || saving}
                  className="w-full"
                >
                  <Download className="h-4 w-4" />
                  Baixar modelo CSV
                </Button>
                <Button type="button" onClick={() => void importPatients()} disabled={saving || stats.valid === 0} className="w-full">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Importar
                </Button>
              </div>
            </div>
          </div>

          <div className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground space-y-1">
            <div>
              Linhas válidas: <span className="font-medium text-foreground">{stats.valid}</span> de{' '}
              <span className="font-medium text-foreground">{stats.total}</span>
            </div>
            <div>Chave de duplicidade: telefone (preferência) ou CPF.</div>
            <div>Datas no formato pt-BR: <span className="font-medium text-foreground">DD/MM/YYYY</span>.</div>
            <div>Ao importar, o paciente é marcado como <span className="font-medium text-foreground">registration_completed_at</span> preenchido (data agora).</div>
          </div>

          {fileParseError ? (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-destructive text-sm">
              {fileParseError}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Prévia</CardTitle>
        </CardHeader>
        <CardContent>
          {parsedRows.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">Faça upload de uma planilha para ver a prévia.</div>
          ) : (
            <div className="space-y-3">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Linha</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>CPF</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedRows.slice(0, 15).map((r) => {
                    const ok = r.errors.length === 0;
                    return (
                      <TableRow key={`${r.rowNumber}-${r.key}`}>
                        <TableCell className="whitespace-nowrap">{r.rowNumber}</TableCell>
                        <TableCell className="max-w-[220px] truncate">{r.full_name}</TableCell>
                        <TableCell className="whitespace-nowrap">{r.phone ?? '—'}</TableCell>
                        <TableCell className="whitespace-nowrap">{r.cpf ?? '—'}</TableCell>
                        <TableCell>
                          <span className={ok ? 'text-emerald-700' : 'text-destructive'}>
                            {ok ? 'OK' : `Erro: ${r.errors[0]}`}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {parsedRows.length > 15 ? (
                <p className="text-xs text-muted-foreground">Mostrando 15 de {parsedRows.length} linhas.</p>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      {importResult ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Resultado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="rounded-xl border p-3">
                <div className="text-xs text-muted-foreground">Criados</div>
                <div className="text-xl font-semibold">{importResult.created}</div>
              </div>
              <div className="rounded-xl border p-3">
                <div className="text-xs text-muted-foreground">Atualizados</div>
                <div className="text-xl font-semibold">{importResult.updated}</div>
              </div>
              <div className="rounded-xl border p-3">
                <div className="text-xs text-muted-foreground">Pulados</div>
                <div className="text-xl font-semibold">{importResult.skipped}</div>
              </div>
              <div className="rounded-xl border p-3">
                <div className="text-xs text-muted-foreground">Erros</div>
                <div className="text-xl font-semibold">{importResult.errors}</div>
              </div>
            </div>

            {importBatch && importBatch.createdPatientIds.length ? (
              <div className="pt-4">
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => void deleteCreatedPatientsFromLastImport()}
                  disabled={saving}
                >
                  Deletar pacientes criados nesta importação
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

