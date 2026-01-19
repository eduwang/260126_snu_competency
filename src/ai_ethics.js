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

// 저장 상태 추적 (질문별, 학생별)
const saveStatus = {
  a: {}, // 학생 A의 각 질문별 저장 상태
  b: {}  // 학생 B의 각 질문별 저장 상태
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
  const userIsAdmin = await isAdmin(user);
  if (userIsAdmin) {
    return true;
  }

  try {
    const settingsDoc = await getDoc(doc(db, 'menuSettings', 'main'));
    
    if (settingsDoc.exists()) {
      const data = settingsDoc.data();
      
      if (data.probing03 === false) {
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
      const userQuery = query(collection(db, 'users_new'), where('uid', '==', user.uid));
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
    ['기술 발전에 따른 윤리적 문제를 해결하기 위한 원칙이 모호한 경우 (질문 1)', '지금 제안한 원칙을 좀 더 명확하게 표현해 볼 수 있을까요?\n지금 제안한 원칙이 윤리적 문제를 해결하기 위한 원칙이라고 볼 수 있을까요?'],
    ['기술 발전에 따른 윤리적 원칙을 사례 2와 사례 3에 어떻게 적용하는지 불분명한 경우 (질문 1)', '제안한 원칙을 사례 2와 사례 3에 적용하면 어떤 의사결정을 해야한다고 생각하나요?\n제안한 원칙이 사례 2나 사례 2의 문제들을 해결하는데 기준을 제공하는 원칙인가요?'],
    ['자율주행차가 다수를 위해 소수를 희생시키는 결정에 대해 인간의 존엄성과 생명권을 근거로 정당하지 않다고 주장하는 경우 (질문 2)', '인간의 생명권을 원칙으로 하는 경우 다수를 희생하는 결정도 자율주행차는 할 수가 없다는 뜻이기 때문에, 이는 자율주행 기술을 사용하지 않거나 매우 제한하여 사용해야 한다는 의미인가요?\n인간의 생명권 중심을 입장으로 기술을 발전시키지 않는 경우, 날로 경쟁이 심해지는 국제 사회에서 기술적으로 경제적으로 우리가 뒤쳐지지는 않을까요?'],
    ['자율주행차가 다수를 위해 소수를 희생시키는 결정은 하는 것은 막을 수 없는 상황에서 피해를 최소화하는 합리적인 선택이라고 주장하는 경우 (질문 2)', '다수를 위해 소수를 희생하는 것을 정당화한다면, 결국 소수를 더 큰 목적을 위한 도구로 전락시키고 결국 목적을 위해 인간을 수단화 하는 생명 경시 풍조를 강화하지 않을까요?\n자율주행 기술이 어떤 예측을 하여 소수를 희생시킨 다고 할 때, 이러한 예측에 오류 가능성이 있다면 그래도 소수를 희생시키는 것이 정당화 될까요?'],
    ['자율주행차의 윤리적 의사결정의 신뢰성에 대한 문제를 심층적으로 논의하려는 경우 (질문 2)', '자율주행차가 탑승자를 희생시키는 의사결정을 하는 알고리즘을 탑재하게 되면 구매자가 그 기술을 신뢰하고 상품을 구매할 수 있을까요?\n자율주행의 의사결정의 피해자는 누구에게 책임을 물어야 할까요?'],
    ['윤리적 문제로 인해 우리 사회가 자율주행을 허용하지 않는다면, 다른 누군가는 해당 기술을 개발할 것이며, 자칫 우리나라가 기술 개발에서 뒤처지게 되어 국가 경쟁력 저하를 초래할 수 있다고 주장하는 경우 (질문 2)', '기술의 발전이 과연 인간 생명의 존엄성과 사회적 안전보다 우선시될 수 있을까요?\n그렇게 이루어진 기술 발전이 과연 인간 문명의 진보라고 할 수 있을까요?'],
    ['사례 3의 인공지능의 채용 결과에 대해 문제가 없다는 주장에 찬성하는 경우 (질문 3)', '데이터는 인간이 가진 편견과 편향을 그대로 반영한 기록인데, 이를 기준으로 의사결정을 함으로써 차별을 강화하지 않을까요?\n기업의 과거의 편향적 의사결정 사례가 데이터에 누적되었다고 하여, 변화하는 미래에도 그를 답습하는 결정이 기업의 이익을 보장한다고 할 수 있을까요?'],
    ['사례 3의 인공지능의 채용 결과에 대해 문제가 없다는 주장에 반대하는 경우 (질문 3)', '데이터가 제공하는 결정에 인간이 특정한 윤리적 지향에 따라 임의적이거나 주관적으로 개입하는 것을 허용하는 자체가 오히려 객관적 판단을 어렵게 하고 역차별을 가져오지 않을까요?\n완벽하게 편견과 편향의 문제가 없는 데이터를 이용해 인공지능을 학습시킬 수 있을까요?\n인공지능에게 결함이 좀 있다고 해도, 편견과 주관이 강한 인간이 채용의 의사결정을 하는 것 보다는 중립적이고 공정하지 않을까요?'],
    ['인공지능의 법률적 판단에서 과거 전과 기록이 있는 사람이나 경제적으로 빈곤 계층에 속하는 사람의 범죄 가능성을 높게 평가할 위험이 있고 이는 모든 사람이 평등하다는 정의의 원칙에 맞지 않다고 주장하는 경우 (질문 4)', '데이터를 보면 통계적으로 범죄율이 높게 나오는 상황이 있는 것은 어쩔 수 없는 사실인데 그러한 정보를 무시하면 예측의 정확도가 많이 떨어지지 않을까요?\n데이터가 제공하는 법률적 판단은 확률적으로 최적의 판단으로 볼 수 있는데, 그런 판단을 쓰지 않아 범죄가 오히려 늘어나서 무고한 사람들이 피해를 받으면 안되지 않을까요?'],
    ['인공지능의 법률적 판단의 편향성의 문제를 정의의 원칙의 관점에서 설명하지 않는 경우 (질문 4)', '인공지능의 법률 판단이 만약 인종이나 성별 등 특정 집단의 특성으로 인해 개인을 판단하게 된다면, 이는 정의라고 볼 수 있을까요? 이때 개인의 권리나 공정성 측면에서 이런 판단의 문제를 바라보면 어떻게 생각할 수 있을까요?'],
    ['인공지능의 윤리적 문제를 사회적 합의에 의해 해결할 수 있다고 주장하는 경우 (질문 5)', '모든 사회 구성원이 동의하는 사회적 합의에 이를 수 있을까요? 모든 사회 구성원이 수긍할 수 있는 합의에 이르기 위한 제도나 법적 장치는 어떤게 있을까요?\n기술발전의 속도가 빠르고 경쟁이 심각한 상황에서 의견이 분분한 윤리적 문제에 대해 사회가 합의에 이르고 제도를 갖추는 과정은 너무 느리게 진행되지 않을까요?'],
    ['인공지능의 윤리적 문제를 모두가 동의하는 사회적 합의에 의해 해결하는 것은 어려우므로, 기술의 윤리 문제를 잘 아는 전문가 집단이 신속하게 결정해야 한다고 주장하는 경우 (질문 5)', '전문가 집단을 충분히 신뢰할 수 있다는 보장이 있을까요? 기업의 이익에 더 쉽게 영향을 받거나, 엘리트주의적 독단에 빠지거나, 이들이 가진 특정한 신념에 좌우될 가능성이 있지 않을까요?\n모두가 동의하는 사회적 합의에 이르지 않아도, 민주주의의 의사결정 원칙을 통해 다수결로 해결하는 것으로 충분하지 않을까요?\n사회적 합의의 과정이 처음에는 속도가 느리더라도, 결국 장기적으로 볼 때 사회 전체가 문제를 이해하고 해결하는데 도움이 되지 않을까요?'],
    ['[심화] 인공지능의 윤리적 문제가 충돌하는 다른 사례를 탐색', '인공지능의 의사결정을 활용하다가 발생할 수 있는 또 다른 윤리문제는 어떤 것이 있을까요? (의료, 교육 등의 주제 탐색)']
  ];
}

// 평가 기준 Handsontable 초기화
function initCriteriaTables() {
  // 각 질문별 초기 데이터 정의
  const criteriaData = {
    1: [
      ['종합적 사고', '기술발전과 함께 발생하는 윤리 문제를 해결하기 위한 원칙을 명확히 제시하는가? 사례 1을 참고하여 왜 그런 원칙을 제시하는지 주장의 근거가 논리적이고 타당한가? 이 원칙에 따라 사례 2, 3의 문제에 어떻게 적용되는지 명확히 분석하였는가?'],
      ['창의적 사고', '기술발전과 함께 발생하는 윤리 문제를 해결하기 위한 원칙 제시 및 주장에서 독창적인 관점과 사고를 보이는가?'],
      ['공동체', '기술 발전이 가져올 수 있는 부작용을 사회 문제로 인식하고, 이를 적극적으로 해결해야한다는 문제의식을 바탕으로 의견을 제시하고 있는가?']
    ],
    2: [
      ['종합적 사고', '트롤리 딜레마와 자율주행의 윤리 문제의 구조적 동일성을 인식하고, 하나의 입장을 택해 논리적이고 타당한 근거와 함께 주장하고 있는가? 또한 반대 입장과 그 논거를 명확히 이해하고 있는가?'],
      ['지식탐구', '공리주의나 의무론과 같은 철학적 입장을 구체적이고 명확하게 제시하고 있으며, 철학적 입장에 근거하여 논리적이고 정합성있게 주장의 근거를 심층적으로 제시하고 있는가?']
    ],
    3: [
      ['종합적 사고', '주장에 대한 찬반 입장을 명확히 진술하고, 주장에 대한 근거를 정합적이며 논리적으로 구성하고 있는가? 또한 반대 입장과 그 논거를 명확히 이해하고 있는가?'],
      ['지식탐구', '데이터를 기반으로 하는 인공지능의 의사결정 과정에 대한 구체적인 지식과 특성을 바탕으로 답변을 구성하고 있는가? 철학적 입장 등 인공지능과 윤리에 대한 지식을 활용하여 주장에 대한 근거를 심층적으로 구성할 수 있는가?'],
      ['공동체', '기술 적용에서 발생하는 차별 문제가 가져올 사회적 영향에 대한 문제의식을 가지고 있으며, 이에 대한 이해를 바탕으로 답변을 구성하고 있는가?']
    ],
    4: [
      ['지식탐구', 'AI의 법률적 예측의 편향의 양상과 위험성을 상세히 설명할 수 있는가? 정의의 원칙에 대한 명확한 입장을 바탕으로, AI의 편향된 법적 판단의 문제점을 구체적으로 설명하고 있는가?'],
      ['창의적 사고', 'AI가 가진 편향성으로 인한 부작용에 대한 상상과 예측에서 창의성을 드러내는가? 이를 활용한 논거의 구성에서 창의력과 독창적인 관점을 제시하고 있는가?'],
      ['공동체', '인공지능 기술이 차별이나 편향과 같은 사회문제와 관련됨을 이해하고 있으며, 이에 대한 해결의 관점에서 답변을 제시하고 있는가?']
    ],
    5: [
      ['종합적 사고', '주장에 대한 찬반 입장을 명확히 진술하고, 주장에 대한 근거를 정합적이며 논리적으로 구성하고 있는가? 또한 반대 입장과 그 논거를 명확히 이해하고 있는가?'],
      ['지식탐구', '자율주행 문제에 적절한 사회적 합의가 필요한 상황과 관련된 논의를 구체적으로 구성하고 이를 바탕으로 논거를 구성하고 있는가? 국가와 사회에서 사회적 합의가 어떻게 형성되고 적용되는지 구체적인 현실을 바탕으로 논거를 구성하고 있는가?'],
      ['창의적 사고', '자율주행의 윤리적 문제 상황이나, 사회적 합의 과정의 현실이나 해결 방법을 제시할 때 창의성과 독창성을 보이는가?'],
      ['공동체', '서로 다른 입장을 조율하여 사회적 규범과 제도를 정하는 과정에 대한 설명에서 나와 다른 의견을 존중하고 반영할 필요성에 대한 건강한 입장을 가지고 있는가?']
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
      ['협력적 소통', '한쪽 주장에 매몰되지 않고, 서로 다른 가치를 추구하는 입장을 잘 이해하여 쟁점을 좁히고 정리하는 능력을 보이는가? 자신의 주장이나 근거의 논리적 문제를 지적받을 때 이를 적절하게 수정하거나 설득적으로 반박할 수 있는가?'],
      ['자기 관리', '주장을 구성하고 개선하는 과정에서 학습과 탐구의 주도성을 보이고 있는가? 지원 분야에 대한 자신감과 주도적 진로 설계 역량을 드러내는가?'],
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
    const docRef = await addDoc(collection(db, 'probingQuestions_new'), {
      uid: currentUser.uid,
      displayName: currentUser.displayName || '',
      email: currentUser.email || '',
      createdAt: serverTimestamp(),
      conversation: conversation,
      probingQuestions: probingQuestions,
      studentCharacteristics: studentCharacteristics || '',
      studentType: studentType,
      questionType: 'ai_ethics'
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
      collection(db, 'probingQuestions_new'),
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

// 질문 정보 가져오기 (HTML에서)
function getQuestionInfo(questionNum) {
  // 질문 본문 가져오기
  const questionItems = document.querySelectorAll('.question-item');
  let questionText = '';
  if (questionItems[questionNum - 1]) {
    const questionContent = questionItems[questionNum - 1].querySelector('.question-content p');
    questionText = questionContent ? questionContent.textContent.trim() : '';
  }

  // 예시 답안 가져오기 (여러 개의 <p> 태그가 있을 수 있으므로 모두 합침)
  const questionContentDiv = document.getElementById(`question-${questionNum}-content`);
  let answerText = '';
  if (questionContentDiv) {
    const answerTextDiv = questionContentDiv.querySelector('.answer-text');
    if (answerTextDiv) {
      const paragraphs = answerTextDiv.querySelectorAll('p');
      if (paragraphs.length > 0) {
        answerText = Array.from(paragraphs).map(p => p.textContent.trim()).join('\n\n');
      }
    }
  }

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

    // 질문 정보 수집
    const questions = {};
    // 학생 A의 질문별 답변 초기 데이터
    const studentAAnswers = {
      1: '먼저 사례 1번을 통해서 기술 활용에 있어서는 장기적인 영향에 대해 고려를 해야 한다는 것을 알 수 있고 또한 기술이 사용자의 부를 위해서만 활용되었을 때 어떤 문제점들이 발생하는지를 알 수 있는데요. 이를 통해 두 가지 원칙을 세워보았습니다. 첫 번째로는 인공지능에게 적용되는 원칙으로 현재의 결과와 미래에 미칠 영향을 함께 고려해야 한다는 원칙인데요. 이를 통해 사례 3번의 기업 채용 AI를 통해 적용된 양상을 볼 수 있을 것 같습니다. 사례 3번에서는 AI가 기업 채용의 이상적인 모델을 현재 아마존 기업이 준 것으로 인해서 남성 직원들을 우대하는 것에 편향된 결과를 보여주고 있는데요. 이는 인공지능에게 채용의 목적과 길의 결과 즉 미래 지향적인 목적을 확실히 입력하는 것에 따라서 해결할 수 있을 것이라고 생각했습니다.\n다음으로 두 번째 원칙은 기술자에게 적용되는 원칙으로 생각해 보았는데요. 인공지능에게 궁극적인 목적 즉 1번에서와 같이 미래의 기업이 이러한 양상으로 발전되기를 원한다 등의 목적을 부여할 때 만약 사회적 합의에 따라서 그 목적을 부여했을 경우에는 그 기술자 개인이 책임을 지지 않지만 만약 인공지능에게 목적을 부여할 때 이를 자신, 개인 또는 기업 등의 특정 집단의 판단에 따라서 결정한 경우는 이로 인한 결과 등을 개인 또는 그 기업이 책임을 져야 한다고 생각을 했습니다.\n이는 사례에 2번에 트롤리 딜레마에 적용시켜 볼 수 있을 것 같은데요. 만약 인공지능에게 미래에 다수의 사람을 살리게 하는 것을 목적으로 두라는 걸 사회적 합의를 통해 결정 내렸다면 임산부나 어린아이 등을 우대하는 결정이 나왔을 텐데 이는 사회적 합의에 따라서 모두가 동의한 것이기 때문에 기술자 개인이나 기업이 책임을 지지 않을 수 있습니다. 그러나 만약 기업이 자신의 이미지를, 기업 이미지를 가장 우선시하는 결정을 입력했다면 운전자를 살리는 결정을 하게 될 텐데 이는 사회적 합의에 일치하지 않기 때문에 기업이 책임을 지는 등으로 사건을 해결해 나갈 수 있을 것이라고 생각했습니다.',
      2: '먼저 윤리적으로 정당한지 판단을 해볼 때 자신의 사회적 지위나 위치를 고려하지 않고 모두가 동의할 만한 선택을 한다는 점에서 자신이 누구인지 모를 때 과연 어떤 결정을 할 것인가를 예상해 볼 수 있는데요. 내가 노인인지 또 임산부인지 운전자인지 아무것도 모르는 상태에서는 누군가 죽는 것이 타당하다고 아무도 결정을 내릴 수 없을 것이라고 생각합니다. 그렇기 때문에 타인에 의한 희생은 결국 윤리적으로 정당하다고 할 수 없다는 것이 저의 의견인데요. 또 다른 저의 생각으로는 한 개인이 살아있음으로 지닌 미래의 다양한 가능성을 모두 고려할 수 없다고 생각합니다. 무조건적으로 다수가 살아나는 것이 사회의 이익이라고도 볼 수 없는게 운전자가 나중에 미래에 사회적으로 얼마나 큰 영향을 좋은 영향을 미칠 수 있는지 아무도 미래를 볼 수 없기 때문에 살아있는 것 자체로 무한한 가능성을 지닌 인간의 특성을 고려해 보았을 때 누군가의 희생을 정당하다고 할 수는 없을 것 같습니다.',
      3: '이러한 AI 채용이 계속 지속적으로 사용되는 것에 대해서 문제가 없다라고 하는 것에는 반대하는 입장입니다. 그러나 부분적으로 AI가 차별을 했다고 생각하지 않는다에 대해서는 또 찬성을 하기도 하는데요. 그 이유는 먼저 차별에 대한 사전적 정의를 생각해 보았을 때 생산성이 같음에도 불구하고 특정 집단에 속한다는 것으로 다르게 대우하는 것이 차별이라고 생각합니다. 사례 3번에 나타난 인공지능의 판단 근거를 생각해 볼 때 주어진 데이터가 남성의 생산성이 더 높을 수밖에 없었던 기업의 상황이었기 때문에 이는 AI가 차별을 했음은 아니라고 볼 수 있습니다. 왜냐하면 그 데이터에서 생산성이 다르게 나타났기 때문인데요. 그러나 이러한 데이터를 인공지능에게 부여한, 또 학습시킨 기술자의 입장에서는 문제점이 있었다고 생각합니다. 이는 현재 아마존 기업이라는 사회의 일부만을 학습시켰기에 이러한 기술자의 행위는 차별을 야기했다고 볼 수 있는데요. 때문에 이는 자연스럽고 문제가 없다고 주장하는 것에 대해서는 반대하는 입장입니다.',
      4: '먼저 AI의 판단들을 생각해 보았을 때 이전 범죄자들의 사례들을 고려해서 법률적 판단을 내릴 것이라고 예상할 수 있는데요. 그러나 과거와 현재의 사회 환경 등 다양한 맥락과 변화들을 인지하지 못하는 것이 문제를 야기할 것이라고 생각했습니다. 이는 사례 3에서와 비슷한 양상으로 볼 수 있는데 과거의 성차별 현상으로 인해서 여성이 개발 프로그램을 익히고 입사하는 것에 부정적 영향을 미쳤을 수도 있습니다. 그러나 AI 채용 프로그램은 그러한 사회현상은 인지하지 못하기 때문에 이를 여성과 남성의 유전적 형질이나 특성으로 학습하고 편환된 결과를 낼 수도 있다고 생각하는데요. 이와 같이 조금 극단적인 예일 수도 있지만 예를 들어서 먼 과거에는 인종차별로 인해 흑인들이 생계를 유지하기 매우 어려운 환경이었으므로 생계 유지를 위한 관련 범죄의 빈도가 높은 봤을 수도 있습니다. 그러나 현재는 그러한 사회 문제가 해결되었고 이를 어 그러나 이를 만약 AI 가 인지하지 못한다면 현재에도 똑같이 흑인들의 범죄 재발 가능성이 높다고 판단할 수 있다고 생각합니다. 어 그렇기 때문에 이는 음 과거의 사회 현상이 야기한 특정 집단의 특성들을 현재 아무 관련이 없는 집단에게도 그대로 적용하기 때문에 정의롭지 못하다고 생각합니다.',
      5: '사회적 합의를 통해서 윤리적 문제를 완전히 해결할 수 있다라는 것에는 반대하는 입장입니다. 그러나 그러한 노력은 계속해서 필요하다고 생각하는데요. 먼저 인공지능이 학습하는 인간이 생성한 데이터가 이미 윤리적인 문제들을 포함하고 있기 때문에 인공지능의 윤리적 문제를 해결하는 것이 굉장히 어렵고 또한 사회적 합의를 이루어 새로운 원칙을 제공하기에도 모두의 입장이 다르기 때문에 굉장히 어려운 점이라고 생각합니다. 그러나 앞으로 계속해서 필요한 노력 또한 두 가지 정도로 생각해 볼 수 있었는데요. 먼저 인공지능에게 직접적으로 그런 윤리적 문제에 대해서 인지시키는 것이 중요하다고 생각합니다. 또한 그 주입되는 데이터 또한 사회가 함께 변화해 나가면서 고쳐나가려는 노력이 인간 자체에게도 필요하고 판단에 대한 책임을 누가 지느냐를 정하는 등 원칙을 결정하고 매뉴얼을 만들려는 노력이 인공지능의 발전에 있어서 필수적인 절차라고 생각해 보았습니다.'
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
      scenario: '인공지능과윤리',
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

    const docRef = await addDoc(collection(db, 'probingQuestions_new'), docData);
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

    // 질문 정보 수집
    const questions = {};
    // 학생 B의 질문별 답변 초기 데이터
    const studentBAnswers = {
      1: '네, 먼저 새로운 기술이 도입되었을때 그 앞선 경우와 마찬가지로 여러 원칙 도입하는 것이 분명히 필요한데 이에 대해서 예를 들자면 인간을 해치지 않고 이로운 방향으로만 작용해야 된다는 원칙, 그리고 공정성을 가져야 되고 편향성을 가지지 않아야 된다는 이런 원칙, 그리고 인공지능 개발 회사 또한 인공지능이 문제가 일으켰을 때 그에 대한 책임을 나눠야는 한다는 원칙이 현재는 필요하고 기술의 발전과 함께 사회적 합의를 통해서 원칙을 만들어가는 것이 필요하다고 생각합니다. 그리고 마지막으로 기술이 지금도 계속 발전되고 있기 때문에 기술 발전과 함께 지속적인 모니터링을 통해서 해당 원칙들이 지켜지고 있는지를 잘 확인해야 된다고 생각합니다. 그래서 이러한 원칙이 먼저 자율주행차 설계에서는 인간을 해치지 않는다는 기본 원칙 아래에서 판단하되 이런 부분에서는 분명히 논란이 일어날 수 있기 때문에 사회적인 합의를 통해서 프로그래밍을 정하고 이것이 잘, 진행되고 있는지 앞으로도 지속적으로 모니터링을 해야 된다고 생각하고요. 사례 3에서는 공정성이 잘 지켜지도록 하고 앞으로도 계속 지속적인 모니터링을 통해서 잘 유지되고 있는지 확인하는 것이 필요하다고 생각합니다.',
      2: '저는 옳지 않다고 생각하는데, 자율주행차가 다수를 위해서 한 명을 희생시킨다는 것은 소수의 권리를 침해하는 행동이고 모두가 그 한 명의 위치에 섰을 때 당연히 자신이 희생되는 걸 원치 않을 것이기 때문에 그렇습니다. 개인의 생명에 가치를 매기고 이것을 타인의 목숨을 지키기 위한 어떤 수단으로서 이용하는 행위는 분명히 윤리적이지 못한 행위이기 때문에 어떤 경우에도 개인의 희생을 강요하면 안 된다고 생각하기 때문에 옳지 않습니다. 그렇기 때문에 자율주행차에게 있어서 가장 피해를 최소화하는 방법으로 알고리즘을 짜되 누군가의 희생을 강요하는 방식이면 안 되고 다른 방법을 찾아야 한다고 생각합니다.',
      3: '저는 이에 대해서 반대하는데 좋은 성과를 이룬 것은 그 직원이 능력이 있기 때문인 거지 이것이 개인적인 특징이나 특정 집단과 연관지는 것은 옳지 않다고 생각합니다. 그렇기 때문에 사례 3과 같은 경우에서는 직원의 능력과 역량을 위주로 판단을 해서 우수한 직원을 뽑는 것이 맞고 그런 식으로 프로그래밍이 되어야지 단지 어떻게 생각하면 우연한 공통점을 찾아서 이를 맹신하고 점수를 더 주는 것은 공정성에 어긋나는 것이고 한다고 생각합니다.',
      4: '범죄 재발, 범죄 발생 자체의 가능성에 대해서는 기본적으로 어떤 집단이 범죄를 많이 저질렀다고 해서 용의선상에서 해당 집단과 비슷한 특징을 가지고 있는 사람을 올려버리는 것은 잘못했다고 생각하는데 그러나 이미 범죄를 저질렀던 사람에 한해서는 이미 범죄라는 행동을 저질렀기 때문에 그 행동에 대한 책임으로서 재발 가능성이 일반인보다 높다고 판단할 수밖에 없습니다. 그래서 이런 결과가 예상이 되는데 이 경우에는 범죄를 저질렀던 사람들 입장에서는 공정하지 않다고 생각할 수 있지만 공정하지 않다고 생각할 수도 있고 앞서 말했던 그 원칙 중에 공정성에 어긋날 수도 있지만 행동에 대한 책임을 져야 한다는 관점에서는 어쩔 수 없는 결과라고 생각합니다.',
      5: '먼저 반드시 사회적 합의가 일어나야 된다고 저는 생각하는데 어떤 특정 집단에서만 결정을 내리면 이제 필연적으로 특정 집단만 이득을 보는 일이 벌어질 수밖에 없기 때문에 민주적인 절차를 위해서 많은 사람의 의견을 묻고 사회적 합의를 이뤄내는 것이 당연하다고 생각하고요. 그리고 이게 왜 가능하다고 생각하냐면 앞서 말했듯이 보행자와 운전자 모두 본인에게 닥칠 수 있는 일이기 때문에 이를 바탕으로 공감대를 형성하다 보면 사회적 합의를 이룰 수 있을 것 같습니다. 그리고 이렇게 이런 방식을 통해서 해당 가이드라인의 윤리적인 민주적인 정당성을 얻을 수 있고 올바른 방향성이라고도 생각합니다.'
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
      scenario: '인공지능과윤리',
      questions: questions,
      studentType: 'B',
      startTime: startTime,
      endTime: null,
      uid: currentUser.uid,
      displayName: currentUser.displayName || '익명',
      email: currentUser.email || '',
      createdAt: serverTimestamp()
    };

    const docRef = await addDoc(collection(db, 'probingQuestions_new'), docData);
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

// 질문 정보 표시 및 Handsontable 초기화 (학생 B)
function initProbingQuestionScreensB() {
  // 질문 1~5 정보 표시
  for (let i = 1; i <= 5; i++) {
    const questionInfo = getQuestionInfo(i);
    const questionTextEl = document.getElementById(`question-${i}-text-b`);
    const answerEl = document.getElementById(`question-${i}-answer-b`);
    
    // 질문 본문 표시
    if (questionTextEl) {
      questionTextEl.textContent = questionInfo.text;
    }
    
    // 예시 답안 표시 (줄바꿈 처리)
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

  // 질문별 탭 전환 기능
  initProbingQuestionTabsB();
}

// Firestore에서 저장된 데이터를 불러와 Handsontable에 표시 (학생 B)
async function loadProbingDataFromFirestoreB() {
  if (!probingDocIdB) return;

  try {
    const docRef = doc(db, 'probingQuestions_new', probingDocIdB);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      const questions = data.questions || {};

      // 각 질문별로 데이터 로드
      for (let i = 1; i <= 5; i++) {
        const questionData = questions[i];
        if (!questionData) continue;

        // 학생 B 답변 표시 (텍스트로)
        const studentAnswerContainer = document.getElementById(`student-b-answer-${i}`);
        if (studentAnswerContainer && questionData.studentAnswer) {
          // HTML로 변환 (줄바꿈 처리)
          const answerText = questionData.studentAnswer.replace(/\n/g, '<br>');
          
          // 이미지는 추후 추가 예정
          let content = `<p style="margin: 0; text-indent: 1em; line-height: 1.8;">${answerText}</p>`;
          
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

// 질문별 탭 전환 (학생 B)
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

// 질문 정보 표시 및 Handsontable 초기화
function initProbingQuestionScreens() {
  // 질문 1~5 정보 표시
  for (let i = 1; i <= 5; i++) {
    const questionInfo = getQuestionInfo(i);
    const questionTextEl = document.getElementById(`question-${i}-text`);
    const answerEl = document.getElementById(`question-${i}-answer`);
    
    // 질문 본문 표시
    if (questionTextEl) {
      questionTextEl.textContent = questionInfo.text;
    }
    
    // 예시 답안 표시 (줄바꿈 처리)
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

  // 질문별 탭 전환 기능
  initProbingQuestionTabs();
}

// Firestore에서 저장된 데이터를 불러와 Handsontable에 표시
async function loadProbingDataFromFirestore() {
  if (!probingDocIdA) return;

  try {
    const docRef = doc(db, 'probingQuestions_new', probingDocIdA);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      const questions = data.questions || {};

      // 각 질문별로 데이터 로드
      for (let i = 1; i <= 5; i++) {
        const questionData = questions[i];
        if (!questionData) continue;

        // 학생 A 답변 표시 (텍스트로)
        const studentAnswerContainer = document.getElementById(`student-a-answer-${i}`);
        if (studentAnswerContainer && questionData.studentAnswer) {
          // HTML로 변환 (줄바꿈 처리)
          const answerText = questionData.studentAnswer.replace(/\n/g, '<br>');
          
          // 이미지는 추후 추가 예정
          let content = `<p style="margin: 0; text-indent: 1em; line-height: 1.8;">${answerText}</p>`;
          
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

    const docRef = doc(db, 'probingQuestions_new', probingDocId);
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

      const docRef = doc(db, 'probingQuestions_new', probingDocIdA);
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

      const docRef = doc(db, 'probingQuestions_new', probingDocIdB);
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
      collection(db, 'probingQuestions_new'),
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
      // endTime이 존재하고, scenario가 '인공지능과윤리'인 경우만 포함
      if (data.endTime && data.scenario === '인공지능과윤리') {
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

      // 질문별 탐침 질문 표시
      for (let i = 1; i <= 5; i++) {
        const questionData = submission.questions[i];
        if (!questionData || !questionData.probingQuestions || questionData.probingQuestions.length === 0) {
          continue;
        }

        html += `<div style="margin-bottom: 1rem;">`;
        html += `<h4 style="margin-bottom: 0.5rem; color: #1f2937;">질문 ${i}</h4>`;
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

