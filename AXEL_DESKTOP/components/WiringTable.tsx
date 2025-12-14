import React from 'react';
import { WiringRow } from '../types';

export const WiringTable: React.FC<{ rows: WiringRow[] }> = ({ rows }) => (
  <div className="bg-white rounded-lg shadow border border-slate-200 overflow-hidden">
     <div className="overflow-x-auto">
      <table className="w-full text-xs text-left">
        <thead className="bg-slate-900 text-white uppercase font-medium">
          <tr>
            <th className="px-4 py-3">Baie</th>
            <th className="px-4 py-3">Rack</th>
            <th className="px-4 py-3">Secteurs</th>
            <th className="px-4 py-3">Bande</th>
            <th className="px-4 py-3">Carte</th>
            <th className="px-4 py-3">Slot</th>
            <th className="px-4 py-3">Port</th>
            <th className="px-4 py-3">Type Lien</th>
            <th className="px-4 py-3">Unité Distante</th>
            <th className="px-4 py-3">Port Distant</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 font-mono">
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-blue-50">
              <td className="px-4 py-2 font-bold text-slate-500">Baie {row.bay}</td>
              <td className="px-4 py-2">AMIA {row.rack}</td>
              <td className="px-4 py-2 font-bold text-blue-800">{row.sectors}</td>
              <td className="px-4 py-2">{row.band}</td>
              <td className="px-4 py-2 text-blue-700 font-bold">{row.card}</td>
              <td className="px-4 py-2">{row.slot}</td>
              <td className="px-4 py-2 font-bold">{row.port}</td>
              <td className="px-4 py-2 text-slate-500">{row.cable}</td>
              <td className="px-4 py-2 font-bold">{row.remoteUnit}</td>
              <td className="px-4 py-2">{row.remotePort}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);