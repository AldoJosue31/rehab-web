// apps/patient/src/contexts/AuthContext.jsx
import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth, db } from ".././firebaseClient";
import { doc, getDoc } from "firebase/firestore";

const AuthContext = createContext();
export function useAuth() { return useContext(AuthContext); }

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async (uid = null) => {
    try {
      const targetUid = uid || (auth.currentUser && auth.currentUser.uid);
      if (!targetUid) { setProfile(null); return null; }

      // primero intento users/{uid}
      const usersRef = doc(db, "users", targetUid);
      const snapUsers = await getDoc(usersRef);
      if (snapUsers.exists()) {
        const data = snapUsers.data();
        setProfile(data);
        return data;
      }

      // si no existe, intento publicProfiles/{uid}
      const pubRef = doc(db, "publicProfiles", targetUid);
      const snapPub = await getDoc(pubRef);
      if (snapPub.exists()) {
        const data = snapPub.data();
        setProfile(data);
        return data;
      }

      // no hay doc
      setProfile(null);
      return null;
    } catch (err) {
      console.error("refreshProfile error:", err);
      setProfile(null);
      return null;
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u || null);
      if (u) {
        try {
          await refreshProfile(u.uid);
        } catch (err) {
          console.error("Error cargando profile en onAuthStateChanged:", err);
          setProfile(null);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [refreshProfile]);

  const logout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setProfile(null);
    } catch (err) {
      console.error("Error cerrando sesión:", err);
    }
  };

  const value = { user, profile, loading, logout, setProfile, refreshProfile };

  return (
    <AuthContext.Provider value={value}>
      {loading ? <div className="p-6">Comprobando sesión...</div> : children}
    </AuthContext.Provider>
  );
}
