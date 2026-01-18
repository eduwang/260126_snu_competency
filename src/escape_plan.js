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
      
      if (data.probing01 === false) {
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
    ['대피 시뮬레이션의 목적, 필요성, 기능 등이 불분명한 경우 (과제 1)', '이 시뮬레이션 소프트웨어는 어떤 건물에서 어떤 재난 발생 시에 대피 상황을 시뮬레이션 하려는 것인가요?\n이 소프트웨어에 또 다른 기능은 어떤 것을 추가할 수 있을 까요?'],
    ['재난 상황 및 대피 상황의 기능 설정의 구체성이 떨어지는 경우 (과제 1, 2)', '화재가 발생하는 상황을 다양하게 설정하려면 어떻게 하면 될까요?\n건물에 인원을 어떤 범위로 조절하도록 할까요?\n대피에 있어 장애요소는 어떤 것들이 있을까요?'],
    ['적절한 수학적, 과학적, 심리적 모델을 사용하는 아이디어를 제시하지 않는 경우 (과제 3)', '대피하는 사람의 움직임은 어떻게 설정할 수 있을까요?\n빠른 대피를 막는 장애요소를 어떤 공식으로 설정해 놓아야 할까요?'],
    ['소프트웨어에 담고자 하는 기능에 대한 이해도, 수학적, 과학적, 심리적 모델에 대한 이해도를 심층적으로 확인하려는 경우 (과제 3)', '그 물리 모델은 어떤 공식을 가지고 있나요? 이를 코드로 구현하려면 어떻게 해야할까요?\n사람들이 최단 거리가 어떤 경로인지 모를 때 어떤 선택을 할까요?'],
    ['학생의 화면 디자인에 앞에서 제시한 기능 요소에 대한 설계가 충분히 담겨 있지 않은 경우 (과제 4)', '앞서서 언급한 그 기능을 디자인에 추가하면 어떤 위치에 어떤 모양으로 배치할 까요?'],
    ['[심화] 대피 시뮬레이션의 평가 방법 및 활용 방법에 대한 아이디어를 심층적으로 확인하려는 경우 (과제 5)', '실제 상황을 분석한 데이터가 있다면, 시뮬레이션 결과를 평가하는 기준으로 사용할 수 있을 거에요. 이때, 어떤 변수를 측정해야 할까요?\n건물 설계가 아니라 훈련 상황에서 활용하기 위해 어떻게 소프트웨어를 개선할까요?'],
  ];
}

