// apps/therapist/src/pages/Dashboard.jsx
import React, { useEffect, useState, useCallback } from "react";
import {
  collection,
  addDoc,
  doc,
  setDoc,
  serverTimestamp,
  onSnapshot,
  query,
  where,
  getDoc,
  getDocs,
  orderBy,
} from "firebase/firestore";
import { db } from "../firebaseClient"; // ajusta ruta si hace falta
import { useAuth } from "../contexts/AuthContext";
import TopBar from "../components/TopBar"; // si los tienes
import Sidebar from "../components/Sidebar"; // si los tienes

// Si no usas TopBar/Sidebar, puedes reemplazarlos por marcadores simples o eliminarlos.

function SmallBadge({ children }) {
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-indigo-50 text-indigo-700 border border-indigo-100">{children}</span>;
}

function SectionHeader({ title, subtitle }) {
  return (
    <div className="mb-4">
      <h3 className="text-lg md:text-2xl font-semibold text-gray-900">{title}</h3>
      {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
    </div>
  );
}

export default function Dashboard() {
  const { user, profile, logout } = useAuth();

  // UI state: "home" | "patients" | "addPatient" | "patientDetail" | "routines" | "createRoutine" | "exercises" | "createExercise"
  const [view, setView] = useState("home");

  // Patients
  const [patients, setPatients] = useState([]);
  const [patientsLoading, setPatientsLoading] = useState(true);
  const [selectedPatient, setSelectedPatient] = useState(null);

  // Routines & exercises
  const [routines, setRoutines] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [itemsLoading, setItemsLoading] = useState(true);

  // Feedback
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Fetch patients assigned to this therapist (or all if you want)
  useEffect(() => {
    setPatientsLoading(true);
    // simplest: listen to patients collection where terapeuta_id == current uid OR all patients (depending on model).
    // Here we fetch all patients and let therapist filter — adapt where needed.
    const q = collection(db, "patients");
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setPatients(list);
        setPatientsLoading(false);
      },
      (err) => {
        console.warn("patients onSnapshot error:", err);
        setPatients([]);
        setPatientsLoading(false);
      }
    );
    return () => unsub();
  }, []);

  // Fetch routines & exercises (for create/assign)
  useEffect(() => {
    setItemsLoading(true);
    const unsubR = onSnapshot(
      collection(db, "routines"),
      (snap) => {
        setRoutines(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setItemsLoading(false);
      },
      (err) => {
        console.warn("routines snapshot error:", err);
        setRoutines([]);
        setItemsLoading(false);
      }
    );
    const unsubE = onSnapshot(
      collection(db, "ejercicios"),
      (snap) => setExercises(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => {
        console.warn("exercises snapshot error:", err);
        setExercises([]);
      }
    );
    return () => {
      unsubR();
      unsubE();
    };
  }, []);

  // ---------- Patients: add ----------
  async function handleAddPatient(form) {
    setError("");
    setBusy(true);
    try {
      const payload = {
        nombre_completo: form.nombre,
        telefono_emergencia: form.telefono || "",
        nombre_tutor: form.tutor || "",
        nivel_movilidad: form.nivel || "Desconocido",
        created_by_terapeuta: user?.uid || null,
        created_at: serverTimestamp(),
      };
      const docRef = await addDoc(collection(db, "patients"), payload);
      // optional: store relation in therapist's doc or an assignments collection
      setBusy(false);
      setView("patients");
      // seleccionar paciente nuevo
      setSelectedPatient({ id: docRef.id, ...payload });
    } catch (err) {
      console.error("handleAddPatient error:", err);
      setError("No se pudo añadir el paciente. Revisa consola.");
      setBusy(false);
    }
  }

  // ---------- Patients: open detail ----------
  async function openPatientDetail(patientId) {
    setError("");
    setBusy(true);
    try {
      const snap = await getDoc(doc(db, "patients", patientId));
      if (!snap.exists()) {
        setError("Paciente no encontrado.");
        setBusy(false);
        return;
      }
      const data = { id: snap.id, ...snap.data() };
      // load additional info: historial de sesiones, asignaciones, rutinas etc.
      // ejemplo: sesiones donde paciente_id == patientId
      const sesionesQ = query(collection(db, "sesiones"), where("paciente_id", "==", patientId), orderBy("fecha_completada", "desc"));
      const sesionesSnap = await getDocs(sesionesQ);
      const sesiones = sesionesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      // rutinas asignadas (asignaciones)
      const asigQ = query(collection(db, "asignaciones"), where("paciente_id", "==", patientId));
      const asigSnap = await getDocs(asigQ);
      const asignaciones = asigSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      setSelectedPatient({ ...data, sesiones, asignaciones });
      setView("patientDetail");
    } catch (err) {
      console.error("openPatientDetail error:", err);
      setError("Error cargando detalle de paciente.");
    } finally {
      setBusy(false);
    }
  }

  // ---------- Create routine ----------
  async function handleCreateRoutine(form) {
    setBusy(true);
    setError("");
    try {
      const payload = {
        nombre: form.nombre,
        sesiones: Number(form.sesiones) || 1,
        duracion_minutos: Number(form.duracion) || 10,
        recomendaciones: form.recomendaciones || "",
        ejercicios_ids: form.ejercicios || [],
        owner: user?.uid || null,
        created_at: serverTimestamp(),
      };
      const docRef = await addDoc(collection(db, "routines"), payload);
      setBusy(false);
      // ir a lista de rutinas o detalle
      setView("routines");
      // optional: navigate to routine detail
      console.log("Routine created:", docRef.id);
    } catch (err) {
      console.error("handleCreateRoutine error:", err);
      setError("No se pudo crear la rutina.");
      setBusy(false);
    }
  }

  // ---------- Create exercise ----------
  async function handleCreateExercise(form) {
    setBusy(true);
    setError("");
    try {
      const payload = {
        nombre: form.nombre,
        media: form.media || [], // array de urls
        descripcion: form.descripcion || "",
        created_by: user?.uid || null,
        created_at: serverTimestamp(),
      };
      await addDoc(collection(db, "ejercicios"), payload);
      setBusy(false);
      setView("exercises");
    } catch (err) {
      console.error("handleCreateExercise error:", err);
      setError("No se pudo crear el ejercicio.");
      setBusy(false);
    }
  }

  // ---------- Assign routine to patient (helper) ----------
  async function assignRoutineToPatient({ pacienteId, rutinaId, sesiones = 1 }) {
    setBusy(true);
    setError("");
    try {
      const payload = {
        paciente_id: pacienteId,
        rutina_id: rutinaId,
        terapeuta_asignador_id: user?.uid || null,
        fecha_asignacion: serverTimestamp(),
        sesiones_programadas: Number(sesiones) || 1,
        estado: "Asignada",
        progreso: 0,
      };
      await addDoc(collection(db, "asignaciones"), payload);
      setBusy(false);
      // reload patient detail if open
      if (selectedPatient?.id === pacienteId) openPatientDetail(pacienteId);
    } catch (err) {
      console.error("assignRoutine error:", err);
      setError("No se pudo asignar la rutina.");
      setBusy(false);
    }
  }

  // Simple "progress chart" component (weeks)
  function ProgressChart({ sesiones = [] }) {
    // Build weekly buckets (demo): sesiones have fecha_completada timestamp & duracion_minutos
    // For demo, map last 6 weeks with random/derived values if sesiones empty
    const weeks = [];

    for (let i = 5; i >= 0; i--) {
      const label = `S-${i + 1}`;
      const value = Math.min(100, Math.round(Math.random() * 60 + i * 6)); // demo placeholder
      weeks.push({ label, value });
    }

    // If sesiones provided, we could compute real values (omitted for brevity)
    return (
      <div className="w-full overflow-x-auto">
        <div className="flex items-end gap-3 h-36">
          {weeks.map((w) => (
            <div key={w.label} className="flex-1 text-center">
              <div className="h-full flex items-end justify-center">
                <div className="rounded-t-md bg-indigo-600" style={{ height: `${w.value}%`, minHeight: 6 }} title={`${w.value}%`}></div>
              </div>
              <div className="text-xs mt-2 text-gray-600">{w.label}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ---------- UI pieces ----------
  function HomePanel() {
    return (
      <div className="space-y-6">
        <SectionHeader title={`Hola ${profile?.nombre_completo?.split(" ")[0] || user?.email?.split("@")[0] || "Terapeuta"}`} subtitle="Panel médico — Bienvenido" />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="col-span-2 bg-white rounded-xl p-4 shadow-sm border">
            <h4 className="font-semibold mb-2">Acciones rápidas</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button onClick={() => setView("addPatient")} className="p-3 bg-indigo-50 border border-indigo-100 rounded-lg text-left">
                <div className="font-medium">Añadir paciente</div>
                <div className="text-xs text-gray-500 mt-1">Crear perfil y vincular</div>
              </button>
              <button onClick={() => setView("createRoutine")} className="p-3 bg-emerald-50 border border-emerald-100 rounded-lg text-left">
                <div className="font-medium">Crear rutina</div>
                <div className="text-xs text-gray-500 mt-1">Diseñar y guardar</div>
              </button>
              <button onClick={() => setView("createExercise")} className="p-3 bg-yellow-50 border border-yellow-100 rounded-lg text-left">
                <div className="font-medium">Agregar ejercicio</div>
                <div className="text-xs text-gray-500 mt-1">Nuevo ejercicio multimedia</div>
              </button>
            </div>

            <div className="mt-6">
              <h5 className="font-medium mb-2">Resumen rápido</h5>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-white border rounded-lg">
                  <div className="text-xs text-gray-500">Pacientes</div>
                  <div className="text-xl font-semibold mt-1">{patients.length}</div>
                </div>
                <div className="p-3 bg-white border rounded-lg">
                  <div className="text-xs text-gray-500">Rutinas</div>
                  <div className="text-xl font-semibold mt-1">{routines.length}</div>
                </div>
                <div className="p-3 bg-white border rounded-lg">
                  <div className="text-xs text-gray-500">Ejercicios</div>
                  <div className="text-xl font-semibold mt-1">{exercises.length}</div>
                </div>
              </div>
            </div>
          </div>

          <aside className="bg-white rounded-xl p-4 shadow-sm border">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-gray-500">Usuario</div>
                <div className="font-medium">{profile?.nombre_completo || user?.email}</div>
                <div className="text-xs mt-1 text-gray-400">UID: <span className="font-mono text-xs">{user?.uid}</span></div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <button onClick={() => { logout(); }} className="px-3 py-1 bg-rose-500 text-white rounded text-sm">Cerrar sesión</button>
              </div>
            </div>

            <div className="mt-4">
              <div className="text-xs text-gray-500">Progreso promedio (demo)</div>
              <div className="mt-2">
                <div className="w-full h-3 bg-gray-100 rounded-full">
                  <div className="h-3 rounded-full bg-indigo-600" style={{ width: `${profile?.dailyProgress ?? 48}%` }} />
                </div>
                <div className="text-xs text-gray-500 mt-1">{profile?.dailyProgress ?? 48}%</div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    );
  }

  // ---------- Patients list UI ----------
  function PatientsPanel() {
    return (
      <div>
        <SectionHeader title="Gestión de pacientes" subtitle="Añade, visualiza y administra pacientes" />
        <div className="mb-4 flex gap-2">
          <button onClick={() => setView("addPatient")} className="px-4 py-2 bg-indigo-600 text-white rounded">Añadir paciente</button>
          <button onClick={() => setView("home")} className="px-4 py-2 border rounded">Volver al panel</button>
        </div>

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
                    <div className="text-xs text-gray-500">{p.telefono_emergencia || "Sin teléfono"}</div>
                    <div className="text-xs text-gray-400 mt-1">Tutor: {p.nombre_tutor || "—"}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => openPatientDetail(p.id)} className="px-3 py-1 bg-indigo-50 border rounded text-sm">Ver</button>
                    <button onClick={() => assignRoutineToPatient({ pacienteId: p.id, rutinaId: (routines[0]?.id || null) })} className="px-3 py-1 bg-emerald-50 border rounded text-sm">Asignar rutina</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ---------- AddPatient form ----------
  function AddPatientForm() {
    const [nombre, setNombre] = useState("");
    const [telefono, setTelefono] = useState("");
    const [tutor, setTutor] = useState("");
    const [nivel, setNivel] = useState("Moderado");

    return (
      <div>
        <SectionHeader title="Añadir paciente" subtitle="Rellena datos y guarda para vincular al paciente" />
        <div className="bg-white rounded-xl p-6 shadow-sm border max-w-2xl">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAddPatient({ nombre, telefono, tutor, nivel });
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-sm text-gray-600">Nombre completo</label>
              <input required value={nombre} onChange={(e) => setNombre(e.target.value)} className="w-full border rounded px-4 py-2" placeholder="Ej. Juan Pérez" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-600">Teléfono de emergencia</label>
                <input value={telefono} onChange={(e) => setTelefono(e.target.value)} className="w-full border rounded px-4 py-2" placeholder="55 5555 5555" />
              </div>
              <div>
                <label className="block text-sm text-gray-600">Nombre del tutor</label>
                <input value={tutor} onChange={(e) => setTutor(e.target.value)} className="w-full border rounded px-4 py-2" placeholder="Nombre del encargado" />
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-600">Nivel de movilidad</label>
              <select value={nivel} onChange={(e) => setNivel(e.target.value)} className="w-full border rounded px-4 py-2">
                <option>Alto</option>
                <option>Moderado</option>
                <option>Bajo</option>
                <option>Sin movilidad</option>
              </select>
            </div>

            <div className="flex items-center gap-3">
              <button type="submit" disabled={busy} className="px-4 py-2 bg-indigo-600 text-white rounded">{busy ? "Guardando..." : "Guardar paciente"}</button>
              <button type="button" onClick={() => setView("patients")} className="px-4 py-2 border rounded">Cancelar</button>
            </div>

            {error && <p className="text-sm text-rose-600 mt-2">{error}</p>}
          </form>
        </div>
      </div>
    );
  }

  // ---------- Patient detail ----------
  function PatientDetail() {
    if (!selectedPatient) return <p>Selecciona un paciente</p>;

    const p = selectedPatient;
    return (
      <div>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-semibold">{p.nombre_completo}</h2>
            <div className="text-sm text-gray-500">Teléfono: {p.telefono_emergencia || "—"}</div>
            <div className="text-sm text-gray-500">Tutor: {p.nombre_tutor || "—"}</div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setView("patients")} className="px-3 py-1 border rounded">Volver</button>
            <button onClick={() => assignRoutineToPatient({ pacienteId: p.id, rutinaId: routines[0]?.id })} className="px-3 py-1 bg-emerald-600 text-white rounded">Asignar rutina</button>
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
              <button onClick={() => setView("createRoutine")} className="px-3 py-2 bg-indigo-50 border rounded text-left">Crear rutina</button>
              <button onClick={() => setView("createExercise")} className="px-3 py-2 bg-yellow-50 border rounded text-left">Agregar ejercicio</button>
            </div>
          </aside>
        </div>
      </div>
    );
  }

  // ---------- Routines panel ----------
  function RoutinesPanel() {
    return (
      <div>
        <SectionHeader title="Creación y gestión de rutinas" subtitle="Diseña rutinas y asígnalas a pacientes" />
        <div className="mb-4 flex gap-2">
          <button onClick={() => setView("createRoutine")} className="px-4 py-2 bg-indigo-600 text-white rounded">Crear rutina</button>
          <button onClick={() => setView("home")} className="px-4 py-2 border rounded">Volver al panel</button>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm border">
          {itemsLoading ? (
            <p className="text-sm text-gray-500">Cargando rutinas...</p>
          ) : routines.length === 0 ? (
            <p className="text-sm text-gray-500">No hay rutinas guardadas.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {routines.map((r) => (
                <div key={r.id} className="p-3 border rounded">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium">{r.nombre}</div>
                      <div className="text-xs text-gray-500 mt-1">Sesiones: {r.sesiones || "—"} • Duración: {r.duracion_minutos || "—"} min</div>
                      <div className="text-xs text-gray-400 mt-2">{r.recomendaciones || ""}</div>
                    </div>
                    <div className="text-sm text-gray-500"> {r.ejercicios_ids?.length || 0} ejercicios</div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => console.log("Asignar a paciente...")} className="px-3 py-1 bg-emerald-50 border rounded text-sm">Asignar</button>
                    <button onClick={() => console.log("Editar...")} className="px-3 py-1 border rounded text-sm">Editar</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ---------- CreateRoutine form ----------
  function CreateRoutineForm() {
    const [nombre, setNombre] = useState("");
    const [sesionesN, setSesionesN] = useState(4);
    const [duracion, setDuracion] = useState(20);
    const [recomendaciones, setRecomendaciones] = useState("");
    const [selectedEj, setSelectedEj] = useState([]);

    const toggleEj = (id) => {
      setSelectedEj((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
    };

    return (
      <div>
        <SectionHeader title="Crear rutina" subtitle="Añade ejercicios, define sesiones y recomendaciones" />
        <div className="bg-white rounded-xl p-6 shadow-sm border max-w-3xl">
          <form onSubmit={(e) => { e.preventDefault(); handleCreateRoutine({ nombre, sesiones: sesionesN, duracion, recomendaciones, ejercicios: selectedEj }); }} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-600">Nombre de la rutina</label>
              <input required value={nombre} onChange={(e) => setNombre(e.target.value)} className="w-full border rounded px-4 py-2" placeholder="Ej. Rehabilitación de hombro" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-600">Sesiones</label>
                <input type="number" min="1" value={sesionesN} onChange={(e) => setSesionesN(e.target.value)} className="w-full border rounded px-4 py-2" />
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
                    <label key={ex.id} className="p-2 border rounded flex items-center gap-2">
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
              <button type="button" onClick={() => setView("routines")} className="px-4 py-2 border rounded">Cancelar</button>
            </div>

            {error && <p className="text-sm text-rose-600 mt-2">{error}</p>}
          </form>
        </div>
      </div>
    );
  }

  // ---------- Exercises panel & create ----------
  function ExercisesPanel() {
    return (
      <div>
        <SectionHeader title="Ejercicios" subtitle="Crea y administra ejercicios disponibles" />
        <div className="mb-4 flex gap-2">
          <button onClick={() => setView("createExercise")} className="px-4 py-2 bg-yellow-600 text-white rounded">Agregar ejercicio</button>
          <button onClick={() => setView("home")} className="px-4 py-2 border rounded">Volver al panel</button>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm border">
          {exercises.length === 0 ? (
            <p className="text-sm text-gray-500">No hay ejercicios.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {exercises.map((ex) => (
                <div key={ex.id} className="p-3 border rounded">
                  <div className="font-medium">{ex.nombre}</div>
                  <div className="text-xs text-gray-500 mt-1">{ex.descripcion}</div>
                  <div className="flex gap-2 mt-2">
                    {(ex.media || []).slice(0, 2).map((m, i) => (
                      <a key={i} href={m} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 underline">Media {i + 1}</a>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  function CreateExerciseForm() {
    const [nombre, setNombre] = useState("");
    const [descripcion, setDescripcion] = useState("");
    const [mediaText, setMediaText] = useState(""); // comma separated urls

    return (
      <div>
        <SectionHeader title="Agregar ejercicio" subtitle="Crea un ejercicio con referencia visual (urls a imágenes/videos)" />
        <div className="bg-white rounded-xl p-6 shadow-sm border max-w-2xl">
          <form onSubmit={(e) => { e.preventDefault(); handleCreateExercise({ nombre, descripcion, media: mediaText.split(",").map(s => s.trim()).filter(Boolean) }); }} className="space-y-4">
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
              <button type="button" onClick={() => setView("exercises")} className="px-4 py-2 border rounded">Cancelar</button>
            </div>
            {error && <p className="text-sm text-rose-600 mt-2">{error}</p>}
          </form>
        </div>
      </div>
    );
  }

  // ---------- Main render ----------
  return (
    <div className="min-h-screen bg-[#FFF8F3]">
      {/* Top bar (if tienes componente) */}
      <TopBar user={{ ...user, ...profile }} />

      <div className="flex flex-col md:flex-row">
        {Sidebar ? <div className="w-full md:w-64"><Sidebar /></div> : (
          <nav className="w-full md:w-56 bg-white p-4 border-r">
            <div className="space-y-2">
              <button onClick={() => setView("home")} className={`w-full text-left px-3 py-2 rounded ${view === "home" ? "bg-indigo-50" : ""}`}>Panel médico</button>
              <button onClick={() => setView("patients")} className={`w-full text-left px-3 py-2 rounded ${view === "patients" ? "bg-indigo-50" : ""}`}>Gestión de pacientes</button>
              <button onClick={() => setView("routines")} className={`w-full text-left px-3 py-2 rounded ${view === "routines" ? "bg-indigo-50" : ""}`}>Crear rutinas</button>
              <button onClick={() => setView("exercises")} className={`w-full text-left px-3 py-2 rounded ${view === "exercises" ? "bg-indigo-50" : ""}`}>Crear ejercicios</button>
            </div>
          </nav>
        )}

        <main className="flex-1 p-4 md:p-8">
          <div className="max-w-7xl mx-auto">
            {/* Render views */}
            {view === "home" && <HomePanel />}
            {view === "patients" && <PatientsPanel />}
            {view === "addPatient" && <AddPatientForm />}
            {view === "patientDetail" && <PatientDetail />}
            {view === "routines" && <RoutinesPanel />}
            {view === "createRoutine" && <CreateRoutineForm />}
            {view === "exercises" && <ExercisesPanel />}
            {view === "createExercise" && <CreateExerciseForm />}

            {error && <div className="mt-6 text-sm text-rose-600">{error}</div>}
          </div>
        </main>
      </div>
    </div>
  );
}
