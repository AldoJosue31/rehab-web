// apps/therapist/src/pages/Login.jsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { auth, db } from "../firebaseClient";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
} from "firebase/auth";
import {
  doc,
  runTransaction,
  serverTimestamp,
  getDoc,
  setDoc,
} from "firebase/firestore";
import { useAuth } from "../contexts/AuthContext";

const provider = new GoogleAuthProvider();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default function Login() {
  const [mode, setMode] = useState("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [displayName, setDisplayName] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [professionalId, setProfessionalId] = useState("");
  const [age, setAge] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [bio, setBio] = useState("");

  const [googleSignup, setGoogleSignup] = useState(false);
  const [emailLocked, setEmailLocked] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const { user: authUser, profile: authProfile, loading: authLoading, refreshProfile } = useAuth();

  const navigatedRef = useRef(false); // evita navegar repetidamente
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const normalizeEmail = (e) => (e || "").trim().toLowerCase();

  const mapAuthError = (code) => {
    const map = {
      "auth/email-already-in-use": "El correo ya está en uso.",
      "auth/invalid-email": "Correo inválido.",
      "auth/weak-password": "La contraseña es muy débil (mínimo 6 caracteres).",
      "auth/user-not-found": "Usuario no encontrado.",
      "auth/wrong-password": "Contraseña incorrecta.",
      "auth/popup-closed-by-user": "Cerraste la ventana antes de completar.",
      "auth/network-request-failed": "Problema de red. Revisa tu conexión.",
      "auth/unauthorized-domain": "Dominio no autorizado para OAuth (revisa la consola).",
      "auth/account-exists-with-different-credential": "La cuenta ya existe con otro proveedor.",
      "auth/popup-blocked": "El popup fue bloqueado por el navegador.",
    };
    return map[code] || (code ? `Error: ${code}` : "Ocurrió un error.");
  };

  const validateTherapistFields = () => {
    if (!displayName || displayName.trim().length < 2) { setError("Ingresa un nombre completo válido."); return false; }
    if (!professionalId || professionalId.trim().length < 3) { setError("Ingresa tu cédula profesional."); return false; }
    const a = Number(age); if (!Number.isInteger(a) || a <= 0 || a > 120) { setError("Edad inválida."); return false; }
    if (!specialty || specialty.trim().length < 2) { setError("Indica tu especialidad."); return false; }
    return true;
  };

  /**
   * Robust create: first try to write users/{uid} directly (token-based path),
   * then attempt transactional emails/{normalized} + users/{uid} if needed.
   *
   * Throws Error("EMAIL_ALREADY_REGISTERED") if mapping points to another real user.
   */
  const createEmailAndUserTransaction = useCallback(async (uid, emailRaw, minimalUserFields, extraUserFields = {}) => {
    const emailNormalized = normalizeEmail(emailRaw);
    if (!emailNormalized) throw new Error("INVALID_EMAIL");

    const emailRef = doc(db, "emails", emailNormalized);
    const userRef = doc(db, "users", uid);

    // 1) Force token refresh and small wait (helps rules that check request.auth.token.email)
    try {
      await auth.currentUser?.getIdToken(true);
    } catch (_) { /* ignore */ }
    await sleep(300);

    // payload for user doc
    const defaultExtras = {
      rol: "Terapeuta",
      estado: "Activo",
      created_at: serverTimestamp(),
      nombre: (minimalUserFields.nombre_completo || "").split(" ")[0] || minimalUserFields.nombre_completo || "",
    };
    const mergedPayload = Object.assign({}, minimalUserFields, { email_normalized: emailNormalized }, defaultExtras, extraUserFields);

    // 2) Try to create user doc directly (this path is allowed when token contains email == resource.data.email)
    try {
      await setDoc(userRef, mergedPayload, { merge: true });
      // attempt to create mapping emails/{normalized} (best-effort, ignore failure if permission)
      try {
        // If mapping absent -> create; if exists pointing to same uid -> ok; if exists other uid -> leave (we check below)
        const emailSnap = await getDoc(emailRef);
        if (!emailSnap.exists()) {
          // create mapping (may fail under rules if race) - best effort
          await runTransaction(db, async (tx) => {
            const eSnap = await tx.get(emailRef);
            if (!eSnap.exists()) {
              tx.set(emailRef, { uid }, { merge: false });
            } else {
              const d = eSnap.data();
              if (d.uid && d.uid !== uid) {
                // conflict: if other user exists -> throw to indicate email already registered
                const otherUserSnap = await tx.get(doc(db, "users", d.uid));
                if (otherUserSnap.exists()) throw new Error("EMAIL_ALREADY_REGISTERED");
                // else orphan -> overwrite
                tx.set(emailRef, { uid }, { merge: false });
              } // else same uid -> ok
            }
          });
        } else {
          const d = emailSnap.data();
          if (d.uid && d.uid !== uid) {
            const otherUserSnap = await getDoc(doc(db, "users", d.uid));
            if (otherUserSnap.exists()) {
              // mapping belongs to real user -> rollback by throwing
              // (we keep user doc we just wrote — but we inform caller)
              throw new Error("EMAIL_ALREADY_REGISTERED");
            } else {
              // orphan -> try to claim via transaction (update)
              await runTransaction(db, async (tx) => {
                const eSnap = await tx.get(emailRef);
                if (eSnap.exists()) {
                  const d2 = eSnap.data();
                  if (d2.uid !== uid) {
                    const otherUserSnap2 = await tx.get(doc(db, "users", d2.uid));
                    if (!otherUserSnap2.exists()) {
                      tx.set(emailRef, { uid }, { merge: false });
                    } else {
                      throw new Error("EMAIL_ALREADY_REGISTERED");
                    }
                  }
                }
              });
            }
          }
        }
      } catch (mapErr) {
        // If mapping fails due to real conflict, rethrow so caller can handle.
        if (String(mapErr.message).includes("EMAIL_ALREADY_REGISTERED")) {
          throw mapErr;
        }
        // else ignore mapping errors (best-effort)
        console.warn("createEmailAndUserTransaction: mapping attempt failed (ignored):", mapErr);
      }

      // Refresh profile cache
      try { await refreshProfile(uid); } catch (_) {}
      return;
    } catch (err) {
      // If direct setDoc failed due to permission (token not propagated or rules), fallback to full transaction
      if (String(err?.message).toLowerCase().includes("permission-denied") || err?.code === "permission-denied") {
        // fallback transactional path (original approach)
        await runTransaction(db, async (tx) => {
          const emailSnap = await tx.get(emailRef);
          if (emailSnap.exists()) {
            const data = emailSnap.data();
            if (data.uid && data.uid !== uid) {
              const otherUid = data.uid;
              const otherUserSnap = await tx.get(doc(db, "users", otherUid));
              if (otherUserSnap.exists()) {
                throw new Error("EMAIL_ALREADY_REGISTERED");
              } else {
                tx.set(emailRef, { uid }, { merge: false });
              }
            }
          } else {
            tx.set(emailRef, { uid }, { merge: false });
          }

          const minimalPayload = Object.assign({}, minimalUserFields, { email_normalized: emailNormalized });
          tx.set(userRef, minimalPayload, { merge: true });

          const mergedExtras = Object.assign({}, defaultExtras, extraUserFields);
          tx.set(userRef, mergedExtras, { merge: true });
        });

        try { await refreshProfile(uid); } catch (_) {}
        return;
      }

      // other errors: rethrow
      throw err;
    }
  }, [refreshProfile]);

  // Auto-redirect: navegar sólo una vez para evitar flood
  useEffect(() => {
    const onLoginRoute = location.pathname.startsWith("/login") || location.pathname === "/";
    if (!authLoading && authUser && authProfile && onLoginRoute && !navigatedRef.current) {
      navigatedRef.current = true;
      const t = setTimeout(() => {
        try { if (mountedRef.current) navigate("/dashboard"); } catch (_) {}
      }, 120);
      return () => clearTimeout(t);
    }
    if (!authUser || !authProfile || !onLoginRoute) {
      navigatedRef.current = false;
    }
  }, [authLoading, authUser, authProfile, location.pathname, navigate]);

  // --- flows ---
  async function handleLogin(e) {
    e?.preventDefault();
    setError("");
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      try { if (auth.currentUser) await auth.currentUser.getIdToken(true); } catch (_) {}
      const profile = await refreshProfile(cred.user.uid);
      if (!profile || profile.rol !== "Terapeuta") {
        setError("Tu cuenta no tiene rol de Terapeuta. Espera a que un administrador lo asigne.");
        try { await signOut(auth); } catch (_) {}
        setLoading(false);
        return;
      }
      navigate("/dashboard");
    } catch (err) {
      console.error("handleLogin error:", err);
      setError(mapAuthError(err?.code));
    } finally {
      setLoading(false);
    }
  }

  async function handleSignup(e) {
    e?.preventDefault();
    setError("");
    setLoading(true);

    const current = auth.currentUser;
    const currentIsGoogle =
      !!current && Array.isArray(current.providerData) && current.providerData.some(p => p.providerId === "google.com");

    if ((googleSignup || currentIsGoogle) && current) {
      if (!validateTherapistFields()) { setLoading(false); return; }

      try {
        try { await auth.currentUser.getIdToken(true); } catch (_) {}
        await sleep(300);

        const uid = current.uid;
        const minimal = {
          id: uid,
          nombre_completo: displayName || current.displayName || "",
          email: current.email || email || "",
        };
        const extra = {
          photoUrl: photoUrl || current.photoURL || "",
          cedula_profesional: professionalId,
          edad: Number(age),
          especialidad: specialty,
          bio: bio || "",
        };

        try {
          await createEmailAndUserTransaction(uid, minimal.email, minimal, extra);
        } catch (err) {
          console.error("Transacción fallo (google flow):", err);
          if (String(err.message).includes("EMAIL_ALREADY_REGISTERED")) {
            setError("Ese correo ya está registrado por otra cuenta. Inicia sesión o usa recuperar contraseña.");
          } else {
            setError("No se pudo completar el registro con Google. Revisa la consola.");
          }
          // Si falla creacion de perfil por conflicto, sigamos fuera del estado autenticado
          try { await signOut(auth); } catch (_) {}
          setLoading(false);
          return;
        }

        setGoogleSignup(false);
        setEmailLocked(false);
        navigate("/dashboard");
        return;
      } catch (err) {
        console.error("handleSignup google branch error:", err);
        setError("No se pudo completar el registro con Google.");
        setLoading(false);
        return;
      }
    }

    if (!validateTherapistFields()) { setLoading(false); return; }

    let cred = null;
    try {
      cred = await createUserWithEmailAndPassword(auth, email, password);

      try { await updateProfile(cred.user, { displayName, photoURL: photoUrl }); } catch (_) {}
      try { if (auth.currentUser) await auth.currentUser.getIdToken(true); } catch (_) {}
      await sleep(300);

      const minimal = {
        id: cred.user.uid,
        nombre_completo: displayName || "",
        email: cred.user.email || email,
      };
      const extra = {
        photoUrl: photoUrl || "",
        cedula_profesional: professionalId,
        edad: Number(age),
        especialidad: specialty,
        bio: bio || "",
      };

      try {
        await createEmailAndUserTransaction(cred.user.uid, minimal.email, minimal, extra);
      } catch (txErr) {
        console.error("createEmailAndUserTransaction fallo:", txErr);
        if (String(txErr.message).includes("EMAIL_ALREADY_REGISTERED")) {
          setError("Ese correo ya está registrado. Intenta iniciar sesión o usar recuperar contraseña.");
        } else {
          setError("No se pudo crear tu perfil. Revisa consola.");
        }
        try { await signOut(auth); } catch (_) {}
        setLoading(false);
        return;
      }

      alert("Cuenta creada. Un administrador puede verificar/activar tu rol si aplica.");
      setMode("login");
      setEmail(""); setPassword(""); setDisplayName(""); setPhotoUrl(""); setProfessionalId(""); setAge(""); setSpecialty(""); setBio("");
      setLoading(false);
      return;
    } catch (err) {
      console.error("handleSignup error:", err);
      try { await signOut(auth); } catch (_) {}
      setError(mapAuthError(err?.code));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setError("");
    setLoading(true);
    try {
      const res = await signInWithPopup(auth, provider);
      const u = res?.user;
      if (!u) {
        setError("No se obtuvo usuario del proveedor.");
        setLoading(false);
        return;
      }

      try { await auth.currentUser?.getIdToken(true); } catch (_) {}
      await sleep(300);

      try {
        const userSnap = await getDoc(doc(db, "users", u.uid));
        if (userSnap.exists()) {
          try { await refreshProfile(u.uid); } catch (_) {}
          navigate("/dashboard");
          setLoading(false);
          return;
        }
      } catch (err) {
        console.warn("Error comprobando users/{uid} tras Google signIn:", err);
        if (String(err).includes("ERR_BLOCKED_BY_CLIENT")) {
          setError("Una extensión (adblock) está bloqueando peticiones. Prueba en incógnito o desactiva extensiones.");
          try { await signOut(auth); } catch (_) {}
          setLoading(false);
          return;
        }
      }

      // check emails mapping for conflict
      try {
        const normalized = normalizeEmail(u.email || email || "");
        if (normalized) {
          const emailSnap = await getDoc(doc(db, "emails", normalized));
          if (emailSnap.exists()) {
            const data = emailSnap.data();
            if (data.uid && data.uid !== u.uid) {
              // mapping points to another uid that *has* a users doc -> conflict
              const otherUserSnap = await getDoc(doc(db, "users", data.uid));
              if (otherUserSnap.exists()) {
                setError("Ese correo ya está registrado en otra cuenta. Usa ese inicio de sesión o contacta soporte.");
                try { await signOut(auth); } catch (_) {}
                setLoading(false);
                return;
              }
              // else orphan: we'll allow signup to claim it later in createEmailAndUserTransaction
            }
          }
        }
      } catch (err) {
        console.warn("Error comprobando emails index:", err);
      }

      // open completion flow
      setMode("signup");
      setGoogleSignup(true);
      setEmail(u.email || "");
      setDisplayName(u.displayName || "");
      setPhotoUrl(u.photoURL || "");
      setEmailLocked(true);
      setLoading(false);
      return;
    } catch (err) {
      console.warn("signInWithPopup fallo:", err);
      const code = err?.code || "";
      const msg = String(err || "");
      if (code === "auth/popup-blocked" || code === "auth/popup-closed-by-user" || msg.includes("Cross-Origin-Opener-Policy") || msg.includes("window.close")) {
        try {
          await signInWithRedirect(auth, provider);
        } catch (rErr) {
          console.error("signInWithRedirect error:", rErr);
          setError(mapAuthError(rErr?.code) || "No se pudo iniciar con Google (redirect).");
        } finally {
          setLoading(false);
        }
        return;
      }

      setError(mapAuthError(err?.code) || "Error al iniciar con Google.");
      setLoading(false);
    }
  }

  useEffect(() => {
    let mounted = true;
    async function handleRedirectResult() {
      setLoading(true);
      try {
        const result = await getRedirectResult(auth);
        if (result && result.user) {
          const u = result.user;
          try { await auth.currentUser?.getIdToken(true); } catch (_) {}
          if (!mountedRef.current) return;
          await sleep(300);

          const userSnap = await getDoc(doc(db, "users", u.uid));
          if (userSnap.exists()) {
            try { await refreshProfile(u.uid); } catch (_) {}
            navigate("/dashboard");
            setLoading(false);
            return;
          }

          setMode("signup");
          setGoogleSignup(true);
          setEmail(u.email || "");
          setDisplayName(u.displayName || "");
          setPhotoUrl(u.photoURL || "");
          setEmailLocked(true);
          setLoading(false);
        }
      } catch (err) {
        console.log("getRedirectResult:", err?.code || err?.message || err);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    handleRedirectResult();
    return () => { mounted = false; };
  }, [refreshProfile]);

  return (
    <div className="min-h-screen bg-white flex flex-col items-center p-6">
      <div className="w-full max-w-6xl bg-gray-100 rounded-xl shadow-sm py-10 px-6 mb-8">
        <h1 className="text-3xl md:text-4xl font-semibold text-center text-gray-800">mHealth - Terapeuta</h1>
      </div>

      <div className="w-full max-w-md bg-white rounded-xl shadow-lg border border-gray-100">
        <div className="flex items-center justify-center border-b border-gray-100 pt-4">
          <button
            className={`px-6 pb-3 text-sm font-medium ${mode === "signup" ? "text-gray-900" : "text-gray-500"}`}
            onClick={() => { setMode("signup"); setGoogleSignup(false); setEmailLocked(false); }}
            aria-pressed={mode === "signup"}
          >
            Crear cuenta
          </button>
          <button
            className={`px-6 pb-3 text-sm font-medium ${mode === "login" ? "text-gray-900" : "text-gray-500"}`}
            onClick={() => { setMode("login"); setGoogleSignup(false); setEmailLocked(false); }}
            aria-pressed={mode === "login"}
          >
            Iniciar sesión
          </button>
        </div>

        <div className="p-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-1">{mode === "signup" ? (googleSignup ? "Completa tu registro" : "Crear cuenta") : "Iniciar sesión"}</h2>
          <p className="text-sm text-gray-400 mb-6">{mode === "signup" ? "Regístrate como Terapeuta / Médico" : "Accede a tu cuenta"}</p>

          <form className="space-y-4" onSubmit={mode === "signup" ? handleSignup : handleLogin} noValidate>
            {mode === "signup" && (
              <>
                <label className="block">
                  <input
                    id="displayName"
                    name="displayName"
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Nombre completo"
                    className="w-full rounded-full border border-gray-200 px-6 py-3 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    required
                    aria-label="Nombre completo"
                  />
                </label>

                <label className="block">
                  <input
                    id="photoUrl"
                    name="photoUrl"
                    type="url"
                    value={photoUrl}
                    onChange={(e) => setPhotoUrl(e.target.value)}
                    placeholder="Foto URL (opcional)"
                    className="w-full rounded-full border border-gray-200 px-6 py-3 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    aria-label="Foto URL (opcional)"
                  />
                </label>

                <label className="block">
                  <input
                    id="professionalId"
                    name="professionalId"
                    type="text"
                    value={professionalId}
                    onChange={(e) => setProfessionalId(e.target.value)}
                    placeholder="Cédula profesional"
                    className="w-full rounded-full border border-gray-200 px-6 py-3 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    required
                    aria-label="Cédula profesional"
                  />
                </label>

                <label className="block">
                  <input
                    id="age"
                    name="age"
                    type="number"
                    min="18"
                    max="120"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    placeholder="Edad"
                    className="w-full rounded-full border border-gray-200 px-6 py-3 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    required
                    aria-label="Edad"
                  />
                </label>

                <label className="block">
                  <input
                    id="specialty"
                    name="specialty"
                    type="text"
                    value={specialty}
                    onChange={(e) => setSpecialty(e.target.value)}
                    placeholder="Especialidad médica"
                    className="w-full rounded-full border border-gray-200 px-6 py-3 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    required
                    aria-label="Especialidad médica"
                  />
                </label>

                <label className="block">
                  <textarea
                    id="bio"
                    name="bio"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Estado / Biografía profesional (opcional)"
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    rows={3}
                    aria-label="Biografía profesional (opcional)"
                  />
                </label>
              </>
            )}

            <label className="block">
              <input
                id="email"
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                className={`w-full rounded-full border px-6 py-3 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 ${emailLocked ? "bg-gray-100 text-gray-600 border-gray-200" : "bg-white"}`}
                required
                disabled={emailLocked}
                aria-label="Email"
              />
              {emailLocked && <p className="text-xs text-gray-500 mt-1">Usando correo de Google (no editable)</p>}
            </label>

            {!googleSignup && (
              <label className="block relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full rounded-full border border-gray-200 px-6 py-3 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 pr-12"
                  required
                  aria-label="Contraseña"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showPassword ? "👁️" : "🙈"}
                </button>
              </label>
            )}

            <div className="flex justify-center mt-4">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center justify-center rounded-full px-8 py-3 bg-indigo-600 text-white font-medium shadow-lg hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:opacity-60"
              >
                {loading ? "Procesando..." : mode === "signup" ? (googleSignup ? "Completar registro" : "Crear cuenta") : "Iniciar sesión"}
              </button>
            </div>
          </form>

          {error && <p className="text-sm text-rose-600 mt-3 text-center" role="alert">{error}</p>}

          <p className="text-center text-sm text-gray-400 mt-6">Iniciar sesión con:</p>

          <div className="mt-4 flex gap-3 justify-center">
            <button onClick={handleGoogle} disabled={loading} className="flex items-center gap-2 rounded-full border border-gray-200 px-4 py-2 text-sm shadow-sm hover:shadow-md" type="button">
              <svg width="18" height="18" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M44.5 20H24v8.5h11.9C34.9 32.9 30.1 36 24 36 15.9 36 9.6 30.2 9.6 22S15.9 8 24 8c4.1 0 7.9 1.5 10.8 4l6.1-6.1C36.2 2.5 30.5 0 24 0 11 0 0 11 0 24s11 24 24 24c13.2 0 23.8-9.6 24-22 0-.9 0-1.3-.5-2z" fill="#EA4335"/></svg>
              <span>Continuar con Google</span>
            </button>

            <button className="flex items-center gap-2 rounded-full border border-gray-200 px-4 py-2 text-sm shadow-sm hover:shadow-md" disabled type="button">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M16.365 1.43c-.92 1.08-1.95 1.77-3.15 1.77-1.01 0-2.2-.63-3.33-.63-1.36 0-2.8.78-3.79 2.14-1.63 2.28-.95 6.12 1.08 8.98.88 1.29 2.01 2.73 3.43 2.68 1.35-.04 1.86-.86 3.5-.86 1.68 0 2.16.86 3.49.83 1.19-.03 1.94-1.3 2.85-2.6.91-1.3 1.28-2.56 1.3-2.62-.03-.01-2.62-1.01-2.65-4.01-.03-3.07 2.48-4.52 2.55-4.59-1.46-2.12-3.73-2.41-4.6-2.45-.95-.05-1.86.56-2.62 1.7z" fill="#000"/></svg>
              <span>Continuar con Apple</span>
            </button>
          </div>
        </div>

        <div className="h-4" />
      </div>

      <div className="mt-12" />
    </div>
  );
}
