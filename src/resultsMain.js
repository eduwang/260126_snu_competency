import { auth, db, isAdmin } from './firebaseConfig.js';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, getDocs, doc, getDoc, query, where } from 'firebase/firestore';
import Swal from 'sweetalert2';

let currentUser = null;
let allData = [];
let processedData = []; // 탐침 질문을 사용자별로 그룹화한 데이터

// 필터 상태
let selectedScenario = '대피시뮬레이션'; // 기본값을 대피시뮬레이션으로 설정
let selectedStudentType = 'A'; // 기본값을 학생 A로 설정
let selectedQuestion = 'all';

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
    
    // 사용자 정보 표시
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
    await loadAllData();
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
    // 모든 데이터 가져오기
    const querySnapshot = await getDocs(collection(db, 'probingQuestions'));

    if (querySnapshot.empty) {
      allData = [];
      processedData = [];
      initScenarioTabs();
      renderResults();
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
        displayName: displayName,
        affiliation: userInfo?.affiliation || ''
      });
    });

    // 클라이언트 측에서 최신순 정렬
    allData.sort((a, b) => b.createdAt - a.createdAt);

    // 데이터 처리: 탐침 질문을 사용자별로 그룹화
    processData();
    
    // 시나리오 탭 초기화
    initScenarioTabs();
    
    // 필터 이벤트 리스너 설정
    setupFilterListeners();
    
    // 결과 렌더링
    renderResults();
    
  } catch (error) {
    console.error('데이터 불러오기 오류:', error);
    Swal.fire({
      icon: 'error',
      title: '불러오기 실패',
      text: error.message || '데이터를 불러오는 중 오류가 발생했습니다.'
    });
  }
}

// 데이터 처리: 탐침 질문을 사용자별로 그룹화
function processData() {
  processedData = [];
  
  // 구조: processedData[scenario][studentType][questionNumber][userId] = [probingQuestions...]
  
  allData.forEach(data => {
    const scenario = data.scenario || '기타';
    const studentType = data.studentType || '';
    const questions = data.questions || {};
    const userId = data.uid || data.id;
    const displayName = data.displayName || '익명';
    const affiliation = data.affiliation || '';
    const createdAt = data.createdAt;
    
    // 각 문항별로 처리
    for (let questionNum = 1; questionNum <= 5; questionNum++) {
      const questionData = questions[questionNum];
      if (!questionData || !questionData.probingQuestions || questionData.probingQuestions.length === 0) {
        continue;
      }
      
      // 탐침 질문 배열 처리
      questionData.probingQuestions.forEach((probingItem, index) => {
        const situation = typeof probingItem === 'object' && probingItem.situation !== undefined 
          ? probingItem.situation 
          : (Array.isArray(probingItem) ? probingItem[0] : '');
        const question = typeof probingItem === 'object' && probingItem.question !== undefined 
          ? probingItem.question 
          : (Array.isArray(probingItem) ? probingItem[1] : '');
        
        if (!situation && !question) {
          return;
        }
        
        // 데이터 구조 생성
        if (!processedData.find(d => d.scenario === scenario && d.studentType === studentType && d.questionNum === questionNum)) {
          processedData.push({
            scenario: scenario,
            studentType: studentType,
            questionNum: questionNum,
            questionText: questionData.text || '',
            exampleAnswer: questionData.exampleAnswer || '',
            studentAnswer: questionData.studentAnswer || '',
            users: []
          });
        }
        
        const dataEntry = processedData.find(d => 
          d.scenario === scenario && 
          d.studentType === studentType && 
          d.questionNum === questionNum
        );
        
        // 사용자별 그룹화
        let userEntry = dataEntry.users.find(u => u.userId === userId);
        if (!userEntry) {
          userEntry = {
            userId: userId,
            displayName: displayName,
            affiliation: affiliation,
            probingQuestions: []
          };
          dataEntry.users.push(userEntry);
        }
        
        // 탐침 질문 추가 (시간 정보 포함)
        userEntry.probingQuestions.push({
          situation: situation,
          question: question,
          createdAt: createdAt,
          order: index // 같은 시간에 여러 개가 있을 경우 순서 보존
        });
      });
    }
  });
  
  // 각 사용자의 탐침 질문을 시간 내림차순으로 정렬
  processedData.forEach(dataEntry => {
    dataEntry.users.forEach(userEntry => {
      userEntry.probingQuestions.sort((a, b) => {
        if (b.createdAt.getTime() !== a.createdAt.getTime()) {
          return b.createdAt.getTime() - a.createdAt.getTime();
        }
        return b.order - a.order;
      });
    });
  });
}

