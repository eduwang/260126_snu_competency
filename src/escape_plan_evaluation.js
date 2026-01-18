import { auth, db, isAdmin } from './firebaseConfig.js';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, getDocs, query, where } from 'firebase/firestore';
import Swal from 'sweetalert2';
import Handsontable from 'handsontable';
import 'handsontable/dist/handsontable.full.min.css';

let currentUser = null;
let criteriaTables = {}; // 평가 기준 테이블들

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

// 과제별 탭 전환 기능
function initQuestionTabs() {
  const questionTabButtons = document.querySelectorAll('.question-tab-button:not(.evaluation-question-tab)');
  const questionTabContents = document.querySelectorAll('.question-tab-content');
  
  questionTabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const targetQuestion = button.getAttribute('data-question');
      
      questionTabButtons.forEach(btn => btn.classList.remove('active'));
      questionTabContents.forEach(content => content.classList.remove('active'));
      
      button.classList.add('active');
      const targetContent = document.getElementById(`question-${targetQuestion}-content`);
      if (targetContent) {
        targetContent.classList.add('active');
      }
    });
  });
}

// 평가 과제별 탭 전환 기능
function initEvaluationQuestionTabs() {
  const evaluationQuestionTabButtons = document.querySelectorAll('.evaluation-question-tab');
  const evaluationQuestionContents = document.querySelectorAll('.evaluation-question-content');
  
  evaluationQuestionTabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const targetQuestion = button.getAttribute('data-evaluation-question');
      
      evaluationQuestionTabButtons.forEach(btn => btn.classList.remove('active'));
      evaluationQuestionContents.forEach(content => content.classList.remove('active'));
      
      button.classList.add('active');
      const targetContent = document.getElementById(`evaluation-question-${targetQuestion}-content`);
      if (targetContent) {
        targetContent.classList.add('active');
      }
    });
  });
}

// 평가 기준 Handsontable 초기화
function initCriteriaTables() {
  // 각 과제별 초기 데이터 정의 (escape_plan.js에서 가져옴)
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
      const data = criteriaData[i] || [['역량', '평가 기준']];
      const rowCount = data.length;
      const calculatedHeight = Math.max(150, (rowCount + 1) * 50 + 20);
      
      criteriaTables[i] = new Handsontable(container, {
        data: data,
        colHeaders: ['역량', '평가 기준'],
        rowHeaders: true,
        contextMenu: true,
        colWidths: [150, 400],
        minRows: 1,
        minCols: 2,
        licenseKey: 'non-commercial-and-evaluation',
        width: '100%',
        height: calculatedHeight,
        stretchH: 'all',
        manualRowResize: true,
        manualColumnResize: true,
        autoWrapRow: true,
        readOnly: true,
        columns: [
          { 
            data: 0, 
            className: 'htCenter',
            renderer: function(instance, td, row, col, prop, value, cellProperties) {
              Handsontable.renderers.TextRenderer.apply(this, arguments);
              td.style.fontWeight = 'bold';
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
      colWidths: [150, 400],
      minRows: 1,
      minCols: 2,
      licenseKey: 'non-commercial-and-evaluation',
      width: '100%',
      height: 200,
      stretchH: 'all',
      manualRowResize: true,
      manualColumnResize: true,
      autoWrapRow: true,
      readOnly: true,
      columns: [
        { 
          data: 0, 
          className: 'htCenter',
          renderer: function(instance, td, row, col, prop, value, cellProperties) {
            Handsontable.renderers.TextRenderer.apply(this, arguments);
            td.style.fontWeight = 'bold';
          }
        },
        { 
          data: 1, 
          className: 'htLeft'
        }
      ]
    });
  }

  // 탐침 질문 테이블 초기화 (escape_plan.js의 데이터 사용)
  const probingContainer = document.getElementById('probing-questions-table');
  if (probingContainer) {
    const probingData = [
      ['[기본] 소프트웨어의 목적과 기능에 대한 명확한 설명을 확인하려는 경우 (과제 1)', '어떤 재난 상황에서 특히 이 소프트웨어가 유용할까요?\n이 소프트웨어로 어떤 문제를 해결하려고 하나요?'],
      ['[심화] 재난 상황의 설정이 왜 중요한지 확인하려는 경우 (과제 2)', '재난 상황을 다르게 설정하면 어떤 차이가 있을까요?\n재난 상황에 따른 영향이 실제 상황과 유사하게 구현될 수 있을까요?'],
      ['[심화] 대피 행동의 작동 원리에 대한 깊은 이해를 확인하려는 경우 (과제 3)', '사람의 대피 행동을 시뮬레이션할 때 어떤 요소들이 중요한가요?\n알고리즘으로 사람의 행동을 정확히 모델링할 수 있을까요?'],
      ['[기본] 소프트웨어 화면 설계에 대한 이해를 확인하려는 경우 (과제 4)', '화면을 이렇게 설계한 이유는 무엇인가요?\n사용자가 이 소프트웨어를 쉽게 사용할 수 있을까요?'],
      ['[심화] 대피 시뮬레이션의 평가 방법 및 활용 방법에 대한 아이디어를 심층적으로 확인하려는 경우 (과제 5)', '실제 상황을 분석한 데이터가 있다면, 시뮬레이션 결과를 평가하는 기준으로 사용할 수 있을 거에요. 이때, 어떤 변수를 측정해야 할까요?\n건물 설계가 아니라 훈련 상황에서 활용하기 위해 어떻게 소프트웨어를 개선할까요?'],
    ];
    
    criteriaTables['probing'] = new Handsontable(probingContainer, {
      data: probingData,
      colHeaders: ['상황', '탐침 질문'],
      rowHeaders: true,
      contextMenu: true,
      colWidths: [200, 400],
      minRows: 1,
      minCols: 2,
      licenseKey: 'non-commercial-and-evaluation',
      width: '100%',
      height: 300,
      stretchH: 'all',
      manualRowResize: true,
      manualColumnResize: true,
      autoWrapRow: true,
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
            Handsontable.renderers.TextRenderer.apply(this, arguments);
            if (value) {
              const lines = value.split('\n').filter(line => line.trim());
              if (lines.length > 0) {
                td.innerHTML = '<ul style="margin: 0; padding-left: 1.5rem;">' +
                  lines.map(line => `<li>${line.trim()}</li>`).join('') +
                  '</ul>';
              }
            }
          }
        }
      ]
    });
  }
}

