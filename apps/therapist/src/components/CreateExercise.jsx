// CreateExercise.jsx
import React, { useState } from "react";

export default function CreateExercise({ onSubmit = () => {}, onCancel = () => {}, busy = false, error = "" }) {
  const [nombre, setNombre] = useState("");
  const [description, setDescription] = useState("");
  const [url_video, setUrlVideo] = useState("");
  const [media, setMedia] = useState(""); // CSV o nueva lógica
  const [default_repeticiones, setDefaultRepeticiones] = useState("");
  const [default_series, setDefaultSeries] = useState("");
  const [default_tiempo_segundos, setDefaultTiempo] = useState("");

  return (
    <div>
      <h3 className="text-lg md:text-2xl font-semibold mb-2">Agregar ejercicio (plantilla)</h3>
      <div className="bg-white rounded-xl p-6 shadow-sm border max-w-3xl">
        <form onSubmit={(e) => { e.preventDefault();
          const payload = {
            nombre,
            description,
            url_video,
            media: media ? media.split(",").map(s => s.trim()).filter(Boolean) : [],
            default_repeticiones: default_repeticiones ? Number(default_repeticiones) : null,
            default_series: default_series ? Number(default_series) : null,
            default_tiempo_segundos: default_tiempo_segundos ? Number(default_tiempo_segundos) : null,
          };
          onSubmit(payload);
        }} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-600">Nombre</label>
            <input required value={nombre} onChange={(e) => setNombre(e.target.value)} className="w-full border rounded px-4 py-2" />
          </div>

          <div>
            <label className="block text-sm text-gray-600">Descripción</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full border rounded px-4 py-2" rows={3} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-600">URL video</label>
              <input value={url_video} onChange={(e) => setUrlVideo(e.target.value)} className="w-full border rounded px-4 py-2" />
            </div>
            <div>
              <label className="block text-sm text-gray-600">Media (coma separada)</label>
              <input value={media} onChange={(e) => setMedia(e.target.value)} className="w-full border rounded px-4 py-2" placeholder="https://..., https://..." />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm text-gray-600">Default repeticiones</label>
              <input type="number" value={default_repeticiones} onChange={(e) => setDefaultRepeticiones(e.target.value)} className="w-full border rounded px-4 py-2" />
            </div>
            <div>
              <label className="block text-sm text-gray-600">Default series</label>
              <input type="number" value={default_series} onChange={(e) => setDefaultSeries(e.target.value)} className="w-full border rounded px-4 py-2" />
            </div>
            <div>
              <label className="block text-sm text-gray-600">Default tiempo (s)</label>
              <input type="number" value={default_tiempo_segundos} onChange={(e) => setDefaultTiempo(e.target.value)} className="w-full border rounded px-4 py-2" />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button type="submit" disabled={busy} className="px-4 py-2 bg-yellow-600 text-white rounded">{busy ? "Guardando..." : "Crear ejercicio"}</button>
            <button type="button" onClick={onCancel} className="px-4 py-2 border rounded">Cancelar</button>
          </div>

          {error && <p className="text-sm text-rose-600 mt-2">{error}</p>}
        </form>
      </div>
    </div>
  );
}