// 시나리오 탭 초기화
function initScenarioTabs() {
  const scenarioTabs = document.getElementById('scenarioTabs');
  // 고정된 시나리오 순서: 대피시뮬레이션, 건강불평등
  const fixedScenarios = ['대피시뮬레이션', '건강불평등'];
  
  // 데이터에 실제로 존재하는 시나리오만 필터링
  const availableScenarios = fixedScenarios.filter(scenario => 
    allData.some(item => item.scenario === scenario)
  );
  
  // 사용 가능한 시나리오가 없으면 기본값으로 고정 시나리오 사용
  const scenarios = availableScenarios.length > 0 ? availableScenarios : fixedScenarios;
  
  scenarioTabs.innerHTML = scenarios.map(scenario => {
    return `<button class="tab-btn ${selectedScenario === scenario ? 'active' : ''}" 
                    data-scenario="${scenario}">${scenario}</button>`;
  }).join('');
  
  // 기본 선택이 없고 데이터가 있으면 첫 번째 시나리오 선택
  if (scenarios.length > 0 && !scenarios.includes(selectedScenario)) {
    selectedScenario = scenarios[0];
    // active 클래스 업데이트
    const firstBtn = scenarioTabs.querySelector('.tab-btn');
    if (firstBtn) {
      firstBtn.classList.add('active');
    }
  }
  
  // 이벤트 리스너는 setupFilterListeners에서 설정
}

// 필터 이벤트 리스너 설정
function setupFilterListeners() {
  // 시나리오 탭
  document.getElementById('scenarioTabs').addEventListener('click', (e) => {
    if (e.target.classList.contains('tab-btn')) {
      selectedScenario = e.target.getAttribute('data-scenario');
      updateActiveTab('scenarioTabs', e.target);
      renderResults();
    }
  });
  
  // 학생 타입 탭
  document.getElementById('studentTypeTabs').addEventListener('click', (e) => {
    if (e.target.classList.contains('tab-btn')) {
      selectedStudentType = e.target.getAttribute('data-student-type');
      updateActiveTab('studentTypeTabs', e.target);
      renderResults();
    }
  });
  
  // 문항 탭
  document.getElementById('questionTabs').addEventListener('click', (e) => {
    if (e.target.classList.contains('tab-btn')) {
      selectedQuestion = e.target.getAttribute('data-question');
      updateActiveTab('questionTabs', e.target);
      renderResults();
    }
  });
}

// 활성 탭 업데이트
function updateActiveTab(containerId, activeBtn) {
  const container = document.getElementById(containerId);
  container.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  activeBtn.classList.add('active');
}

