// ProgressChartSimple.jsx - (opcional) reutilizable pequeño chart demo
import React from "react";

export default function ProgressChartSimple({ sesiones = [] }) {
  const weeks = [];
  for (let i = 5; i >= 0; i--) {
    const label = `S-${i + 1}`;
    const value = Math.min(100, Math.round(Math.random() * 60 + i * 6));
    weeks.push({ label, value });
  }
  return (
    <div className="w-full overflow-x-auto">
      <div className="flex items-end gap-3 h-36">
        {weeks.map((w) => (
          <div key={w.label} className="flex-1 text-center">
            <div className="h-full flex items-end justify-center">
              <div className="rounded-t-md bg-indigo-600" style={{ height: `${w.value}%`, minHeight: 6 }} title={`${w.value}%`}></div>
            </div>
            <div className="text-xs mt-2 text-gray-600">{w.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
