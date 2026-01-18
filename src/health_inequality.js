import { auth, db, isAdmin } from './firebaseConfig.js';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, addDoc, serverTimestamp, getDocs, query, where, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import Swal from 'sweetalert2';
import Handsontable from 'handsontable';
import 'handsontable/dist/handsontable.full.min.css';

let currentUser = null;
let conversationTableA = null;
let probingQuestionsTableA = null;
let conversationTableB = null;
let probingQuestionsTableB = null;
let lastSelectedRow_conv_a = null;
let lastSelectedRow_prob_a = null;
let lastSelectedRow_conv_b = null;
let lastSelectedRow_prob_b = null;
let criteriaTables = {}; // 평가 기준 테이블들

// 저장 상태 추적 (과제별, 학생별)
const saveStatus = {
  a: {}, // 학생 A의 각 과제별 저장 상태
  b: {}  // 학생 B의 각 과제별 저장 상태
};

// Handsontable 초기화 (학생 A)
function initTablesA() {
  const conversationContainer = document.getElementById('conversation-table-a');
  if (!conversationContainer) {
    return; // 요소가 없으면 초기화하지 않음
  }
  conversationTableA = new Handsontable(conversationContainer, {
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
    selectionMode: 'single',
    afterSelection: function(row, col, row2, col2) {
      lastSelectedRow_conv_a = row;
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

  const probingContainer = document.getElementById('probing-questions-table-a');
  if (!probingContainer) {
    return; // 요소가 없으면 초기화하지 않음
  }
  probingQuestionsTableA = new Handsontable(probingContainer, {
    data: [['', '']],
    colHeaders: ['상황 분석', '탐침질문'],
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
    selectionMode: 'single',
    afterSelection: function(row, col, row2, col2) {
      lastSelectedRow_prob_a = row;
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

// Handsontable 초기화 (학생 B)
function initTablesB() {
  const conversationContainer = document.getElementById('conversation-table-b');
  if (!conversationContainer) {
    return; // 요소가 없으면 초기화하지 않음
  }
  conversationTableB = new Handsontable(conversationContainer, {
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
    selectionMode: 'single',
    afterSelection: function(row, col, row2, col2) {
      lastSelectedRow_conv_b = row;
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

  const probingContainer = document.getElementById('probing-questions-table-b');
  if (!probingContainer) {
    return; // 요소가 없으면 초기화하지 않음
  }
  probingQuestionsTableB = new Handsontable(probingContainer, {
    data: [['', '']],
    colHeaders: ['상황 분석', '탐침질문'],
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
    selectionMode: 'single',
    afterSelection: function(row, col, row2, col2) {
      lastSelectedRow_prob_b = row;
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
  const userIsAdmin = await isAdmin(user.uid);
  if (userIsAdmin) {
    return true;
  }

  try {
    const settingsDoc = await getDoc(doc(db, 'menuSettings', 'main'));
    
    if (settingsDoc.exists()) {
      const data = settingsDoc.data();
      
      if (data.probing02 === false) {
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
    return true;
  }
}

// 인증 상태 확인
onAuthStateChanged(auth, async (user) => {
  if (user) {
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

// 최상단 탭 전환 기능
function initMainTabs() {
  const mainTabButtons = document.querySelectorAll('.main-tab-button');
  const mainTabContents = document.querySelectorAll('.main-tab-content');
  
  mainTabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const targetTab = button.getAttribute('data-main-tab');
      
      mainTabButtons.forEach(btn => btn.classList.remove('active'));
      mainTabContents.forEach(content => content.classList.remove('active'));
      
      button.classList.add('active');
      const targetContent = document.getElementById(`${targetTab}-tab`);
      if (targetContent) {
        targetContent.classList.add('active');
      }
    });
  });
}

// 하위 탭 전환 기능
function initSubTabs() {
  const subTabButtons = document.querySelectorAll('.sub-tab-button');
  const subTabContents = document.querySelectorAll('.sub-tab-content');
  
  subTabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const targetTab = button.getAttribute('data-sub-tab');
      
      subTabButtons.forEach(btn => btn.classList.remove('active'));
      subTabContents.forEach(content => content.classList.remove('active'));
      
      button.classList.add('active');
      const targetContent = document.getElementById(`${targetTab}-tab`);
      if (targetContent) {
        targetContent.classList.add('active');
      }
    });
  });
}

// 탐침 질문 데이터 가져오기
function getProbingQuestionsData() {
  return [
    ['건강 불평등을 야기하는 사회적 불평등의 요소를 명확히 하지 않은 경우 (과제 1)', '사회의 불평등과 관련된 어떤 집단이나 조건이 건강 불평등 문제를 야기할 수 있을까요? 원인 추정 요소를 포함하여 주제를 어떻게 수정할 수 있을까요?'],
    ['불평등 관련 문제를 주제로 제시하였으나 건강 불평등과 연결하지 못한 경우 (과제 1)', '지금 사회적 불평등에 대한 주제를 제시하기는 했지만 건강 불평등으로 연결하지 못했는데, 제시한 사회적 불평등이 건강 불평등에 원인이 될 수 있다고 생각하나요? 그렇다면 주제를 어떻게 수정할 수 있을까요?'],
    ['연구 주제와 주장(가설), 필요성 등의 구성의 구체성과 목적성이 부족한 경우 (과제 1)', '연구 주장을 가설의 형태로 구체적으로 진술해 볼 수 있을까요?\n연구주제를 제시하였지만 연구 목적과 필요성에 대한 구체적인 내용을 보완하면 좋을 것 같은데, 제시한 연구 주제를 통해 어떤 실질적인 문제가 해결되는 것이며, 그 문제는 얼마나 중요한가요?'],
    ['제시문의 연구 주제와의 유사성이 커서 창의적 아이디어를 촉진하고자 할 때 (과제 1)', '예시 연구와 큰 차이가 없는 주제를 제시하였는데, 공중 보건을 향상시키기 위해 상대적으로 정보나 관심을 적게 받고 있는 집단이나 조건을 생각하여 더 새로운 주제를 생각해 볼 수 있을까요?'],
    ['현실 맥락을 고려하여 데이터 수집 계획을 수정할 필요가 있을 경우 (과제 2)', '제시한 그 변수가 현실적으로 수집 가능한 정보일까요? 간접적으로 그 정보를 대신할 수 있는 변수는 어떤 것이 있을까요?'],
    ['데이터 수집 계획의 구체성을 보완해야 하는 경우 (과제 2)', '수집하고자 하는 그 변수는 어떤 질문이나 방법을 통해 정보를 수집할 수 있을까요?\n연구 주제에 등장한 개념과 관련된 정보를 점수나 순위 등으로 수치화하여 수집하려면 어떻게 해야할까요?'],
    ['가설이 틀릴 때의 그래프에 대한 묘사가 없을 경우 (과제 3)', '예상하지 못한 결과가 나오는 경우, 즉 가설이 틀리는 경우, 이 그래프는 어떤 경향을 보일까요?'],
    ['적절한 시각화나 분석 방법을 제시하지 않은 경우 (과제 3)', '지금 제시한 시각화 방안을 구체적으로 그림으로 보여줄 수 있을까요?\n두 개 이상의 변수의 관계를 시각적으로 한눈에 볼 수 있는 방법이 있을까요?\n순위로 매겨진 설문 응답을 집단끼리 어떻게 비교하면 좋을까요?\n제시한 시각화 방법에 또 하나의 요인을 함께 고려하려면 어떻게 수정할 수 있을까요?'],
    ['표본 대표성 문제에 대한 설명이 불충분한 경우 (과제 4)', '표본의 불충분한 대표성이 분석 결과에 어떤 영향을 미칠까요?\n표본 대표성이 부족한 분석 결과에 대해 어떤 비판을 할 수 있을까요?'],
    ['표본 대표성 문제에 대한 대처방법을 탐색하는 경우 (과제 4)', '표본 대표성이 부족한 상황에서 만약 데이터를 추가로 수집하려면 어떻게 해야할까요?\n표본 대표성을 확보하기 위해 데이터 수집 전략을 어떻게 수정해야 할까요?'],
    ['연구 결과에 따른 정책 제안의 설명이 부족하여 보완하고자 하는 경우 (과제 5)', '예상 되는 연구 결과는 어떤 정책을 뒷받침하는 근거가 되나요?\n제안된 정책이 현실에서 실행 가능할까요? 실행 가능성을 높이려면 어떻게 구체적으로 정책을 제안할 수 있을까요?'],
    ['[심화] 연구 결과의 정책 적용을 확장한 주제 탐색 (과제 5)', '제안된 정책 도입 시 예상되는 부작용은 무엇이며 이를 어떻게 해결할 수 있을까요?\n불평등 개선을 위한 사회적 노력을 정책 입안자가 아닌 시민의 입장에서 어떻게 할 수 있을까요?'],
    ['[심화] 건강 불평등 관련 연구에 대한 탐색', '건강 불평등과 관련된 다른 연구 주제나 방법을 제시할 수 있나요?'],
  ];
}

// 평가 기준 Handsontable 초기화
function initCriteriaTables() {
  // 각 과제별 초기 데이터 정의
  const criteriaData = {
    1: [
      ['종합적 사고', '제시문에 주어진 연구의 중요한 정보의 핵심을 잘 이해하여 이를 새로운 연구 주제 개발에 반영하고 있는가? 교육, 경제, 환경 등의 불평등과 건강 불평등 사이의 인과적 관계를 이해하고, 이를 새로운 연구 주제의 발견과 연구의 필요성 구성 및 연구 주장(가설)에 반영하였는가?'],
      ['창의적 사고', '건강 불평등에 영향을 끼치는 사회의 불평등 요인을 독창적으로 추측하고 구체화하여 본인만의 연구 주제를 제시하였는가?'],
      ['공동체', '건강 불평등 문제의 양상을 이해하고 사회적 문제로 인식하고 있으며, 문제의 개선의 필요성을 이해하고 공감하면서 이를 해결하기 위한 연구 주제를 선택하였는가?'],
    ],
    2: [
      ['종합적 사고', '연구를 위한 데이터 수집 계획과 전략이 연구의 목적에 부합하고 가설을 입증하기에 적절한가? 예시 연구의 구체성 만큼 구체적인 데이터 수집의 계획을 세우고 있는가?'],
      ['창의적 사고', '연구에 영향을 끼칠 수 있는 의외의 변수 선택의 아이디어를 창의적으로 제시하고 있는가? 데이터 수집의 참신한 방법을 제시하고 있는가?'],
      ['지식탐구', '불평등, 보건에 관련한 다양한 사회적 이슈와 관련된 폭넓은 이해를 바탕으로 적절한 변수 선택을 하였는가? 표본 선택, 설문, 데이터 수집 과정 등에 대한 지식을 바탕으로 구체적인 데이터 수집 방법과 전략을 제시하고 있는가?'],
    ],
    3: [
      ['종합적 사고', '데이터 분석 및 시각화 전략이 연구의 목적에 부합하며, 주장의 근거를 구성하기에 적절한가? 주장이 맞을 때와 틀릴 때의 모든 경우에 따른 분석 결과 예시를 구현하여 연구에 대한 시나리오를 예측할 수 있는가?'],
      ['지식탐구', '연구 문제의 추상적인 개념에 맞게 표본으로 부터 구하는 정량적 지표나 수치를 구성할 수 있는가?'],
    ],
    4: [
      ['종합적 사고', '자신이 1차로 제시한 데이터 수집 과정에서 일어날 수 있는 문제에 대한 객관적인 분석과 반성을 통해 개선 방향을 제시할 수 있는가?'],
      ['창의적 사고', '표본 수집 과정에서 일어날 수 있는 문제에 대해 다양하게 예측할 수 있는가? 알고 있는 정보를 활용하여 문제의 보완 방법을 유추할 수 있는가?'],
      ['지식 탐구', '모집단과 표본 선택 과정의 임의성과 관련된 표본 불균형 등 통계적 조사 과정에서 발생할 수 있는 오류를 이해하고 있으며, 오류를 보완할 분석 방법(집단별 분석, 가중치 반영 등)이나 추가 데이터 수집 방법 등을 적절하게 제시할 수 있는가?'],
    ],
    5: [
      ['종합적 사고', '제시한 연구 결과가 사회에 끼칠 긍정적 및 부정적 영향을 논리적으로 제시할 수 있는가?'],
      ['창의적 사고', '연구의 한계를 고민하면서 대안적 전략 등을 창의적으로 제시할 수 있는가?'],
      ['공동체', '예상되는 연구 결과를 기반으로 공동체 발전이라는 방향에 맞게 보건 분야에 새로운 정책을 제안하고 있는가? 연구의 현실적 한계에 대한 논의에서 공동체의 안전과 공동 번영에 대한 고려가 적절히 드러나는가?'],
    ]
  };

  for (let i = 1; i <= 5; i++) {
    const container = document.getElementById(`criteria-table-${i}`);
    if (container) {
      const data = criteriaData[i] || [['', '']];
      const rowCount = data.length;
      // 행 수에 따라 높이 자동 계산 (헤더 1줄 + 데이터 행 수, 각 행 약 50px + 여유 공간)
      const calculatedHeight = Math.max(150, (rowCount + 1) * 50 + 20);
      
      criteriaTables[i] = new Handsontable(container, {
        data: data,
        colHeaders: ['역량', '평가 기준'],
        rowHeaders: true,
        contextMenu: true,
        colWidths: [100, 400],
        minRows: 1,
        minCols: 2,
        licenseKey: 'non-commercial-and-evaluation',
        width: '100%',
        height: calculatedHeight,
        stretchH: 'all',
        manualRowResize: true,
        manualColumnResize: true,
        autoWrapRow: true,
        autoWrapCol: true,
        autoRowSize: true,
        wordWrap: true,
        readOnly: true, // 읽기 전용
        columns: [
          { 
            data: 0, 
            className: 'htCenter',
            renderer: function(instance, td, row, col, prop, value, cellProperties) {
              Handsontable.renderers.TextRenderer.apply(this, arguments);
              td.style.fontWeight = 'bold';
              td.style.textAlign = 'center';
            }
          },
          { 
            data: 1, 
            className: 'htLeft'
          }
        ],
        afterRender: function() {
          // Handsontable 렌더링 후 높이 재조정
          const instance = this;
          setTimeout(() => {
            try {
              // 실제 DOM 요소의 높이를 측정
              const tableElement = instance.rootElement;
              if (tableElement) {
                const wtHolder = tableElement.querySelector('.ht_master .wtHolder');
                if (wtHolder) {
                  const tableBody = wtHolder.querySelector('.ht_master table tbody');
                  const tableHeader = wtHolder.querySelector('.ht_master table thead');
                  
                  if (tableBody && tableHeader) {
                    // 헤더 높이
                    const headerHeight = tableHeader.offsetHeight;
                    // 각 행의 실제 높이 합산
                    let bodyHeight = 0;
                    const rows = tableBody.querySelectorAll('tr');
                    rows.forEach(row => {
                      bodyHeight += row.offsetHeight;
                    });
                    
                    // 총 높이 계산 (여유 공간 포함)
                    const totalHeight = headerHeight + bodyHeight + 10;
                    instance.updateSettings({ height: totalHeight });
                  }
                }
              }
            } catch (error) {
              console.error('높이 계산 오류:', error);
              // 오류 발생 시 기본 높이 사용
              const rowCount = instance.countRows();
              const fallbackHeight = Math.max(200, (rowCount + 1) * 60 + 30);
              instance.updateSettings({ height: fallbackHeight });
            }
          }, 200);
        }
      });
    }
  }

  // 종합 평가 기준 테이블 초기화
  const summaryContainer = document.getElementById('summary-criteria-table');
  if (summaryContainer) {
    const summaryCriteriaData = [
      ['협력적 소통', '연구의 의도와 구체적 전략을 충분히 설득적으로 설명하고 있는가? 연구 결과를 얼마나 알기 쉽게 수치 및 시각적으로 전달할 수 있는가? 탐침질문 등을 통해 타인의 시각을 얼마나 유연성있게 받아들이고 자신의 전략을 개선할 수 있는가?'],
      ['자기 관리', '과제 수행 및 개선 과정에서 지원 분야에 대한 자신감, 학습과 탐구, 진로 설계의 자기주도성을 보이고 있는가? 적절한 학습 전략을 설정하고 이끌어갈 수 있는 역량을 드러내었는가?'],
    ];
    
    const summaryRowCount = summaryCriteriaData.length;
    const summaryCalculatedHeight = Math.max(150, (summaryRowCount + 1) * 50 + 20);
    
    criteriaTables['summary'] = new Handsontable(summaryContainer, {
      data: summaryCriteriaData,
      colHeaders: ['역량', '평가 기준'],
      rowHeaders: true,
      contextMenu: true,
      colWidths: [100, 400],
      minRows: 1,
      minCols: 2,
      licenseKey: 'non-commercial-and-evaluation',
      width: '100%',
      height: summaryCalculatedHeight,
      stretchH: 'all',
      manualRowResize: true,
      manualColumnResize: true,
      autoWrapRow: true,
      autoWrapCol: true,
      autoRowSize: true,
      wordWrap: true,
      readOnly: true, // 읽기 전용
      columns: [
        { 
          data: 0, 
          className: 'htCenter',
          renderer: function(instance, td, row, col, prop, value, cellProperties) {
            Handsontable.renderers.TextRenderer.apply(this, arguments);
            td.style.fontWeight = 'bold';
            td.style.textAlign = 'center';
          }
        },
        { 
          data: 1, 
          className: 'htLeft'
        }
      ],
      afterRender: function() {
        // Handsontable 렌더링 후 높이 재조정
        const instance = this;
        setTimeout(() => {
          try {
            // 실제 DOM 요소의 높이를 측정
            const tableElement = instance.rootElement;
            if (tableElement) {
              const wtHolder = tableElement.querySelector('.ht_master .wtHolder');
              if (wtHolder) {
                const tableBody = wtHolder.querySelector('.ht_master table tbody');
                const tableHeader = wtHolder.querySelector('.ht_master table thead');
                
                if (tableBody && tableHeader) {
                  // 헤더 높이
                  const headerHeight = tableHeader.offsetHeight;
                  // 각 행의 실제 높이 합산
                  let bodyHeight = 0;
                  const rows = tableBody.querySelectorAll('tr');
                  rows.forEach(row => {
                    bodyHeight += row.offsetHeight;
                  });
                  
                  // 총 높이 계산 (여유 공간 포함)
                  const totalHeight = headerHeight + bodyHeight + 10;
                  instance.updateSettings({ height: totalHeight });
                }
              }
            }
          } catch (error) {
            console.error('높이 계산 오류:', error);
            // 오류 발생 시 기본 높이 사용
            const rowCount = instance.countRows();
            const fallbackHeight = Math.max(200, (rowCount + 1) * 60 + 30);
            instance.updateSettings({ height: fallbackHeight });
          }
        }, 200);
      }
    });
  }

  // 탐침 질문 테이블 초기화
  const probingContainer = document.getElementById('probing-questions-table');
  if (probingContainer) {
    const probingData = getProbingQuestionsData();

    criteriaTables['probing'] = new Handsontable(probingContainer, {
      data: probingData,
      colHeaders: ['상황 분석', '탐침질문'],
      rowHeaders: true,
      contextMenu: true,
      colWidths: [250, 500],
      minRows: 1,
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
      readOnly: true, // 읽기 전용
      columns: [
        { 
          data: 0, 
          className: 'htLeft',
          renderer: function(instance, td, row, col, prop, value, cellProperties) {
            Handsontable.renderers.TextRenderer.apply(this, arguments);
            td.style.fontWeight = 'bold';
          }
        },
        { 
          data: 1, 
          className: 'htLeft',
          renderer: function(instance, td, row, col, prop, value, cellProperties) {
            if (value && typeof value === 'string') {
              // 줄바꿈으로 구분된 텍스트를 bullet list로 변환
              const lines = value.split('\n').filter(line => line.trim());
              if (lines.length > 0) {
                const html = '<ul style="margin: 0; padding-left: 20px; text-align: left;">' + 
                  lines.map(line => `<li style="margin-bottom: 0.25rem; text-align: left;">${line.trim()}</li>`).join('') + 
                  '</ul>';
                td.innerHTML = html;
                td.style.verticalAlign = 'top';
                td.style.paddingTop = '0.5rem';
                td.style.paddingBottom = '0.5rem';
                td.style.textAlign = 'left';
              } else {
                Handsontable.renderers.TextRenderer.apply(this, arguments);
                td.style.textAlign = 'left';
              }
            } else {
              Handsontable.renderers.TextRenderer.apply(this, arguments);
              td.style.textAlign = 'left';
            }
          }
        }
      ]
    });
  }
}

// 과제별 탭 전환 기능
function initQuestionTabs() {
  const questionTabButtons = document.querySelectorAll('.question-tab-button');
  const questionTabContents = document.querySelectorAll('.question-tab-content');
  
  questionTabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const targetQuestion = button.getAttribute('data-question');
      
      questionTabButtons.forEach(btn => btn.classList.remove('active'));
      questionTabContents.forEach(content => content.classList.remove('active'));
      
      button.classList.add('active');
      let targetContent;
      if (targetQuestion === 'summary') {
        targetContent = document.getElementById('question-summary-content');
      } else {
        targetContent = document.getElementById(`question-${targetQuestion}-content`);
      }
      if (targetContent) {
        targetContent.classList.add('active');
      }
    });
  });
}

// 행 삭제 헬퍼 함수
function deleteRow(table, rowIndex, minRows, lastSelectedRow) {
  if (table.countRows() <= minRows) {
    Swal.fire({
      icon: 'warning',
      title: '알림',
      text: `최소 ${minRows}개의 행이 필요합니다.`
    });
    return;
  }
  
  try {
    table.alter('remove_row', rowIndex);
  } catch (error) {
    console.error('행 삭제 오류:', error);
    Swal.fire({
      icon: 'error',
      title: '삭제 실패',
      text: '행을 삭제하는 중 오류가 발생했습니다: ' + error.message
    });
  }
}

// 행 제어 버튼 초기화 (학생 A)
function initRowControlsA() {
  const addConvBtn = document.getElementById('add-conversation-row-a');
  const delConvBtn = document.getElementById('del-conversation-row-a');
  const addProbingBtn = document.getElementById('add-probing-row-a');
  const delProbingBtn = document.getElementById('del-probing-row-a');
  
  if (!addConvBtn || !delConvBtn || !addProbingBtn || !delProbingBtn) {
    return;
  }
  
  addConvBtn.addEventListener('click', () => {
    try {
      conversationTableA.alter('insert_row', conversationTableA.countRows(), 1);
    } catch (e) {
      try {
        conversationTableA.alter('insert_row_below', conversationTableA.countRows() - 1, 1);
      } catch (e2) {
        Swal.fire({
          icon: 'error',
          title: '오류',
          text: 'Handsontable 버전 호환 문제가 있습니다.'
        });
      }
    }
  });

  delConvBtn.addEventListener('click', () => {
    const sel = conversationTableA.getSelected();
    const selLast = conversationTableA.getSelectedLast();
    const selRange = conversationTableA.getSelectedRange();
    
    let selectedRow = null;
    
    if (sel && Array.isArray(sel) && sel.length > 0) {
      selectedRow = sel[0][0];
    } else if (selLast && Array.isArray(selLast) && selLast.length > 0) {
      selectedRow = selLast[0];
    } else if (selRange) {
      selectedRow = selRange.from.row;
    } else if (lastSelectedRow_conv_a !== null && lastSelectedRow_conv_a !== undefined) {
      selectedRow = lastSelectedRow_conv_a;
    }
    
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
          if (isNaN(rowNum) || rowNum < 0 || rowNum >= conversationTableA.countRows()) {
            return '유효한 행 번호를 입력해주세요';
          }
          return null;
        }
      }).then((result) => {
        if (result.isConfirmed) {
          selectedRow = parseInt(result.value);
          deleteRow(conversationTableA, selectedRow, 2, lastSelectedRow_conv_a);
        }
      });
      return;
    }
    
    deleteRow(conversationTableA, selectedRow, 2, lastSelectedRow_conv_a);
  });

  addProbingBtn.addEventListener('click', () => {
    try {
      probingQuestionsTableA.alter('insert_row', probingQuestionsTableA.countRows(), 1);
    } catch (e) {
      try {
        probingQuestionsTableA.alter('insert_row_below', probingQuestionsTableA.countRows() - 1, 1);
      } catch (e2) {
        Swal.fire({
          icon: 'error',
          title: '오류',
          text: 'Handsontable 버전 호환 문제가 있습니다.'
        });
      }
    }
  });

  delProbingBtn.addEventListener('click', () => {
    const sel = probingQuestionsTableA.getSelected();
    const selLast = probingQuestionsTableA.getSelectedLast();
    const selRange = probingQuestionsTableA.getSelectedRange();
    
    let selectedRow = null;
    
    if (sel && Array.isArray(sel) && sel.length > 0) {
      selectedRow = sel[0][0];
    } else if (selLast && Array.isArray(selLast) && selLast.length > 0) {
      selectedRow = selLast[0];
    } else if (selRange) {
      selectedRow = selRange.from.row;
    } else if (lastSelectedRow_prob_a !== null && lastSelectedRow_prob_a !== undefined) {
      selectedRow = lastSelectedRow_prob_a;
    }
    
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
          if (isNaN(rowNum) || rowNum < 0 || rowNum >= probingQuestionsTableA.countRows()) {
            return '유효한 행 번호를 입력해주세요';
          }
          return null;
        }
      }).then((result) => {
        if (result.isConfirmed) {
          selectedRow = parseInt(result.value);
          deleteRow(probingQuestionsTableA, selectedRow, 1, lastSelectedRow_prob_a);
        }
      });
      return;
    }
    
    deleteRow(probingQuestionsTableA, selectedRow, 1, lastSelectedRow_prob_a);
  });
}