// 결과 렌더링
function renderResults() {
  const resultsContent = document.getElementById('resultsContent');
  
  // 필터링된 데이터 가져오기
  const filteredData = getFilteredData();
  
  if (filteredData.length === 0) {
    resultsContent.innerHTML = `
      <div class="empty-state">
        <p>선택한 필터 조건에 해당하는 데이터가 없습니다.</p>
      </div>
    `;
    return;
  }
  
  // 문항별로 그룹화
  const questionsByNumber = {};
  filteredData.forEach(data => {
    const qNum = data.questionNum;
    if (!questionsByNumber[qNum]) {
      questionsByNumber[qNum] = [];
    }
    questionsByNumber[qNum].push(data);
  });
  
  // 문항 번호 순서대로 정렬
  const questionNumbers = Object.keys(questionsByNumber).sort((a, b) => parseInt(a) - parseInt(b));
  
  let html = '';
  
  questionNumbers.forEach(qNum => {
    const questionData = questionsByNumber[qNum][0]; // 같은 문항이므로 첫 번째 데이터 사용
    html += renderQuestionSection(qNum, questionData, questionsByNumber[qNum]);
  });
  
  resultsContent.innerHTML = html;
  
  // 이미지 클릭 이벤트 추가
  resultsContent.querySelectorAll('img').forEach(img => {
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

// 필터링된 데이터 가져오기
function getFilteredData() {
  return processedData.filter(data => {
    // 시나리오 필터 (전체 옵션이 없으므로 항상 필터링)
    if (data.scenario !== selectedScenario) {
      return false;
    }
    
    // 학생 타입 필터 (전체 옵션이 없으므로 항상 필터링)
    if (data.studentType !== selectedStudentType) {
      return false;
    }
    
    // 문항 필터
    if (selectedQuestion !== 'all' && data.questionNum.toString() !== selectedQuestion) {
      return false;
    }
    
    return true;
  });
}

// 문항 섹션 렌더링
function renderQuestionSection(questionNum, questionData, allQuestionData) {
  const scenario = questionData.scenario || '';
  const studentType = questionData.studentType || '';
  const questionText = questionData.questionText || '';
  let studentAnswer = questionData.studentAnswer || '';
  
  // 학생 답변에 이미지 추가 (시나리오별로)
  if (studentAnswer && scenario === '대피시뮬레이션') {
    if (questionNum === 4 && studentType === 'A') {
      studentAnswer = `<img src="probingQuestion/escape_plan_stdA_04.png" alt="학생 A 답변 이미지" class="student-answer-image" style="max-width: 100%; height: auto; margin-bottom: 1rem; border-radius: 6px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1); cursor: pointer;"><br>${studentAnswer}`;
    } else if (questionNum === 3 && studentType === 'B') {
      studentAnswer = `<img src="probingQuestion/escape_plan_stdB_03.png" alt="학생 B 답변 이미지" class="student-answer-image" style="max-width: 100%; height: auto; margin-bottom: 1rem; border-radius: 6px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1); cursor: pointer;"><br>${studentAnswer}`;
    } else if (questionNum === 4 && studentType === 'B') {
      studentAnswer = `<img src="probingQuestion/escape_plan_stdB_04.png" alt="학생 B 답변 이미지" class="student-answer-image" style="max-width: 100%; height: auto; margin-bottom: 1rem; border-radius: 6px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1); cursor: pointer;"><br>${studentAnswer}`;
    }
  } else if (studentAnswer && scenario === '건강불평등') {
    if (questionNum === 3 && studentType === 'A') {
      studentAnswer = `${studentAnswer}<br><img src="probingQuestion/health_inequality_stdA_03.png" alt="학생 A 답변 이미지" class="student-answer-image" style="max-width: 100%; height: auto; margin-top: 1rem; border-radius: 6px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1); cursor: pointer;">`;
    } else if (questionNum === 3 && studentType === 'B') {
      studentAnswer = `${studentAnswer}<br><img src="probingQuestion/health_inequality_stdB_03.png" alt="학생 B 답변 이미지" class="student-answer-image" style="max-width: 100%; height: auto; margin-top: 1rem; border-radius: 6px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1); cursor: pointer;">`;
    }
  }
  
  // 줄바꿈 처리
  studentAnswer = studentAnswer.replace(/\n/g, '<br>');
  
  // 모든 사용자의 탐침 질문 수집
  const allUsers = [];
  allQuestionData.forEach(data => {
    data.users.forEach(user => {
      // 같은 사용자가 여러 데이터에 있을 수 있으므로 병합
      let existingUser = allUsers.find(u => u.userId === user.userId);
      if (!existingUser) {
        existingUser = {
          userId: user.userId,
          displayName: user.displayName,
          affiliation: user.affiliation,
          probingQuestions: []
        };
        allUsers.push(existingUser);
      }
      existingUser.probingQuestions.push(...user.probingQuestions);
    });
  });
  
  // 각 사용자의 탐침 질문을 시간 내림차순으로 정렬
  allUsers.forEach(user => {
    user.probingQuestions.sort((a, b) => {
      if (b.createdAt.getTime() !== a.createdAt.getTime()) {
        return b.createdAt.getTime() - a.createdAt.getTime();
      }
      return b.order - a.order;
    });
  });
  
  // 사용자별 탐침 질문 렌더링
  let usersHTML = '';
  if (allUsers.length === 0) {
    usersHTML = '<p class="no-probing-message">탐침 질문이 없습니다.</p>';
  } else {
    allUsers.forEach(user => {
      usersHTML += renderUserProbingGroup(user);
    });
  }
  
  const studentTypeLabel = studentType ? `학생 ${studentType}` : '학생';
  const scenarioLabel = scenario ? ` - ${scenario}` : '';
  
  return `
    <div class="question-section">
      <div class="question-header">
        <h2 class="question-title">과제 ${questionNum}${scenarioLabel}</h2>
        <div class="question-meta">${studentTypeLabel}</div>
      </div>
      
      <div class="question-text-box">
        ${questionText}
      </div>
      
      <div class="student-answer-box">
        ${studentAnswer || '응답 없음'}
      </div>
      
      <h3 style="margin-bottom: 1rem; color: #1f2937; font-size: 1.125rem;">탐침 질문</h3>
      
      ${usersHTML}
    </div>
  `;
}

// 사용자별 탐침 질문 그룹 렌더링
function renderUserProbingGroup(user) {
  if (!user.probingQuestions || user.probingQuestions.length === 0) {
    return '';
  }
  
  let probingItemsHTML = '';
  
  user.probingQuestions.forEach((probing, index) => {
    const timeStr = probing.createdAt.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    
    probingItemsHTML += `
      <div class="probing-item">
        <div class="probing-time">${timeStr}</div>
        <table class="probing-table">
          <tbody>
            <tr>
              <th class="situation-cell">상황 분석</th>
              <td class="question-cell">${probing.situation || '-'}</td>
            </tr>
            <tr>
              <th class="situation-cell">탐침 질문</th>
              <td class="question-cell">${probing.question || '-'}</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  });
  
  return `
    <div class="user-probing-group">
      <div class="user-probing-header">
        <div>
          <span class="user-name">${user.displayName}</span>
          ${user.affiliation ? `<span class="user-affiliation">(${user.affiliation})</span>` : ''}
        </div>
        <div style="font-size: 0.875rem; color: #6b7280;">
          총 ${user.probingQuestions.length}개
        </div>
      </div>
      <div class="user-probing-content">
        ${probingItemsHTML}
      </div>
    </div>
  `;
}

