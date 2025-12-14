
import React, { useMemo, useState } from 'react';
import { SystemState, RRUType, CardType } from '../types';
import { CABLE_COLORS, RRU_CONFIG, LAYOUT, BAND_SIDE_MAP, COLORS } from '../constants';
import { CablePath } from './CablePath';

interface DiagramCanvasProps {
  system: SystemState;
  onCableClick?: (id: string) => void;
  onSystemPortClick?: (rackId: number, slotName: string, portId: number) => void;
  onRruPortClick?: (rruId: string, portId: number) => void;
  onSlotContextMenu?: (e: React.MouseEvent, rackId: number, slotName: string, cardType: CardType | null) => void;
  selectedConnectionId?: string | null;
  selectedPort?: { rackId: number; slotName: string; portId: number } | null;
  mimoMode?: 'SISO' | '2x2' | '4x4';
  siteName?: string;
  siteCode?: string;
  onRackReorder?: (sourceId: number, targetId: number) => void;
}

export const DiagramCanvas: React.FC<DiagramCanvasProps> = ({
  system,
  onCableClick,
  onSystemPortClick,
  onRruPortClick,
  onSlotContextMenu,
  selectedConnectionId,
  selectedPort,
  mimoMode = '2x2',
  siteName = '',
  siteCode = '',
  onRackReorder
}) => {

  const [draggingRackId, setDraggingRackId] = useState<number | null>(null);
  const [dropTargetRackId, setDropTargetRackId] = useState<number | null>(null);

  // Pre-calculate RRU grouping (rack + side) for layout purposes
  const rruPlacement = useMemo(() => {
    const rruToRackMap = new Map<string, number>();
    system.connections.forEach(c => {
       if (!rruToRackMap.has(c.toRruInstanceId)) {
         rruToRackMap.set(c.toRruInstanceId, c.fromRackId);
       }
    });

    const groups = new Map<string, typeof system.rrus>();
    system.racks.forEach(r => {
      groups.set(`${r.id}-Left`, []);
      groups.set(`${r.id}-Right`, []);
    });
    // Fallback to ensure keys exist if racks are empty
    groups.set('1-Left', []);
    groups.set('1-Right', []);

    system.rrus.forEach(rru => {
      const rackId = rruToRackMap.get(rru.id) || 1;
      const side = BAND_SIDE_MAP[rru.bands[0]] || 'Right';
      const key = `${rackId}-${side}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(rru);
    });

    return { groups, rruToRackMap };
  }, [system.connections, system.rrus, system.racks]);

  // -- Helper: Layout Calculations --

  // 1. Calculate Rack Positions
  const rackLayouts = useMemo(() => {
    let currentY = LAYOUT.AMIA_START_Y;
    return system.racks.map(rack => {
      const externals = rack.slots.filter(s => ['NODEBOX', 'FPBA', 'FPRB', 'FPBC'].includes(s.name));
      const chassisHeight = LAYOUT.AMIA_CHASSIS_HEIGHT + 20 + (externals.length * 60);

      const sumHeight = (items: typeof system.rrus) => items.reduce((acc, rru, idx) => {
        const cfg = RRU_CONFIG[rru.type];
        return acc + cfg.height + (idx > 0 ? LAYOUT.RRU_GAP_Y : 0);
      }, 0);

      const leftHeight = sumHeight(rruPlacement.groups.get(`${rack.id}-Left`) || []);
      const rightHeight = sumHeight(rruPlacement.groups.get(`${rack.id}-Right`) || []);
      const blockHeight = Math.max(chassisHeight, leftHeight, rightHeight);

      const pos = {
        id: rack.id,
        bayId: rack.bayId,
        x: LAYOUT.AMIA_CENTER_X,
        y: currentY,
        width: LAYOUT.AMIA_WIDTH,
        height: LAYOUT.AMIA_CHASSIS_HEIGHT,
        externals,
        blockHeight
      };
      currentY += blockHeight + LAYOUT.AMIA_GAP;
      return pos;
    });
  }, [rruPlacement.groups, system.racks]);

  // 2. Helper to get physical coordinates of a Slot/Port
  const getPortCoords = (rackId: number, slotName: string, portIndex: number) => {
    const rackPos = rackLayouts.find(r => r.id === rackId);
    if (!rackPos) return { x: 0, y: 0 };
    
    // Internal Slots: C1, B1, B2, B3
    const isInternal = ['C1', 'B1', 'B2', 'B3'].includes(slotName);
    
    if (isInternal) {
      let rowY = rackPos.y + 40; 
      if (slotName === 'B1') rowY += 90;
      else if (slotName === 'B2') rowY += 180;
      else if (slotName === 'B3') rowY += 270;
      
      const slotWidth = rackPos.width - 20; 
      const colX = rackPos.x + 10;
      const portSpacing = slotWidth / 10;
      const px = colX + ((portIndex - 1) * portSpacing) + 5;
      const py = rowY + 55;
      return { x: px, y: py };
    }
    return { x: 0, y: 0 };
  };

  // 3. Calculate RRU Positions (Smart Alignment)
  const rruPositions = useMemo(() => {
    const positions: Array<{
      instanceId: string;
      sectorIds: number[]; 
      portMapping: Record<number, string>;
      type: RRUType; 
      x: number; 
      y: number; 
      width: number; 
      height: number;
      side: 'Left' | 'Right';
      rackId: number;
    }> = [];
    
    // C. Calculate positions iterating through Racks to maintain alignment
    let currentYLeft = LAYOUT.AMIA_START_Y;
    let currentYRight = LAYOUT.AMIA_START_Y;

    // Iterate through racks based on layout order
    rackLayouts.forEach(rackPos => {
       const rackId = rackPos.id;
       const rackTopY = rackPos.y;

       // --- Process Left Side ---
       const leftRRUs = rruPlacement.groups.get(`${rackId}-Left`) || [];
       // Start at least at Rack Top, but respect previous modules to avoid overlap
       let startYLeft = Math.max(currentYLeft, rackTopY);
       
       leftRRUs.forEach(rru => {
          const cfg = RRU_CONFIG[rru.type];
          positions.push({
             instanceId: rru.id,
             sectorIds: rru.sectorIds,
             portMapping: rru.portMapping,
             type: rru.type,
             x: LAYOUT.RRU_LEFT_X,
             y: startYLeft,
             width: LAYOUT.RRU_WIDTH,
             height: cfg.height,
             side: 'Left',
             rackId: rackId
          });
          startYLeft += cfg.height + LAYOUT.RRU_GAP_Y;
       });
       // Update global cursor for Left side with a small gap for the next group
       currentYLeft = startYLeft + 40;

       // --- Process Right Side ---
       const rightRRUs = rruPlacement.groups.get(`${rackId}-Right`) || [];
       let startYRight = Math.max(currentYRight, rackTopY);
       
       rightRRUs.forEach(rru => {
          const cfg = RRU_CONFIG[rru.type];
          positions.push({
             instanceId: rru.id,
             sectorIds: rru.sectorIds,
             portMapping: rru.portMapping,
             type: rru.type,
             x: LAYOUT.RRU_RIGHT_X,
             y: startYRight,
             width: LAYOUT.RRU_WIDTH,
             height: cfg.height,
             side: 'Right',
             rackId: rackId
          });
          startYRight += cfg.height + LAYOUT.RRU_GAP_Y;
       });
       currentYRight = startYRight + 40;
    });

    return positions;
  }, [system.rrus, system.connections, system.racks, rackLayouts]); // added rackLayouts dep

  const getRruPortCoords = (rruInstanceId: string, portIndex: number) => {
    const pos = rruPositions.find(p => p.instanceId === rruInstanceId);
    if (!pos) return { x: 0, y: 0 };
    const isLeft = pos.side === 'Left';
    const cx = isLeft ? pos.x + pos.width : pos.x; 
    const yOffset = portIndex === 1 ? 20 : pos.height - 20;
    return { x: cx, y: pos.y + yOffset };
  };

  const getCardColor = (type: CardType) => {
    switch (type) {
      case CardType.ASIB: return COLORS.ASIB_GREY;
      case CardType.ABIO_FDD: return COLORS.ABIO_FDD_BEIGE;
      case CardType.ABIO_TDD: return COLORS.ABIO_TDD_BLUE;
      case CardType.ABIQ: return COLORS.ABIQ_PINK;
      case CardType.NODEBOX: return COLORS.NODEBOX_RED;
      case CardType.FPBA: return COLORS.FPBA_PURPLE;
      case CardType.FPRB: return COLORS.FPRB_INDIGO;
      case CardType.FPBC: return COLORS.FPBC_VIOLET;
      default: return '#94A3B8';
    }
  };

  const stackBottom = rackLayouts.reduce((max, r) => Math.max(max, r.y + (r as any).blockHeight), LAYOUT.AMIA_START_Y);
  const rruBottom = rruPositions.reduce((max, p) => Math.max(max, p.y + p.height), 0);
  const svgHeight = Math.max(stackBottom + 200, rruBottom + 100);

  return (
    <div id="diagram-canvas" className="w-full h-full overflow-auto bg-slate-50 rounded-lg shadow-inner border border-slate-200 cursor-default bg-white">
      <svg id="diagram-svg" width={LAYOUT.CANVAS_WIDTH} height={svgHeight} viewBox={`0 0 ${LAYOUT.CANVAS_WIDTH} ${svgHeight}`}>
        <defs>
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="2" dy="2" stdDeviation="3" floodOpacity="0.1"/>
          </filter>
        </defs>

        {/* --- SITE INFO HEADER ON CANVAS --- */}
        {(siteName || siteCode) && (
          <g>
            <rect x="20" y="20" width="400" height="40" rx="4" fill="white" stroke="#e2e8f0" strokeWidth="1" filter="url(#shadow)" />
            <text x="35" y="46" className="text-sm font-bold fill-slate-800" fontSize="16">
              {siteCode ? `${siteCode} - ` : ''}{siteName || 'Site Sans Nom'}
            </text>
          </g>
        )}

        {/* --- RACKS --- */}
        {system.racks.map((rack, idx) => {
          const pos = rackLayouts[idx];
          const isDragging = draggingRackId === rack.id;
          const isDropTarget = dropTargetRackId === rack.id && draggingRackId !== rack.id;
          return (
            <g
              key={rack.id}
              draggable
              onDragStart={(e) => {
                setDraggingRackId(rack.id);
                setDropTargetRackId(rack.id);
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', `${rack.id}`);
              }}
              onDragOver={(e) => { e.preventDefault(); setDropTargetRackId(rack.id); }}
              onDrop={(e) => {
                e.preventDefault();
                const payload = e.dataTransfer.getData('text/plain');
                const sourceId = draggingRackId || (payload ? parseInt(payload, 10) : null);
                if (sourceId && sourceId !== rack.id) {
                  onRackReorder?.(sourceId, rack.id);
                }
                setDraggingRackId(null);
                setDropTargetRackId(null);
              }}
              onDragEnd={() => { setDraggingRackId(null); setDropTargetRackId(null); }}
              className="cursor-move"
            >
              
              {/* Chassis */}
              <rect
                x={pos.x}
                y={pos.y}
                width={pos.width}
                height={pos.height}
                fill="#E2E8F0"
                stroke={isDropTarget ? '#CE0033' : '#94A3B8'}
                strokeWidth={isDragging || isDropTarget ? 3 : 2}
                rx="4"
                opacity={isDragging ? 0.85 : 1}
              />
              <text x={pos.x + 10} y={pos.y + 25} className="font-bold text-slate-500 text-lg">AMIA (Baie {rack.bayId})</text>
              
              {/* Internal Slots */}
              {rack.slots.filter(s => ['C1', 'B1', 'B2', 'B3'].includes(s.name)).map(slot => {
                const colX = pos.x + 10;
                let rowY = pos.y + 40;
                if (slot.name === 'B1') rowY += 90;
                else if (slot.name === 'B2') rowY += 180;
                else if (slot.name === 'B3') rowY += 270;

                const slotW = pos.width - 20;
                const slotH = 80;
                const cardColor = slot.card ? getCardColor(slot.card.type) : '#FFFFFF';
                const textColor = (slot.card?.type === CardType.ASIB) ? 'white' : '#1e293b';

                return (
                  <g key={slot.id} 
                     onContextMenu={(e) => { e.preventDefault(); onSlotContextMenu?.(e, rack.id, slot.name, slot.card?.type || null); }}
                     className="cursor-pointer hover:opacity-95"
                  >
                    <rect x={colX} y={rowY} width={slotW} height={slotH} fill={cardColor} stroke="#CBD5E1" rx="2" />
                    <text x={colX + 5} y={rowY + 15} className="text-[10px] fill-slate-900 opacity-50 font-mono">{slot.name}</text>
                    
                    {slot.card ? (
                      <>
                        <text x={colX + slotW/2} y={rowY + 30} textAnchor="middle" fill={textColor} className="text-sm font-bold tracking-tight">{slot.card.label}</text>
                        {/* ABIO Ports */}
                        {(slot.card.type === CardType.ABIO_FDD || slot.card.type === CardType.ABIO_TDD || slot.card.type === CardType.ABIQ) && slot.card.ports.map((port, pIdx) => {
                          const pX = colX + (pIdx * (slotW/10)) + 5;
                          const pY = rowY + 55;
                          const isConnected = system.connections.some(c => c.fromRackId === rack.id && c.fromSlotName === slot.name && c.fromPortId === port.id);
                          const isSelected = selectedPort?.rackId === rack.id && selectedPort?.slotName === slot.name && selectedPort?.portId === port.id;
                          return (
                            <g key={port.id} onClick={(e) => { e.stopPropagation(); onSystemPortClick?.(rack.id, slot.name, port.id); }} className="cursor-pointer">
                              <rect x={pX + 2} y={pY} width={10} height={10} fill={isSelected ? '#F59E0B' : (isConnected ? '#334155' : '#E2E8F0')} stroke={isSelected ? '#D97706' : '#94A3B8'} strokeWidth={isSelected ? 2 : 1} rx={1} />
                              {/* Moved port number text below the port rect */}
                              <text x={pX + 7} y={pY + 22} textAnchor="middle" className="text-[9px] font-bold" fill={textColor}>{port.id}</text>
                            </g>
                          )
                        })}
                      </>
                    ) : (
                      <text x={colX + slotW/2} y={rowY + 45} textAnchor="middle" className="text-xs italic fill-slate-400">VIDE (Clic Droit)</text>
                    )}
                  </g>
                );
              })}

              {/* Externals */}
              {pos.externals.map((slot, extIdx) => {
                 let extY = pos.y + pos.height + 20 + (extIdx * 60);
                 const extWidth = 320; 
                 const extX = pos.x + (pos.width - extWidth) / 2;
                 const cardColor = slot.card ? getCardColor(slot.card.type) : '#FFFFFF';
                 return (
                    <g key={slot.id}>
                        <line x1={pos.x + pos.width/2} y1={extY - 20} x2={pos.x + pos.width/2} y2={extY} stroke="#94A3B8" strokeWidth="2" strokeDasharray="4"/>
                        <rect x={extX} y={extY} width={extWidth} height={50} fill={cardColor} stroke="#94A3B8" rx="2" filter="url(#shadow)" />
                        <text x={extX + 5} y={extY + 15} className="text-[10px] fill-white opacity-70 font-mono">{slot.name}</text>
                        <text x={extX + extWidth/2} y={extY + 30} textAnchor="middle" className="text-sm font-bold fill-white tracking-widest">{slot.card?.label}</text>
                    </g>
                 )
              })}

              {/* GPS Connection (Visible on First Rack Only, connected to ASIB) */}
              {system.hasGps && idx === 0 && (
                 <g>
                    {/* Cable Route: From Top Antenna to ASIB C1 Port */}
                    {/* C1 is at pos.y + 40. We target a port on the left side of C1. */}
                    <path d={`M ${pos.x + 40} ${pos.y - 35} L ${pos.x + 40} ${pos.y + 80}`} stroke="#334155" strokeWidth="3" fill="none" />
          
                    {/* Antenna Head */}
                    <circle cx={pos.x + 40} cy={pos.y - 35} r={12} fill="white" stroke="#334155" strokeWidth="2" />
                    <text x={pos.x + 40} y={pos.y - 35} dy={4} textAnchor="middle" className="text-[10px] font-bold fill-slate-700">GPS</text>
          
                    {/* Connection to ASIB (Port) */}
                    {/* ASIB C1 Slot starts at pos.y + 40, Height 80. Center Y is pos.y + 80. */}
                    <circle cx={pos.x + 40} cy={pos.y + 80} r={5} fill="#334155" stroke="white" strokeWidth="1" />
                    <text x={pos.x + 50} y={pos.y + 83} className="text-[9px] font-bold fill-white">SYNC</text>
                 </g>
              )}

            </g>
          );
        })}

        {/* --- CONNECTIONS --- */}
        {system.connections.map((conn, idx) => {
           const start = getPortCoords(conn.fromRackId, conn.fromSlotName, conn.fromPortId);
           const end = getRruPortCoords(conn.toRruInstanceId, conn.toPortId);
           if (!start.x || !end.x) return null;
           const fixedStart = { x: start.x + 7, y: start.y + 5 }; 
           return (
             <g key={conn.id} onClick={(e) => { e.stopPropagation(); onCableClick?.(conn.id); }} className="cursor-pointer hover:opacity-80">
               <CablePath start={fixedStart} end={end} color={conn.color} offsetIndex={idx % 15} isSelected={selectedConnectionId === conn.id} />
             </g>
           );
        })}

        {/* --- RRUs --- */}
        {rruPositions.map((pos) => {
          const cfg = RRU_CONFIG[pos.type];
          // Determine port count: Macro always 6, Micro always 4
          const totalPorts = cfg.ports || 6;
          // Determine optical port count
          const opticalPorts = (cfg as any).opticalPorts ?? (totalPorts > 4 ? 2 : 1); 

          const ports = Array.from({length: totalPorts}, (_, i) => i + 1);
          
          return (
            <g key={pos.instanceId}>
              <rect x={pos.x} y={pos.y} width={pos.width} height={pos.height} fill={cfg.bgColor} stroke="#000" strokeWidth="1" rx="2" filter="url(#shadow)" />
              <text x={pos.x + pos.width/2} y={pos.y + pos.height/2 + 4} textAnchor="middle" className="text-sm font-bold fill-slate-900 pointer-events-none">
                {cfg.label} <tspan fontSize="10" fontWeight="normal">({cfg.subLabel})</tspan>
              </text>
              <text x={pos.x + 5} y={pos.y + 12} className="text-[9px] fill-slate-500 opacity-50 font-mono">
                 {pos.rackId > 1 ? `AMIA ${pos.rackId}` : ''}
              </text>

              {/* Optical Ports */}
              {pos.side === 'Left' ? (
                <>
                  <g onClick={(e) => { e.stopPropagation(); onRruPortClick?.(pos.instanceId, 1); }} className="cursor-pointer hover:opacity-80">
                    <rect x={pos.x + pos.width} y={pos.y + 10} width={12} height={16} fill="#334155" />
                    <text x={pos.x + pos.width - 4} y={pos.y + 22} textAnchor="end" className="text-[9px] fill-slate-900 font-bold">OPT1</text>
                  </g>
                  {/* OPT2 Only for Macro or Configured */}
                  {opticalPorts > 1 && (
                      <g onClick={(e) => { e.stopPropagation(); onRruPortClick?.(pos.instanceId, 2); }} className="cursor-pointer hover:opacity-80">
                        <rect x={pos.x + pos.width} y={pos.y + pos.height - 26} width={12} height={16} fill="#334155" />
                        <text x={pos.x + pos.width - 4} y={pos.y + pos.height - 14} textAnchor="end" className="text-[9px] fill-slate-900 font-bold">OPT2</text>
                      </g>
                  )}
                  {/* RF Ports */}
                   {ports.map((p,i) => {
                      const label = pos.portMapping[p];
                      return (
                      <g key={i}>
                        <circle cx={pos.x - 5} cy={pos.y + 15 + i*12} r={3} fill={label ? "#CBD5E1" : "#FF0000"} stroke="#64748B" />
                        {label ? (
                           <text x={pos.x - 12} y={pos.y + 18 + i*12} textAnchor="end" className="text-[9px] fill-slate-600 font-bold">{label}</text>
                        ) : (
                           <text x={pos.x - 12} y={pos.y + 18 + i*12} textAnchor="end" className="text-[8px] fill-red-500 italic">5W</text>
                        )}
                      </g>
                   )})}
                </>
              ) : (
                <>
                  <g onClick={(e) => { e.stopPropagation(); onRruPortClick?.(pos.instanceId, 1); }} className="cursor-pointer hover:opacity-80">
                    <rect x={pos.x - 12} y={pos.y + 10} width={12} height={16} fill="#334155" />
                    <text x={pos.x + 16} y={pos.y + 22} textAnchor="start" className="text-[9px] fill-slate-900 font-bold">OPT1</text>
                  </g>
                   {opticalPorts > 1 && (
                      <g onClick={(e) => { e.stopPropagation(); onRruPortClick?.(pos.instanceId, 2); }} className="cursor-pointer hover:opacity-80">
                        <rect x={pos.x - 12} y={pos.y + pos.height - 26} width={12} height={16} fill="#334155" />
                        <text x={pos.x + 16} y={pos.y + pos.height - 14} textAnchor="start" className="text-[9px] fill-slate-900 font-bold">OPT2</text>
                      </g>
                   )}
                  {ports.map((p,i) => {
                      const label = pos.portMapping[p];
                      return (
                      <g key={i}>
                         <circle cx={pos.x + pos.width + 5} cy={pos.y + 15 + i*12} r={3} fill={label ? "#CBD5E1" : "#FF0000"} stroke="#64748B" />
                         {label ? (
                            <text x={pos.x + pos.width + 12} y={pos.y + 18 + i*12} textAnchor="start" className="text-[9px] fill-slate-600 font-bold">{label}</text>
                         ) : (
                            <text x={pos.x + pos.width + 12} y={pos.y + 18 + i*12} textAnchor="start" className="text-[8px] fill-red-500 italic">5W</text>
                         )}
                      </g>
                   )})}
                </>
              )}
            </g>
          );
        })}

      </svg>
    </div>
  );
};
