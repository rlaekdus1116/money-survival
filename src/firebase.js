import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

// .env 파일의 값을 읽어옵니다 (VITE_ 접두사 필수)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FB_API_KEY,
  authDomain: import.meta.env.VITE_FB_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FB_DATABASE_URL, // Realtime Database URL
  projectId: import.meta.env.VITE_FB_PROJECT_ID,
  appId: import.meta.env.VITE_FB_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