// 탐침 질문 크게 보기 버튼
function initViewProbingQuestionsBtn() {
  const viewBtn = document.getElementById('view-probing-questions-btn');
  if (viewBtn) {
    viewBtn.addEventListener('click', () => {
      const probingTable = criteriaTables['probing'];
      if (!probingTable) return;

      const data = probingTable.getData();
      let html = '<div style="text-align: left;">';
      html += '<table style="width: 100%; border-collapse: collapse; font-size: 0.875rem;">';
      html += '<thead><tr style="background: #e5e7eb;"><th style="padding: 0.5rem; border: 1px solid #d1d5db; text-align: left; width: 30%;">상황</th><th style="padding: 0.5rem; border: 1px solid #d1d5db; text-align: left;">탐침 질문</th></tr></thead>';
      html += '<tbody>';

      data.forEach(row => {
        if (row[0] || row[1]) {
          html += '<tr>';
          html += `<td style="padding: 0.5rem; border: 1px solid #d1d5db; font-weight: bold;">${row[0] || ''}</td>`;
          const questionText = row[1] || '';
          const lines = questionText.split('\n').filter(line => line.trim());
          const bulletList = lines.length > 0 
            ? '<ul style="margin: 0; padding-left: 1.5rem; text-align: left;">' + lines.map(line => `<li>${line.trim()}</li>`).join('') + '</ul>'
            : questionText;
          html += `<td style="padding: 0.5rem; border: 1px solid #d1d5db; text-align: left;">${bulletList}</td>`;
          html += '</tr>';
        }
      });

      html += '</tbody></table>';
      html += '</div>';

      Swal.fire({
        title: '탐침 질문',
        html: html,
        width: '900px',
        showConfirmButton: true,
        confirmButtonText: '닫기'
      });
    });
  }
}

// 이미지 팝업 기능
function initImagePopups() {
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('document-image')) {
      const imgSrc = e.target.src;
      Swal.fire({
        imageUrl: imgSrc,
        imageAlt: e.target.alt || '이미지',
        showConfirmButton: false,
        showCloseButton: true,
        width: '90%',
        padding: '1rem',
        customClass: {
          image: 'image-popup'
        }
      });
    }
  });
}

// 메인으로 돌아가기
function initBackToMainBtn() {
  const backBtn = document.getElementById('backToMainBtn');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      window.location.href = 'index.html';
    });
  }
}

// 로그아웃
function initLogoutBtn() {
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        await signOut(auth);
        Swal.fire({
          icon: 'success',
          title: '로그아웃 완료',
          text: '성공적으로 로그아웃되었습니다.',
          confirmButtonText: '확인'
        }).then(() => {
          window.location.href = 'index.html';
        });
      } catch (error) {
        console.error('로그아웃 오류:', error);
        Swal.fire({
          icon: 'error',
          title: '오류',
          text: '로그아웃 중 오류가 발생했습니다.'
        });
      }
    });
  }
}

// 인증 상태 확인 및 UI 업데이트
onAuthStateChanged(auth, async (user) => {
  if (user) {
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
    
    document.getElementById('logoutBtn').style.display = 'block';
  } else {
    currentUser = null;
    document.getElementById('userInfo').textContent = '🔐 로그인 후 이용해 주세요.';
    document.getElementById('logoutBtn').style.display = 'none';
  }
});

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', () => {
  initMainTabs();
  initQuestionTabs();
  initEvaluationQuestionTabs();
  initCriteriaTables();
  initViewProbingQuestionsBtn();
  initImagePopups();
  initBackToMainBtn();
  initLogoutBtn();
});
