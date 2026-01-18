import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// 환경변수에서 Firebase 설정 가져오기
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Firebase 설정 검증
const requiredEnvVars = ['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_PROJECT_ID'];
const missingVars = requiredEnvVars.filter(key => !import.meta.env[key]);

if (missingVars.length > 0) {
  console.error('❌ Firebase 환경변수가 누락되었습니다:', missingVars);
  console.error('프로젝트 루트에 .env 파일을 생성하고 Firebase 설정을 추가해주세요.');
}

// Firebase 초기화
let app;
try {
  app = initializeApp(firebaseConfig);
  console.log('✅ Firebase 초기화 성공');
} catch (error) {
  console.error('❌ Firebase 초기화 실패:', error);
  throw error;
}

// Auth 및 Firestore 인스턴스 생성
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// 관리자 UID 목록 (환경변수에서 가져오거나 하드코딩)
export const ADMIN_UIDS = import.meta.env.VITE_ADMIN_UIDS 
  ? import.meta.env.VITE_ADMIN_UIDS.split(',').map(uid => uid.trim())
  : [];

// 관리자 여부 확인 함수 (Firestore에서도 확인)
export async function isAdmin(uid) {
  // 환경변수에서 관리자 UID 확인
  if (ADMIN_UIDS.includes(uid)) {
    return true;
  }
  
  // Firestore에서 관리자 목록 확인
  try {
    const { doc, getDoc } = await import('firebase/firestore');
    const adminDoc = await getDoc(doc(db, 'adminUsers', uid));
    return adminDoc.exists();
  } catch (error) {
    console.error('관리자 확인 오류:', error);
    return false;
  }
}

// 관리자 추가 함수
export async function addAdmin(uid) {
  try {
    const { doc, setDoc, serverTimestamp } = await import('firebase/firestore');
    await setDoc(doc(db, 'adminUsers', uid), {
      uid: uid,
      createdAt: serverTimestamp()
    });
    return true;
  } catch (error) {
    console.error('관리자 추가 오류:', error);
    return false;
  }
}
