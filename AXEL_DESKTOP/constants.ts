
import { RRUType, CableType, CardType, Band } from './types';

// Free Mobile Theme Colors
export const COLORS = {
  YELLOW: '#FFE600',  // 2600
  ORANGE: '#FF8C00',  // 3500
  MAGENTA: '#FF00FF', // 1800
  CYAN: '#00BFFF',    // 2100
  GREEN: '#32CD32',   // 700/900
  
  // Card Colors
  ASIB_GREY: '#64748B',       // System Module (C1)
  ABIO_FDD_BEIGE: '#D2B48C',  // ABIO FDD
  ABIO_TDD_BLUE: '#93C5FD',   // ABIO TDD
  ABIQ_PINK: '#F472B6',       // ABIQ (New)
  
  NODEBOX_RED: '#DC2626', // Nodebox External
  FPBA_PURPLE: '#7C3AED', // 5G External
  FPRB_INDIGO: '#4338CA', // Power External
  FPBC_VIOLET: '#5B21B6', // Baseband External
};

export const CABLE_COLORS = {
  [CableType.CPRI_LEGACY]: '#94A3B8', 
  [CableType.CPRI_5G]: '#60A5FA',
  [CableType.ECPRI]: '#3B82F6',
  [CableType.FIBER]: '#10B981',
};

