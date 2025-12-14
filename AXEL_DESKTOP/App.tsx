
import React, { useState, useEffect, useRef } from 'react';
import { DiagramCanvas } from './components/DiagramCanvas';
import { BomTable } from './components/BomTable';
import { WiringTable } from './components/WiringTable';
import { 
  SystemState, SiteIntent, Band, Rack, Slot, Connection, 
  CardType, RRUType, RRUInstance, CableType, BomItem, MimoMode, RadioFamily 
} from './types';
import { 
  AMIA_SLOTS_DEF, RRU_CONFIG, 
  MICRO_MODULES, MACRO_SINGLE_MODULES, MACRO_DUAL_MODULES,
  MICRO_DEFAULTS, MACRO_SINGLE_DEFAULTS, MACRO_DUAL_DEFAULTS 
} from './constants';
import { Settings, Download, Cpu, Layers, FileText, Activity, Radio, Server, Trash2, PlugZap, ChevronRight, File, Presentation, Box, PlusCircle, XCircle, RefreshCw, Image as ImageIcon, MapPin, GripVertical } from 'lucide-react';
import { exportToPDF, exportToPPTX, exportToImage } from './utils/exporter';

const generateId = () => Math.random().toString(36).substr(2, 9);

// --- 1. LOGIQUE DE CALCUL RADIO (RRU) ---
const calculateRRUs = (intent: SiteIntent, selectedModules: Record<Band, RRUType>): RRUInstance[] => {
  const rrus: RRUInstance[] = [];
  
  // Grouper les bandes par type de matériel sélectionné
  // Cela permet de fusionner L1800 et L2100 s'ils utilisent le même module (ex: AHEGC)
  const hardwareGroups: Map<RRUType, Band[]> = new Map();
  
  intent.activeBands.forEach(band => {
    // Si l'utilisateur n'a pas sélectionné de module, on ignore (ou on prendrait un défaut, mais l'UI force un choix)
    const type = selectedModules[band];
    if (type) {
      if (!hardwareGroups.has(type)) hardwareGroups.set(type, []);
      hardwareGroups.get(type)?.push(band);
    }
  });

  const sortedTypes = Array.from(hardwareGroups.keys()).sort();

  sortedTypes.forEach(type => {
    const bands = hardwareGroups.get(type)!;
    const rruConfig = RRU_CONFIG[type];

    if (!rruConfig) return; // Safety check

    const totalPorts = rruConfig.ports;

    // Calcul des ports nécessaires par secteur selon MIMO (RF Ports)
    let portsPerSector = 1; // SISO
    if (intent.mimoMode === '2x2') portsPerSector = 2;
    if (intent.mimoMode === '4x4') portsPerSector = 4;
    const maxSectorsPerRRU = Math.max(
      1,
      intent.radioFamily === 'micro'
        ? Math.floor(totalPorts / portsPerSector)
        : Math.min(3, Math.floor(totalPorts / portsPerSector))
    );

    let currentSector = 1;
    
    // Remplir les RRUs secteur par secteur
    // On permet de mettre plusieurs secteurs par RRU si les ports le permettent
    while (currentSector <= intent.numSectors) {
      const instanceSectors: number[] = [];
      const portMapping: Record<number, string> = {};
      let usedPorts = 0;

      // Boucle pour remplir un RRU
      while (currentSector <= intent.numSectors) {
        // Vérification capacité ports RF + limite métier multi-secteurs
        if ((usedPorts + portsPerSector) > totalPorts) break;
        if (instanceSectors.length >= maxSectorsPerRRU) break;
        
        for (let i = 0; i < portsPerSector; i++) {
          portMapping[usedPorts + i + 1] = `S${currentSector}`;
        }
        instanceSectors.push(currentSector);
        usedPorts += portsPerSector;
        currentSector++;
      }

      if (instanceSectors.length > 0) {
        rrus.push({
          id: `rru-${type}-${instanceSectors.join('-')}-${generateId()}`,
          sectorIds: instanceSectors,
          portMapping,
          type: type,
          bands: bands,
          isMimo: intent.mimoMode !== 'SISO'
        });
      }
    }
  });

  return rrus;
};

