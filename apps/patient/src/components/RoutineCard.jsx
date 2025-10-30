// apps/patient/src/components/RoutineCard.jsx
import React from "react";

/**
 * Carta de rutina (simple). Recibe props con la info.
 * Para control real: añadir onComplete, onOpen handlers.
 */
export default function RoutineCard({ item }) {
  const { title, time, durationMin, progressPercent } = item;
  return (
    <div className="flex items-center justify-between border border-gray-200 rounded-lg p-4 mb-3 shadow-sm bg-white">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-lg bg-[#F3F4F6] flex items-center justify-center text-2xl">🏃</div>
        <div>
          <div className="font-semibold">{title}</div>
          <div className="text-xs text-gray-500 mt-1 flex items-center gap-3">
            <span>⏰ {time}</span>
            <span>• {durationMin} min</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* small circular progress */}
        <div className="w-10 h-10 rounded-full border-2 border-[#EAA48A]/30 flex items-center justify-center">
          <div className="w-6 h-6 rounded-full border-2 border-[#3b2a4f]/30" />
        </div>
      </div>
    </div>
  );
}