// 평가 기준 Handsontable 초기화
function initCriteriaTables() {
  // 각 과제별 초기 데이터 정의
  const criteriaData = {
    1: [
      ['종합적 사고', '대피 시뮬레이션 소프트웨어의 목적과 필요를 설정하고, 이에 따라 적절한 핵심적인 기능이 무엇인지 구상하였는가? '],
      ['창의적 사고', '재난 상황, 재난이 발생한 시설, 대피 상황에 대한 설정이 창의적인가?'],
      ['공동체', '대피 시뮬레이션 소프트웨어의 필요성과 목적을 사회적 필요와 공공성의 측면에서 충분히 제시하였는가?'],
    ],
    2: [
      ['종합적 사고', '소프트웨어에 시뮬레이션으로 구현하는 재난 발생 상황을 적절한 요소를 선택하여 체계적으로 설정하였는가? 재난 요소의 변화에 따라 재난의 영향이 어떻게 나타나게 할 것인지 시나리오를 적절하게 추론하여 설정하였는가?'],
      ['창의적 사고', '재난 발생 상황의 요소 설정에서 참신성과 창의성이 드러나는가?'],
      ['지식탐구', '재난 발생의 상황의 여러 변화 요소에 대한 설정이 구체적인가? 재난 상황의 영향을 과학적 지식과 원리를 근거로 설정하였는가?'],
    ],
    3: [
      ['지식탐구', '사람이 상황에 따라 어떻게 대피하게 할 것인지 시뮬레이션 작동원리나 규칙, 알고리즘을 구체적으로 정교하게 설정하였는가? 수학적, 과학적 지식 또는 사람의 행동에 대한 모델을 활용해 시뮬레이션 모델을 제시하고 있는가? 재난 상황과 대피 행동의 핵심적인 작동원리에 필요한 확률 모델, 물리 법칙, 코드 기능 등을 구체적으로 제시하고 있는가?'],
    ],
    4: [
      ['종합적 사고', '앞서 제시했던 대피 시뮬레이션의 여러 기능 요소들의 특성과 관계를 적절하게 고려하여 소프트웨어 화면을 설계했는가?'],
      ['창의적 사고', '소프트웨어의 기능, 시각적 정보와 텍스트 정보를 직관적이고 효과적으로 전달할 수 있는 소프트웨어 화면을 설계하였는가?'],
      ['협력적 소통', '설계한 소프트웨어 화면의 스케치가 소프트웨어의 특성과 기능을 잘 나타내고 있으며 이를 이용해 소프트웨어에 대한 전반적인 설계 내용을 잘 전달하였는가?'],
    ],
    5: [
      ['종합적 사고', '대피 시뮬레이션 소프트웨어를 평가하는 기준을 적절하게 제시할 수 있는가? 대피 시뮬레이션 소프트웨어의 구체적인 활용 용도를 적절하게 제시하였는가?'],
      ['창의적 사고', '대피 시뮬레이션 소프트웨어의 활용 아이디어가 창의적인가?'],
    ]
  };

  for (let i = 1; i <= 5; i++) {
    const container = document.getElementById(`criteria-table-${i}`);
    if (container) {
      criteriaTables[i] = new Handsontable(container, {
        data: criteriaData[i] || [['', '']], // 초기 데이터 사용, 없으면 빈 데이터
        colHeaders: ['역량', '평가 기준'],
        rowHeaders: true,
        contextMenu: true,
        colWidths: [100, 400],
        minRows: 1,
        minCols: 2,
        licenseKey: 'non-commercial-and-evaluation',
        width: '100%',
        height: 200,
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
        ]
      });
    }
  }

  // 종합 평가 기준 테이블 초기화
  const summaryContainer = document.getElementById('summary-criteria-table');
  if (summaryContainer) {
    const summaryCriteriaData = [
      ['협력적 소통', '자신의 아이디어를 잘 조직화하여 설명하고 설득력있게 설명하고 있는가? 탐침질문 등을 통해 타인의 아이디어와 제안을 얼마나 유연성있게 받아들이고 자신의 아이디어를 개선할 수 있는가? 탐침질문을 통해 해결 전략을 정교화하고 발전시킬 수 있는가?'],
      ['자기 관리', '과제 수행 및 개선 과정에서 지원 분야에 대한 자신감, 학습과 탐구, 진로 설계의 자기주도성을 보이고 있는가? 적절한 학습 전략을 설정하고 이끌어갈 수 있는 역량을 드러내었는가?'],
    ];
    
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
      height: 200,
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
      ]
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
      questionType: 'escape_plan'
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
      where('questionType', '==', 'escape_plan')
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
    // 학생 A의 과제별 답변 초기 데이터
    const studentAAnswers = {
      1: '제가 문제 1번에서 이 대피 시뮬레이션 소프트웨어를 구체적으로 어떤 걸로 짤지 계획을 할 때 이 예시 영상이 많은 영감을 주었습니다. 이 예시 영상에서는 1층부터 6층, 7층 정도 되는 높이에 많은 사람들이 대피하는 모습이 실제로 시뮬레이션을 통해 보여지고 있습니다. 그런데 이 사람들은 지금 모두 1층으로 이동함에 있어서 계단 또는 한정된 출입구 등으로 인해 이동에 혼잡을 겪고 있었고 그리고 빠른 대피가 힘들어지는 상황으로 이어졌습니다. 저는 이 상황을 보면서 특히 백화점같이 창문이 없고 출입구가 1층으로 한정되어 있는 상황에서 방금 본 영상처럼 탈출이 힘들 수 있겠다는 생각을 하게 되었습니다. 그래서 재난상황은 화재로 하였고 그리고 건물의 종류는 아까 제가 말씀드린 백화점처럼 수용인원은 많으나 탈출구가 부족해 빠른 대피가 힘든 시설로 두었습니다. 이런 시설의 한 가지 예시를 추가로 더 드리자면 고층 빌딩 역시 있었습니다. 고층 빌딩은 창문이 있긴 하지만 대부분 고정형 창문인 경우가 많으며 고층일수록 기업차로 인해 창문을 열기도 힘들 뿐만 아니라 창문을 깨게 된다면 기압 차로 강한 바람으로 인해 탈출이 더 힘들어질 수 있습니다. 즉, 이러한 두 가지 건물의 종류는 제가 만들 시뮬레이션의 조건에 잘 부합하는 거라고 생각하였습니다. 그래서 제 소프트웨어의 목적은 다수의 탈출구를 가진 건물 설계를 위해 도움을 주는 것이 목적이며 또한 실제 건물을 세우기 전에 시뮬레이션을 통해 이러한 설계가 효과가 있는지 검증할 수 있다는 점에서 중요한 필요성을 가지고 있다고 생각합니다. 따라서 소프트웨어가 가진 기능은 벽, 출입문, 그리고 창문점을 포함한 건물 구조 설계 기능, 또 내부에 있는 대피인원, 즉 사람 모델의 자율적인 이동 기능, 또한 화재 상황, 즉 재난 상황을 명확히 설정하기 위한 화재 구역 설정 기능, 그리고 실제 화재 상황을 시뮬레이션하는 목적인 화재 번짐 기능 등을 생각하였습니다.',
      2: '문제 2번에서는 제가 이 화재라는 재난 상황을 구체적으로 어떻게 설계하고 시뮬레이션 내에서 어떻게 발생하고 그리고 어떻게 지정할 수 있는지에 대해서 말씀드리겠습니다. 우선 설계된 건물 내부에 화재가 발생한 곳을 직접 지정할 수 있게 할 것입니다. 이를 바탕으로 출입문 앞에서 화재가 발생하는 등 위험한 상황을 설정할 수 있고 이를 통해 다양한 상황에서도 안전하게 사람들이 대피할 수 있는 건물을 설계하는 데도 용이하다는 장점을 지닐 수 있을 것입니다. 또한 화재는 단순히 그 불길이 번지는 것 뿐만 아니라 주변 물체의 온도 상승, 그리고 화재로 인해 발생하는 연기의 확산 등을 통해 사람에게 피해가 갈 수 있습니다 그리고 이는 화재피해에 있어서 중요한 요소로 작용할 것입니다. 따라서 이렇게 실제로 화재가 발생했을 때 일어날 수 있는 피해를 시뮬레이션의 기능으로써 넣어야 된다고 생각했습니다.',
      3: '문제 3번은 아까 말씀드린 것에 의해서 재난 상황에서 사람은 그러면 어떻게 대피 상황을 설정하고 작동할 것인가입니다. 저는 사람이 대피할 때 움직임에 대해서 여러 가지 요인을 고려한 다음에 움직이도록 설정해야 된다고 생각했습니다. 특히 여기서는 화재 상황이므로 화재에서 발생할 수 있는 고온, 불길, 연기 등 자신을 위협할 수 있는 요인들과 주변 인구 복잡성 등의 반응을 하도록 만들어서 사람이 자율적으로 상황을 판단할 탈출구를 찾도록 하는 것을 목표로 하였습니다. 따라서 저는 미로찾기에 사용되는 DPS 알고리즘과 내비게이션 길찾기에도 활용이 된다는 A* 알고리즘 등을 활용한다면 사람이 화재 대피에 있어서 그 부분의 위협 상황에 대한 적당한 비용 함수를 설정하여 이를 고려한 알고리즘에 기반하여 명확하게 대피하는 것이 가능하다고 생각합니다.',
      4: '디자인 자체나 제일 위에 시뮬레이션을 시뮬레이션 소프트웨어를 실행할 때에 있어서 각 절차를 대략적으로 표현을 해줄 것입니다. 이처럼 처음에 첫 단계에서는 건물 설계를 하고 두 번째 단계에서는 화재의 위치와 규모를 지정하고 세 번째 단계에서는 사람 모델을 배치하고 네 번째 단계에서는 시뮬레이션을 직접 실행한 후 다섯 번째 단계에서는 결과 평가를 진행하며 밑줄을 통해서 대략적으로 어떤 식으로 진행을 해야 되는지를 보여주면 좋을 거라고 생각합니다. 또한 여기 중앙에 있는 그림 부분은 실제로 시뮬레이션이 일어날 가상의 공간을 마련해 둔 것이며 지금 여기서 예시로 보여지는 디자인은 건물 설계 단계이기 때문에 건물이 점차 배치되어 가고 있는 장면을 보여드리고 있습니다. 또한 이 아래줄에 표시된 것은 각 건물의 블록을 의미하는 것입니다. 이 블록의 종류를 선택해서 자신이 원하는 곳에 배치를 하는 형태로 건물을 우선 설계하는 것을 대략적으로는 잡아서 보고 있습니다. 또한 이 아래줄에 표시된 것은 각 건물의 블록을 의미하는 것입니다. 이 블록의 종류를 선택해서 자신이 원하는 곳에 배치를 하는 형태로 건물을 우선 설계하는 것을 대략적으로 잡아서 보고 있습니다.',
      5: '이 게임은 대피 시뮬레이션 소프트웨어가 잘 만들어졌는지 평가함에 있어서 그 소프트웨어를 바탕으로 건물을 직접 설계하고 화재 상황이 발생한 후에야 소프트웨어 시뮬레이션이랑 차이가 있었는지를 평가하는 것은 너무 많은 시간과 자원이 소모되면 불가능에 가깝다고 생각했기 때문에 이미 있던 화재 사례와 유사한 환경을 소프트웨어 내에 조성하여 실제, 더 이상 실제 발생한 결과와 유사한 결과를 소프트웨어 내에서 만들어낼 수 있는지를 평가하면 그것을 바탕으로 소프트웨어의 퀄리티를 생각할 수 있다고 생각합니다. 또한 건물의 대피 효율성을 높이는 설계를 위해 이 소프트웨어를 활용하는 방법으로는 아까 말씀드린 것처럼 첫 번째 단계, 건물 설계에 있어서 다양한 건물 설계안을 두고 각 설계안에 대해 수용 인원, 화재 상황 등을 고려하여 여러 번 탈출 시뮬레이션을 시행하는 것입니다. 그러면 다양한 시뮬레이션을 종합적으로 고려할 때 대피 시간이나 인명 피해 등을 바탕으로 좀 더 나은 최적의 건물 설계안을 고르려고 그 건물 설계안 자체에서도 조금 더 보완할 부분이 있으면 시뮬레이션을 관찰하면서 보완할 부분이 있다고 생각하면 그것 역시 함께 보완해가면서 최종적으로 하나의 설계를 채택할 수 있다고 봅니다.'
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
      scenario: '대피시뮬레이션',
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
    // 학생 B의 과제별 답변 초기 데이터
    const studentBAnswers = {
      1: '시작하겠습니다. 우선 저는 화재 발생 상황에서 사람들이 많은 영화관, 백화점 혹은 다른 대형 건물에서 사람들이 대피하는 상황을 소프트웨어로 재현하고자 했습니다. 이유는 화재 발생 시에는 몸을 낮추고 물이 젖은 수건으로 입을 가리라 같은 이론적인 내용은 사람들이 많이 알고 있지만 실제 상황에서는 머릿속 이론을 적용한 데는 어려움이 있다고 생각하기 때문입니다. 지금 당장 머릿속의 이론보다는 당장 눈앞에서 불이 나있고 연기가 피어나 있기 때문에 생존을 최우선시하는 방향으로 사람들이 움직일 거라고 생각을 했습니다. 그리고 이 소프트웨어에서는 사람들의 생존본능, 이 생존을 위해서 취하는 행위 중 하나인 군중심리, 어떤 집단에 속하고자 하는 행위를 반영하고자 했습니다 여러 실험에서도 확인되었지만 자신이 고른 답이 정답이라는 걸 확신하는 상황 속에서도 다른 사람들이 그건 답이 아니다, 이것이 답이다 라고 말하면 답을 바꾸는 행위는 비일비재하게 적용합니다. 저는 이것을 소프트웨어에 적용해보고자 했습니다.',
      2: '문제 2번에서는 저는 소프트웨어에서 화재가 시작한 장소를 바꿀 수 있게 할 것입니다. 그렇게 되면은 어떤 한 방에서 화재가 시작되고 그로 인해서 연기도 점차 다른 곳으로 퍼져나갑니다. 그렇게 되면은 그 화재가 시작된 방에 있던 사람들 그리고 그 근처에 있던 사람들은 대피를 가장 빨리 시작할 것이고 거기서 멀리 있는 사람들은 비교적 대피를 늦게 시작하게 될 것입니다. 단 여기에서 방화셔터나 아니면 사이렌 소리 그런 다른 요소들은 없다고 가정을 했습니다. 추후에는 방화셔터 혹은 사이렌 소리 같은 다른 청각적 요소도 추가해서 더 나은 소프트웨어를 만드는 것도 좋은 방법이라고 생각합니다. 그렇게 했을 때 화재가 진행됨에 따라서 연기도 점점 퍼져가서 시야를 방해한다는 설정도 추가할 것입니다. 시야가 방해가 되면 더 먼 곳을 보지 못하게 되고 그렇게 됐을 때는 다른 군중 심리가 더 강하게 작용할 수도 있고 만약에 불이 임계치를 넘는 거리에 있다라고 한다면 거기서 반대되는 방향으로 먼저 가려고 할 수도 있습니다. 아예 막다른 길로 갈 수도 있다고 생각합니다. 통로에 있던 사람이 다시 방으로 들어가는 그러한 식의 행동을 보일 수도 있을 거라고 기대됩니다. 그렇게 하면 조금 더 다채로운 상황을 만들 수 있게 되고 더 다양한 대피 상황을 가정할 수 있을 거라고 생각합니다.',
      3: '저는 우선 사람의 이동 방향을 결정하는 요인으로는 연기의 농도, 불과의 거리, 그리고 다른 사람들의 이동 경로를 추가했습니다. 그리고 이런 방향 외에도 사람들의 이동 속도, 이동 속력을 결정합니다. 변수를 또 추가할 것입니다. 그렇게 했을 때 우선 크게 4가지 상황을 가정할 것입니다. 불과 연기의 임계치가 모두 허용치를 넘은 경우에는 연기로 인해서 시야가 차단된 상태이기에 이동속력이 감소하게 되고 이때는 군중심리보다는 당장의 생존 본능이 앞서게 돼서 불과 반대 방향으로 이동하려는 성향이 강해질 것입니다. 그리고 불의 임계치가 허용치 이하고 연기 인계치가 허용치보다 높아진다면 역시나 연기로 인해서 이동속력이 감소하게 되고 당장 생존의 위협을 받지 않기 때문에 우선 다른 사람들의 이동 방향을 따르려고 할 것입니다. 그리고 다른 사람들의 이동 방향이 특정되지 않는다면 연기 반대 방향으로 가려고 할 것입니다. 그리고 그 상황에서 벗어나기 위해서 출구가 있는 아래층으로 이동하려는 경향을 보일 것입니다. 그리고 연기가 임계치 이하인데 불은 임계치 이상인 상황 사실 이런 상황은 잘 없으리라고 생각을 하지만 만약에 소프트웨어를 작동시켰을 때 이러한 상황이 나온다면 우선 불과 반대 방향으로 이동하도록 설정할 것입니다. 그리고 연기와 불이 모두 임계치 이하라면 사람이 화재의 상황을 인지하지 못하는 것이라고 판단하여, 그저 무작위의 방향으로 이동할 뿐 다른 사람들의 이동 방향에는 영향을 받지 않을 거라고 설정할 것입니다. 그리고 실제로 화재 현장에서 사람들은 부상을 입기 때문에 불이나 연기의 인계치가 높은 곳에 지속적으로 남아있는다면 이동속력이 영구 감소하게 되고 거기에 오래 노출되다 보면 사망하기도 하기 때문에 이동속력이 0이 된 사람은 사망한 것으로 판단할 것입니다.',
      4: '우선 저는 처음에 예시로 보여줬던 영상에서 여러 개의 층을 동시에 보여주는 것은 약간 보기가 힘들다라는 인상을 받았습니다. 그래서 저는 이렇게 1층, 2층, 3층, 4층을 아래 칸에 작게 띄워놓고 클릭하는 층을 하나 크게 위에서 볼 수 있도록 설정했습니다. 그렇게 함으로써 각 층에서 어떤 일이 일어났는지를 집중적으로 볼 수 있게 하여서 시선이 분산되는 것을 방지하였습니다. 그리고 여기선 제가 아이콘으로 표시했지만 실제 소프트웨어에서는 색채를 달리함으로써 붉은색이 강하면 거기는 불의 가중치가 높은 것이고 색깔이 점점 옅어질수록 임계치가 낮은 것으로 표현했습니다. 그리고 여기 자세히 보시면 화살표가 달려있는 동그라미가 보이는데요. 이것이 사람입니다. 그리고 화살표의 길이는 속도의 크기 즉 속력으로 설정했습니다. 이 속력이 점점 작아져서 하나의 점으로만 남게 되면 그것은 사망입니다. 그리고 3번 문제에서 질문 주셨던 것처럼 어떤 장애물의 설정에 관해서 말씀 주셨는데 정지에 있는 사람도 장애물로 설정할 수 있을 거라고 생각합니다.',
      5: '우선은 이 대피 시뮬레이션이 실제 상황과 유사한지를 판단하기 위해서는 실제 화재 상황에서 제가 소프트웨어를 작동시키고 있는 유사한 건물에서 일어났던 화재 상황에서 이동 성능이 0이 된 사람, 즉 사망자 수와 실제로 대피한 사람의 수, 그 수 사이의 관계가 유사하면 소프트웨어가 잘 만들어졌다고 판단할 수 있을 것 같습니다.'
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
      scenario: '대피시뮬레이션',
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
    
    // 예시 답안 표시
    if (answerEl) {
      answerEl.textContent = questionInfo.answer;
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
      
      new Handsontable(criteriaContainer, {
        data: questionInfo.criteria,
        colHeaders: ['역량', '평가 기준'],
        rowHeaders: true,
        contextMenu: true,
        colWidths: [100, 400],
        minRows: 1,
        minCols: 2,
        licenseKey: 'non-commercial-and-evaluation',
        width: '100%',
        height: 200,
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
        ]
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
          
          // 과제 3, 4의 경우 이미지 추가
          let content = '';
          if (i === 3) {
            content = `<img src="probingQuestion/escape_plan_stdB_03.png" alt="학생 B 답변 이미지" style="max-width: 100%; height: auto; margin-bottom: 1rem; border-radius: 6px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);">`;
          } else if (i === 4) {
            content = `<img src="probingQuestion/escape_plan_stdB_04.png" alt="학생 B 답변 이미지" style="max-width: 100%; height: auto; margin-bottom: 1rem; border-radius: 6px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);">`;
          }
          content += `<p style="margin: 0; text-indent: 1em; line-height: 1.8;">${answerText}</p>`;
          
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
    
    // 예시 답안 표시
    if (answerEl) {
      answerEl.textContent = questionInfo.answer;
    }

    // 평가 기준 테이블 표시
    const criteriaContainer = document.getElementById(`question-${i}-criteria`);
    if (criteriaContainer && criteriaTables[i]) {
      // 기존 테이블이 있으면 제거하고 새로 생성
      if (criteriaContainer.querySelector('.handsontable')) {
        criteriaTables[i].destroy();
      }
      
      criteriaTables[i] = new Handsontable(criteriaContainer, {
        data: questionInfo.criteria,
        colHeaders: ['역량', '평가 기준'],
        rowHeaders: true,
        contextMenu: true,
        colWidths: [100, 400],
        minRows: 1,
        minCols: 2,
        licenseKey: 'non-commercial-and-evaluation',
        width: '100%',
        height: 200,
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
        ]
      });
    }

    // 학생 A 답변은 텍스트로 표시 (Handsontable 사용 안 함)

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
          
          // 과제 4의 경우 이미지 추가
          let content = '';
          if (i === 4) {
            content = `<img src="probingQuestion/escape_plan_stdA_04.png" alt="학생 A 답변 이미지" style="max-width: 100%; height: auto; margin-bottom: 1rem; border-radius: 6px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);">`;
          }
          content += `<p style="margin: 0; text-indent: 1em; line-height: 1.8;">${answerText}</p>`;
          
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
      if (data.endTime && data.scenario === '대피시뮬레이션') {
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

