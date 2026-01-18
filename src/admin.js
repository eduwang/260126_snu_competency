import { auth, db, isAdmin } from './firebaseConfig.js';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { 
  collection, 
  getDocs, 
  addDoc, 
  deleteDoc, 
  doc, 
  getDoc, 
  setDoc,
  serverTimestamp,
  query,
  where
} from 'firebase/firestore';
import Swal from 'sweetalert2';

let currentUser = null;
let allUsers = [];
let allData = [];
let selectedDataId = null;
let selectedUserId = null;

// 인증 상태 확인
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    
    // 관리자 권한 확인
    const userIsAdmin = await isAdmin(user.uid);
    if (!userIsAdmin) {
      Swal.fire({
        icon: 'error',
        title: '접근 권한 없음',
        text: '관리자만 접근할 수 있는 페이지입니다.',
        confirmButtonText: '확인'
      }).then(() => {
        window.location.href = '/index.html';
      });
      return;
    }
    
    // 사용자 정보 표시 (index.html과 동일한 로직)
    try {
      const userQuery = query(collection(db, 'users'), where('uid', '==', user.uid));
      const userSnapshot = await getDocs(userQuery);
      
      let displayName = user.displayName || user.email;
      if (!userSnapshot.empty) {
        const userData = userSnapshot.docs[0].data();
        if (userData.name) {
          displayName = `${userData.name}${userData.affiliation ? ` (${userData.affiliation})` : ''}`;
        }
      }
      
      document.getElementById('userInfo').textContent = `👤 ${displayName} 님`;
    } catch (error) {
      console.error('사용자 정보 불러오기 오류:', error);
      document.getElementById('userInfo').textContent = `👤 ${user.displayName || user.email} 님`;
    }
    
    document.getElementById('logoutBtn').style.display = 'inline-block';
    
    // 초기 데이터 로드
    loadUsers();
    loadAllData();
    loadMenuSettings();
  } else {
    document.getElementById('userInfo').textContent = '🔐 로그인 후 이용해 주세요.';
    document.getElementById('logoutBtn').style.display = 'none';
    Swal.fire({
      icon: 'warning',
      title: '로그인이 필요합니다',
      text: '메인 페이지로 이동합니다.',
      confirmButtonText: '확인'
    }).then(() => {
      window.location.href = '/index.html';
    });
  }
});

// 메인으로 돌아가기 버튼
const backToMainBtn = document.getElementById('backToMainBtn');
if (backToMainBtn) {
  backToMainBtn.addEventListener('click', () => {
    window.location.href = '/index.html';
  });
}

// 로그아웃 버튼
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    try {
      await signOut(auth);
      window.location.href = '/index.html';
    } catch (error) {
      console.error('로그아웃 오류:', error);
      Swal.fire({
        icon: 'error',
        title: '로그아웃 실패',
        text: '로그아웃 중 오류가 발생했습니다.'
      });
    }
  });
}

// 탭 전환 기능
function initTabs() {
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');
  
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const targetTab = button.getAttribute('data-tab');
      
      // 모든 탭 버튼과 콘텐츠에서 active 제거
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));
      
      // 클릭한 탭 버튼과 해당 콘텐츠에 active 추가
      button.classList.add('active');
      const targetContent = document.getElementById(`${targetTab}-tab`);
      if (targetContent) {
        targetContent.classList.add('active');
      }
    });
  });
}

// ==================== 사용자 관리 ====================

// 사용자 목록 불러오기
async function loadUsers() {
  try {
    const usersContainer = document.getElementById('usersList');
    usersContainer.innerHTML = '<p class="empty-message">사용자 목록을 불러오는 중...</p>';

    const querySnapshot = await getDocs(collection(db, 'users'));

    if (querySnapshot.empty) {
      usersContainer.innerHTML = '<p class="empty-message">등록된 사용자가 없습니다.</p>';
      return;
    }

    allUsers = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      allUsers.push({
        id: docSnap.id,
        ...data
      });
    });

    // 생성일 기준 정렬 (최신순)
    allUsers.sort((a, b) => {
      const dateA = a.createdAt?.toDate?.() || new Date(0);
      const dateB = b.createdAt?.toDate?.() || new Date(0);
      return dateB - dateA;
    });

    renderUsersList();
    
  } catch (error) {
    console.error('사용자 목록 불러오기 오류:', error);
    document.getElementById('usersList').innerHTML = '<p class="empty-message">사용자 목록을 불러오는 중 오류가 발생했습니다.</p>';
    Swal.fire({
      icon: 'error',
      title: '불러오기 실패',
      text: error.message || '사용자 목록을 불러오는 중 오류가 발생했습니다.'
    });
  }
}

