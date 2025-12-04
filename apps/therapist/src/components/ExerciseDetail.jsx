// ExerciseDetail.jsx
import React from "react";

export default function ExerciseDetail({
  exercise = null,
  onBack = () => {},
  onCreate = () => {},
  onEdit = () => {},
  onDelete = () => {},
}) {
  if (!exercise) return <p>Selecciona un ejercicio</p>;

  const e = exercise;
  const formatDate = (ts) => {
    try { return ts?.toDate ? ts.toDate().toLocaleString() : (ts ? String(ts) : "—"); } catch { return "—"; }
  };

  return (
    <div>
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-semibold">{e.nombre}</h2>
          <div className="text-sm text-gray-500 mt-1">ID: <span className="font-mono text-xs">{e.id}</span></div>
        </div>
        <div className="flex gap-2">
          <button onClick={onBack} className="px-3 py-1 border rounded">Volver</button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="col-span-2 bg-white rounded-xl p-4 shadow-sm border">
          <h4 className="font-medium mb-2">Descripción</h4>
          <div className="text-sm text-gray-700 mb-4">{e.description || e.descripcion || "—"}</div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <div className="text-xs text-gray-500">Repeticiones (def)</div>
              <div className="font-medium">{e.default_repeticiones ?? "—"}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Series (def)</div>
              <div className="font-medium">{e.default_series ?? "—"}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Tiempo (s) (def)</div>
              <div className="font-medium">{e.default_tiempo_segundos ?? "—"}</div>
            </div>
          </div>

          <div className="mt-4">
            <div className="text-xs text-gray-500">Video / Media</div>
            <div className="mt-2 space-y-1">
              {(e.url_video ? [e.url_video] : []).concat(e.media || []).filter(Boolean).map((u, i) => (
                <a key={i} href={u} target="_blank" rel="noreferrer" className="block text-sm text-indigo-600 underline">{u}</a>
              ))}
              {(!((e.media || []).length || e.url_video)) && <div className="text-sm text-gray-500">No hay media disponible.</div>}
            </div>
          </div>

          <div className="mt-6 text-xs text-gray-500">
            <div>Creado por: {e.created_by || "—"}</div>
            <div>Creado: {formatDate(e.created_at)}</div>
          </div>
        </div>

        <aside className="bg-white rounded-xl p-4 shadow-sm border">
          <h5 className="font-medium mb-2">Acciones</h5>
          <div className="flex flex-col gap-2">
            <button onClick={() => { navigator.clipboard?.writeText(e.id); alert("ID copiado"); }} className="px-3 py-2 border rounded text-left">Copiar ID</button>
            <button onClick={() => onEdit(e)} className="px-3 py-2 border rounded text-left">Editar ejercicio</button>
            <button onClick={() => { if (window.confirm(`Eliminar ejercicio "${e.nombre}"?`)) onDelete(e.id); }} className="px-3 py-2 border rounded text-left text-rose-700 bg-rose-50">Eliminar ejercicio</button>
            <button onClick={onCreate} className="px-3 py-2 bg-yellow-50 border rounded text-left">Agregar nuevo</button>
          </div>
        </aside>
      </div>
    </div>
  );
}
