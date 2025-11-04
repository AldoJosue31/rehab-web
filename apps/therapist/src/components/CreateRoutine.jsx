import React, { useState } from "react";

/**
 * CreateRoutine:
 * Props:
 *  - exercises: array [{id, nombre, descripcion}]
 *  - onSubmit(form)
 *  - onCancel()
 *  - busy, error
 */
export default function CreateRoutine({ exercises = [], onSubmit = () => {}, onCancel = () => {}, busy = false, error = "" }) {
  const [nombre, setNombre] = useState("");
  const [sesiones, setSesiones] = useState(4);
  const [duracion, setDuracion] = useState(20);
  const [recomendaciones, setRecomendaciones] = useState("");
  const [selectedEj, setSelectedEj] = useState([]);

  const toggleEj = (id) => setSelectedEj((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border max-w-3xl">
      <form onSubmit={(e) => { e.preventDefault(); onSubmit({ nombre, sesiones, duracion, recomendaciones, ejercicios: selectedEj }); }} className="space-y-4">
        <div>
          <label className="block text-sm text-gray-600">Nombre de la rutina</label>
          <input required value={nombre} onChange={(e) => setNombre(e.target.value)} className="w-full border rounded px-4 py-2" placeholder="Ej. Rehabilitación de hombro" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-gray-600">Sesiones</label>
            <input type="number" min="1" value={sesiones} onChange={(e) => setSesiones(e.target.value)} className="w-full border rounded px-4 py-2" />
          </div>
          <div>
            <label className="block text-sm text-gray-600">Duración (min)</label>
            <input type="number" min="1" value={duracion} onChange={(e) => setDuracion(e.target.value)} className="w-full border rounded px-4 py-2" />
          </div>
        </div>

        <div>
          <label className="block text-sm text-gray-600">Recomendaciones</label>
          <textarea value={recomendaciones} onChange={(e) => setRecomendaciones(e.target.value)} className="w-full border rounded px-4 py-2" rows={3} />
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-2">Añadir ejercicios disponibles</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-auto">
            {exercises.length === 0 ? (
              <div className="text-sm text-gray-500">No hay ejercicios disponibles.</div>
            ) : (
              exercises.map((ex) => (
                <label key={ex.id} className="p-2 border rounded flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={selectedEj.includes(ex.id)} onChange={() => toggleEj(ex.id)} />
                  <div className="text-sm">
                    <div className="font-medium">{ex.nombre}</div>
                    <div className="text-xs text-gray-500">{ex.descripcion || ""}</div>
                  </div>
                </label>
              ))
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button type="submit" disabled={busy} className="px-4 py-2 bg-indigo-600 text-white rounded">{busy ? "Creando..." : "Crear rutina"}</button>
          <button type="button" onClick={onCancel} className="px-4 py-2 border rounded">Cancelar</button>
        </div>

        {error && <p className="text-sm text-rose-600 mt-2">{error}</p>}
      </form>
    </div>
  );
}