// 사용자 목록 렌더링
function renderUsersList() {
  const usersContainer = document.getElementById('usersList');
  
  if (allUsers.length === 0) {
    usersContainer.innerHTML = '<p class="empty-message">등록된 사용자가 없습니다.</p>';
    return;
  }

  const usersHTML = allUsers.map(user => {
    const createdAt = user.createdAt?.toDate?.() || new Date();
    const linkedAt = user.linkedAt?.toDate?.();
    const isLinked = !!user.uid;
    
    return `
      <div class="user-item">
        <div class="user-info">
          <div class="user-name">${user.name || '이름 없음'}</div>
          <div class="user-details">
            소속: ${user.affiliation || '소속 없음'}<br>
            코드: <span class="user-code">${user.code}</span><br>
            ${user.email ? `이메일: ${user.email}<br>` : ''}
            생성일: ${createdAt.toLocaleString('ko-KR')}
            ${linkedAt ? `<br>연결일: ${linkedAt.toLocaleString('ko-KR')}` : ''}
          </div>
        </div>
        <div class="user-actions">
          <div class="user-status">
            <span class="status-badge ${isLinked ? 'status-linked' : 'status-pending'}">
              ${isLinked ? '✓ 연결됨' : '대기 중'}
            </span>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="editUser('${user.id}', '${(user.name || '').replace(/'/g, "\\'")}', '${(user.affiliation || '').replace(/'/g, "\\'")}')">수정</button>
          <button class="btn btn-danger btn-sm" onclick="deleteUser('${user.id}', '${user.name || '사용자'}')">삭제</button>
        </div>
      </div>
    `;
  }).join('');

  usersContainer.innerHTML = usersHTML;
}

// 사용자 수정 함수 (전역으로 등록)
window.editUser = async function(userId, currentName, currentAffiliation) {
  const result = await Swal.fire({
    title: '사용자 정보 수정',
    html: `
      <input id="swal-edit-name" class="swal2-input" placeholder="이름" value="${currentName}" required>
      <input id="swal-edit-affiliation" class="swal2-input" placeholder="소속" value="${currentAffiliation}" required>
    `,
    showCancelButton: true,
    confirmButtonText: '수정',
    cancelButtonText: '취소',
    preConfirm: () => {
      const name = document.getElementById('swal-edit-name').value.trim();
      const affiliation = document.getElementById('swal-edit-affiliation').value.trim();
      
      if (!name || !affiliation) {
        Swal.showValidationMessage('이름과 소속을 모두 입력해주세요.');
        return false;
      }
      
      return { name, affiliation };
    }
  });

  if (result.isConfirmed) {
    try {
      await setDoc(doc(db, 'users', userId), {
        name: result.value.name,
        affiliation: result.value.affiliation
      }, { merge: true });
      
      Swal.fire({
        icon: 'success',
        title: '수정 완료',
        text: '사용자 정보가 수정되었습니다.',
        timer: 1500,
        showConfirmButton: false
      });

      // 사용자 목록 새로고침
      loadUsers();
      
    } catch (error) {
      console.error('사용자 수정 오류:', error);
      Swal.fire({
        icon: 'error',
        title: '수정 실패',
        text: error.message || '사용자 정보를 수정하는 중 오류가 발생했습니다.'
      });
    }
  }
};

// 사용자 삭제 함수 (전역으로 등록)
window.deleteUser = async function(userId, userName) {
  const result = await Swal.fire({
    title: '사용자 삭제',
    html: `정말 <strong>${userName}</strong> 사용자를 삭제하시겠습니까?<br><small style="color: #ef4444;">이 작업은 되돌릴 수 없습니다.</small>`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: '삭제',
    cancelButtonText: '취소',
    confirmButtonColor: '#ef4444'
  });

  if (result.isConfirmed) {
    try {
      await deleteDoc(doc(db, 'users', userId));
      
      Swal.fire({
        icon: 'success',
        title: '삭제 완료',
        text: '사용자가 삭제되었습니다.',
        timer: 1500,
        showConfirmButton: false
      });

      // 사용자 목록 새로고침
      loadUsers();
      
    } catch (error) {
      console.error('사용자 삭제 오류:', error);
      Swal.fire({
        icon: 'error',
        title: '삭제 실패',
        text: error.message || '사용자를 삭제하는 중 오류가 발생했습니다.'
      });
    }
  }
};

