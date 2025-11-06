// apps/patient/src/components/CalendarDays.jsx
import React from "react";

export default function CalendarDays({ selectedIndex }) {
  const days = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];
  const today = new Date().getDay();
  const selected = typeof selectedIndex === "number" ? selectedIndex : today;

  return (
    <div className="overflow-x-auto no-scrollbar">
      <div className="flex items-center gap-4 px-2 md:px-0 snap-x snap-mandatory overflow-x-auto">
        {days.map((label, i) => {
          const isSelected = i === selected;
          return (
            <div key={i} className="snap-center flex flex-col items-center min-w-[56px] md:min-w-[72px]">
              <div className={`text-xs ${isSelected ? "text-[#3b2a4f] font-semibold" : "text-gray-400"}`}>{label}</div>
              <div className={`mt-1 flex items-center justify-center ${isSelected ? "w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-[#FFE8DE] border border-[#EAA48A]" : "w-9 h-9 md:w-10 md:h-10 rounded-full"}`}>
                <span className={`text-sm ${isSelected ? "text-[#3b2a4f] font-semibold" : "text-gray-500"}`}>{i + 7}</span>
              </div>
            </div>
          );
        })}
        <div className="hidden md:block h-12 border-l ml-6 border-[#F3CABC]/40" />
        <div className="ml-4 text-sm text-gray-500 hidden md:block">Mi progreso</div>
      </div>
    </div>
  );
}
