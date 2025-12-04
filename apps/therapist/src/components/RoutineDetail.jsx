import React, { useState, useRef, useEffect } from "react";

/**
 * RoutineDetail
 *
 * Props:
 *  - routine
 *  - exercises: array of available exercise templates (for adding)
 *  - onBack()
 *  - onAssign(rutinaId)
 *  - onViewExercise(exId)
 *  - onSave(routineId, updatedFields) -> saves edits to routine (name, desc, sesiones, duracion, ejercicios)
 *  - onDelete(routineId)
 *  - busy
 */
export default function RoutineDetail({
  routine = null,
  exercises = [],
  onBack = () => {},
  onAssign = () => {},
  onViewExercise = () => {},
  onSave = () => {},
  onDelete = () => {},
  busy = false,
}) {
  if (!routine) return <p>Selecciona una rutina</p>;

  // sync local editable state with incoming routine (when it changes)
  const [editing, setEditing] = useState(false);
  const [nombre, setNombre] = useState(routine.nombre || "");
  const [descripcion, setDescripcion] = useState(routine.descripcion || routine.recomendaciones || "");
  const [sesiones, setSesiones] = useState(routine.sesiones ?? routine.expectedSessions ?? "");
  const [duracion, setDuracion] = useState(routine.duracion_minutos ?? routine.duracion ?? "");
  const [items, setItems] = useState(routine.resolved_ejercicios || routine.ejercicios || []);

  useEffect(() => {
    setNombre(routine.nombre || "");
    setDescripcion(routine.descripcion || routine.recomendaciones || "");
    setSesiones(routine.sesiones ?? routine.expectedSessions ?? "");
    setDuracion(routine.duracion_minutos ?? routine.duracion ?? "");
    setItems(routine.resolved_ejercicios || routine.ejercicios || []);
    setEditing(false);
  }, [routine?.id]); // reset when routine changes

  // drag-n-drop state
  const dragIndexRef = useRef(null);

  const formatDate = (ts) => {
    try {
      return ts?.toDate ? ts.toDate().toLocaleString() : (ts ? String(ts) : "—");
    } catch {
      return "—";
    }
  };

  const removeAt = (idx) => setItems((s) => s.filter((_, i) => i !== idx));

  const move = (from, to) => {
    setItems((prev) => {
      const arr = [...prev];
      const [item] = arr.splice(from, 1);
      arr.splice(to, 0, item);
      return arr;
    });
  };

  // HTML5 drag handlers
  const onDragStart = (e, idx) => {
    dragIndexRef.current = idx;
    // some browsers require setData for drag to work
    try { e.dataTransfer.setData("text/plain", String(idx)); } catch {}
    e.dataTransfer.effectAllowed = "move";
  };
  const onDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; };
  const onDrop = (e, idx) => {
    const from = dragIndexRef.current;
    if (from == null) return;
    if (from !== idx) move(from, idx);
    dragIndexRef.current = null;
  };

  const saveChanges = async () => {
    const payload = {
      nombre: nombre,
      descripcion,
      sesiones: sesiones ? Number(sesiones) : null,
      duracion_minutos: duracion ? Number(duracion) : null,
      // normalize ejercicios to template shape: [{ exercise_id, order }]
      ejercicios: items.map((it, i) => {
        const id = it.exercise_id ?? it.id ?? (typeof it === "string" ? it : null);
        return { exercise_id: id, order: i + 1, ...(it.raw ? { raw: it.raw } : {}) };
      }),
    };
    await onSave(routine.id, payload);
    setEditing(false);
  };

  // helper to safely get exercise id/label
  const getExerciseId = (it) => it?.exercise_id ?? it?.id ?? (typeof it === "string" ? it : null);
  const getExerciseLabel = (it) => {
    if (!it) return "—";
    if (typeof it === "string") return it;
    return it.nombre || it.name || (it.raw && (it.raw.nombre || it.raw.name)) || getExerciseId(it) || "—";
  };

  // AddExercisePicker: small internal component
  function AddExercisePicker({ exercises = [], onAdd = () => {} }) {
    const [q, setQ] = useState("");
    const filtered = exercises.filter((e) => {
      const t = (e.nombre || e.name || "").toLowerCase();
      return !q || t.includes(q.toLowerCase());
    }).slice(0, 50);

    return (
      <div className="border rounded p-2">
        <input
          placeholder="Buscar ejercicio..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full mb-2 border rounded px-2 py-1"
        />
        <div className="max-h-48 overflow-auto">
          {filtered.length === 0 ? (
            <div className="text-sm text-gray-500">No encontrado</div>
          ) : (
            filtered.map((ex) => (
              <div key={ex.id} className="flex items-center justify-between p-1">
                <div className="text-sm">
                  <div className="font-medium">{ex.nombre}</div>
                  <div className="text-xs text-gray-500">{ex.description || ex.descripcion || ""}</div>
                </div>
                <button
                  onClick={() => onAdd(ex.id)}
                  className="px-2 py-1 text-sm border rounded ml-2"
                >
                  Añadir
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  // add exercise by id (avoid duplicates)
  const handleAddExerciseById = (exerciseId) => {
    if (!exerciseId) return;
    setItems((prev) => {
      if (prev.some((it) => getExerciseId(it) === exerciseId)) return prev;
      return [...prev, { exercise_id: exerciseId, order: prev.length + 1 }];
    });
  };

  return (
    <div>
      <div className="flex items-start justify-between">
        <div>
          {editing ? (
            <input
              className="text-2xl font-semibold border-b pb-1"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          ) : (
            <h2 className="text-2xl font-semibold">{routine.nombre}</h2>
          )}

          {editing ? (
            <textarea
              className="w-full mt-2 border p-2 rounded"
              rows={2}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
            />
          ) : (
            <div className="text-sm text-gray-500 mt-1">{routine.descripcion || "Sin descripción"}</div>
          )}

          <div className="text-xs text-gray-400 mt-2">ID: <span className="font-mono text-xs">{routine.id}</span></div>
          <div className="text-xs text-gray-400 mt-1">Creado: {formatDate(routine.created_at)}</div>
        </div>

        <div className="flex gap-2">
          <button onClick={onBack} className="px-3 py-1 border rounded">Volver</button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <main className="col-span-2 bg-white rounded-xl p-4 shadow-sm border">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium">Ejercicios en la rutina</h4>

            <div className="flex gap-2">
              {!editing && (
                <button onClick={() => setEditing(true)} className="px-3 py-1 border rounded text-sm">Editar rutina</button>
              )}
              {editing && (
                <>
                  <button
                    onClick={() => saveChanges()}
                    disabled={busy}
                    className="px-3 py-1 bg-indigo-600 text-white rounded text-sm"
                  >
                    {busy ? "Guardando..." : "Guardar cambios"}
                  </button>
                  <button
                    onClick={() => {
                      setEditing(false);
                      setItems(routine.resolved_ejercicios || routine.ejercicios || []);
                    }}
                    className="px-3 py-1 border rounded text-sm"
                  >
                    Cancelar
                  </button>
                </>
              )}
            </div>
          </div>

          {editing && (
            <div className="mt-4">
              <label className="block text-sm text-gray-600 mb-2">Añadir ejercicio (buscar)</label>
              <AddExercisePicker
                exercises={exercises || []}
                onAdd={(exerciseId) => handleAddExerciseById(exerciseId)}
              />
            </div>
          )}

          {items.length === 0 ? (
            <p className="text-sm text-gray-500 mt-4">No hay ejercicios en esta rutina.</p>
          ) : (
            <div className="space-y-3 mt-3">
              {items.map((it, idx) => {
                const exId = getExerciseId(it);
                const nombreEx = getExerciseLabel(it);
                const order = idx + 1;
                const defaults = {
                  repeticiones: it.default_repeticiones ?? it.repeticiones ?? null,
                  series: it.default_series ?? it.series ?? null,
                  tiempo_segundos: it.default_tiempo_segundos ?? it.tiempo_segundos ?? null,
                };

                return (
                  <div
                    key={exId ?? idx}
                    draggable={editing}
                    onDragStart={(e) => onDragStart(e, idx)}
                    onDragOver={onDragOver}
                    onDrop={(e) => onDrop(e, idx)}
                    className="p-3 border rounded flex items-start justify-between"
                  >
                    <div>
                      <div className="font-medium">{order}. {nombreEx}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {defaults.repeticiones ? `Reps: ${defaults.repeticiones}` : ""}
                        {defaults.series ? ` • Series: ${defaults.series}` : ""}
                        {defaults.tiempo_segundos ? ` • Tiempo: ${defaults.tiempo_segundos}s` : ""}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">ID ejercicio: <span className="font-mono text-xs">{exId ?? "—"}</span></div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <div className="flex gap-2">
                        {exId && (
                          <button
                            onClick={() => onViewExercise(exId)}
                            className="px-3 py-1 border rounded text-sm bg-indigo-50"
                          >
                            Ver ejercicio
                          </button>
                        )}
                        {editing && (
                          <>
                            <button onClick={() => move(idx, Math.max(0, idx - 1))} className="px-2 py-1 border rounded text-sm">↑</button>
                            <button onClick={() => move(idx, Math.min(items.length - 1, idx + 1))} className="px-2 py-1 border rounded text-sm">↓</button>
                            <button
                              onClick={() => {
                                if (window.confirm(`Quitar "${nombreEx}" de la rutina?`)) removeAt(idx);
                              }}
                              className="px-2 py-1 border rounded text-sm text-rose-700 bg-rose-50"
                            >
                              Quitar
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-6">
            <h5 className="font-medium mb-2">Detalles de la plantilla</h5>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <div className="text-xs text-gray-500">Sesiones esperadas</div>
                {editing ? (
                  <input type="number" min="1" value={sesiones} onChange={(e) => setSesiones(e.target.value)} className="w-full border rounded px-2 py-1" />
                ) : (
                  <div className="font-medium">{routine.sesiones ?? routine.expectedSessions ?? "—"}</div>
                )}
              </div>

              <div>
                <div className="text-xs text-gray-500">Duración estimada (min)</div>
                {editing ? (
                  <input type="number" min="1" value={duracion} onChange={(e) => setDuracion(e.target.value)} className="w-full border rounded px-2 py-1" />
                ) : (
                  <div className="font-medium">{routine.duracion_minutos ?? routine.duracion ?? "—"}</div>
                )}
              </div>

              <div>
                <div className="text-xs text-gray-500">Nivel</div>
                <div className="font-medium">{routine.nivel_dificultad ?? "—"}</div>
              </div>
            </div>

            {routine.recomendaciones && <div className="mt-3 text-sm text-gray-700">{routine.recomendaciones}</div>}
          </div>
        </main>

        <aside className="bg-white rounded-xl p-4 shadow-sm border">
          <h5 className="font-medium mb-2">Acciones</h5>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => onAssign(routine.id)}
              disabled={busy}
              className={`px-3 py-2 border rounded text-left ${busy ? "opacity-50 cursor-not-allowed bg-emerald-50" : "bg-emerald-50"}`}
            >
              Asignar a paciente
            </button>

            {/* El botón 'Abrir editor completo' fue removido — edición se hace en esta vista */}
            <button
              onClick={() => { navigator.clipboard?.writeText(routine.id); alert("ID copiado"); }}
              className="px-3 py-2 border rounded text-left"
            >
              Copiar ID
            </button>

            <button
              onClick={() => {
                if (window.confirm(`Eliminar rutina "${routine.nombre}"?`)) onDelete(routine.id);
              }}
              className="px-3 py-2 border rounded text-left text-rose-700 bg-rose-50"
            >
              Eliminar rutina
            </button>
          </div>

          <div className="mt-4 text-xs text-gray-500">
            <div>Creado por: {routine.terapeuta_creador_id || routine.owner || "—"}</div>
            <div>Creado: {formatDate(routine.created_at)}</div>
          </div>
        </aside>
      </div>
    </div>
  );
}
