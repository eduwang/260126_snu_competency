import { auth, db, isAdmin } from './firebaseConfig.js';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, addDoc, serverTimestamp, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import Swal from 'sweetalert2';
import Handsontable from 'handsontable';
import 'handsontable/dist/handsontable.full.min.css';

let currentUser = null;
let conversationTable = null;
let probingQuestionsTable = null;
let lastSelectedRow_conv = null; // 마지막으로 선택된 행 (대화 테이블)
let lastSelectedRow_prob = null; // 마지막으로 선택된 행 (탐침질문 테이블)

// Handsontable 초기화
function initTables() {
  // 면접관-학생 대화 테이블
  const conversationContainer = document.getElementById('conversation-table');
  conversationTable = new Handsontable(conversationContainer, {
    data: [['면접관', ''], ['학생', '']],
    colHeaders: ['발화자', '대화 내용'],
    rowHeaders: true,
    contextMenu: true,
    colWidths: [120, 400],
    minRows: 2,
    minCols: 2,
    licenseKey: 'non-commercial-and-evaluation',
    width: '100%',
    height: 400,
    stretchH: 'all',
    manualRowResize: true,
    manualColumnResize: true,
    autoWrapRow: true,
    autoWrapCol: true,
    autoRowSize: true,
    outsideClickDeselects: false,
    selectionMode: 'single', // 단일 선택 모드
    afterSelection: function(row, col, row2, col2) {
      // 행 선택 추적
      lastSelectedRow_conv = row;
      console.log('대화 테이블 행 선택됨:', row);
    },
    columns: [
      { 
        data: 0, 
        className: 'htCenter',
        type: 'dropdown',
        source: ['면접관', '학생']
      },
      { 
        data: 1, 
        className: 'htLeft'
      }
    ]
  });

  // 탐침질문 테이블
  const probingContainer = document.getElementById('probing-questions-table');
  probingQuestionsTable = new Handsontable(probingContainer, {
    data: [['', '']],
    colHeaders: ['상황', '탐침질문'],
    rowHeaders: true,
    contextMenu: true,
    colWidths: [200, 300],
    minRows: 1,
    minCols: 2,
    licenseKey: 'non-commercial-and-evaluation',
    width: '100%',
    height: 300,
    stretchH: 'all',
    manualRowResize: true,
    manualColumnResize: true,
    autoWrapRow: true,
    autoWrapCol: true,
    autoRowSize: true,
    outsideClickDeselects: false,
    selectionMode: 'single', // 단일 선택 모드
    afterSelection: function(row, col, row2, col2) {
      // 행 선택 추적
      lastSelectedRow_prob = row;
      console.log('탐침질문 테이블 행 선택됨:', row);
    },
    columns: [
      { 
        data: 0, 
        className: 'htLeft'
      },
      { 
        data: 1, 
        className: 'htLeft'
      }
    ]
  });
}

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
    document.getElementById('userInfo').textContent = `👤 ${user.displayName || user.email} 님`;
    document.getElementById('logoutBtn').style.display = 'inline-block';
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

// 메인으로 돌아가기 버튼 (DOMContentLoaded 전에 실행 가능하도록)
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