// 사용자 추가 버튼
document.getElementById('addUserBtn').addEventListener('click', async () => {
  const result = await Swal.fire({
    title: '사용자 추가',
    html: `
      <input id="swal-name" class="swal2-input" placeholder="이름" required>
      <input id="swal-affiliation" class="swal2-input" placeholder="소속" required>
    `,
    showCancelButton: true,
    confirmButtonText: '추가',
    cancelButtonText: '취소',
    preConfirm: () => {
      const name = document.getElementById('swal-name').value.trim();
      const affiliation = document.getElementById('swal-affiliation').value.trim();
      
      if (!name || !affiliation) {
        Swal.showValidationMessage('이름과 소속을 모두 입력해주세요.');
        return false;
      }
      
      return { name, affiliation };
    }
  });

  if (result.isConfirmed) {
    try {
      // 5자리 랜덤 코드 생성
      const code = generateRandomCode();
      
      // Firestore에 사용자 추가
      await addDoc(collection(db, 'users'), {
        name: result.value.name,
        affiliation: result.value.affiliation,
        code: code,
        uid: null,
        createdAt: serverTimestamp(),
        linkedAt: null
      });

      Swal.fire({
        icon: 'success',
        title: '사용자 추가 완료',
        html: `
          <p>사용자가 추가되었습니다.</p>
          <p style="margin-top: 1rem; font-weight: 600; font-size: 1.25rem; color: #2563eb;">
            생성된 코드: <span style="font-family: monospace;">${code}</span>
          </p>
          <p style="margin-top: 0.5rem; font-size: 0.875rem; color: #6b7280;">
            이 코드를 사용자에게 전달하세요.
          </p>
        `,
        confirmButtonText: '확인'
      });

      // 사용자 목록 새로고침
      loadUsers();
      
    } catch (error) {
      console.error('사용자 추가 오류:', error);
      Swal.fire({
        icon: 'error',
        title: '추가 실패',
        text: error.message || '사용자를 추가하는 중 오류가 발생했습니다.'
      });
    }
  }
});

// 5자리 랜덤 코드 생성
function generateRandomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// ==================== 데이터 관리 ====================

// 모든 데이터 불러오기
async function loadAllData() {
  try {
    const listContainer = document.getElementById('dataList');
    listContainer.innerHTML = '<p class="empty-message">데이터를 불러오는 중...</p>';

    const querySnapshot = await getDocs(collection(db, 'probingQuestions'));

    if (querySnapshot.empty) {
      listContainer.innerHTML = '<p class="empty-message">저장된 데이터가 없습니다.</p>';
      return;
    }

    // 사용자 정보 불러오기
    const usersSnapshot = await getDocs(collection(db, 'users'));
    const usersMap = new Map();
    usersSnapshot.forEach((doc) => {
      const userData = doc.data();
      if (userData.uid) {
        usersMap.set(userData.uid, {
          name: userData.name || '',
          affiliation: userData.affiliation || ''
        });
      }
    });

    allData = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const createdAt = data.createdAt?.toDate?.() || new Date();
      
      // endTime이 있는 데이터만 표시 (제출 완료된 데이터)
      if (!data.endTime) {
        return;
      }
      
      // 등록된 사용자 정보 가져오기
      const userInfo = usersMap.get(data.uid);
      let displayName = data.displayName || data.userName || '익명';
      let userName = '';
      let userAffiliation = '';
      if (userInfo && userInfo.name) {
        userName = userInfo.name;
        userAffiliation = userInfo.affiliation || '';
        displayName = `${userInfo.name}${userInfo.affiliation ? ` (${userInfo.affiliation})` : ''}`;
      }
      
      allData.push({
        id: docSnap.id,
        ...data,
        createdAt: createdAt,
        displayName: displayName,
        userName: userName,
        userAffiliation: userAffiliation
      });
    });

    // 최신순 정렬
    allData.sort((a, b) => b.createdAt - a.createdAt);

    updateUserFilter();
    renderDataList();
    
  } catch (error) {
    console.error('데이터 불러오기 오류:', error);
    document.getElementById('dataList').innerHTML = '<p class="empty-message">데이터를 불러오는 중 오류가 발생했습니다.</p>';
    Swal.fire({
      icon: 'error',
      title: '불러오기 실패',
      text: error.message || '데이터를 불러오는 중 오류가 발생했습니다.'
    });
  }
}

