import React, { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";

const WORLD_TIME_URL = "https://worldtimeapi.org/api/timezone/America/Mexico_City";

function greetingFromHour(hour) {
  if (hour < 12) return "Buenos días";
  if (hour < 19) return "Buenas tardes";
  return "Buenas noches";
}

export default function TopBar({ user }) {
  const { logout } = useAuth();
  const [greeting, setGreeting] = useState("...");
  const [timeStr, setTimeStr] = useState("");

  useEffect(() => {
    let mounted = true;

    async function fetchCloudTime() {
      try {
        const res = await fetch(WORLD_TIME_URL, { cache: "no-store" });
        if (!res.ok) throw new Error("No response");
        const data = await res.json();
        // data.datetime viene algo así: '2025-11-03T12:34:56.123456-06:00'
        const dt = new Date(data.datetime);
        const hour = dt.getHours();
        if (!mounted) return;
        setGreeting(greetingFromHour(hour));
        setTimeStr(dt.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }));
      } catch (err) {
        // Fallback: usar hora del dispositivo si falla la llamada
        const now = new Date();
        const hour = now.getHours();
        if (!mounted) return;
        setGreeting(greetingFromHour(hour));
        setTimeStr(now.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }));
      }
    }

    fetchCloudTime();
    const interval = setInterval(fetchCloudTime, 60_000); // refresca cada minuto
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <header className="bg-[#0a0a0a] text-white py-3 px-4 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="hidden md:block">
          <h2 className="font-semibold text-lg md:text-xl">Panel médico</h2>
          <p className="text-xs text-gray-300">Terapeuta</p>
        </div>
      </div>

      <div className="text-center">
        <h2 className="font-semibold text-lg md:text-xl">{greeting}</h2>
        {timeStr && <p className="text-xs text-gray-300">{timeStr} (CDMX)</p>}
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden md:block text-sm text-gray-200">{user?.email}</div>

        <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden flex items-center justify-center text-sm font-medium text-[#3b2a4f]">
          {user?.avatarUrl ? (
            <img src={user.avatarUrl} alt="avatar" className="w-full h-full object-cover" />
          ) : (
            (user?.email || "T").charAt(0).toUpperCase()
          )}
        </div>

        <button
          onClick={logout}
          className="ml-2 px-3 py-1 bg-rose-500 text-white rounded text-sm hidden md:inline"
        >
          Cerrar sesión
        </button>
      </div>
    </header>
  );
}