// --- 2. SOLVEUR SYSTÈME (CÂBLAGE & BAIES) ---
const solveSystem = (intent: SiteIntent, rrus: RRUInstance[], slotOverrides: Record<string, CardType | 'EMPTY'>): SystemState => {
  const racks: Rack[] = [];
  const connections: Connection[] = [];
  const has5G = intent.activeBands.includes('NR3500');

  // Helper pour créer une nouvelle baie AMIA avec prise en compte des overrides
  const createRack = (id: number): Rack => {
    const slots: Slot[] = AMIA_SLOTS_DEF.map(def => {
      const overrideKey = `${id}-${def.name}`;
      const overrideVal = slotOverrides[overrideKey];
      
      let card = null;

      if (overrideVal === 'EMPTY') {
        card = null;
      } else if (overrideVal) {
        // Force specific card
        card = { 
           id: `card-${generateId()}`, type: overrideVal, label: overrideVal, ports: Array.from({length: 9}, (_, idx) => ({ id: idx + 1 })) 
        };
      } else if (def.name === 'C1') {
         // Default C1 to ASIB if not overridden
         card = { 
           id: `asib-rack${id}`, type: CardType.ASIB, label: 'ASIB', ports: []
         };
      }

      return {
        id: `rack${id}-${def.name}`,
        name: def.name,
        side: def.side as any,
        isControl: def.isControl,
        card: card
      };
    });

    // Ajout des unités externes
    [CardType.NODEBOX, CardType.FPBA, CardType.FPRB, CardType.FPBC].forEach(extType => {
      slots.push({
        id: `rack${id}-${extType}`,
        name: extType,
        side: 'Full',
        isControl: false,
        card: { id: `${extType.toLowerCase()}-rack${id}`, type: extType, label: extType, ports: [] }
      });
    });

    return { id, bayId: id, slots };
  };

  racks.push(createRack(1));

  // TRI: Par secteur pour regrouper 4G/5G
  rrus.sort((a, b) => {
    const minSecA = Math.min(...a.sectorIds);
    const minSecB = Math.min(...b.sectorIds);
    if (minSecA !== minSecB) return minSecA - minSecB;
    return a.bands[0].localeCompare(b.bands[0]);
  });

  // --- TRAITEMENT DU CÂBLAGE PAR RRU ---
  rrus.forEach(rru => {
    const isNR = rru.bands.includes('NR3500');
    const rruConfig = RRU_CONFIG[rru.type];
    
    // Check if Micro based on config or explicit family choice
    const isMicroUnit = rruConfig.description.includes('Micro');
    const isMicroContext = isMicroUnit || intent.radioFamily === 'micro';
    
    // Strict Sector Grouping Rule:
    // Applies to Micro and Macro Single.
    // Ensures that for a given AMIA, if it hosts a Sector, it hosts all bands for that Sector (if possible).
    const useSectorAffinity = intent.radioFamily === 'micro' || intent.radioFamily === 'macro_single';

    // On détermine les liens physiques requis pour CETTE unité RRU
    const requiredLinks: Array<{
       rruPortIndex: number,
       targetAbioPort: number,
       cardType: CardType,
       cable: CableType
    }> = [];

    const primarySector = rru.sectorIds[0] || 1;
    const sectorMod = (primarySector - 1) % 3; // Pattern "bloc 6 secteurs" (micro) -> 0..2

    // En Micro : on applique un mapping "préféré" par groupe de 3 secteurs (exemples Nokia)
    // En Macro : on laisse le solveur choisir le prochain port libre (targetAbioPort = -1)
    const preferFixedPorts = isMicroContext;

    if (isNR) {
       // --- NR3500 (TDD) Rules ---
       // OPT1 toujours, OPT2 seulement si l'utilisateur demande 2 liens
       requiredLinks.push({
         rruPortIndex: 1,
         targetAbioPort: preferFixedPorts ? (1 + sectorMod) : -1,
         cardType: CardType.ABIO_TDD,
         cable: CableType.ECPRI
       });
       if (intent.nrLinks === 2) {
         requiredLinks.push({
           rruPortIndex: 2,
           targetAbioPort: preferFixedPorts ? (7 + sectorMod) : -1,
           cardType: CardType.ABIO_TDD,
           cable: CableType.ECPRI
         });
       }

    } else {
       // --- FDD Rules ---
       // Cas Low Band (L700/L900) : RRH dual-band, souvent 2 fibres (OPT1 legacy + OPT2 "5G")
       const isLowBand = rru.bands.includes('L700') || rru.bands.includes('L900');

       if (isLowBand) {
         requiredLinks.push({
           rruPortIndex: 1,
           targetAbioPort: -1,
           cardType: CardType.ABIO_FDD,
           cable: CableType.CPRI_LEGACY
         });
         requiredLinks.push({
           rruPortIndex: 2,
           targetAbioPort: -1,
           cardType: CardType.ABIO_FDD,
           cable: CableType.CPRI_5G
         });
       } else {
         const band = rru.bands[0];
         let targetBase = -1;

         if (band === 'L2600') targetBase = 1;
         else if (band === 'L1800') targetBase = 4;
         else if (band === 'L2100') targetBase = 7;

         const targetPort = (preferFixedPorts && targetBase !== -1) ? (targetBase + sectorMod) : -1;

         requiredLinks.push({
            rruPortIndex: 1,
            targetAbioPort: targetPort,
            cardType: CardType.ABIO_FDD,
            cable: CableType.CPRI_LEGACY
         });
       }
    }

    // --- EXECUTION DU CABLAGE ---
    requiredLinks.forEach(link => {
       let allocated = false;
       
       // 1. Identifier racks préférés
       const preferredRackIds = new Set<number>();
       connections.forEach(c => {
          // Priority A: Same RRU (e.g. 2nd fiber of same box)
          if (c.toRruInstanceId === rru.id) preferredRackIds.add(c.fromRackId);
          
          // Priority B: Same Sector (Strict Grouping for Balanced Bands)
          if (useSectorAffinity) {
             const sharesSector = c.toSectorList.some(s => rru.sectorIds.includes(s));
             if (sharesSector) preferredRackIds.add(c.fromRackId);
          }
       });
       
       const sortedRacks = [...racks].sort((a, b) => {
         const aPref = preferredRackIds.has(a.id);
         const bPref = preferredRackIds.has(b.id);
         if (aPref && !bPref) return -1;
         if (!aPref && bPref) return 1;
         return a.id - b.id;
       });

       // 2. Parcourir les Racks
       for (const rack of sortedRacks) {
          const validSlots = rack.slots.filter(s => ['B1', 'B2'].includes(s.name)); 

          // A. Essayer sur Cartes Existantes
          for (const slot of validSlots) {
             // Compatibility check:
             // If manual override to ABIQ, assume it can take FDD/TDD connections for now to prevent breaking wiring.
             // Otherwise strict check.
             const isCompatible = slot.card && (
                slot.card.type === link.cardType || 
                (slot.card.type === CardType.ABIQ) 
             );

             if (isCompatible) {
                const existingConns = connections.filter(c => c.fromRackId === rack.id && c.fromSlotName === slot.name);
                
                let portToUse = -1;
                if (link.targetAbioPort !== -1) {
                   const isTaken = existingConns.some(c => c.fromPortId === link.targetAbioPort);
                   if (!isTaken) portToUse = link.targetAbioPort;
                } else {
                   for(let p=1; p<=9; p++) {
                      if (!existingConns.some(c => c.fromPortId === p)) { portToUse = p; break; }
                   }
                }

                if (portToUse !== -1) {
                   connections.push({
                     id: `conn-${generateId()}`,
                     fromRackId: rack.id,
                     fromSlotName: slot.name,
                     fromCardType: slot.card!.type, // Use actual card type (e.g. ABIQ)
                     fromPortId: portToUse,
                     toSectorList: rru.sectorIds,
                     toRruInstanceId: rru.id,
                     toRruType: rru.type,
                     toPortId: link.rruPortIndex,
                     cableType: link.cable,
                     color: rruConfig.bgColor
                   });
                   allocated = true;
                   break;
                }
             }
          }
          if (allocated) break;

          // B. Essayer sur Slot Vide (Nouvelle Carte)
          // STRICT: Cannot use a slot if it is overridden to EMPTY or overridden to another type
          if (!allocated) {
             const emptySlot = validSlots.find(s => {
                if (s.card) return false; // Already occupied
                // Check if explicitly set to EMPTY
                const overrideKey = `${rack.id}-${s.name}`;
                if (slotOverrides[overrideKey] === 'EMPTY') return false;
                // If overridden to another type but not instantiated yet (shouldn't happen with current logic, but safe check)
                if (slotOverrides[overrideKey] && slotOverrides[overrideKey] !== link.cardType) return false;
                
                return true;
             });

             if (emptySlot) {
                emptySlot.card = {
                   id: `card-${generateId()}`,
                   type: link.cardType,
                   label: link.cardType,
                   ports: Array.from({length: 9}, (_, idx) => ({ id: idx + 1 }))
                };
                
                const portToUse = link.targetAbioPort !== -1 ? link.targetAbioPort : 1;
                
                connections.push({
                   id: `conn-${generateId()}`,
                   fromRackId: rack.id,
                   fromSlotName: emptySlot.name,
                   fromCardType: link.cardType,
                   fromPortId: portToUse,
                   toSectorList: rru.sectorIds,
                   toRruInstanceId: rru.id,
                   toRruType: rru.type,
                   toPortId: link.rruPortIndex,
                   cableType: link.cable,
                   color: rruConfig.bgColor
                });
                allocated = true;
                break;
             }
          }
          if (allocated) break;
       }

       // 3. Echec Total -> Nouvelle Baie (Overflow final)
       if (!allocated) {
          const newId = racks.length + 1;
          const newRack = createRack(newId);
          racks.push(newRack);

          const slotB1 = newRack.slots.find(s => s.name === 'B1')!;
          // If B1 is overridden to empty in this new rack (unlikely unless user pre-configured it), check B2
          const targetSlot = (slotOverrides[`${newId}-B1`] === 'EMPTY') ? newRack.slots.find(s => s.name === 'B2')! : slotB1;
          
          if (targetSlot) {
              targetSlot.card = {
                 id: `card-${generateId()}`,
                 type: link.cardType,
                 label: link.cardType,
                 ports: Array.from({length: 9}, (_, idx) => ({ id: idx + 1 }))
              };

              const portToUse = link.targetAbioPort !== -1 ? link.targetAbioPort : 1;

              connections.push({
                 id: `conn-${generateId()}`,
                 fromRackId: newId,
                 fromSlotName: targetSlot.name,
                 fromCardType: link.cardType,
                 fromPortId: portToUse,
                 toSectorList: rru.sectorIds,
                 toRruInstanceId: rru.id,
                 toRruType: rru.type,
                 toPortId: link.rruPortIndex,
                 cableType: link.cable,
                 color: rruConfig.bgColor
              });
          }
       }
    });
  });

  return { racks, rrus, connections, hasGps: has5G };
};