// 행 제어 버튼 초기화 (학생 B)
function initRowControlsB() {
  const addConvBtn = document.getElementById('add-conversation-row-b');
  const delConvBtn = document.getElementById('del-conversation-row-b');
  const addProbingBtn = document.getElementById('add-probing-row-b');
  const delProbingBtn = document.getElementById('del-probing-row-b');
  
  if (!addConvBtn || !delConvBtn || !addProbingBtn || !delProbingBtn) {
    return;
  }
  
  addConvBtn.addEventListener('click', () => {
    try {
      conversationTableB.alter('insert_row', conversationTableB.countRows(), 1);
    } catch (e) {
      try {
        conversationTableB.alter('insert_row_below', conversationTableB.countRows() - 1, 1);
      } catch (e2) {
        Swal.fire({
          icon: 'error',
          title: '오류',
          text: 'Handsontable 버전 호환 문제가 있습니다.'
        });
      }
    }
  });

  delConvBtn.addEventListener('click', () => {
    const sel = conversationTableB.getSelected();
    const selLast = conversationTableB.getSelectedLast();
    const selRange = conversationTableB.getSelectedRange();
    
    let selectedRow = null;
    
    if (sel && Array.isArray(sel) && sel.length > 0) {
      selectedRow = sel[0][0];
    } else if (selLast && Array.isArray(selLast) && selLast.length > 0) {
      selectedRow = selLast[0];
    } else if (selRange) {
      selectedRow = selRange.from.row;
    } else if (lastSelectedRow_conv_b !== null && lastSelectedRow_conv_b !== undefined) {
      selectedRow = lastSelectedRow_conv_b;
    }
    
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
          if (isNaN(rowNum) || rowNum < 0 || rowNum >= conversationTableB.countRows()) {
            return '유효한 행 번호를 입력해주세요';
          }
          return null;
        }
      }).then((result) => {
        if (result.isConfirmed) {
          selectedRow = parseInt(result.value);
          deleteRow(conversationTableB, selectedRow, 2, lastSelectedRow_conv_b);
        }
      });
      return;
    }
    
    deleteRow(conversationTableB, selectedRow, 2, lastSelectedRow_conv_b);
  });

  addProbingBtn.addEventListener('click', () => {
    try {
      probingQuestionsTableB.alter('insert_row', probingQuestionsTableB.countRows(), 1);
    } catch (e) {
      try {
        probingQuestionsTableB.alter('insert_row_below', probingQuestionsTableB.countRows() - 1, 1);
      } catch (e2) {
        Swal.fire({
          icon: 'error',
          title: '오류',
          text: 'Handsontable 버전 호환 문제가 있습니다.'
        });
      }
    }
  });

  delProbingBtn.addEventListener('click', () => {
    const sel = probingQuestionsTableB.getSelected();
    const selLast = probingQuestionsTableB.getSelectedLast();
    const selRange = probingQuestionsTableB.getSelectedRange();
    
    let selectedRow = null;
    
    if (sel && Array.isArray(sel) && sel.length > 0) {
      selectedRow = sel[0][0];
    } else if (selLast && Array.isArray(selLast) && selLast.length > 0) {
      selectedRow = selLast[0];
    } else if (selRange) {
      selectedRow = selRange.from.row;
    } else if (lastSelectedRow_prob_b !== null && lastSelectedRow_prob_b !== undefined) {
      selectedRow = lastSelectedRow_prob_b;
    }
    
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
          if (isNaN(rowNum) || rowNum < 0 || rowNum >= probingQuestionsTableB.countRows()) {
            return '유효한 행 번호를 입력해주세요';
          }
          return null;
        }
      }).then((result) => {
        if (result.isConfirmed) {
          selectedRow = parseInt(result.value);
          deleteRow(probingQuestionsTableB, selectedRow, 1, lastSelectedRow_prob_b);
        }
      });
      return;
    }
    
    deleteRow(probingQuestionsTableB, selectedRow, 1, lastSelectedRow_prob_b);
  });
}

