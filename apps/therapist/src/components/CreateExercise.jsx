import React, { useState } from "react";

/**
 * CreateExercise:
 * Props: onSubmit(form), onCancel(), busy, error
 */
export default function CreateExercise({ onSubmit = () => {}, onCancel = () => {}, busy = false, error = "" }) {
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [mediaText, setMediaText] = useState("");

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border max-w-2xl">
      <form onSubmit={(e) => { e.preventDefault(); onSubmit({ nombre, descripcion, media: mediaText.split(",").map(s => s.trim()).filter(Boolean) }); }} className="space-y-4">
        <div>
          <label className="block text-sm text-gray-600">Nombre</label>
          <input required value={nombre} onChange={(e) => setNombre(e.target.value)} className="w-full border rounded px-4 py-2" />
        </div>

        <div>
          <label className="block text-sm text-gray-600">Descripción (opcional)</label>
          <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} className="w-full border rounded px-4 py-2" rows={3} />
        </div>

        <div>
          <label className="block text-sm text-gray-600">URLs de media (coma separadas)</label>
          <input value={mediaText} onChange={(e) => setMediaText(e.target.value)} className="w-full border rounded px-4 py-2" placeholder="https://... , https://..." />
        </div>

        <div className="flex gap-3">
          <button type="submit" disabled={busy} className="px-4 py-2 bg-yellow-600 text-white rounded">{busy ? "Guardando..." : "Guardar ejercicio"}</button>
          <button type="button" onClick={onCancel} className="px-4 py-2 border rounded">Cancelar</button>
        </div>

        {error && <p className="text-sm text-rose-600 mt-2">{error}</p>}
      </form>
    </div>
  );
}