// --- RAPPORTS ---
const generateReports = (system: SystemState) => {
  const bom: BomItem[] = [];
  
  bom.push({ part: 'AMIA', description: 'Châssis AirScale (Subrack)', qty: system.racks.length });
  
  const counts: Record<string, number> = {};
  system.racks.forEach(r => {
    r.slots.forEach(s => {
       if (s.card) counts[s.card.type] = (counts[s.card.type] || 0) + 1;
    });
  });
  
  if (counts[CardType.ASIB]) bom.push({ part: 'ASIB', description: 'Module Système (Common Unit)', qty: counts[CardType.ASIB] });
  if (counts[CardType.ABIO_FDD]) bom.push({ part: 'ABIO (FDD)', description: 'Carte Capacité FDD (9 Ports)', qty: counts[CardType.ABIO_FDD] });
  if (counts[CardType.ABIO_TDD]) bom.push({ part: 'ABIO (TDD)', description: 'Carte Capacité TDD (9 Ports)', qty: counts[CardType.ABIO_TDD] });
  if (counts[CardType.ABIQ]) bom.push({ part: 'ABIQ', description: 'Carte Haute Capacité', qty: counts[CardType.ABIQ] });
  
  bom.push({ part: 'NODEBOX', description: 'Unité Externe', qty: system.racks.length });
  bom.push({ part: 'FPBA', description: 'Pool Processing 5G', qty: system.racks.length });
  bom.push({ part: 'FPRB', description: 'Unité Alimentation', qty: system.racks.length });

  if (system.hasGps) {
    bom.push({ part: 'FYGA', description: 'Kit Antenne GPS', qty: 1 });
  }

  const rruCounts: Record<string, number> = {};
  system.rrus.forEach(r => rruCounts[r.type] = (rruCounts[r.type] || 0) + 1);
  Object.entries(rruCounts).forEach(([type, count]) => {
    const desc = RRU_CONFIG[type as RRUType]?.description || 'Radio Unit';
    bom.push({ part: type, description: desc, qty: count });
  });

  bom.push({ part: 'FO/SFP', description: 'Câbles & Transceivers', qty: system.connections.length });

  const wiring = system.connections.map(c => {
    const rru = system.rrus.find(r => r.id === c.toRruInstanceId);
    // Find precise band for this connection if possible, or list all
    const band = rru ? rru.bands.join('/') : 'Inconnu';
    const rack = system.racks.find(r => r.id === c.fromRackId);

    return {
      bay: rack?.bayId || 1,
      rack: c.fromRackId,
      sectors: 'S' + c.toSectorList.join('+'),
      band,
      card: c.fromCardType,
      slot: c.fromSlotName,
      port: c.fromPortId,
      cable: c.cableType,
      remoteUnit: c.toRruType,
      remotePort: c.toPortId === 1 ? 'OPT1' : 'OPT2'
    };
  });

  return { bom, wiring };
};