// 제출 기능 (학생 A) - 기존 버튼이 있을 때만 이벤트 리스너 추가
const submitBtnA = document.getElementById('submitBtnA');
if (submitBtnA) {
  submitBtnA.addEventListener('click', async () => {
    await submitData('A', conversationTableA, probingQuestionsTableA, 'studentCharacteristicsA');
  });
}

// 제출 기능 (학생 B) - 기존 버튼이 있을 때만 이벤트 리스너 추가
const submitBtnB = document.getElementById('submitBtnB');
if (submitBtnB) {
  submitBtnB.addEventListener('click', async () => {
    await submitData('B', conversationTableB, probingQuestionsTableB, 'studentCharacteristicsB');
  });
}

// 공통 제출 함수
async function submitData(studentType, conversationTable, probingQuestionsTable, characteristicsId) {
  if (!currentUser) {
    Swal.fire({
      icon: 'warning',
      title: '로그인 필요',
      text: '로그인이 필요합니다.'
    });
    return;
  }

  const conversationData = conversationTable.getData();
  const probingQuestionsData = probingQuestionsTable.getData();
  const studentCharacteristics = document.getElementById(characteristicsId).value.trim();

  const conversation = [];
  conversationData.forEach(row => {
    if (row[0]?.trim() && row[1]?.trim()) {
      conversation.push({
        speaker: row[0].trim(),
        message: row[1].trim()
      });
    }
  });

  const probingQuestions = [];
  probingQuestionsData.forEach(row => {
    if (row[0]?.trim() || row[1]?.trim()) {
      probingQuestions.push({
        situation: row[0]?.trim() || '',
        question: row[1]?.trim() || ''
      });
    }
  });

  if (conversation.length === 0) {
    Swal.fire({
      icon: 'warning',
      title: '대화 입력 필요',
      text: '면접관과 학생의 대화를 입력해주세요.'
    });
    return;
  }

  const validProbingQuestions = probingQuestions.filter(q => q.situation.trim() || q.question.trim());
  if (validProbingQuestions.length === 0) {
    Swal.fire({
      icon: 'warning',
      title: '탐침질문 입력 필요',
      text: '상황 또는 탐침질문을 최소 1개 이상 입력해주세요.'
    });
    return;
  }

  const confirmResult = await Swal.fire({
    title: '제출하시겠습니까?',
    text: `학생 ${studentType}의 입력한 내용이 저장되어 공유됩니다.`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: '제출',
    cancelButtonText: '취소'
  });

  if (!confirmResult.isConfirmed) {
    return;
  }

  Swal.fire({
    title: '제출 중...',
    allowOutsideClick: false,
    didOpen: () => {
      Swal.showLoading();
    }
  });

  try {
    const docRef = await addDoc(collection(db, 'probingQuestions'), {
      uid: currentUser.uid,
      displayName: currentUser.displayName || '',
      email: currentUser.email || '',
      createdAt: serverTimestamp(),
      conversation: conversation,
      probingQuestions: probingQuestions,
      studentCharacteristics: studentCharacteristics || '',
      studentType: studentType,
      questionType: 'health_inequality'
    });

    console.log('✅ 저장 완료:', docRef.id);

    Swal.fire({
      icon: 'success',
      title: '제출 완료',
      text: `학생 ${studentType}의 탐침질문이 성공적으로 저장되었습니다!`,
      confirmButtonText: '확인'
    }).then(() => {
      conversationTable.loadData([['면접관', ''], ['학생', '']]);
      probingQuestionsTable.loadData([['', '']]);
      document.getElementById(characteristicsId).value = '';
    });

  } catch (error) {
    console.error('❌ 저장 실패:', error);
    Swal.fire({
      icon: 'error',
      title: '제출 실패',
      text: error.message || '데이터 저장 중 오류가 발생했습니다.'
    });
  }
}

// 불러오기 기능 (학생 A)
async function loadSavedDataA() {
  await loadSavedData('A', conversationTableA, probingQuestionsTableA, 'studentCharacteristicsA');
}

// 불러오기 기능 (학생 B)
async function loadSavedDataB() {
  await loadSavedData('B', conversationTableB, probingQuestionsTableB, 'studentCharacteristicsB');
}

