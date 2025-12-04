// apps/therapist/src/pages/Dashboard.jsx
import React, { useEffect, useState } from "react";
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
  deleteField,
  deleteDoc,
} from "firebase/firestore";
import { db } from "../firebaseClient";
import { useAuth } from "../contexts/AuthContext";
import TopBar from "../components/TopBar";
import Sidebar from "../components/Sidebar";
import CreateExercise from "../components/CreateExercise";
import LinkPatientByCode from "../components/LinkPatientByCode";


import PatientsPanel from "../components/PatientsPanel";
import PatientDetail from "../components/PatientDetail";
import RoutinesPanel from "../components/RoutinesPanel";
import CreateRoutineForm from "../components/CreateRoutineForm";
import ExercisesPanel from "../components/ExercisesPanel";
import ExerciseDetail from "../components/ExerciseDetail";
import AddPatientForm from "../components/AddPatientForm";
import RoutineDetail from "../components/RoutineDetail";
import TherapistProfile from "../components/TherapistProfile";
/**
 * Dashboard — usa los componentes externos para vistas (patients, routines, exercises, etc).
 * Mantiene la lógica/handlers/listeners del archivo original, pero adaptado al flujo:
 *  - Ejercicio (plantilla)
 *  - Rutina (plantilla que referencia ejercicios)
 *  - Asignación (instancia que copia ejercicios y guarda targets)
 *  - Sesiones (registro de lo hecho por paciente)
 */

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

  // vista actual
  const [view, setView] = useState("home"); // home | patients | patientDetail | routines | createRoutine | exercises | createExercise | exerciseDetail | addPatient
  // data
  const [patients, setPatients] = useState([]);
  const [patientsLoading, setPatientsLoading] = useState(true);
  const [selectedPatient, setSelectedPatient] = useState(null);

  const [routines, setRoutines] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [itemsLoading, setItemsLoading] = useState(true);

  const [selectedExercise, setSelectedExercise] = useState(null);

  // UI extras para panel pacientes
  const [showAddForm, setShowAddForm] = useState(false);
  const [showLinkByCode, setShowLinkByCode] = useState(false);

  // feedback
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // agregar en el state del componente (ya tienes states similares)
  const [selectedRoutine, setSelectedRoutine] = useState(null);

  // -------------------- Firestore listeners --------------------
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
    async (snap) => {
      try {
        // construye lista defensiva (data puede ser undefined temporalmente)
        const list = snap.docs.map((d) => {
          const data = d.data() || {};
          return { id: d.id, ...data };
        });

        // extrae uids de forma segura
        const uids = Array.from(
          new Set(
            list
              .map((p) => {
                // paciente_uid podría no existir todavía; fallback a id
                return (p && (p.paciente_uid || p.usuario_uid || p.id)) || null;
              })
              .filter(Boolean)
          )
        );

        if (uids.length === 0) {
          // no hay users que resolver: asigna lista con email vacío y sal
          setPatients(list.map((p) => ({ ...p, email: "" })));
          setPatientsLoading(false);
          return;
        }

        // fetch de usuarios en paralelo, pero cada getDoc protegido
        const userDocs = await Promise.all(
          uids.map(async (uid) => {
            try {
              const s = await getDoc(doc(db, "users", uid));
              return s;
            } catch (err) {
              console.warn("getDoc users/ failed for uid:", uid, err);
              return null;
            }
          })
        );

        // mapa de emails (skip resultados nulos)
        const emailMap = {};
        userDocs.forEach((s) => {
          if (s && s.exists && s.exists()) {
            const d = s.data() || {};
            emailMap[s.id] = d.email || d.email_normalized || d.email_normalizado || "";
          }
        });

        // enriquece la lista, usando uid fallbacks con defensiva
        const enriched = list.map((p) => {
          const uidToCheck = (p && (p.paciente_uid || p.usuario_uid || p.id)) || null;
          return { ...p, email: (uidToCheck && emailMap[uidToCheck]) || "" };
        });

        setPatients(enriched);
        setPatientsLoading(false);
      } catch (err) {
        // fallo al procesar snapshot: evitar dejar la UI en blanco, informar y mantener lista previa
        console.warn("Error procesando patients snapshot:", err);
        setPatients((prev) => prev || []);
        setPatientsLoading(false);
      }
    },
    (err) => {
      console.warn("patients onSnapshot error:", err);
      setPatients([]);
      setPatientsLoading(false);
    }
  );

  return () => unsub();
}, [user?.uid]);

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

  // -------------------- Handlers (DB ops) --------------------
