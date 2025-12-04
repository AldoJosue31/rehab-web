// ExercisesPanel.jsx
import React from "react";

export default function ExercisesPanel({
  exercises = [],
  onCreate = () => {},
  onViewDetail = () => {},
  onEdit = () => {},
  onDelete = () => {},
}) {
  return (
    <div>
      <h3 className="text-lg md:text-2xl font-semibold mb-2">Ejercicios</h3>
      <div className="mb-4 flex gap-2">
        <button onClick={onCreate} className="px-4 py-2 bg-yellow-600 text-white rounded">Agregar ejercicio</button>
      </div>

      <div className="bg-white rounded-xl p-4 shadow-sm border">
        {exercises.length === 0 ? (
          <p className="text-sm text-gray-500">No hay ejercicios.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {exercises.map((ex) => (
              <div key={ex.id} className="p-3 border rounded">
                <div className="font-medium">{ex.nombre}</div>
                <div className="text-xs text-gray-500 mt-1">{ex.description || ex.descripcion || ""}</div>
                <div className="text-xs text-gray-500 mt-1">
                  {ex.default_repeticiones ? `Reps (def): ${ex.default_repeticiones}` : ""}
                  {ex.default_series ? ` • Series (def): ${ex.default_series}` : ""}
                  {ex.default_tiempo_segundos ? ` • Tiempo (def): ${ex.default_tiempo_segundos}s` : ""}
                </div>

<div className="flex gap-2 mt-2 items-center">
  {(ex.media || ex.urls || []).slice(0, 2).map((m, i) => (
    <a key={i} href={m} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 underline">Media {i + 1}</a>
  ))}

  <button onClick={() => onViewDetail(ex.id)} className="px-3 py-1 border rounded text-sm bg-indigo-50">Detalle</button>

  <button onClick={() => { if (window.confirm(`Eliminar ejercicio "${ex.nombre}"?`)) onDelete(ex.id); }} className="px-3 py-1 border rounded text-sm text-rose-700 bg-rose-50">Eliminar</button>
</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
