// PatientsPanel.jsx
import React, { useState, useEffect } from "react";

export default function PatientsPanel({
  patients = [],
  patientsLoading = false,
  onViewPatient = () => {},
  onAssignRoutine = () => {},
  onUnlink = () => {},
  routines = [],
  busy = false,
  // Optional callbacks that parent (Dashboard) can provide to control the link panel
  onShowAdd = null,      // called when user wants to add (Dashboard usually shows form)
  onToggleLink = null,   // called when user wants to open the LinkPatientByCode UI
  onBack = null,         // optional: go back to home/panel
}) {
  // UI state for the "assign multiple routines" flow (per-patient)
  const [assigningFor, setAssigningFor] = useState(null); // paciente object or null
  const [selectedMap, setSelectedMap] = useState({}); // { rutinaId: { checked: bool, sesiones: number } }

  // Local toggles only if parent doesn't handle add/link
  const [showAddLocal, setShowAddLocal] = useState(false);
  const [showLinkLocal, setShowLinkLocal] = useState(false);

  useEffect(() => {
    // reset assign form when closing
    if (!assigningFor) setSelectedMap({});
  }, [assigningFor]);

  const openAdd = () => {
    if (typeof onShowAdd === "function") {
      onShowAdd();
      return;
    }
    setShowAddLocal((s) => !s);
    // close local link if open
    setShowLinkLocal(false);
  };

  const openLink = () => {
    // prefer parent to open the LinkPatientByCode UI (Dashboard), do not alter patient listing
    if (typeof onToggleLink === "function") {
      onToggleLink();
      return;
    }
    // fallback: local placeholder UI
    setShowLinkLocal((s) => !s);
    setShowAddLocal(false);
  };

  const handleOpenAssignModal = (patient) => {
    if (!routines || routines.length === 0) return alert("No hay rutinas disponibles.");
    setAssigningFor(patient);
    // prefill selectedMap with defaults (unchecked)
    const map = {};
    routines.forEach((r) => { map[r.id] = { checked: false, sesiones: r.sesiones ?? r.expectedSessions ?? 5 }; });
    setSelectedMap(map);
  };

  const toggleRoutine = (rid) => {
    setSelectedMap((m) => ({ ...m, [rid]: { ...m[rid], checked: !m[rid].checked } }));
  };

  const setSesionesFor = (rid, value) => {
    setSelectedMap((m) => ({ ...m, [rid]: { ...m[rid], sesiones: Number(value) || 0 } }));
  };

  const handleAssignSelected = async () => {
    if (!assigningFor) return;
    const pacienteId = assigningFor.id;
    const toAssign = Object.entries(selectedMap).filter(([_, v]) => v.checked).map(([rid, v]) => ({ rutinaId: rid, sesiones: Number(v.sesiones) || 1 }));
    if (toAssign.length === 0) return alert("Selecciona al menos una rutina.");
    // call onAssignRoutine once per selected rutina (parent's handler will create asignaciones)
    try {
      for (const sel of toAssign) {
        // await in case parent returns a promise (optional)
        await onAssignRoutine({ pacienteId, rutinaId: sel.rutinaId, sesiones: Number(sel.sesiones) || 1 });
      }
      // cerrar modal
      setAssigningFor(null);
      setSelectedMap({});
      alert("Rutinas asignadas.");
    } catch (err) {
      console.error("assign selected error", err);
      alert("Error al asignar rutinas. Revisa la consola.");
    }
  };

  const cancelAssign = () => {
    setAssigningFor(null);
    setSelectedMap({});
  };

  const handleBack = () => {
    if (typeof onBack === "function") return onBack();
    try { window.history.back(); } catch {}
  };

  return (
    <div>
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="text-lg md:text-2xl font-semibold mb-1">Gestión de pacientes</h3>
          <p className="text-sm text-gray-500">Añade, visualiza y administra pacientes</p>
        </div>

        <div className="flex gap-2 items-center">
          <button
            onClick={openAdd}
            className={`px-4 py-2 rounded ${ (typeof onShowAdd === "function") ? "border" : (showAddLocal ? "bg-indigo-600 text-white" : "border") }`}
          >
            Añadir paciente
          </button>



          <button onClick={handleBack} className="px-4 py-2 border rounded ml-2">Volver</button>
        </div>
      </div>

      {/* Optional local placeholders if parent doesn't provide handlers */}
      {showAddLocal && typeof onShowAdd !== "function" && (
        <div className="mb-4">
          <div className="bg-white border rounded p-4 text-sm text-gray-700">
            <div className="font-medium mb-1">Formulario de añadir paciente</div>
            <div>El Dashboard controla la apertura del formulario. Pasa <code>onShowAdd</code> para que el formulario real se muestre.</div>
          </div>
        </div>
      )}

      {showLinkLocal && typeof onToggleLink !== "function" && (
        <div className="mb-4">
          <div className="bg-white border rounded p-4 text-sm text-gray-700">
            <div className="font-medium mb-1">Vincular por código (local)</div>
            <div>Pasa <code>onToggleLink</code> para que el Dashboard muestre el componente <code>LinkPatientByCode</code>.</div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl p-4 shadow-sm border">
        {patientsLoading ? (
          <p className="text-sm text-gray-500">Cargando pacientes...</p>
        ) : patients.length === 0 ? (
          <p className="text-sm text-gray-500">No hay pacientes aún.</p>
        ) : (
          <div className="space-y-3">
            {patients.map((p) => (
              <div key={p.id} className="p-3 border rounded flex items-center justify-between">
                <div>
                  <div className="font-medium">{p.nombre_completo}</div>
                  <div className="text-xs text-gray-500">{p.email ? p.email : (p.telefono_emergencia || "Sin teléfono")}</div>
                  <div className="text-xs text-gray-400 mt-1">Tutor: {p.nombre_tutor || "—"}</div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onViewPatient(p.id)}
                    className="px-3 py-1 bg-indigo-50 border rounded text-sm"
                  >
                    Ver
                  </button>

                  <button
                    onClick={() => handleOpenAssignModal(p)}
                    className="px-3 py-1 bg-emerald-50 border rounded text-sm"
                  >
                    Asignar rutina
                  </button>

                  <button
                    onClick={() => { if (window.confirm(`Desvincular a ${p.nombre_completo}?`)) onUnlink(p.id); }}
                    disabled={busy}
                    className={`px-3 py-1 border rounded text-sm ${busy ? "opacity-50 cursor-not-allowed" : "bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100"}`}
                  >
                    Desvincular
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ASSIGN MODAL / PANEL (inline) */}
      {assigningFor && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30" onClick={cancelAssign} />
          <div className="relative bg-white rounded-lg shadow-lg max-w-2xl w-full p-6 z-50">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="text-lg font-semibold">Asignar rutinas a {assigningFor.nombre_completo}</h4>
                <div className="text-sm text-gray-500">Selecciona una o varias rutinas y define sesiones por cada una.</div>
              </div>
              <button onClick={cancelAssign} className="px-3 py-1 border rounded">Cerrar</button>
            </div>

            <div className="mt-4 space-y-2 max-h-72 overflow-auto">
              {routines.map((r) => {
                const sel = selectedMap[r.id] || { checked: false, sesiones: r.sesiones ?? r.expectedSessions ?? 5 };
                return (
                  <div key={r.id} className="flex items-center justify-between p-2 border rounded">
                    <div className="flex items-center gap-3">
                      <input type="checkbox" checked={!!sel.checked} onChange={() => toggleRoutine(r.id)} />
                      <div>
                        <div className="font-medium">{r.nombre}</div>
                        <div className="text-xs text-gray-500">{r.descripcion || r.descripcion || ""}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="text-xs text-gray-500">Sesiones</div>
                      <input
                        type="number"
                        min="1"
                        value={sel.sesiones}
                        onChange={(e) => setSesionesFor(r.id, e.target.value)}
                        className="w-20 border rounded px-2 py-1"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button onClick={cancelAssign} className="px-4 py-2 border rounded">Cancelar</button>
              <button onClick={handleAssignSelected} className="px-4 py-2 bg-emerald-600 text-white rounded">
                Asignar seleccionadas
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