// 제출 버튼
document.getElementById('submitBtn').addEventListener('click', async () => {
  if (!currentUser) {
    Swal.fire({
      icon: 'warning',
      title: '로그인 필요',
      text: '로그인이 필요합니다.'
    });
    return;
  }

  // 데이터 수집
  const conversationData = conversationTable.getData();
  const probingQuestionsData = probingQuestionsTable.getData();
  const studentCharacteristics = document.getElementById('studentCharacteristics').value.trim();

  // 대화 데이터 정리 (빈 행 제거)
  const conversation = [];
  conversationData.forEach(row => {
    if (row[0]?.trim() && row[1]?.trim()) {
      conversation.push({
        speaker: row[0].trim(),
        message: row[1].trim()
      });
    }
  });

  // 탐침질문 데이터 정리 (빈 행 제거)
  const probingQuestions = [];
  probingQuestionsData.forEach(row => {
    if (row[0]?.trim() || row[1]?.trim()) {
      probingQuestions.push({
        situation: row[0]?.trim() || '',
        question: row[1]?.trim() || ''
      });
    }
  });

  // 유효성 검사
  if (conversation.length === 0) {
    Swal.fire({
      icon: 'warning',
      title: '대화 입력 필요',
      text: '면접관과 학생의 대화를 입력해주세요.'
    });
    return;
  }

  // 탐침질문 유효성 검사 (상황 또는 탐침질문 중 하나라도 입력되어야 함)
  const validProbingQuestions = probingQuestions.filter(q => q.situation.trim() || q.question.trim());
  if (validProbingQuestions.length === 0) {
    Swal.fire({
      icon: 'warning',
      title: '탐침질문 입력 필요',
      text: '상황 또는 탐침질문을 최소 1개 이상 입력해주세요.'
    });
    return;
  }

  // 제출 확인
  const confirmResult = await Swal.fire({
    title: '제출하시겠습니까?',
    text: '입력한 내용이 저장되어 공유됩니다.',
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: '제출',
    cancelButtonText: '취소'
  });

  if (!confirmResult.isConfirmed) {
    return;
  }

  // 로딩 표시
  Swal.fire({
    title: '제출 중...',
    allowOutsideClick: false,
    didOpen: () => {
      Swal.showLoading();
    }
  });

  try {
    // Firestore에 저장
    const docRef = await addDoc(collection(db, 'probingQuestions'), {
      uid: currentUser.uid,
      displayName: currentUser.displayName || '',
      email: currentUser.email || '',
      createdAt: serverTimestamp(),
      conversation: conversation,
      probingQuestions: probingQuestions,
      studentCharacteristics: studentCharacteristics || ''
    });

    console.log('✅ 저장 완료:', docRef.id);

    Swal.fire({
      icon: 'success',
      title: '제출 완료',
      text: '탐침질문이 성공적으로 저장되었습니다!',
      confirmButtonText: '확인'
    }).then(() => {
      // 폼 초기화
      conversationTable.loadData([['면접관', ''], ['학생', '']]);
      probingQuestionsTable.loadData([['', '']]);
      document.getElementById('studentCharacteristics').value = '';
    });

  } catch (error) {
    console.error('❌ 저장 실패:', error);
    Swal.fire({
      icon: 'error',
      title: '제출 실패',
      text: error.message || '데이터 저장 중 오류가 발생했습니다.'
    });
  }
});

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

