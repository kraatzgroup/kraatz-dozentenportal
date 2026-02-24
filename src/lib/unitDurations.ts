import { supabase } from './supabase';

export interface UnitDurations {
  zivilrecht_unterricht: number;
  oeffentliches_recht_unterricht: number;
  strafrecht_unterricht: number;
  zivilrecht_wiederholung: number;
  oeffentliches_recht_wiederholung: number;
  strafrecht_wiederholung: number;
}

const DEFAULT_DURATIONS: UnitDurations = {
  zivilrecht_unterricht: 150,
  oeffentliches_recht_unterricht: 120,
  strafrecht_unterricht: 120,
  zivilrecht_wiederholung: 150,
  oeffentliches_recht_wiederholung: 70,
  strafrecht_wiederholung: 100
};

export const fetchUnitDurations = async (): Promise<UnitDurations> => {
  try {
    const { data, error } = await supabase
      .from('elite_kleingruppe_settings')
      .select('setting_value')
      .eq('setting_key', 'unit_durations')
      .single();
    
    if (error || !data?.setting_value) {
      return DEFAULT_DURATIONS;
    }
    
    return data.setting_value as UnitDurations;
  } catch (error) {
    console.error('Error fetching unit durations:', error);
    return DEFAULT_DURATIONS;
  }
};

export const getUnitDurationMinutes = (unitDurations: UnitDurations, unitType: string): number => {
  const mapping: Record<string, keyof UnitDurations> = {
    'unterricht_zivilrecht': 'zivilrecht_unterricht',
    'unterricht_strafrecht': 'strafrecht_unterricht',
    'unterricht_oeffentliches_recht': 'oeffentliches_recht_unterricht',
    'wiederholung_zivilrecht': 'zivilrecht_wiederholung',
    'wiederholung_strafrecht': 'strafrecht_wiederholung',
    'wiederholung_oeffentliches_recht': 'oeffentliches_recht_wiederholung',
  };
  
  const settingsKey = mapping[unitType];
  return settingsKey ? unitDurations[settingsKey] : 120;
};

export const getUnitDurationHours = (unitDurations: UnitDurations, unitType: string): number => {
  return getUnitDurationMinutes(unitDurations, unitType) / 60;
};

export const formatDuration = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins} Min`;
  if (mins === 0) return `${hours} Std`;
  return `${hours} Std ${mins} Min`;
};
