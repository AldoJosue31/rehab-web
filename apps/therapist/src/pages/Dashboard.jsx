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
  updateDoc,
  deleteField
} from "firebase/firestore";
import { db } from "../firebaseClient"; // ajusta ruta si hace falta
import { useAuth } from "../contexts/AuthContext";
import TopBar from "../components/TopBar"; // si los tienes
import Sidebar from "../components/Sidebar"; // si los tienes
import CreateExercise from "../components/CreateExercise";
// NUEVO: componente para vincular por código (ver archivo a crear)
import LinkPatientByCode from "../components/LinkPatientByCode";


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
const [selectedExercise, setSelectedExercise] = useState(null);
  // Patients
  const [patients, setPatients] = useState([]);
  const [patientsLoading, setPatientsLoading] = useState(true);
  const [selectedPatient, setSelectedPatient] = useState(null);

  // UI extras para panel pacientes
  const [showAddForm, setShowAddForm] = useState(false);
  const [showLinkByCode, setShowLinkByCode] = useState(false);

  // Routines & exercises
  const [routines, setRoutines] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [itemsLoading, setItemsLoading] = useState(true);

  // Feedback
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

// Fetch patients assigned to this therapist
useEffect(() => {
  if (!user?.uid) {
    setPatients([]);
    setPatientsLoading(false);
    return;
  }

   setPatientsLoading(true);
  const q = query(collection(db, "patients"), where("created_by_terapeuta", "==", user.uid));
  const unsub = onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      console.debug("[patients onSnapshot] got", list.length, "docs");

      // preparar lista de uids a consultar (usa paciente_uid si existe, si no usamos el id del doc)
      const uids = Array.from(new Set(list.map((p) => p.paciente_uid || p.id).filter(Boolean)));

      if (uids.length === 0) {
        setPatients(list.map(p => ({ ...p, email: "" })));
        setPatientsLoading(false);
        return;
      }

      // obtener users/{uid} en paralelo y mapear emails
      Promise.all(uids.map((uid) => getDoc(doc(db, "users", uid))))
        .then((userSnaps) => {
          const emailMap = {};
          userSnaps.forEach((s) => {
            if (s.exists()) {
              const d = s.data();
              // intenta varias propiedades por si usas distintas llaves
              emailMap[s.id] = d.email || d.email_normalized || d.email_normalizado || "";
            }
          });

          const enriched = list.map((p) => {
            const uidToCheck = p.paciente_uid || p.id;
            return { ...p, email: emailMap[uidToCheck] || "" };
          });

          setPatients(enriched);
          setPatientsLoading(false);
        })
        .catch((err) => {
          console.warn("Error fetching user emails for patients:", err);
          // fallback: guardar la lista sin emails
          setPatients(list.map(p => ({ ...p, email: "" })));
          setPatientsLoading(false);
        });
    },
    (err) => {
      console.warn("patients onSnapshot error:", err);
      setPatients([]);
      setPatientsLoading(false);
    }
  );
  return () => unsub();
}, [user?.uid]);


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
      // cerrar el formulario si estaba abierto
      setShowAddForm(false);
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

    // obtener email desde users/{uid} si existe paciente_uid o el id del patient es uid
    try {
      const uidToFetch = data.paciente_uid || data.id;
      if (uidToFetch) {
        const userSnap = await getDoc(doc(db, "users", uidToFetch));
        if (userSnap.exists()) {
          const ud = userSnap.data();
          data.email = ud.email || ud.email_normalized || ud.email_normalizado || "";
        } else {
          data.email = "";
        }
      } else {
        data.email = "";
      }
    } catch (err) {
      console.warn("Error fetching users/{uid} for patient detail:", err);
      data.email = "";
    }

    // load additional info: historial de sesiones, asignaciones, rutinas etc.
    const sesionesQ = query(collection(db, "sesiones"), where("paciente_id", "==", patientId), orderBy("fecha_completada", "desc"));
    const sesionesSnap = await getDocs(sesionesQ);
    const sesiones = sesionesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

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

