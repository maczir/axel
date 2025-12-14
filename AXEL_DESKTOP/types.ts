
export enum CableType {
  CPRI_LEGACY = 'CPRI - Legacy',
  CPRI_5G = 'CPRI - 5G FDD',
  ECPRI = 'ECPRI',
  FIBER = 'Fiber',
}

export enum CardType {
  // Internal AMIA Cards
  ASIB = 'ASIB', // System Module (Inside C1)
  ABIO_FDD = 'ABIO (FDD)', 
  ABIO_TDD = 'ABIO (TDD)', 
  ABIQ = 'ABIQ', // High Capacity
  
  // Externals
  NODEBOX = 'NODEBOX', // External Unit
  FPBA = 'FPBA', // 5G Ext
  FPRB = 'FPRB', // Power Ext
  FPBC = 'FPBC', // Baseband Ext
}

export type RadioFamily = 'micro' | 'macro_single' | 'macro_dual';
export type MimoMode = '2x2' | '4x4' | 'SISO';

export enum RRUType {
  // --- L2600 ---
  AHHB = 'AHHB',   // Macro (Dual/Single)
  ARHA = 'ARHA',   // Macro
  AHHA = 'AHHA',   // Micro

  // --- L700 Single Band ---
  // Micro
  AHBB = 'AHBB',
  AHBC = 'AHBC',

  // Macro
  FHPG = 'FHPG',
  FHPD = 'FHPD',
  AHPC = 'AHPC',
  AHPD = 'AHPD',
  AHPE = 'AHPE',
  AHPJ = 'AHPJ',
  AHPF = 'AHPF',
  AHPB = 'AHPB',
  AHPH = 'AHPH',
  AHPG = 'AHPG',

  // --- L900 Single Band ---
  FHDI = 'FHDI',
  AHDA = 'AHDA',
  AHDB = 'AHDB',

  // --- L700 + L900 Dual Band ---
  AHPMDB = 'AHPMDB', 
  AHPDA = 'AHPDA',   
  AHPDB = 'AHPDB',   
  AHPDC = 'AHPDC',   

  // --- L1800 Single Band ---
  FHEL = 'FHEL',
  AHEC = 'AHEC',
  AHED = 'AHED',
  AHEB = 'AHEB',
  AHEH = 'AHEH',

  // --- L2100 Single Band ---
  AHGA = 'AHGA',
  AHGC = 'AHGC',
  AHGF = 'AHGF',

  // --- L1800 + L2100 Dual Band ---
  AHEGC = 'AHEGC', // Macro Common
  AHEGA = 'AHEGA',
  AHEGI = 'AHEGI',
  AHEGB_MACRO = 'AHEGB', 
  AHEGJ = 'AHEGJ',
  AHEGF = 'AHEGF',
  AHEGG = 'AHEGG',
  
  // --- Micro Specific (1800/2100) ---
  AHGB = 'AHGB', // Micro 2100
  AHEJ = 'AHEJ', // Micro 1800

  // --- NR3500 ---
  AZQJ = 'AZQJ',   // Macro
  AWHQE = 'AWHQE', // Micro
  AWHQG = 'AWHQG', // Micro
  AWHQF = 'AWHQF', // Micro
  
  // --- NR3500 (Additional Macro) ---
  AKQA = 'AKQA',
  AKQI = 'AKQI',
  AKQJ = 'AKQJ',
  AKQZ = 'AKQZ',
  AZQG = 'AZQG',
  AZQH = 'AZQH',
  AZQI = 'AZQI',
  AZQL = 'AZQL',
  AZQS = 'AZQS',
}

export type Band = 'L700' | 'L900' | 'L1800' | 'L2100' | 'L2600' | 'NR3500';

export interface SiteIntent {
  radioFamily: RadioFamily;
  numSectors: number;
  activeBands: Band[];
  mimoMode: MimoMode;
  nrLinks: 1 | 2; // Legacy param, logic now auto-calculates
}

export interface Port {
  id: number;
  label?: string;
  isUsed?: boolean;
}

// Logical Slot in an AMIA Subrack
export interface Slot {
  id: string;
  name: string; // e.g. "C1", "B1", "B2", "FPRB", "FPBC"
  side: 'Left' | 'Right' | 'Full';
  isControl: boolean; 
  card: BBUCard | null;
}

export interface BBUCard {
  id: string;
  type: CardType;
  label: string;
  ports: Port[];
  slotId?: string; // Reference to the slot it occupies
}

export interface Rack {
  id: number;
  bayId: number; // Vertical stacking index
  slots: Slot[]; 
}

export interface RRUInstance {
  id: string;
  sectorIds: number[]; // e.g. [1, 2, 3] or [1]
  portMapping: Record<number, string>; // Maps RRU Port Index (1-6) to Sector Label "S1"
  type: RRUType;
  bands: Band[];
  isMimo: boolean;
}

export interface Connection {
  id: string;
  fromRackId: number;
  fromSlotName: string;
  fromCardType: CardType;
  fromPortId: number;
  toSectorList: number[];
  toRruInstanceId: string;
  toRruType: RRUType;
  toPortId: number; // 1 = OPT1, 2 = OPT2
  cableType: CableType;
  color: string;
}

export interface SystemState {
  racks: Rack[];
  rrus: RRUInstance[];
  connections: Connection[];
  hasGps: boolean;
}

export interface WiringRow {
  bay: number;
  rack: number;
  sectors: string;
  band: string;
  card: string;
  slot: string;
  port: number;
  cable: string;
  remoteUnit: string;
  remotePort: string;
}

export interface BomItem {
  part: string;
  description: string;
  qty: number;
}
