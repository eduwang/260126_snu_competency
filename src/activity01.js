import { auth, db, isAdmin } from './firebaseConfig.js';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import Swal from 'sweetalert2';

// 인증 상태 확인 및 메뉴 설정 확인
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    Swal.fire({
      icon: 'warning',
      title: '로그인이 필요합니다',
      text: '메인 페이지로 이동합니다.',
      confirmButtonText: '확인'
    }).then(() => {
      window.location.href = '/index.html';
    });
    return;
  }

  // 관리자는 항상 접근 가능
  const userIsAdmin = await isAdmin(user.uid);
  if (userIsAdmin) {
    return;
  }

  // 메뉴 설정 확인
  try {
    const settingsDoc = await getDoc(doc(db, 'menuSettings', 'main'));
    
    if (settingsDoc.exists()) {
      const data = settingsDoc.data();
      
      // 활동 1이 off인 경우 접근 차단
      if (data.activity1 === false) {
        Swal.fire({
          icon: 'error',
          title: '접근 불가',
          text: '이 페이지는 현재 비활성화되어 있습니다.',
          confirmButtonText: '확인'
        }).then(() => {
          window.location.href = '/index.html';
        });
        return;
      }
    }
  } catch (error) {
    console.error('메뉴 설정 확인 오류:', error);
    // 오류 발생 시 접근 허용 (기본값)
  }
});