// 행 추가/삭제 버튼 이벤트
function initRowControls() {
  console.log('행 제어 버튼 초기화 시작');
  
  const addConvBtn = document.getElementById('add-conversation-row');
  const delConvBtn = document.getElementById('del-conversation-row');
  const addProbingBtn = document.getElementById('add-probing-row');
  const delProbingBtn = document.getElementById('del-probing-row');
  
  if (!addConvBtn || !delConvBtn || !addProbingBtn || !delProbingBtn) {
    console.error('행 제어 버튼을 찾을 수 없습니다:', {
      addConvBtn: !!addConvBtn,
      delConvBtn: !!delConvBtn,
      addProbingBtn: !!addProbingBtn,
      delProbingBtn: !!delProbingBtn
    });
    return;
  }
  
  console.log('모든 버튼 찾음, 이벤트 리스너 등록 시작');
  
  // 대화 테이블 행 추가
  addConvBtn.addEventListener('click', () => {
    try {
      conversationTable.alter('insert_row', conversationTable.countRows(), 1);
    } catch (e) {
      try {
        conversationTable.alter('insert_row_below', conversationTable.countRows() - 1, 1);
      } catch (e2) {
        Swal.fire({
          icon: 'error',
          title: '오류',
          text: 'Handsontable 버전 호환 문제가 있습니다.'
        });
      }
    }
  });

  // 대화 테이블 행 삭제
  delConvBtn.addEventListener('click', () => {
    console.log('행 삭제 버튼 클릭됨');
    
    // 여러 방법으로 선택 확인
    const sel = conversationTable.getSelected();
    const selLast = conversationTable.getSelectedLast();
    const selRange = conversationTable.getSelectedRange();
    const activeEditor = conversationTable.getActiveEditor();
    const activeCell = conversationTable.getSelectedLast();
    
    console.log('getSelected():', sel);
    console.log('getSelectedLast():', selLast);
    console.log('getSelectedRange():', selRange);
    console.log('getActiveEditor():', activeEditor);
    
    let selectedRow = null;
    
    // 방법 1: getSelected() 사용
    if (sel && Array.isArray(sel) && sel.length > 0) {
      selectedRow = sel[0][0];
    }
    // 방법 2: getSelectedLast() 사용
    else if (selLast && Array.isArray(selLast) && selLast.length > 0) {
      selectedRow = selLast[0];
    }
    // 방법 3: getSelectedRange() 사용
    else if (selRange) {
      selectedRow = selRange.from.row;
    }
    // 방법 4: 현재 활성 셀의 행 번호 사용 (마지막 편집 위치)
    else if (activeCell && Array.isArray(activeCell) && activeCell.length > 0) {
      selectedRow = activeCell[0];
    }
    // 방법 5: 마지막으로 선택된 행 사용 (afterSelection 이벤트로 추적)
    else if (lastSelectedRow_conv !== null && lastSelectedRow_conv !== undefined) {
      selectedRow = lastSelectedRow_conv;
      console.log('마지막 선택된 행 사용:', selectedRow);
    }
    
    // 방법 6: 사용자에게 행 번호 입력받기 (최후의 수단)
    if (selectedRow === null || selectedRow === undefined) {
      Swal.fire({
        title: '삭제할 행 선택',
        text: '삭제할 행 번호를 입력하거나, 테이블에서 행을 클릭한 후 다시 시도해주세요.',
        input: 'number',
        inputPlaceholder: '행 번호 (0부터 시작)',
        showCancelButton: true,
        confirmButtonText: '삭제',
        cancelButtonText: '취소',
        inputValidator: (value) => {
          if (!value) {
            return '행 번호를 입력해주세요';
          }
          const rowNum = parseInt(value);
          if (isNaN(rowNum) || rowNum < 0 || rowNum >= conversationTable.countRows()) {
            return '유효한 행 번호를 입력해주세요';
          }
          return null;
        }
      }).then((result) => {
        if (result.isConfirmed) {
          selectedRow = parseInt(result.value);
          deleteRow(conversationTable, selectedRow, 2);
        }
      });
      return;
    }
    
    console.log('최종 선택된 행:', selectedRow);
    deleteRow(conversationTable, selectedRow, 2);
  });
  
  // 행 삭제 헬퍼 함수
  function deleteRow(table, rowIndex, minRows) {
    console.log('선택된 행 인덱스:', rowIndex);
    console.log('현재 행 개수:', table.countRows());
    
    // 최소 행 수 확인
    if (table.countRows() <= minRows) {
      Swal.fire({
        icon: 'warning',
        title: '알림',
        text: `최소 ${minRows}개의 행이 필요합니다.`
      });
      return;
    }
    
    try {
      console.log('행 삭제 시도:', rowIndex);
      table.alter('remove_row', rowIndex);
      console.log('행 삭제 완료');
    } catch (error) {
      console.error('행 삭제 오류:', error);
      Swal.fire({
        icon: 'error',
        title: '삭제 실패',
        text: '행을 삭제하는 중 오류가 발생했습니다: ' + error.message
      });
    }
  }

  // 탐침질문 테이블 행 추가
  addProbingBtn.addEventListener('click', () => {
    try {
      probingQuestionsTable.alter('insert_row', probingQuestionsTable.countRows(), 1);
    } catch (e) {
      try {
        probingQuestionsTable.alter('insert_row_below', probingQuestionsTable.countRows() - 1, 1);
      } catch (e2) {
        Swal.fire({
          icon: 'error',
          title: '오류',
          text: 'Handsontable 버전 호환 문제가 있습니다.'
        });
      }
    }
  });

  // 탐침질문 테이블 행 삭제
  delProbingBtn.addEventListener('click', () => {
    console.log('탐침질문 행 삭제 버튼 클릭됨');
    
    // 여러 방법으로 선택 확인
    const sel = probingQuestionsTable.getSelected();
    const selLast = probingQuestionsTable.getSelectedLast();
    const selRange = probingQuestionsTable.getSelectedRange();
    const activeEditor = probingQuestionsTable.getActiveEditor();
    const activeCell = probingQuestionsTable.getSelectedLast();
    
    console.log('getSelected():', sel);
    console.log('getSelectedLast():', selLast);
    console.log('getSelectedRange():', selRange);
    console.log('getActiveEditor():', activeEditor);
    
    let selectedRow = null;
    
    // 방법 1: getSelected() 사용
    if (sel && Array.isArray(sel) && sel.length > 0) {
      selectedRow = sel[0][0];
    }
    // 방법 2: getSelectedLast() 사용
    else if (selLast && Array.isArray(selLast) && selLast.length > 0) {
      selectedRow = selLast[0];
    }
    // 방법 3: getSelectedRange() 사용
    else if (selRange) {
      selectedRow = selRange.from.row;
    }
    // 방법 4: 현재 활성 셀의 행 번호 사용
    else if (activeCell && Array.isArray(activeCell) && activeCell.length > 0) {
      selectedRow = activeCell[0];
    }
    // 방법 5: 마지막으로 선택된 행 사용 (afterSelection 이벤트로 추적)
    else if (lastSelectedRow_prob !== null && lastSelectedRow_prob !== undefined) {
      selectedRow = lastSelectedRow_prob;
      console.log('마지막 선택된 행 사용:', selectedRow);
    }
    
    // 방법 6: 사용자에게 행 번호 입력받기 (최후의 수단)
    if (selectedRow === null || selectedRow === undefined) {
      Swal.fire({
        title: '삭제할 행 선택',
        text: '삭제할 행 번호를 입력하거나, 테이블에서 행을 클릭한 후 다시 시도해주세요.',
        input: 'number',
        inputPlaceholder: '행 번호 (0부터 시작)',
        showCancelButton: true,
        confirmButtonText: '삭제',
        cancelButtonText: '취소',
        inputValidator: (value) => {
          if (!value) {
            return '행 번호를 입력해주세요';
          }
          const rowNum = parseInt(value);
          if (isNaN(rowNum) || rowNum < 0 || rowNum >= probingQuestionsTable.countRows()) {
            return '유효한 행 번호를 입력해주세요';
          }
          return null;
        }
      }).then((result) => {
        if (result.isConfirmed) {
          selectedRow = parseInt(result.value);
          deleteRow(probingQuestionsTable, selectedRow, 1);
        }
      });
      return;
    }
    
    console.log('최종 선택된 행:', selectedRow);
    deleteRow(probingQuestionsTable, selectedRow, 1);
  });
}

