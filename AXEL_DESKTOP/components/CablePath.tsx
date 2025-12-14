import React from 'react';

interface Point {
  x: number;
  y: number;
}

interface CablePathProps {
  start: Point; // From System Module (Center)
  end: Point;   // To RRU (Side)
  color: string;
  offsetIndex: number;
  label?: string;
  isSelected?: boolean;
}

export const CablePath: React.FC<CablePathProps> = ({ 
  start, 
  end, 
  color, 
  offsetIndex,
  label,
  isSelected
}) => {
  // Determine direction
  const isGoingLeft = end.x < start.x;
  
  const channelX = isGoingLeft 
    ? 300 - (offsetIndex * 4) 
    : 950 + (offsetIndex * 4);

  const pathData = `
    M ${start.x} ${start.y}
    L ${start.x} ${start.y - 15} 
    L ${channelX} ${start.y - 15}
    L ${channelX} ${end.y}
    L ${end.x} ${end.y}
  `;

  return (
    <g className={`cable-group transition-all duration-200 ${isSelected ? 'opacity-100' : 'opacity-90 hover:opacity-100'}`}>
      {/* Background stroke (wider for hit target and border) */}
      <path 
        d={pathData} 
        fill="none" 
        stroke={isSelected ? '#F59E0B' : 'white'} 
        strokeWidth={isSelected ? "8" : "5"} 
        strokeLinecap="round" 
        strokeLinejoin="round"
        className="drop-shadow-sm"
      />
      {/* Main Wire */}
      <path 
        d={pathData} 
        fill="none" 
        stroke={color} 
        strokeWidth="2.5" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
      {/* Port Dots */}
      <circle cx={start.x} cy={start.y} r={isSelected ? 4 : 3} fill={color} stroke={isSelected ? '#F59E0B' : 'white'} strokeWidth={1} />
      <circle cx={end.x} cy={end.y} r={isSelected ? 4 : 3} fill={color} stroke={isSelected ? '#F59E0B' : 'white'} strokeWidth={1} />
    </g>
  );
};