// --- RRU CONFIGURATION ---
export const RRU_CONFIG: Record<RRUType, { label: string, subLabel: string, description: string, bgColor: string, height: number, ports: number, opticalPorts?: number }> = {
  // --- L2600 ---
  [RRUType.AHHB]: { label: 'AHHB', subLabel: '2600', description: 'Macro 4T4R 2600', bgColor: COLORS.YELLOW, height: 110, ports: 6, opticalPorts: 2 },
  [RRUType.ARHA]: { label: 'ARHA', subLabel: '2600', description: 'Macro 2600 High Power', bgColor: COLORS.YELLOW, height: 110, ports: 6, opticalPorts: 2 },
  [RRUType.AHHA]: { label: 'AHHA', subLabel: '2600', description: 'Micro 2600', bgColor: COLORS.YELLOW, height: 90, ports: 4, opticalPorts: 1 },

  // --- L700 Single ---
  // Micro (mono-bande)
  [RRUType.AHBB]: { label: 'AHBB', subLabel: '700', description: 'Micro 700', bgColor: COLORS.GREEN, height: 90, ports: 4, opticalPorts: 1 },
  [RRUType.AHBC]: { label: 'AHBC', subLabel: '700', description: 'Micro 700', bgColor: COLORS.GREEN, height: 90, ports: 4, opticalPorts: 1 },

  // Macro
  [RRUType.FHPG]: { label: 'FHPG', subLabel: '700', description: 'Macro Single 700', bgColor: COLORS.GREEN, height: 110, ports: 6, opticalPorts: 2 },
  [RRUType.FHPD]: { label: 'FHPD', subLabel: '700', description: 'Macro Single 700', bgColor: COLORS.GREEN, height: 110, ports: 6, opticalPorts: 2 },
  [RRUType.AHPC]: { label: 'AHPC', subLabel: '700', description: 'Macro Single 700', bgColor: COLORS.GREEN, height: 110, ports: 6, opticalPorts: 2 },
  [RRUType.AHPD]: { label: 'AHPD', subLabel: '700', description: 'Macro Single 700', bgColor: COLORS.GREEN, height: 110, ports: 6, opticalPorts: 2 },
  [RRUType.AHPE]: { label: 'AHPE', subLabel: '700', description: 'Macro Single 700', bgColor: COLORS.GREEN, height: 110, ports: 6, opticalPorts: 2 },
  [RRUType.AHPJ]: { label: 'AHPJ', subLabel: '700', description: 'Macro Single 700', bgColor: COLORS.GREEN, height: 110, ports: 6, opticalPorts: 2 },
  [RRUType.AHPF]: { label: 'AHPF', subLabel: '700', description: 'Macro Single 700', bgColor: COLORS.GREEN, height: 110, ports: 6, opticalPorts: 2 },
  [RRUType.AHPB]: { label: 'AHPB', subLabel: '700', description: 'Macro Single 700', bgColor: COLORS.GREEN, height: 110, ports: 6, opticalPorts: 2 },
  [RRUType.AHPH]: { label: 'AHPH', subLabel: '700', description: 'Macro Single 700', bgColor: COLORS.GREEN, height: 110, ports: 6, opticalPorts: 2 },
  [RRUType.AHPG]: { label: 'AHPG', subLabel: '700', description: 'Macro Single 700', bgColor: COLORS.GREEN, height: 110, ports: 6, opticalPorts: 2 },

  // --- L900 Single ---
  [RRUType.FHDI]: { label: 'FHDI', subLabel: '900', description: 'Macro Single 900', bgColor: COLORS.GREEN, height: 110, ports: 6, opticalPorts: 2 },
  [RRUType.AHDA]: { label: 'AHDA', subLabel: '900', description: 'Macro Single 900', bgColor: COLORS.GREEN, height: 110, ports: 6, opticalPorts: 2 },
  [RRUType.AHDB]: { label: 'AHDB', subLabel: '900', description: 'Macro Single 900', bgColor: COLORS.GREEN, height: 110, ports: 6, opticalPorts: 2 },

  // --- L700 / L900 (Dual Band) ---
  [RRUType.AHPMDB]: { label: 'AHPMDB', subLabel: '700/900', description: 'Macro Bande Basse', bgColor: COLORS.GREEN, height: 120, ports: 6, opticalPorts: 2 },
  [RRUType.AHPDA]: { label: 'AHPDA', subLabel: '700/900', description: 'Macro Bande Basse', bgColor: COLORS.GREEN, height: 120, ports: 6, opticalPorts: 2 },
  [RRUType.AHPDB]: { label: 'AHPDB', subLabel: '700/900', description: 'Macro Bande Basse', bgColor: COLORS.GREEN, height: 120, ports: 6, opticalPorts: 2 },
  [RRUType.AHPDC]: { label: 'AHPDC', subLabel: '700/900', description: 'Macro Bande Basse', bgColor: COLORS.GREEN, height: 120, ports: 6, opticalPorts: 2 },

  // --- L1800 Single ---
  [RRUType.FHEL]: { label: 'FHEL', subLabel: '1800', description: 'Macro Single 1800', bgColor: COLORS.MAGENTA, height: 110, ports: 6, opticalPorts: 2 },
  [RRUType.AHEC]: { label: 'AHEC', subLabel: '1800', description: 'Macro Single 1800', bgColor: COLORS.MAGENTA, height: 110, ports: 6, opticalPorts: 2 },
  [RRUType.AHED]: { label: 'AHED', subLabel: '1800', description: 'Macro Single 1800', bgColor: COLORS.MAGENTA, height: 110, ports: 6, opticalPorts: 2 },
  [RRUType.AHEB]: { label: 'AHEB', subLabel: '1800', description: 'Macro Single 1800', bgColor: COLORS.MAGENTA, height: 110, ports: 6, opticalPorts: 2 },
  [RRUType.AHEH]: { label: 'AHEH', subLabel: '1800', description: 'Macro Single 1800', bgColor: COLORS.MAGENTA, height: 110, ports: 6, opticalPorts: 2 },

  // --- L2100 Single ---
  [RRUType.AHGA]: { label: 'AHGA', subLabel: '2100', description: 'Macro Single 2100', bgColor: COLORS.CYAN, height: 110, ports: 6, opticalPorts: 2 },
  [RRUType.AHGC]: { label: 'AHGC', subLabel: '2100', description: 'Macro Single 2100', bgColor: COLORS.CYAN, height: 110, ports: 6, opticalPorts: 2 },
  [RRUType.AHGF]: { label: 'AHGF', subLabel: '2100', description: 'Macro Single 2100', bgColor: COLORS.CYAN, height: 110, ports: 6, opticalPorts: 2 },

  // --- L1800 / L2100 (Dual Band) ---
  [RRUType.AHEGC]: { label: 'AHEGC', subLabel: '18/21', description: 'Macro Bi-Bande', bgColor: COLORS.MAGENTA, height: 110, ports: 6, opticalPorts: 2 },
  [RRUType.AHEGA]: { label: 'AHEGA', subLabel: '18/21', description: 'Macro Bi-Bande', bgColor: COLORS.MAGENTA, height: 110, ports: 6, opticalPorts: 2 },
  [RRUType.AHEGI]: { label: 'AHEGI', subLabel: '18/21', description: 'Macro Bi-Bande', bgColor: COLORS.MAGENTA, height: 110, ports: 6, opticalPorts: 2 },
  [RRUType.AHEGB_MACRO]: { label: 'AHEGB', subLabel: '18/21', description: 'Macro Bi-Bande', bgColor: COLORS.MAGENTA, height: 110, ports: 6, opticalPorts: 2 },
  [RRUType.AHEGJ]: { label: 'AHEGJ', subLabel: '18/21', description: 'Macro Bi-Bande', bgColor: COLORS.MAGENTA, height: 110, ports: 6, opticalPorts: 2 },
  [RRUType.AHEGF]: { label: 'AHEGF', subLabel: '18/21', description: 'Macro Bi-Bande', bgColor: COLORS.MAGENTA, height: 110, ports: 6, opticalPorts: 2 },
  [RRUType.AHEGG]: { label: 'AHEGG', subLabel: '18/21', description: 'Macro Bi-Bande', bgColor: COLORS.MAGENTA, height: 110, ports: 6, opticalPorts: 2 },
  
  // Micro Specifics
  [RRUType.AHEJ]: { label: 'AHEJ', subLabel: '1800', description: 'Micro 1800', bgColor: COLORS.MAGENTA, height: 90, ports: 4, opticalPorts: 1 },
  [RRUType.AHGB]: { label: 'AHGB', subLabel: '2100', description: 'Micro 2100', bgColor: COLORS.CYAN, height: 90, ports: 4, opticalPorts: 1 },

  // --- NR3500 ---
  [RRUType.AZQJ]: { label: 'AZQJ', subLabel: 'NR3500', description: 'Massive MIMO', bgColor: COLORS.ORANGE, height: 130, ports: 6, opticalPorts: 2 },
  [RRUType.AWHQE]: { label: 'AWHQE', subLabel: '3500', description: 'Micro 3500', bgColor: COLORS.ORANGE, height: 100, ports: 4, opticalPorts: 2 },
  [RRUType.AWHQG]: { label: 'AWHQG', subLabel: '3500', description: 'Micro 3500', bgColor: COLORS.ORANGE, height: 100, ports: 4, opticalPorts: 2 },
  [RRUType.AWHQF]: { label: 'AWHQF', subLabel: '3500', description: 'Micro 3500', bgColor: COLORS.ORANGE, height: 100, ports: 4, opticalPorts: 2 },

  // --- NR3500 Additional ---
  [RRUType.AKQA]: { label: 'AKQA', subLabel: 'NR3500', description: 'Macro 3500', bgColor: COLORS.ORANGE, height: 130, ports: 6, opticalPorts: 2 },
  [RRUType.AKQI]: { label: 'AKQI', subLabel: 'NR3500', description: 'Macro 3500', bgColor: COLORS.ORANGE, height: 130, ports: 6, opticalPorts: 2 },
  [RRUType.AKQJ]: { label: 'AKQJ', subLabel: 'NR3500', description: 'Macro 3500', bgColor: COLORS.ORANGE, height: 130, ports: 6, opticalPorts: 2 },
  [RRUType.AKQZ]: { label: 'AKQZ', subLabel: 'NR3500', description: 'Macro 3500', bgColor: COLORS.ORANGE, height: 130, ports: 6, opticalPorts: 2 },
  [RRUType.AZQG]: { label: 'AZQG', subLabel: 'NR3500', description: 'Macro 3500', bgColor: COLORS.ORANGE, height: 130, ports: 6, opticalPorts: 2 },
  [RRUType.AZQH]: { label: 'AZQH', subLabel: 'NR3500', description: 'Macro 3500', bgColor: COLORS.ORANGE, height: 130, ports: 6, opticalPorts: 2 },
  [RRUType.AZQI]: { label: 'AZQI', subLabel: 'NR3500', description: 'Macro 3500', bgColor: COLORS.ORANGE, height: 130, ports: 6, opticalPorts: 2 },
  [RRUType.AZQL]: { label: 'AZQL', subLabel: 'NR3500', description: 'Macro 3500', bgColor: COLORS.ORANGE, height: 130, ports: 6, opticalPorts: 2 },
  [RRUType.AZQS]: { label: 'AZQS', subLabel: 'NR3500', description: 'Macro 3500', bgColor: COLORS.ORANGE, height: 130, ports: 6, opticalPorts: 2 },
};

