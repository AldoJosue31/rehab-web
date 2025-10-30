// apps/patient/src/components/CalendarDays.jsx
import React from "react";

/**
 * Calendario horizontal de la semana (simple).
 * - Este componente es estático por simplicidad pero se puede enlazar a la DB.
 * - Muestra el día seleccionado en el centro con estilo "pill".
 */
export default function CalendarDays() {
  // Generamos la semana actual (domingo..sábado)
  const days = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];
  // índice de día seleccionado (hoy -> 3 en la imagen ejemplo)
  const selected = new Date().getDay(); // 0-6 (Dom..Sab)

  // para demo, forzamos que el centro sea 3 como en la imagen; comenta para usar today:
  // const selected = 3;

  return (
    <div className="flex items-center gap-3 overflow-x-auto">
      {days.map((label, i) => {
        const isSelected = i === selected;
        return (
          <div key={i} className="flex flex-col items-center min-w-[44px] md:min-w-[64px]">
            <div className={`text-xs ${isSelected ? "text-[#3b2a4f] font-semibold" : "text-gray-400"}`}>{label}</div>
            <div className={`mt-1 w-8 h-8 flex items-center justify-center rounded-full ${isSelected ? "bg-[#FFE8DE] border border-[#EAA48A]" : ""}`}>
              <span className={`text-sm ${isSelected ? "text-[#3b2a4f] font-semibold" : "text-gray-500"}`}>{i + 7}</span>
            </div>
          </div>
        );
      })}
      <div className="border-l h-12 ml-4 border-[#F3CABC]/40" />
      <div className="ml-4 text-sm text-gray-500">Mi progreso</div>
    </div>
  );
}