// 사용자 필터 업데이트
function updateUserFilter() {
  const filterSelect = document.getElementById('userFilter');
  if (!filterSelect) return;
  
  // 현재 선택된 시나리오 필터 값 가져오기
  const scenarioFilter = document.getElementById('scenarioFilter')?.value || '';
  
  // 시나리오 필터가 적용된 데이터만 사용
  let filteredDataForUsers = allData;
  if (scenarioFilter) {
    filteredDataForUsers = allData.filter(item => item.scenario === scenarioFilter);
  }
  
  const uniqueUsers = [...new Set(filteredDataForUsers.map(item => item.displayName || '익명'))];
  
  filterSelect.innerHTML = '<option value="">전체 사용자</option>';
  uniqueUsers.forEach(userName => {
    const option = document.createElement('option');
    option.value = userName;
    option.textContent = userName;
    filterSelect.appendChild(option);
  });
}

// 데이터 목록 렌더링
function renderDataList() {
  const listContainer = document.getElementById('dataList');
  const scenarioFilter = document.getElementById('scenarioFilter')?.value || '';
  const userFilter = document.getElementById('userFilter')?.value || '';
  
  // 시나리오 및 사용자 필터링
  let filteredData = allData;
  if (scenarioFilter) {
    filteredData = filteredData.filter(item => item.scenario === scenarioFilter);
  }
  if (userFilter) {
    filteredData = filteredData.filter(item => (item.displayName || '익명') === userFilter);
  }
  
  if (filteredData.length === 0) {
    listContainer.innerHTML = '<p class="empty-message">표시할 데이터가 없습니다.</p>';
    document.getElementById('dataDetail').innerHTML = `
      <div class="empty-detail">
        <p>좌측 목록에서 항목을 선택하세요</p>
      </div>
    `;
    return;
  }

  const listHTML = filteredData.map((item) => {
    const displayName = item.displayName || '익명';
    const userName = item.userName || item.displayName?.split(' (')[0] || '익명';
    const userAffiliation = item.userAffiliation || (item.displayName?.includes('(') ? item.displayName.split('(')[1].replace(')', '') : '');
    const studentType = item.studentType || '';
    const dateStr = item.createdAt.toLocaleString('ko-KR', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    
    const studentTypeLabel = studentType ? `학생 ${studentType}` : '';

    return `
      <div class="data-item ${selectedDataId === item.id ? 'active' : ''}" data-id="${item.id}">
        <div class="data-item-header">
          <span class="data-item-name">${userName}${userAffiliation ? ` (${userAffiliation})` : ''}${studentTypeLabel ? ` - ${studentTypeLabel}` : ''}</span>
          <span class="data-item-date">${dateStr}</span>
        </div>
        <div class="data-item-preview">탐침 질문 보기</div>
      </div>
    `;
  }).join('');

  listContainer.innerHTML = listHTML;

  // 클릭 이벤트 추가
  listContainer.querySelectorAll('.data-item').forEach(item => {
    item.addEventListener('click', () => {
      const itemId = item.getAttribute('data-id');
      selectDataItem(itemId);
    });
  });
}

// 데이터 항목 선택
function selectDataItem(itemId) {
  selectedDataId = itemId;
  const selectedData = allData.find(item => item.id === itemId);
  
  if (!selectedData) {
    return;
  }

  // 목록에서 active 클래스 업데이트
  document.querySelectorAll('.data-item').forEach(item => {
    if (item.getAttribute('data-id') === itemId) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // 상세 내용 렌더링
  renderDataDetail(selectedData);
}

// 데이터 상세 내용 렌더링
function renderDataDetail(data) {
  const detailContainer = document.getElementById('dataDetail');
  
  const displayName = data.displayName || '익명';
  const userName = data.userName || data.displayName?.split(' (')[0] || '익명';
  const userAffiliation = data.userAffiliation || (data.displayName?.includes('(') ? data.displayName.split('(')[1].replace(')', '') : '');
  const dateStr = data.createdAt.toLocaleString('ko-KR', { 
    year: 'numeric', 
    month: '2-digit', 
    day: '2-digit', 
    hour: '2-digit', 
    minute: '2-digit' 
  });
  const studentType = data.studentType || '';
  const scenario = data.scenario || '';
  const questions = data.questions || {};

  // 학생 타입 표시
  const studentTypeLabel = studentType ? `학생 ${studentType}` : '학생';
  
  // 시나리오 표시
  const scenarioLabel = scenario ? ` - ${scenario}` : '';

  // 과제별 내용 생성
  let questionsHTML = '';
  for (let i = 1; i <= 5; i++) {
    const questionData = questions[i];
    if (!questionData) continue;

    const questionText = questionData.text || '';
    const exampleAnswer = questionData.exampleAnswer || '';
    let studentAnswer = questionData.studentAnswer || '';
    const probingQuestions = questionData.probingQuestions || [];
    
    // 학생 답변에 이미지 추가 (시나리오별로)
    if (studentAnswer && scenario === '대피시뮬레이션') {
      if (i === 4 && studentType === 'A') {
        // 학생 A 문항 4 이미지
        studentAnswer = `<img src="public/probingQuestion/escape_plan_stdA_04.png" alt="학생 A 답변 이미지" class="student-answer-image" style="max-width: 100%; height: auto; margin-bottom: 1rem; border-radius: 6px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1); cursor: pointer;"><br>${studentAnswer}`;
      } else if (i === 3 && studentType === 'B') {
        // 학생 B 문항 3 이미지
        studentAnswer = `<img src="public/probingQuestion/escape_plan_stdB_03.png" alt="학생 B 답변 이미지" class="student-answer-image" style="max-width: 100%; height: auto; margin-bottom: 1rem; border-radius: 6px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1); cursor: pointer;"><br>${studentAnswer}`;
      } else if (i === 4 && studentType === 'B') {
        // 학생 B 문항 4 이미지
        studentAnswer = `<img src="public/probingQuestion/escape_plan_stdB_04.png" alt="학생 B 답변 이미지" class="student-answer-image" style="max-width: 100%; height: auto; margin-bottom: 1rem; border-radius: 6px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1); cursor: pointer;"><br>${studentAnswer}`;
      }
    } else if (studentAnswer && scenario === '건강불평등') {
      if (i === 3 && studentType === 'A') {
        // 학생 A 과제 3 이미지
        studentAnswer = `${studentAnswer}<br><img src="public/probingQuestion/health_inequality_stdA_03.png" alt="학생 A 답변 이미지" class="student-answer-image" style="max-width: 100%; height: auto; margin-top: 1rem; border-radius: 6px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1); cursor: pointer;">`;
      } else if (i === 3 && studentType === 'B') {
        // 학생 B 과제 3 이미지
        studentAnswer = `${studentAnswer}<br><img src="public/probingQuestion/health_inequality_stdB_03.png" alt="학생 B 답변 이미지" class="student-answer-image" style="max-width: 100%; height: auto; margin-top: 1rem; border-radius: 6px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1); cursor: pointer;">`;
      }
    }
    
    // 줄바꿈 처리
    studentAnswer = studentAnswer.replace(/\n/g, '<br>');

    // 탐침 질문 테이블 생성
    let probingTableHTML = '';
    if (probingQuestions.length > 0) {
      const probingRows = probingQuestions.map(item => {
        const situation = typeof item === 'object' && item.situation !== undefined 
          ? item.situation 
          : (Array.isArray(item) ? item[0] : '');
        const question = typeof item === 'object' && item.question !== undefined 
          ? item.question 
          : (Array.isArray(item) ? item[1] : '');
        
        return `
          <tr>
            <td class="situation-cell">${situation || '-'}</td>
            <td class="question-cell">${question || '-'}</td>
          </tr>
        `;
      }).join('');

      probingTableHTML = `
        <table class="probing-table">
          <thead>
            <tr>
              <th>상황</th>
              <th>탐침 질문</th>
            </tr>
          </thead>
          <tbody>
            ${probingRows}
          </tbody>
        </table>
      `;
    } else {
      probingTableHTML = '<p style="color: #6b7280; font-size: 0.875rem;">탐침 질문이 없습니다.</p>';
    }

    questionsHTML += `
      <div class="question-detail-section">
        <h3 style="margin-top: 0; color: #2563eb; margin-bottom: 1rem;">과제 ${i}</h3>
        <div class="question-content-section">
          <h4 style="margin-bottom: 0.75rem; color: #1f2937; font-size: 1rem;">과제 본문</h4>
          <div class="question-text-content" style="margin-bottom: 1.5rem; padding: 1rem; background: #f9fafb; border-radius: 6px; line-height: 1.8;">${questionText}</div>
          
          <h4 style="margin-bottom: 0.75rem; color: #1f2937; font-size: 1rem;">${studentTypeLabel} 응답</h4>
          <div class="student-answer-content" style="margin-bottom: 1.5rem; padding: 1rem; background: #f0f9ff; border: 1px solid #3b82f6; border-radius: 6px; line-height: 1.8;">${studentAnswer || '응답 없음'}</div>
          
          <h4 style="margin-bottom: 0.75rem; color: #1f2937; font-size: 1rem;">사용자가 입력한 탐침 질문</h4>
          <div class="probing-questions-content">
            ${probingTableHTML}
          </div>
        </div>
      </div>
    `;
  }

  // 전체 HTML 조합
  detailContainer.innerHTML = `
    <div class="detail-header" style="margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: flex-start;">
      <div>
        <h2 style="margin: 0 0 0.5rem 0; font-size: 1.5rem; color: #1f2937;">${userName}${userAffiliation ? ` (${userAffiliation})` : ''}님의 탐침 질문${scenarioLabel}</h2>
        <p style="margin: 0; color: #6b7280; font-size: 0.875rem;">${studentTypeLabel} | 작성일: ${dateStr}</p>
      </div>
      <div class="detail-actions">
        <button class="btn btn-danger" onclick="deleteDataItem('${data.id}')">삭제</button>
      </div>
    </div>
    <div class="questions-container">
      ${questionsHTML || '<p style="color: #6b7280;">과제 데이터가 없습니다.</p>'}
    </div>
  `;

  // 이미지 클릭 이벤트 추가
  detailContainer.querySelectorAll('img').forEach(img => {
    img.addEventListener('click', () => {
      const imgSrc = img.src;
      const imgAlt = img.alt || '이미지';
      
      Swal.fire({
        html: `<img src="${imgSrc}" alt="${imgAlt}" style="max-width: 90vw; max-height: 90vh; width: auto; height: auto; border-radius: 8px;">`,
        width: 'auto',
        padding: '1rem',
        showConfirmButton: false,
        showCloseButton: true,
        background: 'rgba(0, 0, 0, 0.9)',
        customClass: {
          popup: 'image-popup',
          closeButton: 'image-popup-close'
        }
      });
    });
  });
}

// 데이터 삭제 함수 (전역으로 등록)
window.deleteDataItem = async function(dataId) {
  const result = await Swal.fire({
    title: '데이터 삭제',
    text: '정말 이 데이터를 삭제하시겠습니까?',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: '삭제',
    cancelButtonText: '취소',
    confirmButtonColor: '#ef4444'
  });

  if (result.isConfirmed) {
    try {
      await deleteDoc(doc(db, 'probingQuestions', dataId));
      
      Swal.fire({
        icon: 'success',
        title: '삭제 완료',
        text: '데이터가 삭제되었습니다.',
        timer: 1500,
        showConfirmButton: false
      });

      // 데이터 목록 새로고침
      loadAllData();
      
      // 상세 내용 초기화
      document.getElementById('dataDetail').innerHTML = `
        <div class="empty-detail">
          <p>좌측 목록에서 항목을 선택하세요</p>
        </div>
      `;
      
    } catch (error) {
      console.error('데이터 삭제 오류:', error);
      Swal.fire({
        icon: 'error',
        title: '삭제 실패',
        text: error.message || '데이터를 삭제하는 중 오류가 발생했습니다.'
      });
    }
  }
};

// ==================== 메뉴 관리 ====================

// 메뉴 설정 불러오기
async function loadMenuSettings() {
  try {
    const settingsDoc = await getDoc(doc(db, 'menuSettings', 'main'));
    
    if (settingsDoc.exists()) {
      const data = settingsDoc.data();
      document.getElementById('mockEval01Toggle').checked = data.mockEval01 !== false;
      document.getElementById('mockEval02Toggle').checked = data.mockEval02 !== false;
      document.getElementById('probing01Toggle').checked = data.probing01 !== false;
      document.getElementById('probing02Toggle').checked = data.probing02 !== false;
      document.getElementById('activity2Toggle').checked = data.activity2 !== false;
      document.getElementById('qrCodeToggle').checked = data.qrCode !== false;
    } else {
      // 기본값: 모두 활성화
      document.getElementById('mockEval01Toggle').checked = true;
      document.getElementById('mockEval02Toggle').checked = true;
      document.getElementById('probing01Toggle').checked = true;
      document.getElementById('probing02Toggle').checked = true;
      document.getElementById('activity2Toggle').checked = true;
      document.getElementById('qrCodeToggle').checked = true;
    }

    // 토글 이벤트 추가
    document.getElementById('mockEval01Toggle').addEventListener('change', async (e) => {
      await saveMenuSettings('mockEval01', e.target.checked);
    });

    document.getElementById('mockEval02Toggle').addEventListener('change', async (e) => {
      await saveMenuSettings('mockEval02', e.target.checked);
    });

    document.getElementById('probing01Toggle').addEventListener('change', async (e) => {
      await saveMenuSettings('probing01', e.target.checked);
    });

    document.getElementById('probing02Toggle').addEventListener('change', async (e) => {
      await saveMenuSettings('probing02', e.target.checked);
    });

    document.getElementById('activity2Toggle').addEventListener('change', async (e) => {
      await saveMenuSettings('activity2', e.target.checked);
    });

    document.getElementById('qrCodeToggle').addEventListener('change', async (e) => {
      await saveMenuSettings('qrCode', e.target.checked);
    });
    
  } catch (error) {
    console.error('메뉴 설정 불러오기 오류:', error);
    Swal.fire({
      icon: 'error',
      title: '설정 불러오기 실패',
      text: '메뉴 설정을 불러오는 중 오류가 발생했습니다.'
    });
  }
}

// 메뉴 설정 저장
async function saveMenuSettings(key, value) {
  try {
    const settingsDoc = await getDoc(doc(db, 'menuSettings', 'main'));
    const currentData = settingsDoc.exists() ? settingsDoc.data() : {};
    
    await setDoc(doc(db, 'menuSettings', 'main'), {
      ...currentData,
      [key]: value,
      updatedAt: serverTimestamp()
    }, { merge: true });

    Swal.fire({
      icon: 'success',
      title: '설정 저장 완료',
      text: '메뉴 설정이 저장되었습니다.',
      timer: 1500,
      showConfirmButton: false
    });
    
  } catch (error) {
    console.error('메뉴 설정 저장 오류:', error);
    Swal.fire({
      icon: 'error',
      title: '설정 저장 실패',
      text: error.message || '메뉴 설정을 저장하는 중 오류가 발생했습니다.'
    });
    
    // 원래 상태로 되돌리기
    document.getElementById(`${key}Toggle`).checked = !value;
  }
}

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  
  // 시나리오 필터 변경 이벤트 등록
  const scenarioFilter = document.getElementById('scenarioFilter');
  if (scenarioFilter) {
    scenarioFilter.addEventListener('change', () => {
      // 사용자 필터 선택값 초기화
      const userFilter = document.getElementById('userFilter');
      if (userFilter) {
        userFilter.value = '';
      }
      updateUserFilter(); // 사용자 필터 업데이트 (시나리오에 맞는 사용자만 표시)
      renderDataList();
      // 필터 변경 시 상세 내용 초기화
      document.getElementById('dataDetail').innerHTML = `
        <div class="empty-detail">
          <p>좌측 목록에서 항목을 선택하세요</p>
        </div>
      `;
      selectedDataId = null;
    });
  }
  
  // 사용자 필터 변경 이벤트 등록
  const userFilter = document.getElementById('userFilter');
  if (userFilter) {
    userFilter.addEventListener('change', () => {
      renderDataList();
      // 필터 변경 시 상세 내용 초기화
      document.getElementById('dataDetail').innerHTML = `
        <div class="empty-detail">
          <p>좌측 목록에서 항목을 선택하세요</p>
        </div>
      `;
      selectedDataId = null;
    });
  }
});