// --- MODULE LISTS PER ARCHITECTURE ---

const NR3500_MACRO_LIST = [
  RRUType.AZQJ, RRUType.AKQA, RRUType.AKQI, RRUType.AKQJ, RRUType.AKQZ, 
  RRUType.AZQG, RRUType.AZQH, RRUType.AZQI, RRUType.AZQL, RRUType.AZQS
];

const LOW_BAND_DUAL_LIST = [RRUType.AHPDA, RRUType.AHPMDB, RRUType.AHPDB, RRUType.AHPDC];

export const MICRO_MODULES: Record<Band, RRUType[]> = {
  'L700': [RRUType.AHBB, RRUType.AHBC],
  // Micro RRH: pas de L900 dans notre logique actuelle (mono-bande micro)
  'L900': [],
  'L1800': [RRUType.AHEJ],
  'L2100': [RRUType.AHGB],
  'L2600': [RRUType.AHHA],
  'NR3500': [RRUType.AWHQF, RRUType.AWHQE, RRUType.AWHQG]
};

export const MACRO_SINGLE_MODULES: Record<Band, RRUType[]> = {
  'L700': [RRUType.FHPG, RRUType.FHPD, RRUType.AHPC, RRUType.AHPD, RRUType.AHPE, RRUType.AHPJ, RRUType.AHPF, RRUType.AHPB, RRUType.AHPH, RRUType.AHPG],
  'L900': [RRUType.FHDI, RRUType.AHDA, RRUType.AHDB],
  'L1800': [RRUType.FHEL, RRUType.AHEC, RRUType.AHED, RRUType.AHEB, RRUType.AHEH],
  'L2100': [RRUType.AHGA, RRUType.AHGC, RRUType.AHGF],
  'L2600': [RRUType.AHHB, RRUType.ARHA],
  'NR3500': NR3500_MACRO_LIST
};

