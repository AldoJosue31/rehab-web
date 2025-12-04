// PatientDetail.jsx
import React from "react";
import ProgressChart from "./ProgressChartSimple";

export default function PatientDetail({ patient, onBack = () => {}, onAssignRoutine = () => {}, onCreateRoutine = () => {}, onCreateExercise = () => {}, routines = [] }) {
  if (!patient) return <p>Selecciona un paciente</p>;
  const p = patient;

  // small helper to choose routine and optionally request targets (similar to PatientsPanel)
  const chooseAndAssign = async () => {
    if (!routines || routines.length === 0) return alert("No hay rutinas disponibles.");
    const list = routines.map((r, i) => `${i+1}. ${r.nombre} (id:${r.id})`).join("\n");
    const choice = window.prompt(`Elige rutina (escribe el número):\n${list}\n\nO escribe el id de la rutina:`);
    if (!choice) return;
    let rutinaId = null;
    const n = Number(choice);
    if (!Number.isNaN(n) && n >= 1 && n <= routines.length) rutinaId = routines[n-1].id;
    else rutinaId = choice.trim();
    if (!rutinaId) return alert("Rutina inválida.");
    const sessions = window.prompt("¿Cuántas sesiones esperadas? (número)", "5");
    if (!sessions) return;
    // optional targets
    const rut = routines.find(r => r.id === rutinaId);
    let exerciseTargets = {};
    if (rut?.ejercicios && rut.ejercicios.length) {
      for (const item of rut.ejercicios) {
        const exId = item.exercise_id;
        const repsPrompt = window.prompt(`Target repeticiones para ejercicio ${exId} (dejar vacío para usar defecto)`, "");
        if (repsPrompt) {
          exerciseTargets[exId] = exerciseTargets[exId] || {};
          exerciseTargets[exId].target_repeticiones = Number(repsPrompt);
        }
        const seriesPrompt = window.prompt(`Target series para ejercicio ${exId} (vacío = defecto)`, "");
        if (seriesPrompt) {
          exerciseTargets[exId] = exerciseTargets[exId] || {};
          exerciseTargets[exId].target_series = Number(seriesPrompt);
        }
        const timePrompt = window.prompt(`Target tiempo(s) para ejercicio ${exId} (vacío = defecto)`, "");
        if (timePrompt) {
          exerciseTargets[exId] = exerciseTargets[exId] || {};
          exerciseTargets[exId].target_tiempo_segundos = Number(timePrompt);
        }
      }
    }

    onAssignRoutine({ pacienteId: p.id, rutinaId, sesiones: Number(sessions), exerciseTargets });
  };

  return (
    <div>
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-semibold">{p.nombre_completo}</h2>
          <div className="text-sm text-gray-500">Email: {p.email || "—"}</div>
          <div className="text-sm text-gray-500">Teléfono: {p.telefono_emergencia || "—"}</div>
          <div className="text-sm text-gray-500">Tutor: {p.nombre_tutor || "—"}</div>
        </div>
        <div className="flex gap-2">
          <button onClick={onBack} className="px-3 py-1 border rounded">Volver</button>
          <button onClick={chooseAndAssign} className="px-3 py-1 bg-emerald-600 text-white rounded">Asignar rutina</button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="col-span-2 bg-white rounded-xl p-4 shadow-sm border">
          <h4 className="font-medium mb-2">Detalles personales</h4>
          <div className="text-sm text-gray-600 mb-2">Edad: {p.edad || "—"} • Discapacidad: {p.discapacidad || "—"}</div>

          <h5 className="font-medium mt-4 mb-2">Rutinas asignadas</h5>
          {p.asignaciones && p.asignaciones.length ? (
            p.asignaciones.map((a) => (
              <div key={a.id} className="p-3 border rounded mb-3 flex items-center justify-between">
                <div>
                  <div className="font-medium">Rutina: {a.rutina_id || "—"}</div>
                  <div className="text-xs text-gray-500">Estado: {a.estado}</div>
                </div>
                <div className="text-sm text-gray-500">{a.progreso ?? 0}%</div>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-500">No hay rutinas asignadas.</p>
          )}

          <h5 className="font-medium mt-4 mb-2">Historial de sesiones</h5>
          {p.sesiones && p.sesiones.length ? (
            <div className="space-y-3">
              <div className="text-sm text-gray-500">Semanas trabajadas (resumen)</div>
              <ProgressChart sesiones={p.sesiones} />
              <div className="mt-3">
                {p.sesiones.slice(0, 6).map((s) => (
                  <div key={s.id} className="p-2 border rounded mb-2 text-sm">
                    <div className="font-medium">{s.fecha_completada?.toDate ? s.fecha_completada.toDate().toLocaleString() : s.fecha_completada}</div>
                    <div className="text-xs text-gray-500">Duración: {s.duracion_minutos || "—"} min • Percepción: {s.percepcion_esfuerzo || "—"}</div>
                    {/* si quieres mostrar reps reales por ejercicio aquí se puede */}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">Aún no hay sesiones registradas.</p>
          )}
        </div>

        <aside className="bg-white rounded-xl p-4 shadow-sm border">
          <h5 className="font-medium mb-2">Acciones</h5>
          <div className="flex flex-col gap-2">
            <button onClick={onCreateRoutine} className="px-3 py-2 bg-indigo-50 border rounded text-left">Crear rutina</button>
            <button onClick={onCreateExercise} className="px-3 py-2 bg-yellow-50 border rounded text-left">Agregar ejercicio</button>
          </div>
        </aside>
      </div>
    </div>
  );
}
