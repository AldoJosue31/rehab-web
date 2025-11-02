// src/contexts/AuthContext.jsx
import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth, db } from "../firebaseClient";
import { doc, getDoc } from "firebase/firestore";

const AuthContext = createContext();
export function useAuth() { return useContext(AuthContext); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // helper to compare important profile fields (avoid unnecessary rerenders)
  const isSameProfile = (a, b) => {
    try {
      if (!a && !b) return true;
      if (!a || !b) return false;
      return a.id === b.id
        && a.email === b.email
        && a.nombre_completo === b.nombre_completo
        && a.rol === b.rol;
    } catch { return false; }
  };

  // Try to force-refresh token with a few retries (returns true if got a token)
  const tryForceTokenRefresh = useCallback(async (attempts = 3, baseDelay = 200) => {
    for (let i = 0; i < attempts; i++) {
      try {
        if (auth.currentUser) {
          // request fresh token from backend (true forces refresh)
          await auth.currentUser.getIdToken(true);
          return true;
        } else {
          // no auth user present
          return false;
        }
      } catch (e) {
        // transient: wait a bit and retry
        await sleep(baseDelay * (i + 1));
      }
    }
    return false;
  }, []);

  /**
   * refreshProfile(uid, { retries, delayMs })
   * - Intenta leer users/{uid} y publicProfiles/{uid}
   * - Si falla con permission-denied reintenta con backoff y fuerza refresh del token
   * - Devuelve el profile o null
   */
  const refreshProfile = useCallback(async (uid = null, { retries = 6, delayMs = 300 } = {}) => {
    try {
      const targetUid = uid || (auth.currentUser && auth.currentUser.uid);
      if (!targetUid) {
        if (isMountedRef.current) setProfile(null);
        return null;
      }

      // Primero: intenta forzar token (rápido) para reducir probabilidad de permiso denegado
      await tryForceTokenRefresh(2, 150);

      let attempt = 0;
      let lastError = null;
      while (attempt < retries && isMountedRef.current) {
        try {
          const usersRef = doc(db, "users", targetUid);
          const snapUsers = await getDoc(usersRef);
          if (snapUsers.exists()) {
            const data = snapUsers.data();
            if (isMountedRef.current) {
              setProfile((prev) => isSameProfile(prev, data) ? prev : data);
            }
            return data;
          }

          const pubRef = doc(db, "publicProfiles", targetUid);
          const snapPub = await getDoc(pubRef);
          if (snapPub.exists()) {
            const data = snapPub.data();
            if (isMountedRef.current) {
              setProfile((prev) => isSameProfile(prev, data) ? prev : data);
            }
            return data;
          }

          // no doc found: puede ser propagación -> retry
          attempt++;
          if (attempt >= retries) {
            if (isMountedRef.current) setProfile(null);
            return null;
          }
          await sleep(delayMs * attempt);
        } catch (err) {
          lastError = err;
          const code = err?.code || "";
          // Si falla por permisos, intentamos forzar token y reintentar
          if (code === "permission-denied" || String(err).toLowerCase().includes("permission-denied")) {
            // pequeño aviso pero no lo spameamos
            console.warn && attempt === 0 && console.warn("refreshProfile: permission-denied recibido; reintentando con refresh de token...");
            // intentar forzar token una vez y esperar un poco
            await tryForceTokenRefresh(3, 200);
            await sleep(delayMs * (attempt + 1));
            attempt++;
            continue;
          }

          // otros errores (network/transient) -> reintentar también
          console.warn && console.warn(`refreshProfile: intento ${attempt + 1} fallo:`, err?.message || err, "code=", err?.code);
          attempt++;
          if (attempt >= retries) {
            console.error("refreshProfile fatal error:", err);
            if (isMountedRef.current) setProfile(null);
            return null;
          }
          await sleep(delayMs * attempt);
        }
      }

      if (isMountedRef.current) setProfile(null);
      return null;
    } catch (err) {
      console.error("refreshProfile error (outer):", err);
      if (isMountedRef.current) setProfile(null);
      return null;
    }
  }, [tryForceTokenRefresh]);

  const ensureProfileExists = useCallback(async (uid = null) => {
    const target = uid || (auth.currentUser && auth.currentUser.uid);
    if (!target) return false;
    const p = await refreshProfile(target);
    return !!p;
  }, [refreshProfile]);

  // ensureTherapist: intenta forzar token y refrescar profile
  const ensureTherapist = useCallback(async ({ signOutOnFail = false } = {}) => {
    try {
      const current = auth.currentUser;
      if (!current) return false;

      // Force token before checking
      await tryForceTokenRefresh(3, 200);

      const prof = await refreshProfile(current.uid);
      if (prof && prof.rol === "Terapeuta") return true;
      if (signOutOnFail) {
        try { await signOut(auth); } catch (e) { console.warn("signOut falló en ensureTherapist:", e); }
      }
      return false;
    } catch (err) {
      console.error("ensureTherapist error:", err);
      if (signOutOnFail) {
        try { await signOut(auth); } catch (_) {}
      }
      return false;
    }
  }, [refreshProfile, tryForceTokenRefresh]);

  // onAuthStateChanged: intentamos forzar token antes de llamar refreshProfile
  useEffect(() => {
    setLoading(true);
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!isMountedRef.current) return;

      setUser(u || null);

      if (u) {
        // intentar varias veces forzar token (silencioso)
        let ok = false;
        for (let i = 0; i < 4 && !ok; i++) {
          try {
            await auth.currentUser?.getIdToken(true);
            ok = true;
          } catch (e) {
            await sleep(200 * (i + 1));
          }
        }

        try {
          await refreshProfile(u.uid);
        } catch (err) {
          console.error("Error cargando profile en onAuthStateChanged:", err);
          if (isMountedRef.current) setProfile(null);
        }
      } else {
        setProfile(null);
      }

      if (isMountedRef.current) setLoading(false);
    });

    return () => {
      unsub();
    };
  }, [refreshProfile]);

  const logout = async () => {
    try {
      await signOut(auth);
      if (isMountedRef.current) {
        setUser(null);
        setProfile(null);
      }
    } catch (err) {
      console.error("Error cerrando sesión:", err);
    }
  };

  const value = {
    user,
    profile,
    loading,
    logout,
    setProfile,
    refreshProfile,
    ensureProfileExists,
    ensureTherapist,
  };

  return (
    <AuthContext.Provider value={value}>
      {loading ? <div className="p-6">Comprobando sesión...</div> : children}
    </AuthContext.Provider>
  );
}