async function openExerciseDetail(exerciseId) {
  setError("");
  setBusy(true);
  try {
    if (!exerciseId) throw new Error("Id de ejercicio inválido.");
    const snap = await getDoc(doc(db, "ejercicios", exerciseId));
    if (!snap.exists()) {
      setError("Ejercicio no encontrado.");
      setBusy(false);
      return;
    }
    const data = { id: snap.id, ...snap.data() };
    // normalizar campos opcionales
    data.repeticiones = data.repeticiones ?? data.reps ?? null;
    data.series = data.series ?? null;
    data.tiempo_segundos = data.tiempo_segundos ?? data.tiempo ?? null;
    setSelectedExercise(data);
    setView("exerciseDetail");
  } catch (err) {
    console.error("openExerciseDetail error:", err);
    setError("Error cargando detalle de ejercicio.");
  } finally {
    setBusy(false);
  }
}


  // ---------- Create routine ----------
async function handleCreateRoutine(form) {
  setBusy(true);
  setError("");
  try {
    // Validaciones mínimas
    if (!form.nombre || form.nombre.trim().length < 3) {
      setError("Nombre de rutina inválido.");
      setBusy(false);
      return;
    }

    // construye el payload consistente con tu ejemplo
    const payload = {
      nombre: form.nombre,
      descripcion: form.descripcion || "",
      nivel_dificultad: (form.nivel_dificultad || "BAJO").toUpperCase(),
      ejercicios: Array.isArray(form.ejercicios) ? form.ejercicios : (form.ejercicios ? [form.ejercicios] : []), // array de ids
      owner: user?.uid || null,
      terapeuta_creador_id: user?.uid || null,
      created_at: serverTimestamp(),
    };

    // crear doc con id auto
    const docRef = await addDoc(collection(db, "routines"), payload);

    // guardar campo id dentro del documento por conveniencia (opcional pero útil)
    await setDoc(doc(db, "routines", docRef.id), { id: docRef.id }, { merge: true });

    // registra auditoría básica
    try {
      await addDoc(collection(db, "auditoria"), {
        accion: "RutinaCreada",
        entidad_afectada: "routines",
        entidad_id: docRef.id,
        usuario_id: user?.uid || null,
        datos_nuevos: payload,
        datos_previos: null,
        timestamp: serverTimestamp(),
      });
    } catch (auditErr) {
      console.warn("Auditoría falla (se ignora):", auditErr);
    }

    setBusy(false);
    setView("routines");
    // opcional: refrescar lista o navegar a detalle
    return docRef.id;
  } catch (err) {
    console.error("handleCreateRoutine error:", err);
    setError("No se pudo crear la rutina. Revisa consola.");
    setBusy(false);
  }
}


  // ---------- Create exercise ----------