// handler: puede recibir objeto rutina OR id
async function openRoutineDetail(routineOrId) {
  setError("");
  setBusy(true);
  try {
    let routine = null;

    if (!routineOrId) throw new Error("Rutina inválida.");

    if (typeof routineOrId === "string") {
      const snap = await getDoc(doc(db, "routines", routineOrId));
      if (!snap.exists()) throw new Error("Rutina no encontrada.");
      routine = { id: snap.id, ...snap.data() };
    } else {
      routine = routineOrId;
    }

    // resolver ejercicios (si vienen como ids o como objetos)
    const items = routine.ejercicios || [];
    const resolved = await Promise.all(items.map(async (it) => {
      const id = (typeof it === "string") ? it : (it.exercise_id || it.id || it.exerciseId || null);
      if (!id) {
        // item sin id (obj raw)
        return { exercise_id: null, nombre: it.nombre || it.name || "Sin ID", raw: it };
      }
      try {
        const esnap = await getDoc(doc(db, "ejercicios", id));
        if (esnap.exists()) {
          const d = esnap.data();
          return { exercise_id: id, nombre: d.nombre || d.name || id, raw: it };
        } else {
          return { exercise_id: id, nombre: id, raw: it };
        }
      } catch (err) {
        return { exercise_id: id, nombre: id, raw: it };
      }
    }));

    routine.resolved_ejercicios = resolved;
    setSelectedRoutine(routine);
    setView("routineDetail");
  } catch (err) {
    console.error("openRoutineDetail error:", err);
    setError(err?.message || "Error cargando detalle de rutina.");
  } finally {
    setBusy(false);
  }
}


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
      // opcional: set id en doc
      await setDoc(doc(db, "patients", docRef.id), { id: docRef.id }, { merge: true });

      setBusy(false);
      setView("patients");
      setSelectedPatient({ id: docRef.id, ...payload });
      setShowAddForm(false);
    } catch (err) {
      console.error("handleAddPatient error:", err);
      setError("No se pudo añadir el paciente. Revisa consola.");
      setBusy(false);
    }
  }

