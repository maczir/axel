import React from 'react';
import { BomItem } from '../types';

export const BomTable: React.FC<{ items: BomItem[] }> = ({ items }) => (
  <div className="bg-white rounded-lg shadow border border-slate-200 overflow-hidden">
    <table className="w-full text-sm text-left">
      <thead className="bg-slate-50 text-slate-500 uppercase font-medium">
        <tr>
          <th className="px-6 py-3">Article</th>
          <th className="px-6 py-3">Description</th>
          <th className="px-6 py-3 text-right">Quantité</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {items.map((item, i) => (
          <tr key={i} className="hover:bg-slate-50">
            <td className="px-6 py-3 font-semibold text-slate-700">{item.part}</td>
            <td className="px-6 py-3 text-slate-600">{item.description}</td>
            <td className="px-6 py-3 text-right font-mono text-blue-600">{item.qty}</td>
          </tr>
        ))}
        {items.length === 0 && (
          <tr>
             <td colSpan={3} className="px-6 py-8 text-center text-slate-400 italic">Aucun équipement généré.</td>
          </tr>
        )}
      </tbody>
    </table>
  </div>
);