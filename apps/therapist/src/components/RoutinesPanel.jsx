// RoutinesPanel.jsx
import React from "react";

function getExerciseLabel(item) {
  if (!item) return "—";
  if (typeof item === "string") return item;
  return item.nombre || item.name || item.descripcion || item.exercise_id || item.id || "—";
}

export default function RoutinesPanel({
  routines = [],
  itemsLoading = false,
  onCreate = () => {},
  onView = () => {},
  onEdit = () => {},
  onDelete = () => {},
}) {
  return (
    <div>
      <h3 className="text-lg md:text-2xl font-semibold mb-2">Creación y gestión de rutinas</h3>
      <div className="mb-4 flex gap-2">
        <button onClick={onCreate} className="px-4 py-2 bg-indigo-600 text-white rounded">Crear rutina</button>
      </div>

      <div className="bg-white rounded-xl p-4 shadow-sm border">
        {itemsLoading ? (
          <p className="text-sm text-gray-500">Cargando rutinas...</p>
        ) : routines.length === 0 ? (
          <p className="text-sm text-gray-500">No hay rutinas guardadas.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {routines.map((r) => {
              const previewList = (r.ejercicios || []).map(getExerciseLabel).slice(0, 4);
              const previewText = previewList.length ? previewList.join(", ") : "Sin ejercicios";
              const count = (r.ejercicios && r.ejercicios.length) || 0;

              return (
                <div key={r.id} className="p-3 border rounded">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium">{r.nombre}</div>
                      <div className="text-xs text-gray-500 mt-1">{r.descripcion || ""}</div>
                      <div className="text-xs text-gray-400 mt-2">{previewText}</div>
                    </div>
                    <div className="text-sm text-gray-500"> {count} ejercicios</div>
                  </div>
<div className="mt-3 flex gap-2">
  <button onClick={() => console.log("Asignar a paciente...")} className="px-3 py-1 bg-emerald-50 border rounded text-sm">Asignar</button>

  {/* Pasamos el objeto rutina completo (no sólo id) */}
  <button onClick={() => onView(r)} className="px-3 py-1 border rounded text-sm">Ver</button>

  <button
    onClick={() => {
      if (window.confirm(`¿Eliminar rutina "${r.nombre}"? Esta acción no se puede deshacer.`)) {
        onDelete(r.id);
      }
    }}
    className="px-3 py-1 border rounded text-sm text-rose-700 bg-rose-50"
  >
    Eliminar
  </button>
</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