// 불러오기 기능
async function loadSavedData() {
  if (!currentUser) {
    Swal.fire({
      icon: 'warning',
      title: '로그인 필요',
      text: '로그인이 필요합니다.'
    });
    return;
  }

  try {
    // 로딩 표시
    Swal.fire({
      title: '불러오는 중...',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    // Firestore에서 현재 사용자의 데이터 가져오기 (인덱스 없이 사용)
    const q = query(
      collection(db, 'probingQuestions'),
      where('uid', '==', currentUser.uid)
    );
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      Swal.fire({
        icon: 'info',
        title: '저장된 데이터 없음',
        text: '아직 제출한 내용이 없습니다.'
      });
      return;
    }

    // 데이터 목록 생성
    const items = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const createdAt = data.createdAt?.toDate?.() || new Date();
      const conversation = data.conversation || [];
      
      // 대화 내용 일부 추출 (최대 3개 발화)
      let preview = '';
      if (conversation.length > 0) {
        const previewItems = conversation.slice(0, 3);
        preview = previewItems.map(item => `${item.speaker}: ${item.message}`).join(' / ');
        if (conversation.length > 3) {
          preview += ' ...';
        }
      } else {
        preview = '대화 내용 없음';
      }

      items.push({
        id: doc.id,
        data: data,
        createdAt: createdAt,
        preview: preview
      });
    });

    // 클라이언트 측에서 최신순 정렬
    items.sort((a, b) => b.createdAt - a.createdAt);

    // 팝업으로 목록 표시
    const itemsHTML = items.map(item => `
      <div class="load-item" data-id="${item.id}">
        <div class="load-item-header">
          <strong>${item.createdAt.toLocaleString('ko-KR')}</strong>
        </div>
        <div class="load-item-preview">${item.preview}</div>
      </div>
    `).join('');

    Swal.fire({
      title: '저장된 내용 불러오기',
      html: `<div class="load-popup">${itemsHTML}</div>`,
      width: '600px',
      showCancelButton: true,
      confirmButtonText: '닫기',
      cancelButtonText: '취소',
      didOpen: () => {
        // 각 항목 클릭 이벤트
        document.querySelectorAll('.load-item').forEach(item => {
          item.addEventListener('click', () => {
            const itemId = item.getAttribute('data-id');
            const selectedItem = items.find(i => i.id === itemId);
            if (selectedItem) {
              loadDataIntoForm(selectedItem.data);
              Swal.close();
            }
          });
        });
      }
    });

  } catch (error) {
    console.error('데이터 불러오기 오류:', error);
    Swal.fire({
      icon: 'error',
      title: '불러오기 실패',
      text: error.message || '데이터를 불러오는 중 오류가 발생했습니다.'
    });
  }
}