const App: React.FC = () => {
  const [intent, setIntent] = useState<SiteIntent>({
    radioFamily: 'macro_dual', 
    numSectors: 3,
    activeBands: ['L1800', 'L2100', 'L2600', 'NR3500'],
    mimoMode: '2x2',
    nrLinks: 2,
  });

  // New State for Site Info
  const [siteName, setSiteName] = useState('');
  const [siteCode, setSiteCode] = useState('');

  const [activeTab, setActiveTab] = useState<'diagram' | 'wiring' | 'bom'>('diagram');
  const [rawSystemState, setRawSystemState] = useState<SystemState>({ racks: [], rrus: [], connections: [], hasGps: false });
  const [systemState, setSystemState] = useState<SystemState>({ racks: [], rrus: [], connections: [], hasGps: false });
  const [rackOrder, setRackOrder] = useState<number[]>([]);
  const [draggingRackId, setDraggingRackId] = useState<number | null>(null);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [pendingSourcePort, setPendingSourcePort] = useState<{ rackId: number; slotName: string; portId: number } | null>(null);
  const [manualCableType, setManualCableType] = useState<CableType>(CableType.FIBER);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  
  // New: Slot Overrides
  const [slotOverrides, setSlotOverrides] = useState<Record<string, CardType | 'EMPTY'>>({});
  
  // New: Context Menu State
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, rackId: number, slotName: string, currentType: CardType | null } | null>(null);

  // State for user-selected modules per band
  const [selectedModules, setSelectedModules] = useState<Record<Band, RRUType>>({} as any);

  // Helper to get correct lists based on family
  const getCurrentModuleList = (family: RadioFamily) => {
    if (family === 'micro') return MICRO_MODULES;
    if (family === 'macro_single') return MACRO_SINGLE_MODULES;
    return MACRO_DUAL_MODULES;
  }
  
  const getCurrentDefaults = (family: RadioFamily) => {
    if (family === 'micro') return MICRO_DEFAULTS;
    if (family === 'macro_single') return MACRO_SINGLE_DEFAULTS;
    return MACRO_DUAL_DEFAULTS;
  }

  // Track previous architecture to detect switches
  const prevRadioFamily = useRef<RadioFamily>(intent.radioFamily);

  // Initialize or update module selections when bands or architecture changes
  useEffect(() => {
    const defaults = getCurrentDefaults(intent.radioFamily);
    const isFamilyChanged = prevRadioFamily.current !== intent.radioFamily;

    setSelectedModules(prev => {
      const next = { ...prev };
      
      if (isFamilyChanged) {
         // Force reset of active bands to new default if architecture changed
         intent.activeBands.forEach(band => {
             next[band] = defaults[band];
         });
      } else {
         // Ensure any new active bands have a default value
         intent.activeBands.forEach(band => {
            if (!next[band]) {
               next[band] = defaults[band];
            }
         });
      }
      return next;
    });

    prevRadioFamily.current = intent.radioFamily;
  }, [intent.activeBands, intent.radioFamily]);

  useEffect(() => {
    const rrus = calculateRRUs(intent, selectedModules);
    const solved = solveSystem(intent, rrus, slotOverrides);
    setRawSystemState(solved);
  }, [intent, selectedModules, slotOverrides]);

  // Normalize an order array to always include the latest rack ids
  const normalizeRackOrder = (order: number[], racks: Rack[]) => {
    const rackIds = racks.map(r => r.id);
    const preserved = order.filter(id => rackIds.includes(id));
    const missing = rackIds.filter(id => !preserved.includes(id));
    return [...preserved, ...missing];
  };

  const applyRackOrdering = (system: SystemState, order: number[]): SystemState => {
    const normalized = normalizeRackOrder(order, system.racks);
    const orderedRacks = [...system.racks]
      .sort((a, b) => normalized.indexOf(a.id) - normalized.indexOf(b.id))
      .map((rack, idx) => ({ ...rack, bayId: idx + 1 }));
    return { ...system, racks: orderedRacks };
  };

  // Re-apply ordering whenever raw system or order changes
  useEffect(() => {
    const normalized = normalizeRackOrder(rackOrder, rawSystemState.racks);
    const hasChanged = normalized.length !== rackOrder.length || normalized.some((id, idx) => id !== rackOrder[idx]);
    if (hasChanged) {
      setRackOrder(normalized);
      setSystemState(applyRackOrdering(rawSystemState, normalized));
      return;
    }
    setSystemState(applyRackOrdering(rawSystemState, normalized));
  }, [rawSystemState, rackOrder]);

  const reports = React.useMemo(() => generateReports(systemState), [systemState]);

  const handleCableClick = (connectionId: string) => {
    if (selectedConnectionId === connectionId) setSelectedConnectionId(null); 
    else { setSelectedConnectionId(connectionId); setPendingSourcePort(null); }
  };

  const handleDeleteCable = () => {
    if (!selectedConnectionId) return;
    setRawSystemState(prev => ({
      ...prev,
      connections: prev.connections.filter(c => c.id !== selectedConnectionId)
    }));
    setSelectedConnectionId(null);
  };

  const handleSystemPortClick = (rackId: number, slotName: string, portId: number) => {
    if (selectedConnectionId) {
      setRawSystemState(prev => ({
        ...prev,
        connections: prev.connections.map(c =>
          c.id === selectedConnectionId
          ? { ...c, fromRackId: rackId, fromSlotName: slotName, fromPortId: portId }
          : c
        )
      }));
      setSelectedConnectionId(null);
      return;
    }
    if (pendingSourcePort && pendingSourcePort.rackId === rackId && pendingSourcePort.slotName === slotName && pendingSourcePort.portId === portId) {
      setPendingSourcePort(null);
    } else {
      setPendingSourcePort({ rackId, slotName, portId });
    }
  };

  const handleRruPortClick = (rruId: string, optPortId: number) => {
    if (pendingSourcePort) {
      const rru = rawSystemState.rrus.find(r => r.id === rruId);
      if (!rru) return;
      const rack = rawSystemState.racks.find(r => r.id === pendingSourcePort.rackId);
      const slot = rack?.slots.find(s => s.name === pendingSourcePort.slotName);
      if (!slot?.card) return;

      const rruCfg = RRU_CONFIG[rru.type];
      const newConn: Connection = {
        id: `manual-conn-${generateId()}`,
        fromRackId: pendingSourcePort.rackId,
        fromSlotName: pendingSourcePort.slotName,
        fromCardType: slot.card.type,
        fromPortId: pendingSourcePort.portId,
        toSectorList: rru.sectorIds,
        toRruInstanceId: rruId,
        toRruType: rru.type,
        toPortId: optPortId,
        cableType: manualCableType,
        color: rruCfg.bgColor
      };

      setRawSystemState(prev => ({ ...prev, connections: [...prev.connections, newConn] }));
      setPendingSourcePort(null);
    }
  };

  const reorderRacks = (sourceId: number, targetId: number) => {
    if (sourceId === targetId) return;
    setRackOrder(prev => {
      const normalized = normalizeRackOrder(prev, rawSystemState.racks);
      const sourceIndex = normalized.indexOf(sourceId);
      const targetIndex = normalized.indexOf(targetId);
      if (sourceIndex === -1 || targetIndex === -1) return normalized;
      const next = [...normalized];
      next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, sourceId);
      return next;
    });
  };

  const toggleBand = (band: Band) => {
    // Règle métier : en infra MicroRRH, on ne propose pas de L900 dans cette bibliothèque
    if (intent.radioFamily === 'micro' && band === 'L900') return;
    setIntent(prev => {
      if (prev.activeBands.includes(band)) return { ...prev, activeBands: prev.activeBands.filter(b => b !== band) };
      return { ...prev, activeBands: [...prev.activeBands, band] };
    });
  };

  const changeModule = (band: Band, type: string) => {
    setSelectedModules(prev => ({ ...prev, [band]: type as RRUType }));
  };

  const handleSlotContextMenu = (e: React.MouseEvent, rackId: number, slotName: string, currentType: CardType | null) => {
     setContextMenu({
        x: e.clientX,
        y: e.clientY,
        rackId,
        slotName,
        currentType
     });
  };

  const applySlotOverride = (type: CardType | 'EMPTY') => {
     if (!contextMenu) return;
     const key = `${contextMenu.rackId}-${contextMenu.slotName}`;
     setSlotOverrides(prev => ({ ...prev, [key]: type }));
     setContextMenu(null);
  };

  const handleExport = async (type: 'pdf' | 'pptx' | 'png') => {
    setIsExportMenuOpen(false);
    setIsExporting(true);
    
    // Ensure diagram is visible if not active (basic check)
    const exportName = `${siteCode ? siteCode + '_' : ''}${siteName || 'Site_Config'}`;
    const fullSiteName = `${siteCode ? siteCode + ' - ' : ''}${siteName || 'Configuration Sans Nom'}`;
    
    const exportData = {
      bom: reports.bom,
      wiring: reports.wiring,
      siteName: fullSiteName,
      system: systemState 
    };

    try {
      if (type === 'pdf') {
        await exportToPDF(exportData);
      } else if (type === 'pptx') {
        await exportToPPTX(exportData);
      } else {
        await exportToImage(`AXEL_${exportName}_${new Date().toISOString().split('T')[0]}`);
      }
    } catch (e) {
      console.error("Export failed", e);
      alert("Erreur lors de l'exportation. Assurez-vous d'être sur l'onglet Schéma pour inclure l'image.");
    } finally {
      setIsExporting(false);
    }
  };

  // Get current available modules based on selected family
  const currentAvailableModules = getCurrentModuleList(intent.radioFamily);

  return (
    <div className="min-h-screen flex flex-col font-sans text-slate-800 bg-white" onClick={() => setContextMenu(null)}>
      {/* Context Menu */}
      {contextMenu && (
         <div 
            className="fixed bg-white rounded shadow-xl border border-slate-200 z-50 w-48 text-sm overflow-hidden"
            style={{ top: contextMenu.y, left: contextMenu.x }}
            onClick={(e) => e.stopPropagation()}
         >
            <div className="bg-slate-50 px-3 py-2 border-b border-slate-100 font-bold text-slate-700">
               Baie {contextMenu.rackId} - {contextMenu.slotName}
            </div>
            
            {contextMenu.currentType && (
              <button 
                onClick={() => applySlotOverride('EMPTY')}
                className="w-full text-left px-3 py-2 text-red-600 hover:bg-red-50 flex items-center gap-2"
              >
                <XCircle size={14}/> Supprimer
              </button>
            )}

            {contextMenu.slotName === 'C1' ? (
               <button 
                  onClick={() => applySlotOverride(CardType.ASIB)}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2"
               >
                  <Cpu size={14}/> Installer ASIB
               </button>
            ) : (
               <>
                  <button 
                     onClick={() => applySlotOverride(CardType.ABIO_FDD)}
                     className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2"
                  >
                     <PlusCircle size={14}/> Installer ABIO (FDD)
                  </button>
                  <button 
                     onClick={() => applySlotOverride(CardType.ABIO_TDD)}
                     className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2"
                  >
                     <PlusCircle size={14}/> Installer ABIO (TDD)
                  </button>
                  <button 
                     onClick={() => applySlotOverride(CardType.ABIQ)}
                     className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2"
                  >
                     <PlusCircle size={14}/> Installer ABIQ
                  </button>
               </>
            )}
         </div>
      )}

      {/* Header - White Band (Reverted) */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 shadow-sm flex justify-between items-center z-20">
        <div className="flex items-center gap-4">
          <div className="h-12 w-32 flex items-center">
             {/* Improved SVG for Free Logo - Clean Vector Paths */}
             <svg viewBox="0 0 500 200" className="h-full w-full" fill="#CE0033" xmlns="http://www.w3.org/2000/svg">
                <title>Free</title>
                {/* 'f' */}
                <path d="M110.5 68.3H74.4V38.6c0-13.6 8.8-19.3 21.3-19.3 5.7 0 11.4 1.2 16.1 2.8l5.3-33.3C110 5.4 99.5 3.3 85.9 3.3 48.6 3.3 33.3 26.4 33.3 58.5v9.8H13.5v37h19.8v103.1h41.1V105.3h27.9l8.2-37z"/>
                {/* 'r' */}
                <path d="M169.3 105.3V208.4h41.1V141.4c0-18.9 10.7-27.5 26.4-27.5 2.8 0 5.7 0.3 8.2 0.9l5.4-39c-4.6-1.3-9.7-2-15.5-2-18.6 0-33.8 11.1-39.2 29h-0.7V78.9h-40.8v26.4z"/>
                {/* 'e' */}
                <path d="M313 148.1H252.1c0.9 16 13.1 26.7 28.8 26.7 10.1 0 19-4.7 23.9-12.8l34.1 17.1c-11.8 19.8-31.9 30.5-58.3 30.5-41.1 0-68.6-30.5-68.6-70.2s28.8-70.8 69.4-70.8c39.2 0 64.9 29.7 64.9 71.9 0 3.1-0.3 6.3-0.6 7.6h-74z m-31.6-25.5h31c-0.9-13.3-11.1-19.6-20.7-19.6-10.7 0-19.6 7.3-20.7 19.6z"/>
                {/* 'e' */}
                <path d="M439 148.1H378.1c0.9 16 13.1 26.7 28.8 26.7 10.1 0 19-4.7 23.9-12.8l34.1 17.1c-11.8 19.8-31.9 30.5-58.3 30.5-41.1 0-68.6-30.5-68.6-70.2s28.8-70.8 69.4-70.8c39.2 0 64.9 29.7 64.9 71.9 0 3.1-0.3 6.3-0.6 7.6h-74z m-31.6-25.5h31c-0.9-13.3-11.1-19.6-20.7-19.6-10.7 0-19.6 7.3-20.7 19.6z"/>
             </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[#CE0033]">AXEL</h1>
            <p className="text-xs text-slate-500">AirScale Xpert Engineering Layout</p>
          </div>
        </div>
        <div className="flex bg-slate-100 rounded-lg p-1">
           <button onClick={() => setActiveTab('diagram')} className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm transition-all ${activeTab === 'diagram' ? 'bg-white text-[#CE0033] shadow' : 'text-slate-500 hover:text-slate-700'}`}>
             <Activity size={16} /> Schéma
           </button>
           <button onClick={() => setActiveTab('wiring')} className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm transition-all ${activeTab === 'wiring' ? 'bg-white text-[#CE0033] shadow' : 'text-slate-500 hover:text-slate-700'}`}>
             <Layers size={16} /> Table de Câblage
           </button>
           <button onClick={() => setActiveTab('bom')} className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm transition-all ${activeTab === 'bom' ? 'bg-white text-[#CE0033] shadow' : 'text-slate-500 hover:text-slate-700'}`}>
             <FileText size={16} /> BOM
           </button>
        </div>
        
        <div className="relative">
          <button 
            onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
            className="flex items-center gap-2 px-4 py-2 bg-[#CE0033] hover:bg-[#A30029] text-white rounded-md text-sm shadow-sm transition-colors"
          >
            <Download size={16} /> {isExporting ? 'Export...' : 'Exporter'}
          </button>
          
          {isExportMenuOpen && (
            <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-md shadow-xl border border-slate-200 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
              <button 
                onClick={() => handleExport('pdf')}
                className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 border-b border-slate-100"
              >
                <File className="w-4 h-4 text-red-500" /> Rapport PDF
              </button>
              <button 
                onClick={() => handleExport('pptx')}
                className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 border-b border-slate-100"
              >
                <Presentation className="w-4 h-4 text-orange-500" /> Présentation PPTX
              </button>
              <button 
                onClick={() => handleExport('png')}
                className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
              >
                <ImageIcon className="w-4 h-4 text-blue-500" /> Image (PNG)
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden">
        <aside className="w-80 bg-white border-r border-slate-200 flex flex-col shadow-xl z-10 overflow-hidden">
          <div className="p-5 border-b border-slate-100 bg-slate-50">
             <h2 className="font-bold text-slate-800 flex items-center gap-2">
                <Settings className="w-4 h-4 text-[#CE0033]" /> Paramètres du Site
             </h2>
          </div>

          <div className="p-6 space-y-6 overflow-y-auto flex-1">
            
            {/* --- Site Info Inputs --- */}
            <div className="space-y-3 p-4 bg-slate-50 border border-slate-200 rounded-lg">
               <h3 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2"><MapPin size={12}/> Identification</h3>
               <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Code Site (ex: 75123)</label>
                  <input 
                    type="text" 
                    value={siteCode} 
                    onChange={(e) => setSiteCode(e.target.value)} 
                    placeholder="Code"
                    className="w-full px-2 py-1 border border-slate-300 rounded text-sm font-semibold text-slate-700 focus:border-[#CE0033] focus:ring-1 focus:ring-[#CE0033]"
                  />
               </div>
               <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Nom du Site</label>
                  <input 
                    type="text" 
                    value={siteName} 
                    onChange={(e) => setSiteName(e.target.value)} 
                    placeholder="Nom du site"
                    className="w-full px-2 py-1 border border-slate-300 rounded text-sm font-semibold text-slate-700 focus:border-[#CE0033] focus:ring-1 focus:ring-[#CE0033]"
                  />
               </div>
            </div>

            <div className="space-y-2">
               {/* Updated Terminology */}
               <label className="text-xs font-bold text-slate-500 uppercase">Configuration Module Radio</label>
               <div className="flex flex-col gap-2 p-1 bg-slate-100 rounded-lg">
                  <div className="flex gap-2">
                     <button onClick={() => setIntent(p => ({
                       ...p,
                       radioFamily: 'micro',
                       // Sécurité : si on bascule en Micro, on retire L900 (pas de micro-RRH L900 ici)
                       activeBands: p.activeBands.filter(b => b !== 'L900')
                     }))} className={`flex-1 py-2 text-xs font-bold rounded-md flex items-center justify-center gap-1 ${intent.radioFamily === 'micro' ? 'bg-white text-[#CE0033] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><Radio size={12} /> MicroRRH</button>
                     <button onClick={() => setIntent(p => ({...p, radioFamily: 'macro_dual'}))} className={`flex-1 py-2 text-xs font-bold rounded-md flex items-center justify-center gap-1 ${intent.radioFamily === 'macro_dual' ? 'bg-white text-[#CE0033] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><Server size={12} /> DualBand RRH</button>
                  </div>
                  <button onClick={() => setIntent(p => ({...p, radioFamily: 'macro_single'}))} className={`w-full py-2 text-xs font-bold rounded-md flex items-center justify-center gap-1 ${intent.radioFamily === 'macro_single' ? 'bg-white text-[#CE0033] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><Box size={12} /> SingleBand RRH</button>
               </div>
            </div>
            <hr className="border-slate-100" />
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Nombre de Secteurs</label>
              <input type="number" min="1" max="100" value={intent.numSectors} onChange={(e) => setIntent(p => ({...p, numSectors: Math.max(1, parseInt(e.target.value) || 0)}))} className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm font-bold text-[#CE0033] focus:outline-none focus:ring-2 focus:ring-[#CE0033]"/>
            </div>
             <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Mode RF (MIMO)</label>
              <select value={intent.mimoMode} onChange={(e) => setIntent(p => ({...p, mimoMode: e.target.value as MimoMode}))} className="w-full p-2 bg-white border border-slate-200 rounded text-sm text-slate-700 focus:border-[#CE0033] focus:ring-[#CE0033]">
                <option value="SISO">SISO (1 Secteur = 1 Port RF)</option>
                <option value="2x2">2x2 MIMO (1 Secteur = 2 Ports RF)</option>
                <option value="4x4">4x4 MIMO (1 Secteur = 4 Ports RF)</option>
              </select>
            </div>
            
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Configuration Bandes & Modules</label>
              <div className="space-y-3">
                {(['L700', 'L900', 'L1800', 'L2100', 'L2600', 'NR3500'] as Band[]).map(band => {
                  const isDisabled = intent.radioFamily === 'micro' && band === 'L900';
                  const isActive = intent.activeBands.includes(band);

                  return (
                  <div key={band} className={`p-3 border rounded-lg transition-colors ${isActive ? 'bg-slate-50 border-slate-300' : 'bg-white border-slate-100 opacity-70'} ${isDisabled ? 'opacity-40' : ''}`}>
                    <div className="flex items-center gap-3 mb-2">
                      <input
                        type="checkbox"
                        disabled={isDisabled}
                        checked={isActive}
                        onChange={() => toggleBand(band)}
                        className={`w-4 h-4 text-[#CE0033] rounded focus:ring-[#CE0033] ${isDisabled ? 'cursor-not-allowed' : ''}`}
                      />
                      <span className={`font-bold ${isActive ? 'text-slate-800' : 'text-slate-400'}`}>{band}</span>
                      {isDisabled && (
                        <span className="text-[10px] font-bold text-slate-400">(not available in MicroRRH)</span>
                      )}
                    </div>
                    
                    {isActive && (currentAvailableModules[band]?.length ?? 0) > 0 && (
                       <div className="pl-7">
                         <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Module Radio</label>
                         <div className="relative">
                            <select 
                               value={selectedModules[band] || ''} 
                               onChange={(e) => changeModule(band, e.target.value)}
                               className="w-full pl-2 pr-6 py-1 bg-white border border-slate-300 rounded text-xs font-semibold text-slate-700 focus:border-[#CE0033] focus:ring-1 focus:ring-[#CE0033] appearance-none"
                            >
                              {currentAvailableModules[band].map(type => (
                                <option key={type} value={type}>{type}</option>
                              ))}
                            </select>
                            <ChevronRight className="absolute right-2 top-1.5 w-3 h-3 text-slate-400 rotate-90 pointer-events-none" />
                         </div>
                       </div>
                    )}
                  </div>
                )})}
              </div>
            </div>

            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="text-xs font-bold text-blue-800 uppercase mb-1 flex items-center gap-1"><RefreshCw size={12}/> Info Édition</h4>
                <p className="text-[10px] text-blue-700">
                  Clic droit sur un slot (C1, B1, B2...) pour changer ou supprimer une carte.
                </p>
                {Object.keys(slotOverrides).length > 0 && (
                   <button onClick={() => setSlotOverrides({})} className="mt-2 text-[10px] text-red-600 font-bold hover:underline">
                      Réinitialiser modifications manuelles
                   </button>
                )}
            </div>

            <div className="mt-4 p-4 bg-white border border-slate-200 rounded-lg shadow-sm">
              <h4 className="text-xs font-bold text-slate-700 uppercase mb-2 flex items-center gap-2">
                <GripVertical size={14} className="text-[#CE0033]" /> Organisation des Baies
              </h4>
              <p className="text-[11px] text-slate-500 mb-3">Glissez-déposez pour réordonner verticalement. Les câbles et RRUs suivent automatiquement.</p>
              <div className="space-y-2">
                {normalizeRackOrder(rackOrder, systemState.racks).map((rackId) => {
                  const rack = systemState.racks.find(r => r.id === rackId);
                  if (!rack) return null;
                  const totalLinks = systemState.connections.filter(c => c.fromRackId === rack.id).length;
                  return (
                    <div
                      key={rack.id}
                      draggable
                      onDragStart={(e) => { setDraggingRackId(rack.id); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', `${rack.id}`); }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const payload = e.dataTransfer.getData('text/plain');
                        const source = draggingRackId || (payload ? parseInt(payload, 10) : null);
                        if (source) reorderRacks(source, rack.id);
                        setDraggingRackId(null);
                      }}
                      onDragEnd={() => setDraggingRackId(null)}
                      className={`flex items-center gap-3 p-3 border rounded-lg bg-white transition shadow-sm ${draggingRackId === rack.id ? 'ring-2 ring-[#CE0033]' : 'hover:border-[#CE0033]'}`}
                    >
                      <GripVertical className="text-slate-400 w-4 h-4" />
                      <div className="flex-1">
                        <div className="text-sm font-bold text-slate-800">Baie {rack.bayId}</div>
                        <div className="text-[11px] text-slate-500">Rack ID {rack.id} • {rack.slots.filter(s => s.card).length} cartes • {totalLinks} liaisons</div>
                      </div>
                      <span className="text-[11px] font-semibold text-slate-400">Drag</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {(selectedConnectionId || pendingSourcePort) && (
              <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg shadow-sm animate-in fade-in slide-in-from-bottom-2">
                 <h3 className="text-xs font-bold text-orange-800 uppercase mb-2 flex items-center gap-2"><PlugZap size={14}/> Édition Manuelle</h3>
                 {selectedConnectionId ? (
                   <div>
                     <p className="text-xs text-orange-700 mb-2">Câble sélectionné. Déplacer ou supprimer.</p>
                     <button onClick={handleDeleteCable} className="w-full py-2 bg-red-600 text-white rounded text-xs font-bold flex items-center justify-center gap-2 hover:bg-red-700"><Trash2 size={12}/> Supprimer</button>
                   </div>
                 ) : (
                   <div className="space-y-3">
                     <p className="text-xs text-orange-700 font-bold">Sélectionnez le port OPT destination.</p>
                     <div className="flex gap-1 flex-wrap">
                        <button onClick={() => setManualCableType(CableType.CPRI_LEGACY)} className={`px-2 py-1 text-[10px] border rounded ${manualCableType === CableType.CPRI_LEGACY ? 'bg-orange-600 text-white' : 'bg-white'}`}>CPRI</button>
                        <button onClick={() => setManualCableType(CableType.ECPRI)} className={`px-2 py-1 text-[10px] border rounded ${manualCableType === CableType.ECPRI ? 'bg-orange-600 text-white' : 'bg-white'}`}>eCPRI</button>
                        <button onClick={() => setManualCableType(CableType.FIBER)} className={`px-2 py-1 text-[10px] border rounded ${manualCableType === CableType.FIBER ? 'bg-orange-600 text-white' : 'bg-white'}`}>Fibre</button>
                     </div>
                   </div>
                 )}
              </div>
            )}
          </div>
        </aside>

        <div className="flex-1 p-6 overflow-hidden bg-slate-100/50 flex flex-col">
            {activeTab === 'diagram' && (
              <DiagramCanvas
                system={systemState}
                onCableClick={handleCableClick}
                onSystemPortClick={handleSystemPortClick}
                onRruPortClick={handleRruPortClick}
                onSlotContextMenu={handleSlotContextMenu}
                selectedConnectionId={selectedConnectionId}
                selectedPort={pendingSourcePort}
                mimoMode={intent.mimoMode}
                siteName={siteName}
                siteCode={siteCode}
                onRackReorder={reorderRacks}
              />
            )}
            {activeTab === 'wiring' && (<div className="h-full overflow-auto"><h2 className="text-lg font-bold mb-4 text-slate-800">Table de Câblage</h2><WiringTable rows={reports.wiring} /></div>)}
            {activeTab === 'bom' && (<div className="h-full overflow-auto max-w-4xl mx-auto w-full"><h2 className="text-lg font-bold mb-4 text-slate-800">Bill of Materials (BOM)</h2><BomTable items={reports.bom} /></div>)}
        </div>
      </main>
    </div>
  );
};

export default App;
