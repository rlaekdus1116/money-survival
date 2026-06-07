import { db } from "./firebase";
import { ref, get, set, remove } from "firebase/database";

/*
  반(room) 코드 시스템:
    "mg:room:<반>:game"    -> rooms/<반>/game
    "mg:room:<반>:p:<id>" -> rooms/<반>/players/<id>
*/
function safeRoom(room) {
  return room.replace(/[.#$/[\]\s]/g, "_");
}

function pathFor(key) {
  const rm = key.match(/^mg:room:([^:]+):(.+)$/);
  if (rm) {
    const r = safeRoom(rm[1]), rest = rm[2];
    if (rest === "game") return `rooms/${r}/game`;
    if (rest.startsWith("p:")) return `rooms/${r}/players/${rest.slice(2)}`;
  }
  // 레거시 키 (하위 호환)
  if (key === "mg:game") return "game";
  if (key.startsWith("mg:p:")) return "players/" + key.slice(5);
  return "misc/" + key.replace(/[.#$/[\]]/g, "_");
}

export async function sGet(key) {
  try {
    const snap = await get(ref(db, pathFor(key)));
    return snap.exists() ? snap.val() : null;
  } catch (e) {
    console.error("sGet 실패:", key, e);
    return null;
  }
}

export async function sSet(key, value) {
  try {
    await set(ref(db, pathFor(key)), value);
  } catch (e) {
    console.error("sSet 실패:", key, e);
  }
}

export async function sList(prefix) {
  try {
    // 반 코드 시스템: "mg:room:<반>:p:"
    const rm = prefix.match(/^mg:room:([^:]+):p:$/);
    if (rm) {
      const r = safeRoom(rm[1]);
      const snap = await get(ref(db, `rooms/${r}/players`));
      if (!snap.exists()) return [];
      return Object.keys(snap.val()).map((id) => `mg:room:${rm[1]}:p:${id}`);
    }
    // 레거시
    if (prefix === "mg:p:") {
      const snap = await get(ref(db, "players"));
      if (!snap.exists()) return [];
      return Object.keys(snap.val()).map((id) => "mg:p:" + id);
    }
    return [];
  } catch (e) {
    console.error("sList 실패:", prefix, e);
    return [];
  }
}

export async function sDel(key) {
  try {
    await remove(ref(db, pathFor(key)));
  } catch (e) {
    console.error("sDel 실패:", key, e);
  }
}