// reemplaza la función openPatientDetail existente por esta versión
// reemplaza tu openPatientDetail por esta función
async function openPatientDetail(patientIdOrUid) {
  setError("");
  setBusy(true);
  try {
    if (!patientIdOrUid) throw new Error("Paciente inválido.");

    // 1) intentar usar datos ya cargados en memoria (desde el listener `patients`)
    //    esto evita lecturas adicionales y previene muchos errores de permisos/ids inconsistentes.
    const localMatch = patients.find(
      (p) =>
        p.id === patientIdOrUid ||
        p.paciente_uid === patientIdOrUid ||
        p.usuario_uid === patientIdOrUid
    );

    let baseData = null;
    let patientDocId = null;

    if (localMatch) {
      baseData = { ...localMatch };
      patientDocId = localMatch.id;
    } else {
      // 2) si no está en memoria, intentar lectura directa patients/{id} (protegida)
      try {
        const snap = await getDoc(doc(db, "patients", patientIdOrUid));
        if (snap.exists()) {
          baseData = { id: snap.id, ...snap.data() };
          patientDocId = snap.id;
        }
      } catch (err) {
        console.debug("direct getDoc patients/{id} failed (will try query fallback):", err?.message);
      }

      // 3) fallback: buscar por campos paciente_uid / usuario_uid
      if (!baseData) {
        try {
          let snaps = await getDocs(query(collection(db, "patients"), where("paciente_uid", "==", patientIdOrUid)));
          if (snaps.empty) {
            snaps = await getDocs(query(collection(db, "patients"), where("usuario_uid", "==", patientIdOrUid)));
          }
          if (!snaps.empty) {
            const pdoc = snaps.docs[0];
            baseData = { id: pdoc.id, ...pdoc.data() };
            patientDocId = pdoc.id;
          }
        } catch (err) {
          console.debug("fallback query patients by paciente_uid/usuario_uid failed:", err?.message);
        }
      }
    }

    if (!baseData) {
      setError("No se encontró el perfil del paciente (o no tienes permisos para verlo).");
      setBusy(false);
      return;
    }

    // A partir de aqui intentamos enriquecer con email / sesiones / asignaciones
    const data = { ...baseData };

    // email desde users/{uid} (no fatal)
    try {
      const uidToFetch = data.paciente_uid || data.usuario_uid || data.id;
      if (uidToFetch) {
        const userSnap = await getDoc(doc(db, "users", uidToFetch));
        data.email = userSnap.exists() ? (userSnap.data().email || "") : "";
      } else data.email = data.email || "";
    } catch (err) {
      console.warn("Error fetching users/{uid} for patient detail:", err);
      data.email = data.email || "";
    }

    // sesiones (intentar, pero si falla por permisos, seguir adelante con array vacío)
    let sesiones = [];
    try {
      if (patientDocId) {
        const sesionesQ = query(collection(db, "sesiones"), where("paciente_id", "==", patientDocId), orderBy("fecha_completada", "desc"));
        const sesionesSnap = await getDocs(sesionesQ);
        sesiones = sesionesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      }
    } catch (err) {
      console.warn("No se pudieron cargar sesiones (permiso o error):", err);
      sesiones = [];
    }

    // asignaciones (igual: no fatal si falla)
    let asignaciones = [];
    try {
      if (patientDocId) {
        const asigQ = query(collection(db, "asignaciones"), where("paciente_id", "==", patientDocId));
        const asigSnap = await getDocs(asigQ);
        asignaciones = asigSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      }
    } catch (err) {
      console.warn("No se pudieron cargar asignaciones (permiso o error):", err);
      asignaciones = [];
    }

    setSelectedPatient({ ...data, sesiones, asignaciones });
    setView("patientDetail");
    setBusy(false);
    return;
  } catch (err) {
    console.error("openPatientDetail error:", err);
    setError(err?.message || "Error cargando detalle de paciente.");
    setBusy(false);
  }
}



  async function handleUnlinkPatient(patientId) {
    setError("");
    setBusy(true);
    try {
      if (!user?.uid) throw new Error("Usuario no autenticado.");
      const ref = doc(db, "patients", patientId);
      await updateDoc(ref, {
        terapeuta_id: deleteField(),
        created_by_terapeuta: deleteField(),
        linked_at: deleteField()
      });
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

  async function handleCreateRoutine(form) {
    setBusy(true);
    setError("");
    try {
      if (!form.nombre || form.nombre.trim().length < 3) {
        setError("Nombre de rutina inválido.");
        setBusy(false);
        return;
      }

      // transforma ejercicios seleccionados (array de ids) a estructura interna simple
      const ejercicios = Array.isArray(form.ejercicios)
        ? form.ejercicios.map((id, idx) => ({ exercise_id: id, order: idx + 1 }))
        : (form.ejercicios ? [{ exercise_id: form.ejercicios, order: 1 }] : []);

      const payload = {
        nombre: form.nombre,
        descripcion: form.descripcion || form.recomendaciones || "",
        nivel_dificultad: (form.nivel_dificultad || "BAJO").toUpperCase(),
        ejercicios,
        sesiones: form.sesiones || null,
        duracion_minutos: form.duracion || null,
        owner: user?.uid || null,
        terapeuta_creador_id: user?.uid || null,
        created_at: serverTimestamp(),
      };
      const docRef = await addDoc(collection(db, "routines"), payload);
      await setDoc(doc(db, "routines", docRef.id), { id: docRef.id }, { merge: true });

      setBusy(false);
      setView("routines");
      return docRef.id;
    } catch (err) {
      console.error("handleCreateRoutine error:", err);
      setError("No se pudo crear la rutina. Revisa consola.");
      setBusy(false);
    }
  }

  async function handleCreateExercise(form) {
    setBusy(true);
    setError("");
    try {
      if (!form.nombre || form.nombre.trim().length < 2) {
        setError("Nombre de ejercicio inválido.");
        setBusy(false);
        return;
      }
      const payload = {
        nombre: form.nombre,
        description: form.description || form.descripcion || "",
        url_video: form.url_video || "",
        media: form.media || [],
        // defaults (plantilla)
        default_repeticiones: form.default_repeticiones ? Number(form.default_repeticiones) : (form.repeticiones ? Number(form.repeticiones) : null),
        default_series: form.default_series ? Number(form.default_series) : (form.series ? Number(form.series) : null),
        default_tiempo_segundos: form.default_tiempo_segundos ? Number(form.default_tiempo_segundos) : (form.tiempo_segundos ? Number(form.tiempo_segundos) : null),
        created_by: user?.uid || null,
        created_at: serverTimestamp(),
      };
      const docRef = await addDoc(collection(db, "ejercicios"), payload);
      await setDoc(doc(db, "ejercicios", docRef.id), { id: docRef.id }, { merge: true });
      setBusy(false);
      setView("exercises");
      return docRef.id;
    } catch (err) {
      console.error("handleCreateExercise error:", err);
      setError("No se pudo crear el ejercicio.");
      setBusy(false);
    }
  }

  /**
   * assignRoutineToPatient
   * - acepta:
   *    - assignRoutineToPatient({ pacienteId, rutinaId, sesiones, fecha_inicio, exerciseTargets })
   *    - assignRoutineToPatient(pacienteId) fallback (usa first routine)
   * - copia los ejercicios de la plantilla dentro de assigned_exercises para mantener plantillas/instancias separadas
   */
  async function assignRoutineToPatient(input) {
    setBusy(true);
    setError("");
    try {
      if (!user?.uid) throw new Error("Usuario no autenticado.");

      // normalize input
      let pacienteId = null;
      let rutinaId = null;
      let sesiones = 1;
      let fecha_inicio = null;
      let exerciseTargets = {};

      if (!input) throw new Error("Datos de asignación faltantes.");
      if (typeof input === "string") {
        pacienteId = input;
      } else if (typeof input === "object") {
        pacienteId = input.pacienteId || input.paciente_id || null;
        rutinaId = input.rutinaId || input.rutina_id || input.rutinaId || null;
        sesiones = input.sesiones ?? input.expectedSessions ?? 1;
        fecha_inicio = input.fecha_inicio || input.fechaInicio || null;
        exerciseTargets = input.exerciseTargets || {};
      }

      if (!pacienteId) throw new Error("Paciente inválido.");

      // If rutinaId not provided, pick first routine as fallback
      if (!rutinaId) {
        if (!routines || routines.length === 0) throw new Error("No hay rutinas disponibles.");
        rutinaId = routines[0].id;
      }

      // fetch rutina
      const rutSnap = await getDoc(doc(db, "routines", rutinaId));
      if (!rutSnap.exists()) throw new Error("Rutina no encontrada.");
      const rutina = { id: rutSnap.id, ...rutSnap.data() };

      // obtener ejercicios referenciados en la plantilla
      const exerciseIds = (rutina.ejercicios || []).map((e) => e.exercise_id).filter(Boolean);
      const exerciseDocs = {};
      if (exerciseIds.length > 0) {
        const snaps = await Promise.all(exerciseIds.map((id) => getDoc(doc(db, "ejercicios", id))));
        snaps.forEach((s) => { if (s.exists()) exerciseDocs[s.id] = s.data(); });
      }

      // construir assigned_exercises (copia de plantilla + targets)
      const assigned_exercises = (rutina.ejercicios || []).map((item, idx) => {
        const exId = item.exercise_id;
        const src = exerciseDocs[exId] || {};
        const targets = exerciseTargets[exId] || {};
        return {
          exercise_id: exId,
          nombre: src.nombre || "",
          description: src.description || src.descripcion || "",
          default_repeticiones: src.default_repeticiones ?? src.repeticiones ?? null,
          default_series: src.default_series ?? src.series ?? null,
          default_tiempo_segundos: src.default_tiempo_segundos ?? src.tiempo_segundos ?? null,
          target_repeticiones: targets.target_repeticiones ?? (src.default_repeticiones ?? null),
          target_series: targets.target_series ?? (src.default_series ?? null),
          target_tiempo_segundos: targets.target_tiempo_segundos ?? (src.default_tiempo_segundos ?? null),
          order: item.order ?? (idx + 1),
        };
      });

      const payload = {
        paciente_id: pacienteId,
        rutina_id: rutinaId,
        terapeuta_asignador_id: user.uid,
        fecha_asignacion: serverTimestamp(),
        fecha_inicio: fecha_inicio ? fecha_inicio : serverTimestamp(),
        expectedSessions: Number(sesiones) || 1,
        progreso: 0,
        estado: "Asignada",
        assigned_exercises,
        created_at: serverTimestamp(),
      };

      const asignRef = await addDoc(collection(db, "asignaciones"), payload);
      await setDoc(doc(db, "asignaciones", asignRef.id), { id: asignRef.id }, { merge: true });

      // refrescar detalle del paciente si está abierto
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
      data.repeticiones = data.repeticiones ?? data.reps ?? data.default_repeticiones ?? null;
      data.series = data.series ?? data.default_series ?? null;
      data.tiempo_segundos = data.tiempo_segundos ?? data.tiempo ?? data.default_tiempo_segundos ?? null;
      setSelectedExercise(data);
      setView("exerciseDetail");
    } catch (err) {
      console.error("openExerciseDetail error:", err);
      setError("Error cargando detalle de ejercicio.");
    } finally {
      setBusy(false);
    }
  }
  async function handleDeleteRoutine(routineId) {
  if (!routineId) return;
  setBusy(true); setError("");
  try {
    await deleteDoc(doc(db, "routines", routineId));
    // opcional: si vista abierta es esa, volver a lista
    if (selectedRoutine?.id === routineId) { setSelectedRoutine(null); setView("routines"); }
  } catch (err) {
    console.error("delete routine error", err);
    setError("No se pudo eliminar la rutina.");
  } finally { setBusy(false); }
}

// --- guardar cambios de rutina (update) ---
async function handleSaveRoutine(routineId, updatedFields) {
  setBusy(true); setError("");
  try {
    // normalized payload: ensure tipos correctos
    const payload = { ...updatedFields, updated_at: serverTimestamp() };
    await updateDoc(doc(db, "routines", routineId), payload);
    // refresca detalle si está abierto:
    if (selectedRoutine?.id === routineId) {
      await openRoutineDetail(routineId);
    }
  } catch (err) {
    console.error("save routine error", err);
    setError("No se pudo guardar la rutina.");
  } finally { setBusy(false); }
}

// --- eliminar ejercicio ---
async function handleDeleteExercise(exerciseId) {
  if (!exerciseId) return;
  setBusy(true); setError("");
  try {
    await deleteDoc(doc(db, "ejercicios", exerciseId));
    // si tenías ejercicio seleccionar en detalle, cerrar
    if (selectedExercise?.id === exerciseId) { setSelectedExercise(null); setView("exercises"); }
  } catch (err) {
    console.error("delete exercise error", err);
    setError("No se pudo eliminar el ejercicio.");
  } finally { setBusy(false); }
}

// --- editar ejercicio ---
function handleEditExercise(exObj) {
  // ejemplo simple: abrir vista createExercise pero pasar initial values
  // Tendrás que adaptar CreateExercise para aceptar initialValues prop y modo edición
  setSelectedExercise(exObj);
  setView("createExercise"); // y en CreateExercise detecta selectedExercise para prellenar y hacer update
}

async function handleOnLinked(uid) {
  setError("");
  setBusy(true);
  try {
    if (!uid) throw new Error("UID inválido recibido al vincular.");

    // 1) intento directo: si existe patients/{uid} y puedo leerlo, úsalo
    try {
      const directSnap = await getDoc(doc(db, "patients", uid));
      if (directSnap.exists()) {
        // comprobamos permisos al leer: si existe y lo leíste, adelante
        setBusy(false);
        // abrir detalle con el id real (uid)
        await openPatientDetail(uid);
        setShowLinkByCode(false);
        setView("patientDetail");
        return;
      }
    } catch (err) {
      // no fatal: puede fallar por permisos, seguimos a la búsqueda por campo
      console.debug("patients direct getDoc failed or not exists, will search by paciente_uid -", err?.message);
    }

    // 2) buscar por campo paciente_uid o usuario_uid en la colección patients
    // (esto requiere permiso de lectura sobre pacientes; debería tenerlo el terapeuta)
    const q = query(
      collection(db, "patients"),
      where("paciente_uid", "==", uid)
    );

    let snaps = await getDocs(q);
    if (snaps.empty) {
      // intentar con usuario_uid como fallback
      const q2 = query(collection(db, "patients"), where("usuario_uid", "==", uid));
      snaps = await getDocs(q2);
    }

    if (!snaps.empty) {
      // tomar el primer doc encontrado (normalmente sólo habrá uno)
      const pdoc = snaps.docs[0];
      const patientId = pdoc.id;
      // abrir detalle con id real
      await openPatientDetail(patientId);
      setShowLinkByCode(false);
      setView("patientDetail");
      setBusy(false);
      return;
    }

    // 3) si no encontramos nada, informar al usuario y recargar la lista (porque la vinculación pudo haber creado los campos en otro momento)
    setError("Paciente vinculado correctamente pero no se encontró su perfil local (patients). Espera unos segundos y vuelve a intentarlo o refresca la vista.");
    // opcional: fuerza recarga del listener de patients re-suscribiendo (simple: togglear el estado patientsLoading para forzar UI)
    setPatientsLoading(true);
    // dejamos el busy en false para que UI reaccione
    setBusy(false);
  } catch (err) {
    console.error("handleOnLinked error:", err);
    setError(err?.message || "Error procesando enlace de paciente.");
    setBusy(false);
  }
}

  // -------------------- Main layout & view routing (same UI as tu versión) --------------------
  return (
    <div className="min-h-screen bg-[#FFF8F3]">
      <TopBar user={{ ...user, ...profile }} />

      <div className="flex flex-col md:flex-row">
        <div className="w-full md:w-64">
          <Sidebar onNavigate={(key) => setView(key)} />
        </div>

        <main className="flex-1 p-4 md:p-8">
          <div className="max-w-7xl mx-auto">
            {/* Home simple header reused */}
            {view === "home" && (
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
            )}

            {/* Patients views */}
            {view === "patients" && (
              <PatientsPanel
                patients={patients}
                patientsLoading={patientsLoading}
                onViewPatient={openPatientDetail}
                // onAssignRoutine puede ser llamado desde el panel como:
                // - onAssignRoutine(pacienteId)  -> asumirá primera rutina
                // - onAssignRoutine({ pacienteId, rutinaId, sesiones, fecha_inicio, exerciseTargets })
                onAssignRoutine={(payload) => {
                  // si payload es string tratamos como pacienteId
                  if (typeof payload === "string") return assignRoutineToPatient({ pacienteId: payload });
                  return assignRoutineToPatient(payload);
                }}
                // pasar ambas versiones para compatibilidad con tus componentes
                onUnlinkPatient={handleUnlinkPatient}
                onUnlink={handleUnlinkPatient}
                routines={routines}
                busy={busy}
                onShowAdd={() => { setShowAddForm(true); setView("addPatient"); }}
              />
            )}

            {view === "addPatient" && (
              <div>
                {/* si activaste showLinkByCode lo mostramos */}
                {showLinkByCode && (
                  <div className="mb-4">
                    <LinkPatientByCode therapistId={user?.uid} onLinked={handleOnLinked} />
                  </div>
                )}

                <AddPatientForm
                  onSubmit={handleAddPatient}
                  onCancel={() => { setView("patients"); setShowAddForm(false); }}
                  busy={busy}
                  error={error}
                />
              </div>
            )}

            {view === "patientDetail" && selectedPatient && (
              <PatientDetail
                patient={selectedPatient}
                onBack={() => setView("patients")}
                onAssignRoutine={(rutinaId) => assignRoutineToPatient({ pacienteId: selectedPatient.id, rutinaId })}
                routines={routines}
              />
            )}

            {view === "profile" && (
  <TherapistProfile
    onBack={() => setView("home")}
    onEdit={() => {
      // si quieres una vista de edición, maneja aquí: por ejemplo setView("editProfile")
      // ahora solo abrimos la vista de editar si la implementas
      setView("home");
    }}
  />
)}

            {/* Routines */}
{view === "routines" && (
<RoutinesPanel
  routines={routines}
  itemsLoading={itemsLoading}
  onCreate={() => setView("createRoutine")}
  onView={openRoutineDetail}
  onEdit={(r) => { setSelectedRoutine(r); setView("createRoutine"); }} // o abrir editor dedicado
  onDelete={handleDeleteRoutine}
/>

)}

            {view === "createRoutine" && (
              <CreateRoutineForm
                onSubmit={async (form) => { await handleCreateRoutine(form); }}
                onCancel={() => setView("routines")}
                exercises={exercises}
                busy={busy}
                error={error}
              />
            )}

            {/* Exercises */}
            {view === "exercises" && (
<ExercisesPanel
  exercises={exercises}
  onCreate={() => setView("createExercise")}
  onViewDetail={openExerciseDetail}
  onEdit={handleEditExercise}
  onDelete={handleDeleteExercise}
/>
            )}

            {view === "createExercise" && (
              <CreateExercise
                onSubmit={async (form) => { await handleCreateExercise(form); }}
                onCancel={() => setView("exercises")}
                busy={busy}
                error={error}
              />
            )}

{view === "exerciseDetail" && selectedExercise && (
  <ExerciseDetail
    exercise={selectedExercise}
    onBack={() => setView("exercises")}
    onEdit={handleEditExercise}
    onDelete={handleDeleteExercise}
    onCreate={() => setView("createExercise")}
  />
)}

{view === "routineDetail" && selectedRoutine && (
  <RoutineDetail
    routine={selectedRoutine}
    exercises={exercises}                // <-- pasar ejercicios disponibles
    onBack={() => setView("routines")}
    onAssign={(rid) => assignRoutineToPatient({ pacienteId: selectedPatient?.id, rutinaId: rid })}
    onViewExercise={openExerciseDetail}
    onSave={handleSaveRoutine}
    onDelete={handleDeleteRoutine}
    busy={busy}
  />
)}



            {/* show link panel toggle in patients area */}
            {view === "patients" && (
              <div className="mt-4">
                <div className="flex gap-2">
                  <button onClick={() => { setShowLinkByCode((s) => !s); setShowAddForm(false); }} className={`px-4 py-2 rounded ${showLinkByCode ? "bg-emerald-600 text-white" : "border"}`}>
                    Vincular paciente (por código)
                  </button>
                </div>
                {showLinkByCode && (
                  <div className="mt-3">
                   <LinkPatientByCode therapistId={user?.uid} onLinked={handleOnLinked} />

                  </div>
                )}
              </div>
            )}

            {error && <div className="mt-6 text-sm text-rose-600">{error}</div>}
          </div>
        </main>
      </div>
    </div>
  );
}
