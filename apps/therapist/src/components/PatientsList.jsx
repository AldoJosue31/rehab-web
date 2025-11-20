import React from "react";

/**
 * Presentational list of patients (stateless).
 * Props:
 *  - patients: array
 *  - loading: boolean
 *  - onView(patientId)
 *  - onAssign(patientId)
 *  - onUnlink(patientId)  <-- NUEVO (función que debe pasar el padre)
 */
export default function PatientsList({
  patients = [],
  loading = false,
  onView = () => {},
  onAssign = () => {},
  onUnlink = () => {}
}) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border">
      {loading ? (
        <p className="text-sm text-gray-500">Cargando pacientes...</p>
      ) : patients.length === 0 ? (
        <p className="text-sm text-gray-500">No hay pacientes aún.</p>
      ) : (
        <div className="space-y-3">
          {patients.map((p) => (
            <div key={p.id} className="p-3 border rounded flex items-center justify-between">
              <div>
                <div className="font-medium">{p.nombre_completo}</div>
                <div className="text-xs text-gray-500">{p.telefono_emergencia || "Sin teléfono"}</div>
                <div className="text-xs text-gray-400 mt-1">Tutor: {p.nombre_tutor || "—"}</div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => onView(p.id)}
                  className="px-3 py-1 bg-indigo-50 border rounded text-sm"
                  title="Ver detalle"
                >
                  Ver
                </button>

                <button
                  onClick={() => onAssign(p.id)}
                  className="px-3 py-1 bg-emerald-50 border rounded text-sm"
                  title="Asignar rutina"
                >
                  Asignar rutina
                </button>

                <button
                  onClick={() => {
                    // confirm simple y directo; el padre realiza la acción real
                    const ok = window.confirm(`¿Desvincular al paciente "${p.nombre_completo}"? Esta acción quitará la relación con el terapeuta.`);
                    if (ok) onUnlink(p.id);
                  }}
                  className="px-3 py-1 bg-rose-50 border border-rose-200 rounded text-sm text-rose-700 hover:bg-rose-100"
                  title="Desvincular paciente"
                >
                  Desvincular
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