// 폼에 데이터 채우기
function loadDataIntoForm(data) {
  try {
    // 대화 데이터 채우기
    const conversation = data.conversation || [];
    if (conversation.length > 0) {
      const conversationData = conversation.map(item => [item.speaker, item.message]);
      // 최소 2행 유지
      while (conversationData.length < 2) {
        conversationData.push(['', '']);
      }
      conversationTable.loadData(conversationData);
    } else {
      conversationTable.loadData([['면접관', ''], ['학생', '']]);
    }

    // 탐침질문 데이터 채우기
    const probingQuestions = data.probingQuestions || [];
    if (probingQuestions.length > 0) {
      const probingData = probingQuestions.map(item => {
        if (typeof item === 'string') {
          // 이전 형식 (문자열 배열)
          return ['', item];
        } else {
          // 새 형식 (객체 배열)
          return [item.situation || '', item.question || ''];
        }
      });
      probingQuestionsTable.loadData(probingData);
    } else {
      probingQuestionsTable.loadData([['', '']]);
    }

    // 학생 특성 채우기
    const studentCharacteristics = data.studentCharacteristics || '';
    document.getElementById('studentCharacteristics').value = studentCharacteristics;

    Swal.fire({
      icon: 'success',
      title: '불러오기 완료',
      text: '저장된 내용이 불러와졌습니다!',
      timer: 2000,
      showConfirmButton: false
    });

  } catch (error) {
    console.error('데이터 채우기 오류:', error);
    Swal.fire({
      icon: 'error',
      title: '오류',
      text: '데이터를 불러오는 중 오류가 발생했습니다.'
    });
  }
}

// 불러오기 버튼 이벤트
function initLoadButton() {
  document.getElementById('load-btn').addEventListener('click', () => {
    loadSavedData();
  });
}

// 페이지 로드 시 테이블 초기화
document.addEventListener('DOMContentLoaded', () => {
  initTables();
  initTabs();
  initRowControls();
  initLoadButton();
});

