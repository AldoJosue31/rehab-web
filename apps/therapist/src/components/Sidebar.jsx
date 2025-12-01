// apps/therapist/src/components/Sidebar.jsx
import React, { useState } from "react";

export default function Sidebar({ onNavigate = () => {} }) {
  const [open, setOpen] = useState(false);

  const menu = [
    { key: "home", label: "Panel médico", emoji: "🏥" },
    { key: "patients", label: "Gestión de pacientes", emoji: "🧑‍🤝‍🧑" },
    { key: "routines", label: "Crear rutinas", emoji: "📋" },
    { key: "exercises", label: "Ejercicios", emoji: "🏃" },
    { key: "createExercise", label: "Agregar ejercicio", emoji: "➕" },
    { key: "profile", label: "Perfil", emoji: "⚙️" },
  ];

  const handleClick = (key) => {
    setOpen(false);
    onNavigate(key);
  };

  return (
    <>
      {/* Mobile hamburger */}
      <div className="fixed top-3 left-3 z-40 md:hidden">
        <button
          onClick={() => setOpen(true)}
          aria-label="Abrir menú"
          className="p-2 rounded-md bg-white/90 shadow border border-gray-100"
        >
          <svg className="w-6 h-6 text-[#3b2a4f]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-30 transition-opacity duration-300 ${open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        aria-hidden={!open}
        onClick={() => setOpen(false)}
      >
        <div className="absolute inset-0 bg-black/40" />
      </div>

      {/* Drawer panel */}
      <aside
        className={`fixed top-0 left-0 z-40 h-full w-64 bg-white shadow-lg transform transition-transform duration-300
          ${open ? "translate-x-0" : "-translate-x-full"} md:translate-x-0 md:static md:shadow-none md:w-64`}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div>
            <h3 className="text-lg font-bold text-[#3b2a4f]">mHealth</h3>
            <p className="text-xs text-gray-400">Terapeuta</p>
          </div>
          <button onClick={() => setOpen(false)} className="p-2 rounded-md bg-gray-100 hover:bg-gray-200 md:hidden" aria-label="Cerrar menú">
            <svg className="w-5 h-5 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <nav className="p-3 space-y-1">
          {menu.map((it) => (
            <button
              key={it.key}
              onClick={() => handleClick(it.key)}
              className="w-full text-left flex items-center gap-3 p-2 rounded-md hover:bg-[#FFF2EE] transition-colors"
            >
              <span className="w-8 h-8 rounded-md bg-[#EAA48A]/20 flex items-center justify-center text-lg">{it.emoji}</span>
              <span className="text-sm font-medium">{it.label}</span>
            </button>
          ))}
        </nav>

        <div className="mt-auto p-4 border-t border-gray-100">
          <div className="text-xs text-gray-500">© mHealth</div>
        </div>
      </aside>
    </>
  );
}
