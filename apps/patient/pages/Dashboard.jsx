// apps/patient/src/pages/Dashboard.jsx
import React, { useEffect, useState, useCallback } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  onSnapshot,
  getDoc,
  doc,
} from "firebase/firestore";
import { db } from "../src/firebaseClient";
import { useAuth } from "../src/contexts/AuthContext";

import Sidebar from "../src/components/Sidebar";
import TopBar from "../src/components/TopBar";
import CalendarDays from "../src/components/CalendarDays";
import ProgressWidget from "../src/components/ProgressWidget";
import RoutineList from "../src/components/RoutineList";
import SessionRecorder from "../src/components/SessionRecorder";

export default function Dashboard() {
  const { user, profile, logout } = useAuth();

  const [routines, setRoutines] = useState([]);
  const [routinesLoading, setRoutinesLoading] = useState(true);

  const [asignaciones, setAsignaciones] = useState([]);
  const [asignLoading, setAsignLoading] = useState(true);
  const [assignmentsMap, setAssignmentsMap] = useState({});
  const [assignedWithRoutine, setAssignedWithRoutine] = useState([]);

  // 🆕 nuevo: mapa terapeutaId -> nombre
  const [therapists, setTherapists] = useState({});

  // Cargar rutinas propias
  useEffect(() => {
    let mounted = true;
    async function loadRoutines() {
      setRoutinesLoading(true);
      try {
        if (user?.uid) {
          const q = query(collection(db, "routines"), where("owner", "==", user.uid));
          const snap = await getDocs(q);
          const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          if (!mounted) return;
          if (items.length) setRoutines(items);
          else setRoutines(getDemoRoutines());
        } else {
          if (mounted) setRoutines(getDemoRoutines());
        }
      } catch (err) {
        console.warn("Error cargando rutinas:", err?.message || err);
        if (mounted) setRoutines(getDemoRoutines());
      } finally {
        if (mounted) setRoutinesLoading(false);
      }
    }

    loadRoutines();
    return () => {
      mounted = false;
    };
  }, [user]);

  // Escuchar asignaciones del paciente en tiempo real
  useEffect(() => {
    setAsignLoading(true);
    if (!user?.uid) {
      setAsignaciones([]);
      setAsignLoading(false);
      setAssignmentsMap({});
      setAssignedWithRoutine([]);
      return;
    }

    const q = query(collection(db, "asignaciones"), where("paciente_id", "==", user.uid));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setAsignaciones(items);
        setAsignLoading(false);

        const map = {};
        items.forEach((it) => {
          if (it.rutina_id && !map[it.rutina_id]) map[it.rutina_id] = it;
        });
        setAssignmentsMap(map);

        fetchRoutinesForAssignments(items);
        fetchTherapistsForAssignments(items);
      },
      (err) => {
        console.warn("Error escuchando asignaciones:", err?.message || err);
        setAsignaciones([]);
        setAsignLoading(false);
        setAssignmentsMap({});
        setAssignedWithRoutine([]);
      }
    );

    return () => unsub();
  }, [user]);

  // Cargar rutinas asociadas
  const fetchRoutinesForAssignments = useCallback(async (asigs) => {
    const rutinaIds = Array.from(new Set(asigs.map((a) => a.rutina_id).filter(Boolean)));
    if (rutinaIds.length === 0) {
      setAssignedWithRoutine(asigs.map((a) => ({ assignment: a, rutina: null })));
      return;
    }

    const promises = rutinaIds.map(async (rid) => {
      try {
        const d = await getDoc(doc(db, "routines", rid));
        return d.exists() ? { id: d.id, ...d.data() } : null;
      } catch (err) {
        console.warn("Error getDoc routine", rid, err);
        return null;
      }
    });

    const rutinas = await Promise.all(promises);
    const rutMap = {};
    rutinas.forEach((r) => {
      if (r && r.id) rutMap[r.id] = r;
    });

    const combined = asigs.map((a) => ({
      assignment: a,
      rutina: a.rutina_id ? rutMap[a.rutina_id] || null : null,
    }));

    setAssignedWithRoutine(combined);
  }, []);

  // 🆕 Obtener nombres de terapeutas (una vez por ID)
  const fetchTherapistsForAssignments = useCallback(async (asigs) => {
    const ids = Array.from(
      new Set(asigs.map((a) => a.terapeuta_asignador_id).filter(Boolean))
    );

    // evitar recargar los que ya tenemos
    const missingIds = ids.filter((id) => !therapists[id]);
    if (missingIds.length === 0) return;

    const newTherapists = {};
    for (const id of missingIds) {
      try {
        const docRef = doc(db, "users", id); // 👈 cambia "users" si tu colección se llama "profiles"
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data();
          newTherapists[id] = data.nombre || data.nombre_completo || "Terapeuta";
        } else {
          newTherapists[id] = "Terapeuta desconocido";
        }
      } catch (err) {
        console.warn("Error obteniendo terapeuta:", id, err);
        newTherapists[id] = "Terapeuta desconocido";
      }
    }

    setTherapists((prev) => ({ ...prev, ...newTherapists }));
  }, [therapists]);

  function getDemoRoutines() {
    return [
      { id: "demo-r1", title: "Hombro movilidad", time: "07:00 am", durationMin: 20, progressPercent: 50 },
      { id: "demo-r2", title: "Flexo-Extensión", time: "11:00 am", durationMin: 45, progressPercent: 20 },
    ];
  }

  return (
    <div className="min-h-screen bg-[#FFF8F3]">
      <TopBar user={{ ...user, ...profile }} />

      <div className="flex">
        <Sidebar />

        <main className="flex-1 p-4 md:p-8">
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="rounded-xl overflow-hidden">
              <div className="bg-[#0a0a0a] text-white py-6 px-4 md:px-8 rounded-t-xl flex items-center justify-between">
                <div>
                  <h3 className="text-lg md:text-2xl font-semibold">
                    {profile?.nombre_completo
                      ? `Hola ${profile.nombre_completo.split(" ")[0]}`
                      : user?.email
                      ? `Hola ${user.email.split("@")[0]}`
                      : "Hola"}
                  </h3>
                  <p className="text-sm text-gray-300 mt-1">
                    UID: <span className="font-mono text-xs">{user?.uid || "demo"}</span>
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={logout}
                    className="hidden md:inline px-4 py-2 bg-red-500 text-white rounded shadow-sm text-sm"
                  >
                    Cerrar sesión
                  </button>
                  <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden flex items-center justify-center text-sm font-medium text-[#3b2a4f]">
                    {profile?.avatarUrl ? (
                      <img src={profile.avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                    ) : (
                      profile?.nombre_completo?.charAt(0).toUpperCase() ||
                      user?.email?.charAt(0).toUpperCase() ||
                      "U"
                    )}
                  </div>
                </div>
              </div>
              <div className="bg-[#FFF8F3] border-t border-[#EAA48A]/20 px-4 md:px-8 py-6 rounded-b-xl shadow-sm">
                <CalendarDays />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              <div className="lg:col-span-2 space-y-4">
                <ProgressWidget percent={profile?.dailyProgress ?? 50} />

                <section className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-lg">Mi rutina</h4>
                    <div className="text-sm text-gray-400">Hoy</div>
                  </div>

                  {asignLoading ? (
                    <p className="text-sm text-gray-500">Cargando rutinas asignadas...</p>
                  ) : asignaciones.length > 0 ? (
                    assignedWithRoutine.map(({ assignment, rutina }) => (
                      <div key={assignment.id} className="mt-4 p-4 border rounded bg-white">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-medium text-gray-800">
                              {rutina?.nombre || rutina?.title || `Rutina ${assignment.rutina_id}`}
                            </div>
                            <div className="text-xs text-gray-400 mt-2">
                              Estado:{" "}
                              <span className="font-medium text-gray-700">
                                {assignment.estado}
                              </span>
                              {" • Progreso: "}
                              <span className="font-mono">{assignment.progreso ?? 0}%</span>
                            </div>
                          </div>

                          {/* 🧑‍⚕️ Terapeuta con nombre */}
                          <div className="text-right">
                            <div className="text-sm text-gray-500">Terapeuta:</div>
                            <div className="font-medium">
                              {therapists[assignment.terapeuta_asignador_id] ||
                                "Cargando..."}
                            </div>
                          </div>
                        </div>

                        <div className="mt-3">
                          <SessionRecorder
                            asignacionId={assignment.id}
                            rutinaId={assignment.rutina_id}
                            onSessionCreated={(sid) => console.log("Sesión creada:", sid)}
                          />
                        </div>
                      </div>
                    ))
                  ) : (
                    <RoutineList routines={routines} loading={routinesLoading} />
                  )}
                </section>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