// 공통 불러오기 함수
async function loadSavedData(studentType, conversationTable, probingQuestionsTable, characteristicsId) {
  if (!currentUser) {
    Swal.fire({
      icon: 'warning',
      title: '로그인 필요',
      text: '로그인이 필요합니다.'
    });
    return;
  }

  try {
    Swal.fire({
      title: '불러오는 중...',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    const q = query(
      collection(db, 'probingQuestions'),
      where('uid', '==', currentUser.uid),
      where('studentType', '==', studentType),
      where('questionType', '==', 'health_inequality')
    );
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      Swal.fire({
        icon: 'info',
        title: '저장된 데이터 없음',
        text: `학생 ${studentType}의 제출한 내용이 없습니다.`
      });
      return;
    }

    const items = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const createdAt = data.createdAt?.toDate?.() || new Date();
      const conversation = data.conversation || [];
      
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

    items.sort((a, b) => b.createdAt - a.createdAt);

    const itemsHTML = items.map(item => `
      <div class="load-item" data-id="${item.id}">
        <div class="load-item-header">
          <strong>${item.createdAt.toLocaleString('ko-KR')}</strong>
        </div>
        <div class="load-item-preview">${item.preview}</div>
      </div>
    `).join('');

    Swal.fire({
      title: `학생 ${studentType}의 저장된 내용 불러오기`,
      html: `<div class="load-popup">${itemsHTML}</div>`,
      width: '600px',
      showCancelButton: true,
      confirmButtonText: '닫기',
      cancelButtonText: '취소',
      didOpen: () => {
        document.querySelectorAll('.load-item').forEach(item => {
          item.addEventListener('click', () => {
            const itemId = item.getAttribute('data-id');
            const selectedItem = items.find(i => i.id === itemId);
            if (selectedItem) {
              loadDataIntoForm(selectedItem.data, conversationTable, probingQuestionsTable, characteristicsId);
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
function loadDataIntoForm(data, conversationTable, probingQuestionsTable, characteristicsId) {
  try {
    const conversation = data.conversation || [];
    if (conversation.length > 0) {
      const conversationData = conversation.map(item => [item.speaker, item.message]);
      while (conversationData.length < 2) {
        conversationData.push(['', '']);
      }
      conversationTable.loadData(conversationData);
    } else {
      conversationTable.loadData([['면접관', ''], ['학생', '']]);
    }

    const probingQuestions = data.probingQuestions || [];
    if (probingQuestions.length > 0) {
      const probingData = probingQuestions.map(item => {
        if (typeof item === 'string') {
          return ['', item];
        } else {
          return [item.situation || '', item.question || ''];
        }
      });
      probingQuestionsTable.loadData(probingData);
    } else {
      probingQuestionsTable.loadData([['', '']]);
    }

    const studentCharacteristics = data.studentCharacteristics || '';
    document.getElementById(characteristicsId).value = studentCharacteristics;

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
function initLoadButtons() {
  const loadBtnA = document.getElementById('load-btn-a');
  if (loadBtnA) {
    loadBtnA.addEventListener('click', () => {
      loadSavedDataA();
    });
  }

  const loadBtnB = document.getElementById('load-btn-b');
  if (loadBtnB) {
    loadBtnB.addEventListener('click', () => {
      loadSavedDataB();
    });
  }
}

// 탐침 질문 크게 보기 팝업
function showProbingQuestionsPopup() {
  const probingData = getProbingQuestionsData();

  Swal.fire({
    title: '탐침 질문',
    html: '<div id="probing-questions-popup-table" style="width: 100%; min-height: 500px;"></div>',
    width: '90%',
    maxWidth: '1200px',
    showConfirmButton: true,
    confirmButtonText: '닫기',
    didOpen: () => {
      const container = document.getElementById('probing-questions-popup-table');
      if (container) {
        new Handsontable(container, {
          data: probingData,
          colHeaders: ['상황 분석', '탐침질문'],
          rowHeaders: true,
          contextMenu: true,
          colWidths: [300, 700],
          minRows: 1,
          minCols: 2,
          licenseKey: 'non-commercial-and-evaluation',
          width: '100%',
          height: 600,
          stretchH: 'all',
          manualRowResize: true,
          manualColumnResize: true,
          autoWrapRow: true,
          autoWrapCol: true,
          autoRowSize: true,
          readOnly: true,
          columns: [
            { 
              data: 0, 
              className: 'htLeft',
              renderer: function(instance, td, row, col, prop, value, cellProperties) {
                Handsontable.renderers.TextRenderer.apply(this, arguments);
                td.style.fontWeight = 'bold';
              }
            },
            { 
              data: 1, 
              className: 'htLeft',
              renderer: function(instance, td, row, col, prop, value, cellProperties) {
                if (value && typeof value === 'string') {
                  const lines = value.split('\n').filter(line => line.trim());
                  if (lines.length > 0) {
                    const html = '<ul style="margin: 0; padding-left: 20px; text-align: left;">' + 
                      lines.map(line => `<li style="margin-bottom: 0.25rem; text-align: left;">${line.trim()}</li>`).join('') + 
                      '</ul>';
                    td.innerHTML = html;
                    td.style.verticalAlign = 'top';
                    td.style.paddingTop = '0.5rem';
                    td.style.paddingBottom = '0.5rem';
                    td.style.textAlign = 'left';
                  } else {
                    Handsontable.renderers.TextRenderer.apply(this, arguments);
                    td.style.textAlign = 'left';
                  }
                } else {
                  Handsontable.renderers.TextRenderer.apply(this, arguments);
                  td.style.textAlign = 'left';
                }
              }
            }
          ]
        });
      }
    }
  });
}

// 학생 A 탐침 질문 만들기 관련 변수
let probingDocIdA = null;
let probingQuestionsTablesA = {};

// 학생 B 탐침 질문 만들기 관련 변수
let probingDocIdB = null;
let probingQuestionsTablesB = {};

// 과제 정보 가져오기 (HTML에서)
function getQuestionInfo(questionNum) {
  // 과제 본문 가져오기
  const questionItems = document.querySelectorAll('.question-item');
  let questionText = '';
  if (questionItems[questionNum - 1]) {
    const questionContent = questionItems[questionNum - 1].querySelector('.question-content p');
    questionText = questionContent ? questionContent.textContent.trim() : '';
  }

  // 예시 답안 가져오기
  const questionContentDiv = document.getElementById(`question-${questionNum}-content`);
  const answerTextEl = questionContentDiv?.querySelector('.answer-text p');
  const answerText = answerTextEl ? answerTextEl.textContent.trim() : '';

  // 평가 기준 가져오기
  const criteriaTable = criteriaTables[questionNum];
  const criteria = criteriaTable ? criteriaTable.getData() : [];

  return {
    text: questionText,
    answer: answerText,
    criteria: criteria
  };
}

// 학생 A 시작하기 버튼 클릭
async function startProbingA() {
  if (!currentUser) {
    Swal.fire({
      icon: 'error',
      title: '로그인 필요',
      text: '로그인 후 이용해주세요.'
    });
    return;
  }

  try {
    // Firestore 문서 생성
    const now = new Date();
    const startTime = {
      date: now.toISOString().split('T')[0],
      time: now.toTimeString().split(' ')[0].substring(0, 5)
    };

    // 과제 정보 수집
    const questions = {};
    // 학생 A의 과제별 답변 초기 데이터 (건강불평등)
    const studentAAnswers = {
      1: '우선 예시에 있던 문제에서 나왔던 그 사례가 고용 유형이랑… 잠시만요. 고용 유형이랑 사업장 규모였는데, 저는 어떤 불평등이 있을까 생각을 하다가 최근에 뉴스에서 나온 주 52시간 근무제 예외에 관한 뉴스가 생각이 났습니다. 그게 반도체 산업에서 추가적으로 산업의 특성 때문에 추가로 근무를 해야 된다는 얘기였는데, 그거랑 관련해서 전에 윤석열 정부에서 주 69시간 근무 제도 얘기를 했었고, 한국 사회가 예전에 그랬던 것처럼 야근이나 연장근무를 장려하는 문화가 있었던 걸로 알고 있어서, 그것과 관련해서 근무량이 많아지면 건강 악화 정도가 눈에 띄게 증가하는가를 규명해 보고자 했습니다. 이를 통해서 근무시간 제도 변경 시 주장에 대한 찬반 근거로서 이 연구를 활용하고, 과도한 업무 부담을 주는 사회 분위기를 바꿀 수 있지 않을까 생각합니다.',
      2: '관심 집단은 같은 직종, 비슷한 근무 환경이지만 근무시간만 차이나는 기업의 사람들을 전체적으로 조사를 해서 이상치를 제외하고 평균치로 비교하고자 합니다. 조사할 데이터는 주관적 건강 수준, 각종 질병 발생률, 시간에 따른 건강 악화 정도를 조사할 것입니다. 시간당 악화 정도가 중요하다고 생각해서 전체 비교와 시간당 비교를 두 번 진행하고 싶습니다. 기간은 직종별로 굉장히 다를 것 같은게, 근속시간이 엄청 긴 직종도 있고, 짧은 직종도 있어서 다를 수 있지만 긴 직종으로 했을 때, 한 2년 정도 조사하면 괜찮을 것 같습니다. 수집 방식은 주관적으로 물어볼 수 있는 것은 설문조사로 하고, 객관적 데이터는 건강검진 데이터 등을 통해 확보하겠습니다.',
      3: '세 번째는 어떤 분석을 수행할지, 가설이 맞을 때, 틀릴 때를 표현하는 건데, 앞에서 얘기한 것처럼 건강 수준이나 시간에 따라 건강이 악화되는 정도가 유의미하게 차이가 있는지 예시 자료처럼 도표로 분석할 겁니다. 제가 시간이 넉넉하지 않아 굉장히 간소화된 도표만 그렸지만, 저 데이터 하나 뿐만 아니라 여러 데이터를 막대그래프로 데이터화 시켜서 비교하면 좋겠다고 생각했습니다. 가설이 맞으면 건강악화 정도-특히 시간당 악화 정도-가 유의미하게 차이가 날 것이고, 만약에 이 가설이 유의미하지 않다면 시간 당 건강악화 정도가 그렇게 큰 차이가 나지 않을 것입니다.',
      4: '수집한 데이터 표본이 전체 집단을 대표하지 못할 가능성은 어느 정도 있을 수 밖에 없는게, 제가 설정한 데이터 포본이 같은 직종, 다른 환경적인 측면이 같은데 근무시간만 다른 회사를 설정을 했습니다. 이런 회사를 찾기 힘들고, 그런 회사들만 비교한다고 해서 전체 경향성을 나타내기 어렵다고 생각합니다. 이를 보완 방법은 더 다양한 요소의 변인들을 하나씩 바꿔서 훨씬 더 많은 비교를 해야한다고 생각합니다. 예를 들어 근무시간만 다르고 다른 변인들은 전부 같은데, 또 급여만 다를 경우에, 어떤 영향이 있는지 아니면 근무하는 환경이 실내인지 실외인지 이런것도 영향이 있는지 분석할 수 있고 이런식으로 되게 다양한 비교를 해야 보완할 수 있다고 생각했습니다.',
      5: '연구 결과에서 결국 이야기하고 싶었던 것은 연장근무를 했을 때 노동자가 얼마나 건강이 약화될 수 있는지를 얘기하고 싶었고, 이를 실제로 적용시킬려면 연장근무를 강제하는 분위기를 없애야 한다고 생각했습니다. 이를 실행하기 위해서 연장근무를 할 때, 추가적인 서류를 내야 한다든지 아니면 추가적인 절차를 필요하게 해서 회사 입장에서도 함부로 연장근무를 강제하는 그런 문화를 없앨 수 있지 않을까라고 제안해보고 싶습니다. 유의할 점은 이렇게 했는데도 연장근무를 하는 분위기는 사라지지 않았는데 오히려 노동자가 이제 제출해야 되는 서류라던지 절차가 복잡해져서 할 일만 늘어나는 그런 허울뿐인 정책이 되면 안 될 것 같습니다.'
    };
    
    for (let i = 1; i <= 5; i++) {
      const info = getQuestionInfo(i);
      // 평가 기준을 객체 배열로 변환 (Firestore는 중첩 배열을 지원하지 않음)
      const criteriaArray = info.criteria.map(row => ({
        capability: row[0] || '',
        criteria: row[1] || ''
      }));
      
      questions[i] = {
        text: info.text,
        exampleAnswer: info.answer,
        criteria: criteriaArray,
        studentAnswer: studentAAnswers[i] || '',
        probingQuestions: []
      };
    }

    const docData = {
      scenario: '건강불평등',
      questions: questions,
      studentType: 'A',
      startTime: startTime,
      endTime: null,
      uid: currentUser.uid,
      userName: currentUser.displayName || currentUser.email?.split('@')[0] || '사용자',
      userEmail: currentUser.email || '',
      displayName: currentUser.displayName || '익명',
      email: currentUser.email || '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    const docRef = await addDoc(collection(db, 'probingQuestions'), docData);
    probingDocIdA = docRef.id;

    // 저장 상태 초기화
    resetSaveStatus('a');

    // 화면 전환
    document.getElementById('student-a-start-screen').style.display = 'none';
    document.getElementById('student-a-work-screen').style.display = 'block';

    // 과제 정보 표시 및 Handsontable 초기화
    initProbingQuestionScreens();

    // 초기 답변 표시
    for (let i = 1; i <= 5; i++) {
      const studentAnswerContainer = document.getElementById(`student-a-answer-${i}`);
      if (studentAnswerContainer && studentAAnswers[i]) {
        const answerText = studentAAnswers[i].replace(/\n/g, '<br>');
        let content = `<p style="margin: 0; text-indent: 1em; line-height: 1.8;">${answerText}</p>`;
        
        // 과제 3의 경우 이미지 추가 (답변 아래)
        if (i === 3) {
          content += `<img src="probingQuestion/health_inequality_stdA_03.png" alt="학생 A 답변 이미지" style="max-width: 100%; height: auto; margin-top: 1rem; border-radius: 6px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);">`;
        }
        
        studentAnswerContainer.innerHTML = content;
      }
    }

    // 저장된 데이터를 Handsontable에 로드 (약간의 지연 후 실행)
    setTimeout(() => {
      loadProbingDataFromFirestore();
    }, 100);

    Swal.fire({
      icon: 'success',
      title: '시작되었습니다',
      text: '탐침 질문 작성을 시작하세요!',
      timer: 2000,
      showConfirmButton: false
    });
  } catch (error) {
    console.error('문서 생성 오류:', error);
    Swal.fire({
      icon: 'error',
      title: '오류',
      text: '작업을 시작하는 중 오류가 발생했습니다.'
    });
  }
}

// 학생 B 시작하기 버튼 클릭
async function startProbingB() {
  if (!currentUser) {
    Swal.fire({
      icon: 'error',
      title: '로그인 필요',
      text: '로그인 후 이용해주세요.'
    });
    return;
  }

  try {
    // Firestore 문서 생성
    const now = new Date();
    const startTime = {
      date: now.toISOString().split('T')[0],
      time: now.toTimeString().split(' ')[0].substring(0, 5)
    };

    // 과제 정보 수집
    const questions = {};
    // 학생 B의 과제별 답변 초기 데이터 (건강불평등)
    const studentBAnswers = {
      1: '네 저는 거주지 주변에 녹지 정도의 차이가 건강 불평등으로 이어진다고 하는 연구를 진행해 보려고 합니다. 일단 먼저 제가 하고 싶은 주장은 녹지는 사람의 삶에 큰 영향을 미치는 부분인데 깨끗한 공기뿐만 아니라 운동할 공간, 그리고 사람들끼리 시민들끼리 할 수 있는 사회적 화합의 장의 역할을 합니다. 그래서 이는 육체적 건강뿐만 아니라 정신적 건강에도 도움을 주는 공간인데요. 그렇기 때문에 저는 녹지의 정도가 시민들의 건강에도 큰 영향을 끼친다고 생각을 하고 있습니다. 그렇기 때문에 이것이 녹지가 건강 불평등으로 이어진다고 하는 주장을 하려고 합니다. 이 연구의 필요성을 먼저 말씀드리겠습니다. 이 연구의 필요성은 우리나라의 급진적이고 무분별한 개발과 도시화로 인해서 녹지가 점점 부족해지고 있는 현상이 나타나고 있는데요. 그래서 시민들의 쉼터와 건강을 책임질 공간이 부족해지고 또 그 극소수의 공간들이 유료화되는 현상이 벌어지고 있는 점에 주목하였습니다. 소도시가 아닌 이상 대도시에서의 녹지는 대부분 녹지 근처에 거주하기 위해서는 아주 비싼 돈을 지불해야 됩니다. 그래서 이것이 아주 우리 사회의 큰 문제라고 주목을 하였습니다. 이 연구의 목적은 그린벨트의 보호라든지 혹은 공원과 산책길 등을 개발하고 녹지를 유지하려는 정부의 정책을 더 지지하기 위해서 이런 연구를 시행하게 되었습니다.',
      2: '네, 문제 2번 답변을 드리자면 일단 먼저 관심 집단을 4개로 선정하였습니다. 우선 인구 20만 명 이하의 시, 군의 녹지지대 하나, 그리고 인구 20만 명 이하의 시, 군의 녹지가 아주 소규모의 녹지가 있는 지대 하나, 그리고 C는 100만 명 이상의 대도시의 녹지지대 하나, D는 100만명 이상의 시부에 녹지가 없는 지대라고 적었는데 정정하겠습니다.  A와 C는 뭔가 정확한 숫자는 모르지만 큰 규모의 녹지가 큰 규모의 녹지 하나 그리고 그 주변의 지대를 말하는 거고 B, D는 아주 작은 녹지 하나 그리고 그 주변의 지대를 말합니다. 그래서 한 지역당 뭔가 녹지 지대 하나를 선정하고 그 주변 변수를 보면 아시겠지만 반경 3KM 이내의 거주민들에 대해서 조사를 해보려고 합니다. 그래서 이런 관심 집단을 바탕으로 데이터를 10개를 생각을 해보았는데요. 먼저 독립변수로는 이렇게 7개가 있는데 혹시 다 읽어드려야 되나요? 1번은 그 도시에 선정된 녹지의 크기 제곱미터를 통해서 녹지의 크기 얼마나 되는지 확인을 해보고 두 번째로 녹지에서 반경 3KM 이내에 거주민이 얼마나 있는지 거주민의 수를 체크해봅니다. 제가 3KM라고 주장한 것은 좀 멀긴 해도 그 정도면 걸어가거나 금방 갈 수 있는 거리라고 생각을 해서 3KM로 선정을 하였습니다 그 다음에는 3, 4번은 같은 반경 3KM 이내에 거주민의 소득 분위와 가족 구성 나이, 성별, 가족 구성원의 수 등을 확인을 하고요. 5번에서는 방문하는 계절별 한 달 평균 방문자의 수 그리고 6번 계절별 한 달 평균 대기 상태를 체크하고 7번은 그 녹지 근처에 자전거나 운동기구 등이 있다면 그 대여소의 대여 빈도수를 체크하려고 합니다. 이 모든 독립변수는 계절별로 한 달마다 평균치를 내려고 하는데요. 왜냐하면 다양한 환경이기 때문에 계절마다 예를 들어서 겨울에는 사람들이 녹지에 많이 방문을 하지 않을 수 있기 때문에 계절별의 차이가 큰 차이가 될 것 같고, 또 한 달 평균로 낸 것은 당연히 뭔가 변수가 있을 수 있기 때문에 한 달을 기준으로 잘라서 12개월을 확인하면 좋을 것 같다고 생각하였습니다. 그래서 종속변수로는 8번 근처 아파트나 주택가에 아까 3KM 이내라고 한 그 부분에서 정신 건강 테스트를 시행을 해서 우울증 검사나 그런 정신 건강에 대한 테스트를 시행을 하면 좋을 것 같은데 물론 당연히 그렇게 길거리를 다니는 시민들에게 테스트를 시행을 요청하면 안 받아줄 가능성이 높으니까 간단하게 주관적 정신건강상태를 1번에서 10번 정도로 나타내달라고 하는 검사를 여론조사와 같이 전화를 통해서 하는 것도 대안이 될 수 있을 것 같습니다. 9번에서는 주관적으로 신체건강상태에 답변을 하는데 같이 여론조사와 같이 전화를 통해서 표본 추출을 통해서 몇 명에게 전화를 거는 방식이 좋을 것 같고요. 10번으로는 보건소에서 무료 건강검진센터 같은 곳이 있다면 그곳에서 건강검진을 하는 사람들의 건강이 어떤 상태인지 체크를 하는 것이 좋을 것 같습니다. 8번은 정신, 그리고 9번, 10번은 육체 건강의 측정을 위해서 나타낸 것입니다.',
      3: '이렇게 여기까지 되는 변수를 바탕으로 가설을 네 가지를 설정을 하였는데요. 가설을 먼저 말씀을 드리자면 첫 번째 가설은 대기 상태가 좋을수록 건강 상태가 좋을 것이다. 두 번째는 녹지 크기가 클수록 운동을 많이 할 것이고 이것이 건강 상태에 기여를 한다. 3번 녹지 크기가 클수록 정신 건강이 높아질 것이다. 그리고 마지막 가설 4번은 대도시일수록 경제적 수준이 높고, 특히 대도시일수록, 경제적 수준이 높을수록 녹지 근처에 거주할 확률이 높다는 것인데요. 1번 먼저 설명을 드리자면 녹지가 미세먼지에 영향을 끼친다는 선행 연구를 통해서 그것이 영향이 있음을 증명을 하고, 그 뒤에 이 미세먼지가 육체나 정신 건강 상태에 영향을 끼친다는 걸 얘기할 건데 1번 데이터에서의 녹지 크기 그리고 6번 데이터에서 대기 상태를 통해서 8, 9, 10의 정신 건강과 육체 건강에 영향이 있음을 분석을 하면 좋을 것 같고요. 10번에서 특히 폐렴이나 호흡기 질환 위주로 체크를 하면 좋을 것 같습니다. 그리고 전반적으로 도표와 그림은 제가 그릴 시간이 없어서 그리지 못했지만 말로 설명드리겠습니다. 그리고 2번 가설은 녹지 크기가 클수록 운동을 많이 하고 건강이 높아질 것이다. 인데요. 녹지 크기가 큰 곳일수록 운동을 하는 빈도가 높다는 것은 자전거나 운동기구의 대여 빈도 그리고 녹지의 방문자 수를 통해서 체크를 할 수 있고요. 이걸 통해서 종속변수인 육체와 정신건강에 영향을 미칠 것이라는 가설입니다. 가설 3번은 녹지 크기가 클수록 정신건강이 높다는 것인데 저는 개인적으로 녹지는 운동 공간, 미세먼지 뿐만이 아니라 사람들이 모이는 아고라의 역할도 하고 사회적 화합의 역할을 한다고 생각합니다. 그렇기 때문에 정신건강에 영향을 줄 것을 크게 느껴서 정신건강만 따로 분류하여서 어떤 녹지 크기가 정신건강에 어떤 영향을 미치는지 분석을 하려고 하고요. 아 그리고 5번은 방문자 수입니다. 5번 데이터는 가설 4번은 대도시일수록 경제적 수준이 높고, 대도시일수록 경제적 수준이 높을수록 녹지 근처에 거주할 확률이 높…, 경제적 수준이 높을수록 녹지 근처에 많이 거주한다입니다. 그래서 대도시와 소도시로 분류한 A, B와 C, D 집단에서 각각 1, 2, 3, 4번의 데이터를 체크하면 되는데요. 대도시 앞에서 제가 연구의 목적과 필요성을 말씀드릴 때 소도시에서는 사실 크게 경제적 수준과 녹지 근처 거주 여부가 차이가 나지 않을 수가 있지만 서울과 같은 대도시일수록 특히 경제적 수준이 높아야만 녹지 근처에 거주할 수 있을 것 같다고 말씀을 드렸는데, 이것을 증명하기 위해서 경제적 수준을 체크하고 녹지 근처에 사는 사람들의 경제적 수준을 체크하면 이것을 판단할 수 있을 것이라고 생각했습니다. 그런데 대도시와 소도시 여부를 판단하기 위해서 A, B와 C, D의 차이를 분석하면 될 것이라고 보았습니다.',
      4: '문제 4번은 데이터 표본이 전체 집단을 대표하지 않거나 한계가 있는지 얘기해보라는 것인데 일단 첫 번째로는 제가 활동한 연구는 각 도시의 녹지 하나만을 선정하는 것입니다. 하지만 녹지가 많이 없는 공간이라면 그 녹지 하나가 큰 영향을 미치겠지만 녹지가 작지만 여러 군데 있다든지와 같은 상황이 있으면은 거주민도 사실 여러군 데의 녹지에 쉽게 방문을 할 수 있고 그렇기 때문에 거주민의 녹지의 방문 빈도라던지 다양한 것이 분산되기 때문에 큰 의미가 떨어질 것이라고 예상이 됩니다. 또한 제가 운동 상태를 체크하기 위해서 자전거 등 운동기구 대여소가 있을 것임을 가정했는데, 그런 것이 없는 녹지가 더 많을 것이기 때문에 운동 상태를 체크하기 어렵습니다. 하지만 방문자 수가 많을 운동을 체크하기엔 어려울 것이라 판단해서 혹시 가능하다면 자전거 대여소가 있으면 운동 상태를 체크하기 더 좋을 것 같아서 그 데이터를 포함하였습니다. 그리고 또 건강 상태와 정신건강 상태를 판단을 할 때 사실 개인의 건강검진 결과를 보지 않는 이상 전화응답 등 설문조사를 통해서 주관적인 개인의 판단에 의존하고 있기 때문에 조사의 신뢰성이 떨어질 수 있습니다. 그래서 보안책을 말씀드렸는데 보안책으로는 그래서 녹지를 A, B, C, D 4군데만 선정을 하는 것이 아니라 A, B, C, D 안에서도 다양한 녹지를 선정을 해가지고 다양성을 증대하는 것이 중요할 것 같다고 생각을 하였고요. 특징이 다양한 여러 곳에 분포된 녹지를 선정하는 것이 도움이 될 것 같고 또 랜덤으로 근처 3KM 이내 거주민의 전화 응답을 돌리는 것보다 특정 실험자를 선정해서 그 사람의 건강 상태와 운동 빈도 등을 꾸준히 체크하는 것이 조금 더 정확한 조사가 가능할 것이라고 판단을 하였습니다.',
      5: '마지막 문제는… 제가 예상한 연구 결과는 가설이 다 충족된다고 생각을 하였고요. 그래서 이 결과를 통해서 교육 수준 향상을 위한 새로운 보건 정책을 제안해 보도록 하겠습니다. 그래서 제가 생각한 건 소도시보다는 대도시가 특히 녹지와 건강 상태의 여부에 큰 영향을 미칠 거라고 생각했는데 그래서 새로운 보건 정책으로 첫 번째로는 초중고등학교 근처에 운동장을 필수로 지어야 하는 것으로 알고 있습니다. 근데 운동장 말고도 일정 크기의 녹지나 혹은 텃밭 같은 것을 필수로 건설하도록 정책을 바꾸어서 자라나는 성장기의 아이들이 녹지를 함께 느끼고 즐기면서 자라날 수 있도록 한다면 녹지를 더 많이 늘릴 수 있을 것이라고 생각을 하였습니다. 이렇게 한다면 잘하는 학생들의 정신건강과 육체 건강에 더 큰 도움이 될 것이고 이것이 교육에도 교육과 학생들의 학습에도 큰 영향을 미칠 것이라고 생각을 했습니다. 왜냐하면 요즘 학생들은 사실 학교나 집을 왔다 갔다 하는 과정에서 녹지가 없는 이상 녹지를 찾아가거나 맞닥뜨릴 일이 좀 부족해진 것이 현실인데요. 그리고 또한 학습으로 인한 우울증이라든지 정신건강상태에 어려움을 호소하는 학생들이 많기 때문에 이들을 돕기 위해서 학교 근처에 녹지를 필수로 지정하고, 보존하는 것이 필요하다고 생각을 하였습니다. 두 번째로 생각한 보건정책은요. 교육과정에 생태체험학습을 포함시키는 것입니다. 계절별로 1년에 한 번씩 현장체험학습을 가는 것 말고도 한 달에 한 번 혹은 계절에 한 번씩 학교 근처에 녹지나 자연환경에 방문해서 생태체험을 하고 자연과 교감할 수 있는 시간을 필수적으로 지정을 해주는 것이 필요하다고 생각합니다. 이것이 만약에 이변이 어느 정도 있다고 하더라도 그 빈도수를 현저히 늘려야 할 것이라고 판단이 됩니다.'
    };
    
    for (let i = 1; i <= 5; i++) {
      const info = getQuestionInfo(i);
      // 평가 기준을 객체 배열로 변환 (Firestore는 중첩 배열을 지원하지 않음)
      const criteriaArray = info.criteria.map(row => ({
        capability: row[0] || '',
        criteria: row[1] || ''
      }));
      
      questions[i] = {
        text: info.text,
        exampleAnswer: info.answer,
        criteria: criteriaArray,
        studentAnswer: studentBAnswers[i] || '',
        probingQuestions: []
      };
    }

    const docData = {
      scenario: '건강불평등',
      questions: questions,
      studentType: 'B',
      startTime: startTime,
      endTime: null,
      uid: currentUser.uid,
      displayName: currentUser.displayName || '익명',
      email: currentUser.email || '',
      createdAt: serverTimestamp()
    };

    const docRef = await addDoc(collection(db, 'probingQuestions'), docData);
    probingDocIdB = docRef.id;

    // 저장 상태 초기화
    resetSaveStatus('b');

    // 화면 전환
    document.getElementById('student-b-start-screen').style.display = 'none';
    document.getElementById('student-b-work-screen').style.display = 'block';

    // 과제 정보 표시 및 Handsontable 초기화
    initProbingQuestionScreensB();

    // 초기 답변 표시
    for (let i = 1; i <= 5; i++) {
      const studentAnswerContainer = document.getElementById(`student-b-answer-${i}`);
      if (studentAnswerContainer && studentBAnswers[i]) {
        const answerText = studentBAnswers[i].replace(/\n/g, '<br>');
        let content = `<p style="margin: 0; text-indent: 1em; line-height: 1.8;">${answerText}</p>`;
        
        // 과제 3의 경우 이미지 추가 (답변 아래)
        if (i === 3) {
          content += `<img src="probingQuestion/health_inequality_stdB_03.png" alt="학생 B 답변 이미지" style="max-width: 100%; height: auto; margin-top: 1rem; border-radius: 6px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);">`;
        }
        
        studentAnswerContainer.innerHTML = content;
      }
    }

    // 저장된 데이터를 표시 (약간의 지연 후 실행)
    setTimeout(() => {
      loadProbingDataFromFirestoreB();
    }, 100);

    Swal.fire({
      icon: 'success',
      title: '시작되었습니다',
      text: '탐침 질문 작성을 시작하세요!',
      timer: 2000,
      showConfirmButton: false
    });
  } catch (error) {
    console.error('문서 생성 오류:', error);
    Swal.fire({
      icon: 'error',
      title: '오류',
      text: '작업을 시작하는 중 오류가 발생했습니다.'
    });
  }
}

// 과제 정보 표시 및 Handsontable 초기화 (학생 B)
function initProbingQuestionScreensB() {
  // 과제 1~5 정보 표시
  for (let i = 1; i <= 5; i++) {
    const questionInfo = getQuestionInfo(i);
    const questionTextEl = document.getElementById(`question-${i}-text-b`);
    const answerEl = document.getElementById(`question-${i}-answer-b`);
    
    // 과제 본문 표시
    if (questionTextEl) {
      questionTextEl.textContent = questionInfo.text;
    }
    
    // 예시 답안 표시 (면접 자료 탭의 HTML을 그대로 복사)
    if (answerEl) {
      const materialsAnswerEl = document.querySelector(`#question-${i}-content .answer-text`);
      if (materialsAnswerEl) {
        answerEl.innerHTML = materialsAnswerEl.innerHTML;
      } else {
        answerEl.textContent = questionInfo.answer;
      }
    }

    // 평가 기준 테이블 표시
    const criteriaContainer = document.getElementById(`question-${i}-criteria-b`);
    if (criteriaContainer) {
      // 기존 테이블이 있으면 제거
      const existingTable = criteriaContainer.querySelector('.handsontable');
      if (existingTable) {
        // Handsontable 인스턴스가 있다면 destroy
        const hotInstance = Handsontable.getInstance(criteriaContainer);
        if (hotInstance) {
          hotInstance.destroy();
        }
      }
      
      const criteriaData = questionInfo.criteria || [['', '']];
      const rowCount = criteriaData.length;
      const calculatedHeight = Math.max(150, (rowCount + 1) * 50 + 20);
      
      new Handsontable(criteriaContainer, {
        data: criteriaData,
        colHeaders: ['역량', '평가 기준'],
        rowHeaders: true,
        contextMenu: true,
        colWidths: [100, 400],
        minRows: 1,
        minCols: 2,
        licenseKey: 'non-commercial-and-evaluation',
        width: '100%',
        height: calculatedHeight,
        stretchH: 'all',
        manualRowResize: true,
        manualColumnResize: true,
        autoWrapRow: true,
        autoWrapCol: true,
        autoRowSize: true,
        wordWrap: true,
        readOnly: true,
        columns: [
          { 
            data: 0, 
            className: 'htCenter',
            renderer: function(instance, td, row, col, prop, value, cellProperties) {
              Handsontable.renderers.TextRenderer.apply(this, arguments);
              td.style.fontWeight = 'bold';
              td.style.textAlign = 'center';
            }
          },
          { 
            data: 1, 
            className: 'htLeft'
          }
        ],
        afterRender: function() {
          // Handsontable 렌더링 후 높이 재조정
          const instance = this;
          setTimeout(() => {
            try {
              // 실제 DOM 요소의 높이를 측정
              const tableElement = instance.rootElement;
              if (tableElement) {
                const wtHolder = tableElement.querySelector('.ht_master .wtHolder');
                if (wtHolder) {
                  const tableBody = wtHolder.querySelector('.ht_master table tbody');
                  const tableHeader = wtHolder.querySelector('.ht_master table thead');
                  
                  if (tableBody && tableHeader) {
                    // 헤더 높이
                    const headerHeight = tableHeader.offsetHeight;
                    // 각 행의 실제 높이 합산
                    let bodyHeight = 0;
                    const rows = tableBody.querySelectorAll('tr');
                    rows.forEach(row => {
                      bodyHeight += row.offsetHeight;
                    });
                    
                    // 총 높이 계산 (여유 공간 포함)
                    const totalHeight = headerHeight + bodyHeight + 10;
                    instance.updateSettings({ height: totalHeight });
                  }
                }
              }
            } catch (error) {
              console.error('높이 계산 오류:', error);
              // 오류 발생 시 기본 높이 사용
              const rowCount = instance.countRows();
              const fallbackHeight = Math.max(200, (rowCount + 1) * 60 + 30);
              instance.updateSettings({ height: fallbackHeight });
            }
          }, 200);
        }
      });
    }

    // 탐침 질문 Handsontable 초기화
    const probingContainer = document.getElementById(`probing-questions-b-${i}`);
    if (probingContainer && !probingQuestionsTablesB[i]) {
      probingQuestionsTablesB[i] = new Handsontable(probingContainer, {
        data: [['', '']],
        colHeaders: ['상황 분석', '탐침질문'],
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
        autoWrapRow: true,
        autoWrapCol: true,
        autoRowSize: true
      });
    }
  }

  // 과제별 탭 전환 기능
  initProbingQuestionTabsB();
}

// Firestore에서 저장된 데이터를 불러와 Handsontable에 표시 (학생 B)
async function loadProbingDataFromFirestoreB() {
  if (!probingDocIdB) return;

  try {
    const docRef = doc(db, 'probingQuestions', probingDocIdB);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      const questions = data.questions || {};

      // 각 과제별로 데이터 로드
      for (let i = 1; i <= 5; i++) {
        const questionData = questions[i];
        if (!questionData) continue;

        // 학생 B 답변 표시 (텍스트로)
        const studentAnswerContainer = document.getElementById(`student-b-answer-${i}`);
        if (studentAnswerContainer && questionData.studentAnswer) {
          // HTML로 변환 (줄바꿈 처리)
          const answerText = questionData.studentAnswer.replace(/\n/g, '<br>');
          
          // 과제 3의 경우 이미지 추가 (답변 아래)
          let content = `<p style="margin: 0; text-indent: 1em; line-height: 1.8;">${answerText}</p>`;
          if (i === 3) {
            content += `<img src="probingQuestion/health_inequality_stdB_03.png" alt="학생 B 답변 이미지" style="max-width: 100%; height: auto; margin-top: 1rem; border-radius: 6px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);">`;
          }
          
          studentAnswerContainer.innerHTML = content;
        }

        // 탐침 질문 로드
        if (probingQuestionsTablesB[i] && questionData.probingQuestions && questionData.probingQuestions.length > 0) {
          const probingData = questionData.probingQuestions.map(item => {
            if (typeof item === 'object' && item.situation !== undefined) {
              // 객체 형태로 저장된 경우
              return [item.situation || '', item.question || ''];
            } else if (Array.isArray(item)) {
              // 배열 형태로 저장된 경우 (이전 형식)
              return item;
            }
            return ['', ''];
          });
          probingQuestionsTablesB[i].loadData(probingData);
        }
      }
    }
  } catch (error) {
    console.error('데이터 불러오기 오류:', error);
  }
}

// 과제별 탭 전환 (학생 B)
function initProbingQuestionTabsB() {
  const tabButtons = document.querySelectorAll('#student-b-work-screen .question-tab-button[data-question]');
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const targetQuestion = button.getAttribute('data-question');
      
      // 모든 탭 비활성화
      tabButtons.forEach(btn => btn.classList.remove('active'));
      document.querySelectorAll('#student-b-work-screen .question-probing-content').forEach(content => {
        content.style.display = 'none';
        content.classList.remove('active');
      });

      // 선택한 탭 활성화
      button.classList.add('active');
      const targetContent = document.getElementById(`question-${targetQuestion}-probing-content-b`);
      if (targetContent) {
        targetContent.style.display = 'block';
        targetContent.classList.add('active');
      }
    });
  });
}

// 과제 정보 표시 및 Handsontable 초기화
function initProbingQuestionScreens() {
  // 과제 1~5 정보 표시
  for (let i = 1; i <= 5; i++) {
    const questionInfo = getQuestionInfo(i);
    const questionTextEl = document.getElementById(`question-${i}-text`);
    const answerEl = document.getElementById(`question-${i}-answer`);
    
    // 과제 본문 표시
    if (questionTextEl) {
      questionTextEl.textContent = questionInfo.text;
    }
    
    // 예시 답안 표시 (면접 자료 탭의 HTML을 그대로 복사)
    if (answerEl) {
      const materialsAnswerEl = document.querySelector(`#question-${i}-content .answer-text`);
      if (materialsAnswerEl) {
        answerEl.innerHTML = materialsAnswerEl.innerHTML;
      } else {
        answerEl.textContent = questionInfo.answer;
      }
    }

    // 평가 기준 테이블 표시
    const criteriaContainer = document.getElementById(`question-${i}-criteria`);
    if (criteriaContainer && criteriaTables[i]) {
      // 기존 테이블이 있으면 제거하고 새로 생성
      if (criteriaContainer.querySelector('.handsontable')) {
        criteriaTables[i].destroy();
      }
      
      const criteriaData = questionInfo.criteria || [['', '']];
      const rowCount = criteriaData.length;
      const calculatedHeight = Math.max(150, (rowCount + 1) * 50 + 20);
      
      criteriaTables[i] = new Handsontable(criteriaContainer, {
        data: criteriaData,
        colHeaders: ['역량', '평가 기준'],
        rowHeaders: true,
        contextMenu: true,
        colWidths: [100, 400],
        minRows: 1,
        minCols: 2,
        licenseKey: 'non-commercial-and-evaluation',
        width: '100%',
        height: calculatedHeight,
        stretchH: 'all',
        manualRowResize: true,
        manualColumnResize: true,
        autoWrapRow: true,
        autoWrapCol: true,
        autoRowSize: true,
        wordWrap: true,
        readOnly: true,
        columns: [
          { 
            data: 0, 
            className: 'htCenter',
            renderer: function(instance, td, row, col, prop, value, cellProperties) {
              Handsontable.renderers.TextRenderer.apply(this, arguments);
              td.style.fontWeight = 'bold';
              td.style.textAlign = 'center';
            }
          },
          { 
            data: 1, 
            className: 'htLeft'
          }
        ],
        afterRender: function() {
          // Handsontable 렌더링 후 높이 재조정
          const instance = this;
          setTimeout(() => {
            try {
              // 실제 DOM 요소의 높이를 측정
              const tableElement = instance.rootElement;
              if (tableElement) {
                const wtHolder = tableElement.querySelector('.ht_master .wtHolder');
                if (wtHolder) {
                  const tableBody = wtHolder.querySelector('.ht_master table tbody');
                  const tableHeader = wtHolder.querySelector('.ht_master table thead');
                  
                  if (tableBody && tableHeader) {
                    // 헤더 높이
                    const headerHeight = tableHeader.offsetHeight;
                    // 각 행의 실제 높이 합산
                    let bodyHeight = 0;
                    const rows = tableBody.querySelectorAll('tr');
                    rows.forEach(row => {
                      bodyHeight += row.offsetHeight;
                    });
                    
                    // 총 높이 계산 (여유 공간 포함)
                    const totalHeight = headerHeight + bodyHeight + 10;
                    instance.updateSettings({ height: totalHeight });
                  }
                }
              }
            } catch (error) {
              console.error('높이 계산 오류:', error);
              // 오류 발생 시 기본 높이 사용
              const rowCount = instance.countRows();
              const fallbackHeight = Math.max(200, (rowCount + 1) * 60 + 30);
              instance.updateSettings({ height: fallbackHeight });
            }
          }, 200);
        }
      });
    }

    // 학생 A 답변은 loadProbingDataFromFirestore 함수에서 표시됨

    // 탐침 질문 Handsontable 초기화
    const probingContainer = document.getElementById(`probing-questions-a-${i}`);
    if (probingContainer && !probingQuestionsTablesA[i]) {
      probingQuestionsTablesA[i] = new Handsontable(probingContainer, {
        data: [['', '']],
        colHeaders: ['상황 분석', '탐침질문'],
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
        autoWrapRow: true,
        autoWrapCol: true,
        autoRowSize: true
      });
    }
  }

  // 과제별 탭 전환 기능
  initProbingQuestionTabs();
}

// Firestore에서 저장된 데이터를 불러와 Handsontable에 표시
async function loadProbingDataFromFirestore() {
  if (!probingDocIdA) return;

  try {
    const docRef = doc(db, 'probingQuestions', probingDocIdA);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      const questions = data.questions || {};

      // 각 과제별로 데이터 로드
      for (let i = 1; i <= 5; i++) {
        const questionData = questions[i];
        if (!questionData) continue;

        // 학생 A 답변 표시 (텍스트로)
        const studentAnswerContainer = document.getElementById(`student-a-answer-${i}`);
        if (studentAnswerContainer && questionData.studentAnswer) {
          // HTML로 변환 (줄바꿈 처리)
          const answerText = questionData.studentAnswer.replace(/\n/g, '<br>');
          
          // 과제 3의 경우 이미지 추가 (답변 아래)
          let content = `<p style="margin: 0; text-indent: 1em; line-height: 1.8;">${answerText}</p>`;
          if (i === 3) {
            content += `<img src="probingQuestion/health_inequality_stdA_03.png" alt="학생 A 답변 이미지" style="max-width: 100%; height: auto; margin-top: 1rem; border-radius: 6px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);">`;
          }
          
          studentAnswerContainer.innerHTML = content;
        }

        // 탐침 질문 로드
        if (probingQuestionsTablesA[i] && questionData.probingQuestions && questionData.probingQuestions.length > 0) {
          const probingData = questionData.probingQuestions.map(item => {
            if (typeof item === 'object' && item.situation !== undefined) {
              // 객체 형태로 저장된 경우
              return [item.situation || '', item.question || ''];
            } else if (Array.isArray(item)) {
              // 배열 형태로 저장된 경우 (이전 형식)
              return item;
            }
            return ['', ''];
          });
          probingQuestionsTablesA[i].loadData(probingData);
        }
      }
    }
  } catch (error) {
    console.error('데이터 불러오기 오류:', error);
  }
}

// 과제별 탭 전환
function initProbingQuestionTabs() {
  const tabButtons = document.querySelectorAll('#student-a-work-screen .question-tab-button[data-question]');
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const targetQuestion = button.getAttribute('data-question');
      
      // 모든 탭 비활성화
      tabButtons.forEach(btn => btn.classList.remove('active'));
      document.querySelectorAll('.question-probing-content').forEach(content => {
        content.style.display = 'none';
        content.classList.remove('active');
      });

      // 선택한 탭 활성화
      button.classList.add('active');
      const targetContent = document.getElementById(`question-${targetQuestion}-probing-content`);
      if (targetContent) {
        targetContent.style.display = 'block';
        targetContent.classList.add('active');
      }
    });
  });
}

// 탐침 질문 저장
async function saveProbingQuestion(questionNum, studentType) {
  const probingDocId = studentType === 'a' ? probingDocIdA : probingDocIdB;
  const probingTables = studentType === 'a' ? probingQuestionsTablesA : probingQuestionsTablesB;
  
  if (!probingDocId) {
    Swal.fire({
      icon: 'error',
      title: '오류',
      text: '작업이 시작되지 않았습니다.'
    });
    return;
  }

  try {
    const probingTable = probingTables[questionNum];
    
    if (!probingTable) {
      Swal.fire({
        icon: 'error',
        title: '오류',
        text: '테이블이 초기화되지 않았습니다.'
      });
      return;
    }

    const probingDataRaw = probingTable.getData().filter(row => row[0] || row[1]);
    // 탐침 질문을 객체 배열로 변환 (Firestore는 중첩 배열을 지원하지 않음)
    const probingData = probingDataRaw.map(row => ({
      situation: row[0] || '',
      question: row[1] || ''
    }));
    
    // 학생 답변은 읽기 전용이므로 저장하지 않음 (이미 Firestore에 저장되어 있음)

    const docRef = doc(db, 'probingQuestions', probingDocId);
    await updateDoc(docRef, {
      [`questions.${questionNum}.probingQuestions`]: probingData,
      updatedAt: serverTimestamp()
    });

    // 저장 상태 업데이트
    const now = new Date();
    const saveTime = now.toTimeString().split(' ')[0].substring(0, 8); // HH:MM:SS 형식
    
    saveStatus[studentType][questionNum] = {
      saved: true,
      time: saveTime
    };
    
    // 상태 메시지 업데이트
    updateSaveStatus(questionNum, studentType);

    Swal.fire({
      icon: 'success',
      title: '저장 완료',
      text: `탐침 질문이 저장되었습니다. (${saveTime})`,
      timer: 2000,
      showConfirmButton: false
    });
  } catch (error) {
    console.error('저장 오류:', error);
    Swal.fire({
      icon: 'error',
      title: '오류',
      text: '저장 중 오류가 발생했습니다.'
    });
  }
}

// 저장 상태 메시지 업데이트 함수
function updateSaveStatus(questionNum, studentType) {
  const statusElement = document.querySelector(
    `.save-status[data-question="${questionNum}"][data-student="${studentType}"]`
  );
  
  if (!statusElement) return;
  
  const status = saveStatus[studentType][questionNum];
  
  if (status && status.saved) {
    statusElement.textContent = `저장됨 (${status.time})`;
    statusElement.style.color = '#10b981'; // 초록색
  } else {
    statusElement.textContent = '저장되지 않음';
    statusElement.style.color = '#ef4444'; // 빨간색
  }
}

// 모든 저장 상태 초기화 (새로 시작하기 클릭 시)
function resetSaveStatus(studentType) {
  saveStatus[studentType] = {};
  // 모든 상태 메시지 업데이트
  for (let i = 1; i <= 5; i++) {
    updateSaveStatus(i, studentType);
  }
}

// 제출하기
async function submitProbingA() {
  if (!probingDocIdA) {
    Swal.fire({
      icon: 'error',
      title: '오류',
      text: '작업이 시작되지 않았습니다.'
    });
    return;
  }

  const result = await Swal.fire({
    title: '제출하시겠습니까?',
    text: '제출 후에는 수정할 수 없습니다.',
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: '최종 제출하기',
    cancelButtonText: '취소'
  });

  if (result.isConfirmed) {
    try {
      const now = new Date();
      const endTime = {
        date: now.toISOString().split('T')[0],
        time: now.toTimeString().split(' ')[0].substring(0, 5)
      };

      const docRef = doc(db, 'probingQuestions', probingDocIdA);
      await updateDoc(docRef, {
        endTime: endTime,
        updatedAt: serverTimestamp()
      });

      Swal.fire({
        icon: 'success',
        title: '제출 완료',
        text: '탐침 질문이 제출되었습니다.',
        confirmButtonText: '확인'
      }).then(() => {
        // 화면 초기화
        document.getElementById('student-a-start-screen').style.display = 'block';
        document.getElementById('student-a-work-screen').style.display = 'none';
        probingDocIdA = null;
      });
    } catch (error) {
      console.error('제출 오류:', error);
      Swal.fire({
        icon: 'error',
        title: '오류',
        text: '제출 중 오류가 발생했습니다.'
      });
    }
  }
}

// 제출하기 (학생 B)
async function submitProbingB() {
  if (!probingDocIdB) {
    Swal.fire({
      icon: 'error',
      title: '오류',
      text: '작업이 시작되지 않았습니다.'
    });
    return;
  }

  const result = await Swal.fire({
    title: '제출하시겠습니까?',
    text: '제출 후에는 수정할 수 없습니다.',
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: '최종 제출하기',
    cancelButtonText: '취소'
  });

  if (result.isConfirmed) {
    try {
      const now = new Date();
      const endTime = {
        date: now.toISOString().split('T')[0],
        time: now.toTimeString().split(' ')[0].substring(0, 5)
      };

      const docRef = doc(db, 'probingQuestions', probingDocIdB);
      await updateDoc(docRef, {
        endTime: endTime,
        updatedAt: serverTimestamp()
      });

      Swal.fire({
        icon: 'success',
        title: '제출 완료',
        text: '탐침 질문이 제출되었습니다.',
        confirmButtonText: '확인'
      }).then(() => {
        // 화면 초기화
        document.getElementById('student-b-start-screen').style.display = 'block';
        document.getElementById('student-b-work-screen').style.display = 'none';
        probingDocIdB = null;
      });
    } catch (error) {
      console.error('제출 오류:', error);
      Swal.fire({
        icon: 'error',
        title: '오류',
        text: '제출 중 오류가 발생했습니다.'
      });
    }
  }
}

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', () => {
  initTablesA();
  initTablesB();
  initCriteriaTables();
  initMainTabs();
  initSubTabs();
  initQuestionTabs();
  initRowControlsA();
  initRowControlsB();
  initLoadButtons();
  
  // 초기 저장 상태 메시지 설정
  for (let i = 1; i <= 5; i++) {
    updateSaveStatus(i, 'a');
    updateSaveStatus(i, 'b');
  }
  
  // 탐침 질문 크게 보기 버튼
  const viewProbingBtn = document.getElementById('view-probing-questions-btn');
  if (viewProbingBtn) {
    viewProbingBtn.addEventListener('click', () => {
      showProbingQuestionsPopup();
    });
  }

  // 학생 A 시작하기 버튼
  const startBtnA = document.getElementById('start-probing-a-btn');
  if (startBtnA) {
    startBtnA.addEventListener('click', startProbingA);
  }

  // 저장 버튼들 (동적으로 생성되므로 이벤트 위임 사용)
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('save-probing-btn')) {
      const questionNum = e.target.getAttribute('data-question');
      const studentType = e.target.getAttribute('data-student');
      saveProbingQuestion(questionNum, studentType);
    }
  });

  // 제출하기 버튼
  const submitBtnA = document.getElementById('submit-probing-a-btn');
  if (submitBtnA) {
    submitBtnA.addEventListener('click', submitProbingA);
  }

  // 학생 B 시작하기 버튼
  const startBtnB = document.getElementById('start-probing-b-btn');
  if (startBtnB) {
    startBtnB.addEventListener('click', startProbingB);
  }

  // 제출하기 버튼 (학생 B)
  const submitBtnB = document.getElementById('submit-probing-b-btn');
  if (submitBtnB) {
    submitBtnB.addEventListener('click', submitProbingB);
  }

  // 이미지 클릭 시 팝업으로 크게 보기
  document.addEventListener('click', (e) => {
    if (e.target.tagName === 'IMG' && e.target.src) {
      const imgSrc = e.target.src;
      const imgAlt = e.target.alt || '이미지';
      
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
    }
  });

  // 내가 만든 탐침 질문 보기 버튼
  const viewMyProbingBtn = document.getElementById('view-my-probing-questions-btn');
  if (viewMyProbingBtn) {
    viewMyProbingBtn.addEventListener('click', showMyProbingQuestions);
  }
});

