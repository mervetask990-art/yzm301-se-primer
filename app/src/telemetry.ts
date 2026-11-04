// Veri toplama modu: her karar bir satır (data/oturumlar.csv ile aynı sütunlar, bkz. data/SOZLUK.md).
// Yalnızca bu tarayıcıda durur; ad, e-posta, cihaz kimliği, konum, IP toplanmaz.
// Oturum ve oyuncu kimlikleri rastgele üretilir ve kişiyle ilişkilendirilemez.
import type { ChoiceId, LevelId } from './types';

const ROWS_KEY = 'se-primer-oturumlar-v1';
const PLAYER_KEY = 'se-primer-oyuncu-v1';

// Model girdileri: sıra config.json'daki `features` ile aynı olmalı (sözleşme)
export const FEATURES = [
  'karar_no',
  'konu_puani',
  'sure_baskisi',
  'onceki_karar_suresi_sn',
  'onceki_gidip_gelme',
  'onceki_riskli_sayisi',
  'ipucu_sayisi',
  'tutor_mesaj_sayisi',
  'gecmis_riskli_oran',
] as const;

export type FeatureName = (typeof FEATURES)[number];
export type Features = Record<FeatureName, number>;

export interface DecisionRow extends Features {
  oturum_id: string;
  oyuncu_id: string;
  kaynak: 'gercek' | 'sentetik';
  tarih: string; // YYYY-MM-DD (saat bilgisi tutulmaz)
  karar_id: string;
  seviye: LevelId;
  secim: ChoiceId;
  sure_doldu: number; // 0/1
  karar_suresi_sn: number; // etiketle birlikte bilinir; model girdisi DEĞİL
  gidip_gelme: number; // bu karardaki A↔B geçişi; model girdisi DEĞİL
  model_p: number | ''; // kararın başında modelin verdiği olasılık (model yoksa boş)
  destek_modu: number; // 0/1, model desteği açtı mı
  zorlandi: number; // etiket: B seçti veya süre doldu
}

export const CSV_COLUMNS: (keyof DecisionRow)[] = [
  'oturum_id',
  'oyuncu_id',
  'kaynak',
  'tarih',
  'karar_id',
  'seviye',
  ...FEATURES,
  'secim',
  'sure_doldu',
  'karar_suresi_sn',
  'gidip_gelme',
  'model_p',
  'destek_modu',
  'zorlandi',
];

export function randomId(prefix: string): string {
  const raw =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 10)
      : Math.random().toString(36).slice(2, 12);
  return `${prefix}-${raw}`;
}

export function loadRows(): DecisionRow[] {
  try {
    const raw = window.localStorage.getItem(ROWS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function appendRow(row: DecisionRow): DecisionRow[] {
  const rows = [...loadRows(), row];
  try {
    window.localStorage.setItem(ROWS_KEY, JSON.stringify(rows));
  } catch {
    // depolama kapalıysa oyun veri toplamadan devam eder
  }
  return rows;
}

export function clearRows(): void {
  try {
    window.localStorage.removeItem(ROWS_KEY);
  } catch {
    /* yok say */
  }
}

// Aynı cihazda sırayla birden fazla kişi oynarsa "Yeni oyuncu" yeni bir rastgele kimlik verir
export function playerId(): string {
  try {
    const existing = window.localStorage.getItem(PLAYER_KEY);
    if (existing) return existing;
    const id = randomId('o');
    window.localStorage.setItem(PLAYER_KEY, id);
    return id;
  } catch {
    return 'o-bilinmiyor';
  }
}

export function newPlayerId(): string {
  const id = randomId('o');
  try {
    window.localStorage.setItem(PLAYER_KEY, id);
  } catch {
    /* yok say */
  }
  return id;
}

export function toCsv(rows: DecisionRow[]): string {
  const esc = (v: unknown) => {
    const s = v === undefined || v === null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [CSV_COLUMNS.join(','), ...rows.map((r) => CSV_COLUMNS.map((c) => esc(r[c])).join(','))].join('\n') + '\n';
}

export function downloadCsv(rows: DecisionRow[]): void {
  const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `oturumlar-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const round1 = (n: number) => Math.round(n * 10) / 10;
