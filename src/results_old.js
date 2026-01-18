import { auth, db, isAdmin } from './firebaseConfig.js';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, getDocs, doc, getDoc, query, where } from 'firebase/firestore';
import Swal from 'sweetalert2';

let currentUser = null;
let allData = [];
let selectedDataId = null;
let selectedScenario = 'all'; // 'all', '대피시뮬레이션', '건강불평등'

// 메뉴 설정 확인 함수
async function checkMenuAccess(user) {
  // 관리자는 항상 접근 가능
  const userIsAdmin = await isAdmin(user.uid);
  if (userIsAdmin) {
    return true;
  }

  try {
    const settingsDoc = await getDoc(doc(db, 'menuSettings', 'main'));
    
    if (settingsDoc.exists()) {
      const data = settingsDoc.data();
      
      // 활동 2가 off인 경우 접근 차단
      if (data.activity2 === false) {
        Swal.fire({
          icon: 'error',
          title: '접근 불가',
          text: '이 페이지는 현재 비활성화되어 있습니다.',
          confirmButtonText: '확인'
        }).then(() => {
          window.location.href = '/index.html';
        });
        return false;
      }
    }
    
    return true;
  } catch (error) {
    console.error('메뉴 설정 확인 오류:', error);
    // 오류 발생 시 접근 허용 (기본값)
    return true;
  }
}

// 인증 상태 확인
onAuthStateChanged(auth, async (user) => {
  if (user) {
    // 메뉴 접근 권한 확인
    const hasAccess = await checkMenuAccess(user);
    if (!hasAccess) {
      return;
    }

    currentUser = user;
    
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
    loadAllData();
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

// 모든 데이터 불러오기
async function loadAllData() {
  try {
    const listContainer = document.getElementById('dataList');
    listContainer.innerHTML = '<p class="empty-message">데이터를 불러오는 중...</p>';

    // 모든 데이터 가져오기
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
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const createdAt = data.createdAt?.toDate?.() || new Date();
      
      // endTime이 있는 데이터만 표시 (제출 완료된 데이터)
      if (!data.endTime) {
        return;
      }
      
      // 등록된 사용자 정보 가져오기
      const userInfo = usersMap.get(data.uid);
      let displayName = data.displayName || data.userName || '익명';
      if (userInfo && userInfo.name) {
        displayName = `${userInfo.name}${userInfo.affiliation ? ` (${userInfo.affiliation})` : ''}`;
      }
      
      allData.push({
        id: doc.id,
        ...data,
        createdAt: createdAt,
        displayName: displayName
      });
    });

    // 클라이언트 측에서 최신순 정렬
    allData.sort((a, b) => b.createdAt - a.createdAt);

    // 시나리오 필터 추가
    initScenarioFilter();
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

// 시나리오 필터 초기화
function initScenarioFilter() {
  const listTitle = document.querySelector('.list-title');
  if (!listTitle) return;

  // 기존 필터가 있으면 제거
  const existingFilter = listTitle.querySelector('.scenario-filter');
  if (existingFilter) {
    existingFilter.remove();
  }

  // 시나리오 목록 추출
  const scenarios = ['all', ...new Set(allData.map(item => item.scenario).filter(Boolean))];
  
  const filterHTML = `
    <div class="scenario-filter" style="margin-top: 1rem; display: flex; gap: 0.5rem; flex-wrap: wrap;">
      ${scenarios.map(scenario => {
        const label = scenario === 'all' ? '전체' : scenario;
        return `<button class="scenario-filter-btn ${selectedScenario === scenario ? 'active' : ''}" 
                        data-scenario="${scenario}"
                        style="padding: 0.5rem 1rem; border: 1px solid #e5e7eb; border-radius: 6px; background: ${selectedScenario === scenario ? '#2563eb' : 'white'}; color: ${selectedScenario === scenario ? 'white' : '#374151'}; cursor: pointer; font-size: 0.875rem; transition: all 0.2s;">
                ${label}
              </button>`;
      }).join('')}
    </div>
  `;
  
  listTitle.insertAdjacentHTML('afterend', filterHTML);

  // 필터 버튼 이벤트
  document.querySelectorAll('.scenario-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedScenario = btn.getAttribute('data-scenario');
      document.querySelectorAll('.scenario-filter-btn').forEach(b => {
        b.classList.remove('active');
        b.style.background = 'white';
        b.style.color = '#374151';
      });
      btn.classList.add('active');
      btn.style.background = '#2563eb';
      btn.style.color = 'white';
      renderDataList();
    });
  });
}

// 데이터 목록 렌더링
function renderDataList() {
  const listContainer = document.getElementById('dataList');
  
  // 시나리오 필터링
  let filteredData = allData;
  if (selectedScenario !== 'all') {
    filteredData = allData.filter(item => item.scenario === selectedScenario);
  }
  
  if (filteredData.length === 0) {
    listContainer.innerHTML = '<p class="empty-message">저장된 데이터가 없습니다.</p>';
    return;
  }

  const listHTML = filteredData.map((item, index) => {
    const displayName = item.displayName || '익명';
    const dateStr = item.createdAt.toLocaleString('ko-KR', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    const studentType = item.studentType || '';
    const scenario = item.scenario || '';
    
    // 학생 타입 표시
    const studentTypeLabel = studentType ? ` (학생 ${studentType})` : '';
    
    // 시나리오 표시
    const scenarioLabel = scenario ? ` [${scenario}]` : '';

    return `
      <div class="data-list-item ${selectedDataId === item.id ? 'active' : ''}" data-id="${item.id}">
        <div class="item-header">
          <span class="item-name">${displayName}${studentTypeLabel}${scenarioLabel}</span>
          <span class="item-date">${dateStr}</span>
        </div>
        <div class="item-preview">과제별 탐침 질문 보기</div>
      </div>
    `;
  }).join('');

  listContainer.innerHTML = listHTML;

  // 클릭 이벤트 추가
  listContainer.querySelectorAll('.data-list-item').forEach(item => {
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
  document.querySelectorAll('.data-list-item').forEach(item => {
    if (item.getAttribute('data-id') === itemId) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // 상세 내용 렌더링
  renderDetailContent(selectedData);
}

// 상세 내용 렌더링
function renderDetailContent(data) {
  const detailContainer = document.getElementById('detailContent');
  
  const displayName = data.displayName || '익명';
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
    <div class="detail-header" style="margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 1px solid #e5e7eb;">
      <h2 style="margin: 0 0 0.5rem 0; font-size: 1.5rem; color: #1f2937;">${displayName}님의 탐침 질문${scenarioLabel}</h2>
      <p style="margin: 0; color: #6b7280; font-size: 0.875rem;">${studentTypeLabel} | 작성일: ${dateStr}</p>
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
