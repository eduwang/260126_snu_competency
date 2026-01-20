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

// 질문별 탭 전환 기능
function initQuestionTabs() {
  const questionTabButtons = document.querySelectorAll('.question-tab-button:not(.evaluation-question-tab)');
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

// 평가 질문별 탭 전환 기능
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
  // 각 질문별 초기 데이터 정의 (교통사고 배상금 계산)
  const criteriaData = {
    1: [
      ['종합적 사고', '과소 추정 및 과다 추정 사례를 적절하게 제시하고 그렇게 생각한 이유를 논리적 근거를 적절하게 제시하였는가? 추정법의 수정 제안이 앞서 제시한 과소, 과다 추정 문제를 합리적으로 해결하는 방안인가?'],
      ['창의적 사고', '과소 추정, 과다 추정 사례 제시 및 이의 해결법의 제시에서 독창적이고 창의적인 제안을 할 수 있는가?'],
      ['지식탐구', '추정법의 수정 제안이 구체적이고, 적절한 수학적, 통계적 문제해결 방법을 포함하고 있는가?'],
    ],
    2: [
      ['종합적 사고', '가해자 측 옹호 및 반박 사례에 해당하는 적절한 자료를 균형있게 제안하고 있는가?'],
      ['창의적 사고', '가해자 측 옹호 및 반박 사례에 해당하는 자료에 제시함에 있어 독창적이고 창의적인 아이디어를 내고 있는가?'],
      ['지식탐구', '제시하는 자료가 양측의 논박에 어떤 역할을 할 수 있는지 그 근거를 제시할 때, 자료의 특성을 깊이 이해하고 있으며 주장을 뒷받침하는 자료의 해석을 명확하게 할 수 있는가?'],
    ],
    3: [
      ['종합적 사고', '보험료를 토대로 하는 위자료 계산을 가정할 때 정신적 피해의 과다 추정의 사례를 근거와 함께 적절하게 제시하고 있는가?'],
      ['창의적 사고', '정신적 피해의 과다 추정의 사례가 독창적이고 창의적인가?'],
      ['지식탐구', '정신적 피해의 과다 추정의 이유에 대한 설명에서 일상 생활의 사례를 적절히 활용하고 있으며 충분한 수학적, 통계적 판단을 포함하는가?'],
    ]
  };

  for (let i = 1; i <= 3; i++) {
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
      ['협력적 소통', '주장과 아이디어를 근거와 함께 설득력 있게 설명할 수 있는가? 논리적인 허점을 지적 받거나 반박에 대해 상대방의 주장을 잘 이해하여 이를 유연하게 수용하거나 설득력있게 반박할 수 있는가?'],
      ['공동체', '손해 배상의 명확한 기준의 마련이 사회적으로 필요한 이유를 이해하고 있는가? 피해자의 입장과 피해를 과다 추정하지 않고 보상해야 한다는 입장의 충돌을 조율할 사회적 필요성을 이해하고 있는가?'],
      ['자기 관리', '주장을 구성하고 개선하는 과정에서 학습과 탐구의 주도성을 보이고 있는가? 지원 분야에 대한 자신감과 주도적 진로 설계 역량을 드러내는가?'],
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

  // 탐침 질문 테이블 초기화
  const probingContainer = document.getElementById('probing-questions-table');
  if (probingContainer) {
    const probingData = [
      ['상황 분석 예시', '탐침 질문 예시를 여기에 입력하세요.'],
    ];
    
    criteriaTables['probing'] = new Handsontable(probingContainer, {
      data: probingData,
      colHeaders: ['상황 분석', '탐침질문'],
      rowHeaders: true,
      contextMenu: true,
      colWidths: [200, 400],
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
      html += '<thead><tr style="background: #e5e7eb;"><th style="padding: 0.5rem; border: 1px solid #d1d5db; text-align: left; width: 30%;">상황 분석</th><th style="padding: 0.5rem; border: 1px solid #d1d5db; text-align: left;">탐침질문</th></tr></thead>';
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