export const MACRO_DUAL_MODULES: Record<Band, RRUType[]> = {
  'L700': LOW_BAND_DUAL_LIST, // L700 uses Dual Band Modules
  'L900': LOW_BAND_DUAL_LIST, // L900 uses Dual Band Modules
  'L1800': [RRUType.AHEGC, RRUType.AHEGA, RRUType.AHEGI, RRUType.AHEGB_MACRO, RRUType.AHEGJ, RRUType.AHEGF, RRUType.AHEGG],
  'L2100': [RRUType.AHEGC, RRUType.AHEGA, RRUType.AHEGI, RRUType.AHEGB_MACRO, RRUType.AHEGJ, RRUType.AHEGF, RRUType.AHEGG],
  'L2600': [RRUType.AHHB, RRUType.ARHA],
  'NR3500': NR3500_MACRO_LIST
};

// --- DEFAULTS ---

export const MICRO_DEFAULTS: Record<Band, RRUType> = {
  'L700': RRUType.AHBB,
  // L900 non supporté en micro -> laissé par compat, mais l'UI interdit l'activation
  'L900': RRUType.AHBB,
  'L1800': RRUType.AHEJ,
  'L2100': RRUType.AHGB,
  'L2600': RRUType.AHHA,
  'NR3500': RRUType.AWHQF,
};

export const MACRO_SINGLE_DEFAULTS: Record<Band, RRUType> = {
  'L700': RRUType.FHPG,
  'L900': RRUType.FHDI,
  'L1800': RRUType.FHEL,
  'L2100': RRUType.AHGA,
  'L2600': RRUType.AHHB,
  'NR3500': RRUType.AZQJ,
};

export const MACRO_DUAL_DEFAULTS: Record<Band, RRUType> = {
  'L700': RRUType.AHPDA, // Default Dual Band for Low Band
  'L900': RRUType.AHPDA, // Default Dual Band for Low Band
  'L1800': RRUType.AHEGC,
  'L2100': RRUType.AHEGC,
  'L2600': RRUType.AHHB,
  'NR3500': RRUType.AZQJ,
};


// Mapping Bands to Sides for Diagram
export const BAND_SIDE_MAP: Record<Band, 'Left' | 'Right'> = {
  'L2600': 'Left',
  'NR3500': 'Left',
  'L1800': 'Right',
  'L2100': 'Right',
  'L700': 'Right',
  'L900': 'Right',
};

// AMIA Physical Layout Definition
// C1 is System Module. B1, B2, B3 are available for Capacity (ABIO)
export const AMIA_SLOTS_DEF = [
  { name: 'C1', side: 'Full', isControl: true }, 
  { name: 'B1', side: 'Full', isControl: false }, 
  { name: 'B2', side: 'Full', isControl: false }, 
  { name: 'B3', side: 'Full', isControl: false }, 
] as const;

export const LAYOUT = {
  CANVAS_WIDTH: 1400,
  AMIA_WIDTH: 360,
  AMIA_CENTER_X: 520, 
  AMIA_START_Y: 80, 
  AMIA_CHASSIS_HEIGHT: 380, // C1 + B1 + B2 + B3
  AMIA_GAP: 60,
  
  RRU_WIDTH: 180,
  RRU_LEFT_X: 50,
  RRU_RIGHT_X: 1050,
  RRU_GAP_Y: 20,
};
