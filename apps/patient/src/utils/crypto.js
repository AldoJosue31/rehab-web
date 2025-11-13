// apps/patient/src/utils/crypto.js
export function generateCode(len = 8) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  const cryptoObj = window.crypto || window.msCrypto;
  const buf = new Uint32Array(len);
  cryptoObj.getRandomValues(buf);
  for (let i = 0; i < len; i++) {
    out += chars[buf[i] % chars.length];
  }
  return out;
}

export async function sha256Hex(text) {
  const enc = new TextEncoder();
  const data = enc.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return hex.toUpperCase();
}
