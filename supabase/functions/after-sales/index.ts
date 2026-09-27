// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

interface ContractRow {
  id: string;
  teilnehmer_id: string;
  contract_number: string;
  start_date: string;
  end_date: string | null;
  total_hours: number | string | null;
  calculated_hours: number | string | null;
  status: string | null;
  is_active: boolean | null;
}

interface ParticipantRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  current_contract_id: string | null;
  contract_start: string | null;
  contract_end: string | null;
  booked_hours: number | string | null;
}

const jsonResponse = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
})

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const authorization = req.headers.get('Authorization');
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return jsonResponse({ error: 'Unauthorized' }, 401);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !anonKey || !serviceRoleKey) throw new Error('Supabase environment is incomplete');

    const authClient = createClient(supabaseUrl, anonKey);
    const { data: { user }, error: authError } = await authClient.auth.getUser(token);
    if (authError || !user) return jsonResponse({ error: 'Unauthorized' }, 401);

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, additional_roles')
      .eq('id', user.id)
      .maybeSingle();
    if (profileError) throw profileError;

    const roles = new Set([profile?.role, ...(profile?.additional_roles || [])]);
    if (!roles.has('admin') && !roles.has('vertrieb')) return jsonResponse({ error: 'Forbidden' }, 403);

    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('id, teilnehmer_id')
      .in('status', ['closed', 'contract_closed'])
      .not('teilnehmer_id', 'is', null);
    if (leadsError) throw leadsError;

    const participantIds = [...new Set((leads || []).map(lead => lead.teilnehmer_id).filter(Boolean))] as string[];
    if (participantIds.length === 0) return jsonResponse({ eligible: [] });

    const [{ data: participants, error: participantsError }, { data: contracts, error: contractsError }] = await Promise.all([
      supabase
        .from('teilnehmer')
        .select('id, name, email, phone, current_contract_id, contract_start, contract_end, booked_hours')
        .in('id', participantIds),
      supabase
        .from('contracts')
        .select('id, teilnehmer_id, contract_number, start_date, end_date, total_hours, calculated_hours, status, is_active')
        .in('teilnehmer_id', participantIds)
        .eq('status', 'active'),
    ]);
    if (participantsError) throw participantsError;
    if (contractsError) throw contractsError;

    const activeContracts = (contracts || []).filter((contract: ContractRow) => contract.status === 'active' && contract.is_active !== false);
    const contractIds = activeContracts.map((contract: ContractRow) => contract.id);
    const { data: freeHours, error: freeHoursError } = contractIds.length > 0
      ? await supabase.from('free_hours').select('contract_id, hours_used').in('contract_id', contractIds)
      : { data: [], error: null };
    if (freeHoursError) throw freeHoursError;

    const participantsById = new Map((participants || []).map((participant: ParticipantRow) => [participant.id, participant]));
    const freeHoursByContract = new Map<string, number>();
    (freeHours || []).forEach((row: { contract_id: string; hours_used: number | string | null }) => {
      freeHoursByContract.set(row.contract_id, (freeHoursByContract.get(row.contract_id) || 0) + Number(row.hours_used || 0));
    });
    const now = new Date();
    const eligible = (leads || []).flatMap(lead => {
      if (!lead.teilnehmer_id) return [];
      const participant = participantsById.get(lead.teilnehmer_id);
      if (!participant) return [];
      const participantContracts = activeContracts.filter((contract: ContractRow) => contract.teilnehmer_id === participant.id);
      const contract = participantContracts.find((item: ContractRow) => item.id === participant.current_contract_id)
        || participantContracts.sort((a: ContractRow, b: ContractRow) => b.start_date.localeCompare(a.start_date))[0];
      if (!contract) return [];

      const startDate = contract.start_date || participant.contract_start;
      const endDate = contract.end_date || participant.contract_end;
      const startTime = startDate ? new Date(`${startDate}T00:00:00Z`).getTime() : Number.NaN;
      const endTime = endDate ? new Date(`${endDate}T00:00:00Z`).getTime() : Number.NaN;
      const durationProgress = Number.isFinite(startTime) && Number.isFinite(endTime) && endTime > startTime
        ? Math.min(1, Math.max(0, (now.getTime() - startTime) / (endTime - startTime)))
        : null;
      const totalHours = Number(contract.total_hours || participant.booked_hours || 0);
      const usedHours = Number(contract.calculated_hours || 0) + (freeHoursByContract.get(contract.id) || 0);
      const remainingHours = Math.max(0, totalHours - usedHours);
      const durationEligible = durationProgress !== null && durationProgress >= 0.75;
      const hoursEligible = totalHours > 0 && remainingHours <= totalHours * 0.25;
      if (!durationEligible && !hoursEligible) return [];

      return [{
        lead_id: lead.id,
        teilnehmer_id: participant.id,
        teilnehmer_name: participant.name,
        contract_number: contract.contract_number,
        contract_start: startDate,
        contract_end: endDate,
        total_hours: totalHours,
        used_hours: usedHours,
        remaining_hours: remainingHours,
        duration_progress: durationProgress === null ? null : Math.round(durationProgress * 1000) / 10,
        hours_used_percent: totalHours > 0 ? Math.round(usedHours / totalHours * 1000) / 10 : null,
        trigger: durationEligible && hoursEligible ? 'both' : durationEligible ? 'duration' : 'hours',
      }];
    });

    return jsonResponse({ eligible });
  } catch (error) {
    console.error('After-sales lookup failed:', error);
    return jsonResponse({ error: 'After-sales data could not be loaded' }, 500);
  }
})

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/after-sales' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