// 내가 만든 탐침 질문 보기
async function showMyProbingQuestions() {
  if (!currentUser) {
    Swal.fire({
      icon: 'error',
      title: '로그인 필요',
      text: '로그인 후 이용해주세요.'
    });
    return;
  }

  try {
    // 현재 사용자가 제출한 데이터 조회 (uid로만 필터링)
    const q = query(
      collection(db, 'probingQuestions'),
      where('uid', '==', currentUser.uid)
    );

    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      Swal.fire({
        icon: 'info',
        title: '제출된 데이터 없음',
        text: '아직 제출한 탐침 질문이 없습니다.'
      });
      return;
    }

    // 데이터 정리 및 필터링 (클라이언트 측에서)
    const submissions = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      // endTime이 존재하고, scenario가 '대피시뮬레이션'인 경우만 포함
      if (data.endTime && data.scenario === '건강불평등') {
        submissions.push({
          id: doc.id,
          studentType: data.studentType,
          endTime: data.endTime,
          questions: data.questions || {},
          createdAt: data.createdAt
        });
      }
    });

    if (submissions.length === 0) {
      Swal.fire({
        icon: 'info',
        title: '제출된 데이터 없음',
        text: '아직 제출한 탐침 질문이 없습니다.'
      });
      return;
    }

    // 학생 타입별, 시간별로 정렬
    submissions.sort((a, b) => {
      if (a.studentType !== b.studentType) {
        return a.studentType.localeCompare(b.studentType);
      }
      // 시간 역순 (최신순)
      const timeA = `${a.endTime.date} ${a.endTime.time}`;
      const timeB = `${b.endTime.date} ${b.endTime.time}`;
      return timeB.localeCompare(timeA);
    });

    // 팝업 HTML 생성
    let html = '<div style="text-align: left; max-height: 70vh; overflow-y: auto;">';
    
    let currentStudentType = null;
    submissions.forEach((submission, index) => {
      // 학생 타입별 섹션
      if (currentStudentType !== submission.studentType) {
        if (currentStudentType !== null) {
          html += '</div>'; // 이전 섹션 닫기
        }
        currentStudentType = submission.studentType;
        html += `<h3 style="margin-top: 1.5rem; margin-bottom: 0.75rem; color: #2563eb;">학생 ${submission.studentType}의 케이스</h3>`;
        html += '<div style="display: flex; flex-direction: column; gap: 0.5rem;">';
      }

      // 제출 시간 버튼
      const timeStr = `${submission.endTime.date} ${submission.endTime.time}`;
      html += `
        <button class="submission-time-btn" 
                data-submission-id="${submission.id}" 
                data-student-type="${submission.studentType}"
                style="padding: 0.75rem 1rem; text-align: left; background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 6px; cursor: pointer; transition: background 0.2s;">
          <strong>제출 시간:</strong> ${timeStr}
        </button>
        <div id="submission-${submission.id}" style="display: none; margin-left: 1rem; margin-bottom: 1rem; padding: 1rem; background: #f9fafb; border-radius: 6px; border: 1px solid #e5e7eb;">
      `;

      // 과제별 탐침 질문 표시
      for (let i = 1; i <= 5; i++) {
        const questionData = submission.questions[i];
        if (!questionData || !questionData.probingQuestions || questionData.probingQuestions.length === 0) {
          continue;
        }

        html += `<div style="margin-bottom: 1rem;">`;
        html += `<h4 style="margin-bottom: 0.5rem; color: #1f2937;">과제 ${i}</h4>`;
        html += `<table style="width: 100%; border-collapse: collapse; font-size: 0.875rem;">`;
        html += `<thead><tr style="background: #e5e7eb;"><th style="padding: 0.5rem; border: 1px solid #d1d5db; text-align: left; width: 30%;">상황</th><th style="padding: 0.5rem; border: 1px solid #d1d5db; text-align: left;">탐침 질문</th></tr></thead>`;
        html += `<tbody>`;

        questionData.probingQuestions.forEach(item => {
          const situation = typeof item === 'object' ? (item.situation || '') : (Array.isArray(item) ? item[0] : '');
          const question = typeof item === 'object' ? (item.question || '') : (Array.isArray(item) ? item[1] : '');
          
          if (situation || question) {
            html += `<tr>`;
            html += `<td style="padding: 0.5rem; border: 1px solid #d1d5db; font-weight: bold;">${situation}</td>`;
            html += `<td style="padding: 0.5rem; border: 1px solid #d1d5db; white-space: pre-wrap;">${question.replace(/\n/g, '<br>')}</td>`;
            html += `</tr>`;
          }
        });

        html += `</tbody></table>`;
        html += `</div>`;
      }

      html += `</div>`; // submission 내용 닫기
    });

    if (currentStudentType !== null) {
      html += '</div>'; // 마지막 섹션 닫기
    }

    html += '</div>';

    // SweetAlert2로 팝업 표시
    const { value: result } = await Swal.fire({
      title: '내가 만든 탐침 질문',
      html: html,
      width: '900px',
      showConfirmButton: true,
      confirmButtonText: '닫기',
      didOpen: () => {
        // 버튼 클릭 이벤트 추가
        document.querySelectorAll('.submission-time-btn').forEach(btn => {
          btn.addEventListener('click', function() {
            const submissionId = this.getAttribute('data-submission-id');
            const contentDiv = document.getElementById(`submission-${submissionId}`);
            
            if (contentDiv.style.display === 'none') {
              contentDiv.style.display = 'block';
              this.style.background = '#dbeafe';
            } else {
              contentDiv.style.display = 'none';
              this.style.background = '#f3f4f6';
            }
          });

          // 호버 효과
          btn.addEventListener('mouseenter', function() {
            if (this.style.background !== 'rgb(219, 234, 254)') {
              this.style.background = '#e5e7eb';
            }
          });
          btn.addEventListener('mouseleave', function() {
            if (this.style.background !== 'rgb(219, 234, 254)') {
              this.style.background = '#f3f4f6';
            }
          });
        });
      }
    });

  } catch (error) {
    console.error('데이터 불러오기 오류:', error);
    Swal.fire({
      icon: 'error',
      title: '오류',
      text: '데이터를 불러오는 중 오류가 발생했습니다.'
    });
  }
}