async function handleCreateExercise(form) {
  setBusy(true);
  setError("");
  try {
    if (!form.nombre || form.nombre.trim().length < 2) {
      setError("Nombre de ejercicio inválido.");
      setBusy(false);
      return;
    }

    // normalizar a tipos numéricos cuando tenga sentido
    const payload = {
      nombre: form.nombre,
      description: form.description || form.descripcion || "",
      repeticiones: form.repeticiones ? Number(form.repeticiones) : null,
      series: form.series ? Number(form.series) : null,
      tiempo_segundos: form.tiempo_segundos ? Number(form.tiempo_segundos) : null,
      url_video: form.url_video || "",
      created_by: user?.uid || null,
      created_at: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, "ejercicios"), payload);
    // establecer id en documento
    await setDoc(doc(db, "ejercicios", docRef.id), { id: docRef.id }, { merge: true });

    // auditoría
    try {
      await addDoc(collection(db, "auditoria"), {
        accion: "EjercicioCreado",
        entidad_afectada: "ejercicios",
        entidad_id: docRef.id,
        usuario_id: user?.uid || null,
        datos_nuevos: payload,
        datos_previos: null,
        timestamp: serverTimestamp(),
      });
    } catch (_) {}

    setBusy(false);
    setView("exercises");
    return docRef.id;
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
    if (!user?.uid) throw new Error("Usuario no autenticado.");
    if (!pacienteId || !rutinaId) throw new Error("Paciente o rutina inválida.");

    // asegúrate de convertir sesiones a número
    const expected = Number(sesiones) || 1;

    const payload = {
      paciente_id: pacienteId,
      rutina_id: rutinaId,
      terapeuta_asignador_id: user.uid,
      fecha_asignacion: serverTimestamp(),
      expectedSessions: expected,
      progreso: 0,
      estado: "Asignada", // o "En progreso" dependiendo flujo
    };

    const asignRef = await addDoc(collection(db, "asignaciones"), payload);

    // auditoría
    try {
      await addDoc(collection(db, "auditoria"), {
        accion: "AsignacionCreada",
        entidad_afectada: "asignaciones",
        entidad_id: asignRef.id,
        usuario_id: user.uid,
        datos_nuevos: payload,
        datos_previos: null,
        timestamp: serverTimestamp(),
      });
    } catch (auditErr) {
      console.warn("Auditoría fallo (ignorado):", auditErr);
    }

    // refrescar detalle paciente si está abierto
    if (selectedPatient?.id === pacienteId) {
      await openPatientDetail(pacienteId);
    }

    setBusy(false);
    return asignRef.id;
  } catch (err) {
    console.error("assignRoutineToPatient error:", err);
    setError(err?.message || "No se pudo asignar la rutina.");
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
              <button onClick={() => setView("patients")} className="p-3 bg-indigo-50 border border-indigo-100 rounded-lg text-left">
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

  // ---------- Patients list UI (MODIFICADO) ----------
  function PatientsPanel() {
    return (
      <div>
        <SectionHeader title="Gestión de pacientes" subtitle="Añade, visualiza y administra pacientes" />
        <div className="mb-4 flex gap-2 items-center">
          {/* Botones: Añadir paciente (manual) / Vincular por código */}
          <button
            onClick={() => { setShowAddForm((s) => !s); setShowLinkByCode(false); }}
            className={`px-4 py-2 rounded ${showAddForm ? "bg-indigo-600 text-white" : "border"}`}
          >
            Añadir paciente
          </button>

          <button
            onClick={() => { setShowLinkByCode((s) => !s); setShowAddForm(false); }}
            className={`px-4 py-2 rounded ${showLinkByCode ? "bg-emerald-600 text-white" : "border"}`}
          >
            Vincular paciente (por código)
          </button>

          <button onClick={() => setView("home")} className="px-4 py-2 border rounded ml-auto">Volver al panel</button>
        </div>

        {/* Si el terapeuta abrió el formulario manual */}
        {showAddForm && (
          <div className="mb-4">
            {/* Reutilizamos la función AddPatientForm definida más abajo (componente local) */}
            <AddPatientForm />
          </div>
        )}

        {/* Si el terapeuta abrió el panel para vincular por código */}
        {showLinkByCode && (
          <div className="mb-4">
            <LinkPatientByCode therapistId={user?.uid} onLinked={(uid) => {
              // abrir detalle del paciente vinculado y cerrar panel
              openPatientDetail(uid);
              setShowLinkByCode(false);
            }} />
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
        onClick={() => openPatientDetail(p.id)}
        className="px-3 py-1 bg-indigo-50 border rounded text-sm"
      >
        Ver
      </button>

<button
  onClick={() => {
    if (!routines || routines.length === 0) return alert("No hay rutinas disponibles.");
    // crear lista corta para elegir
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
    assignRoutineToPatient({ pacienteId: p.id, rutinaId, sesiones: Number(sessions) });
  }}
  className="px-3 py-1 bg-emerald-50 border rounded text-sm"
>
  Asignar rutina
</button>


<button
  onClick={() => {
    const ok = window.confirm(`¿Desvincular al paciente "${p.nombre_completo}"? Esta acción quitará la relación con el terapeuta.`);
    if (ok) handleUnlinkPatient(p.id);
  }}
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
      </div>
    );
  }

  // ---------- Unlink / Desvincular paciente ----------
async function handleUnlinkPatient(patientId) {
  console.debug("[handleUnlinkPatient] start", { patientId, therapistId: user?.uid });
  setError("");
  setBusy(true);
  try {
    if (!user?.uid) throw new Error("Usuario no autenticado.");

    const ref = doc(db, "patients", patientId);

    // elimina campos de vinculación (ajusta nombres si usas otros campos)
    await updateDoc(ref, {
      terapeuta_id: deleteField(),
      created_by_terapeuta: deleteField(),
      linked_at: deleteField()
    });

    console.debug("[handleUnlinkPatient] success", { patientId });
    // si el detalle del paciente estaba abierto, ciérralo
    if (selectedPatient?.id === patientId) {
      setSelectedPatient(null);
      setView("patients");
    }

    setBusy(false);
  } catch (err) {
    console.error("handleUnlinkPatient error:", err);
    setError(err?.message || "No se pudo desvincular al paciente. Revisa la consola.");
    setBusy(false);
  }
}



  // ---------- AddPatient form (local) ----------
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
              <button type="button" onClick={() => { setView("patients"); setShowAddForm(false); }} className="px-4 py-2 border rounded">Cancelar</button>
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
            <div className="text-sm text-gray-500">Email: {p.email || "—"}</div>
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

  function ExerciseDetail() {
  if (!selectedExercise) return <p>Selecciona un ejercicio</p>;
  const e = selectedExercise;

  const formatDate = (ts) => {
    try {
      return ts?.toDate ? ts.toDate().toLocaleString() : (ts ? String(ts) : "—");
    } catch {
      return "—";
    }
  };

  return (
    <div>
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-semibold">{e.nombre}</h2>
          <div className="text-sm text-gray-500 mt-1">ID: <span className="font-mono text-xs">{e.id}</span></div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setView("exercises")} className="px-3 py-1 border rounded">Volver</button>
          {/* Si quieres editar más adelante, puedes añadir botón Editar aquí */}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="col-span-2 bg-white rounded-xl p-4 shadow-sm border">
          <h4 className="font-medium mb-2">Descripción</h4>
          <div className="text-sm text-gray-700 mb-4">{e.description || e.descripcion || "—"}</div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <div className="text-xs text-gray-500">Repeticiones</div>
              <div className="font-medium">{e.repeticiones ?? "—"}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Series</div>
              <div className="font-medium">{e.series ?? "—"}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Tiempo (s)</div>
              <div className="font-medium">{e.tiempo_segundos ?? "—"}</div>
            </div>
          </div>

          <div className="mt-4">
            <div className="text-xs text-gray-500">Video / Media</div>
            <div className="mt-2 space-y-1">
              {(e.url_video ? [e.url_video] : []).concat(e.media || []).filter(Boolean).map((u, i) => (
                <a key={i} href={u} target="_blank" rel="noreferrer" className="block text-sm text-indigo-600 underline">{u}</a>
              ))}
              {/* si no hay media mostramos mensaje */}
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
            <button onClick={() => { /* más acciones: copiar id, editar, eliminar */ }} className="px-3 py-2 border rounded text-left">Copiar ID</button>
            <button onClick={() => setView("createExercise")} className="px-3 py-2 bg-yellow-50 border rounded text-left">Agregar nuevo</button>
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
    <div className="text-xs text-gray-500 mt-1">{ex.description || ex.descripcion || ""}</div>
    <div className="text-xs text-gray-500 mt-1">
      {ex.repeticiones ? `Reps: ${ex.repeticiones}` : ""} {ex.series ? ` • Series: ${ex.series}` : ""} {ex.tiempo_segundos ? ` • Tiempo: ${ex.tiempo_segundos}s` : ""}
    </div>
    <div className="flex gap-2 mt-2">
      {(ex.media || ex.urls || []).slice(0, 2).map((m, i) => (
        <a key={i} href={m} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 underline">Media {i + 1}</a>
      ))}
      <button
        onClick={() => openExerciseDetail(ex.id)}
        className="px-3 py-1 border rounded text-sm bg-indigo-50"
      >
        Detalle
      </button>
    </div>
  </div>
))}

            </div>
          )}
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
        {Sidebar ? (
  <div className="w-full md:w-64">
    <Sidebar onNavigate={(key) => {
      // Si quieres mapear keys a vistas diferentes, hazlo aquí
      // usamos key tal cual porque coincide con tus vistas
      setView(key);
    }} />
  </div>
) : (
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
            {view === "createExercise" && (
  <CreateExercise
    onSubmit={async (form) => {
      await handleCreateExercise(form);
    }}
    onCancel={() => setView("exercises")}
    busy={busy}
    error={error}
  />
)}

            {error && <div className="mt-6 text-sm text-rose-600">{error}</div>}
          </div>
        </main>
      </div>
    </div>
  );
}
