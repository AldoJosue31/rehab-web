// apps/patient/src/components/ProgressWidget.jsx
import React from "react";

/**
 * Widget de progreso circular simple (estático visual).
 * Si tienes progreso por día en DB, reemplazar percent por ese valor.
 */
export default function ProgressWidget({ percent = 50 }) {
  // percent: número 0-100
  const stroke = 36; // grosor visual
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200 flex items-center gap-4">
      <div className="flex items-center gap-4">
        <svg width="92" height="92" viewBox="0 0 92 92">
          <defs>
            <linearGradient id="g1" x1="0" x2="1">
              <stop offset="0%" stopColor="#3b2a4f" />
              <stop offset="100%" stopColor="#A6D7FF" />
            </linearGradient>
          </defs>
          <g transform="translate(46,46)">
            <circle r={radius} stroke="#eee" strokeWidth={stroke} fill="none" />
            <circle
              r={radius}
              stroke="url(#g1)"
              strokeWidth={stroke}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              transform="rotate(-90)"
            />
            <text x="0" y="6" textAnchor="middle" className="font-semibold" style={{ fontSize: 18, fill: "#2b2340" }}>
              {percent}%
            </text>
          </g>
        </svg>
        <div>
          <div className="text-sm text-gray-500">Mi progreso</div>
          <div className="text-lg font-semibold">Objetivo diario</div>
        </div>
      </div>
    </div>
  );
}
