// apps/patient/src/components/RoutineList.jsx
import React from "react";

/**
 * RoutineList
 * Props:
 *  - routines: array
 *  - loading: boolean
 *  - assignmentsMap: { [rutinaId]: { id, ...asignacionData } } // opcional
 *
 * Muestra las rutinas y un botón "Ver asignación" si existe una asignación para esa rutina.
 * El botón hace scroll hacia la tarjeta de la asignación en el dashboard (id="assignment-{asigId}").
 */
export default function RoutineList({ routines = [], loading = false, assignmentsMap = {} }) {
  if (loading) {
    return <div className="py-4 text-sm text-gray-500">Cargando rutinas...</div>;
  }

  if (!routines || routines.length === 0) {
    return <div className="py-4 text-sm text-gray-600">No hay rutinas para mostrar.</div>;
  }

  const handleGoToAssignment = (rutinaId) => {
    const asign = assignmentsMap && assignmentsMap[rutinaId];
    if (!asign) {
      return;
    }
    const node = document.getElementById(`assignment-${asign.id}`);
    if (node) {
      node.scrollIntoView({ behavior: "smooth", block: "center" });
      // añadir una pequeña animación highlight
      node.classList.add("ring-2", "ring-yellow-300");
      setTimeout(() => node.classList.remove("ring-2", "ring-yellow-300"), 2000);
    } else {
      // fallback: si no encuentra el elemento
      alert("No se encontró la asignación en la pantalla. Desplázate a 'Mis rutinas asignadas'.");
    }
  };

  return (
    <div className="space-y-3">
      {routines.map((r) => {
        const asign = assignmentsMap && assignmentsMap[r.id];
        return (
          <div key={r.id} className="p-3 rounded-md border hover:shadow-sm flex items-center justify-between bg-white">
            <div>
              <div className="font-medium">{r.title || r.nombre || "Rutina sin título"}</div>
              <div className="text-xs text-gray-500">
                {r.time ? r.time + " • " : ""}
                {r.durationMin ? `${r.durationMin} min` : (r.duracion ? `${r.duracion} min` : "")}
              </div>
              {r.notes && <div className="text-sm text-gray-600 mt-1">{r.notes}</div>}
            </div>

            <div className="flex flex-col items-end gap-2">
              {asign ? (
                <button
                  onClick={() => handleGoToAssignment(r.id)}
                  className="px-3 py-1 text-sm bg-[#3b2a4f] text-white rounded-full"
                  title="Ir a la asignación relacionada"
                >
                  Ver asignación
                </button>
              ) : (
                <span className="text-xs text-gray-400">Sin asignación</span>
              )}

              {/* small progress pill */}
              <div className="text-sm text-gray-600">
                {r.progressPercent != null ? <span>{r.progressPercent}%</span> : <span>—</span>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
