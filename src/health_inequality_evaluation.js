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
  // 각 과제별 초기 데이터 정의 (health_inequality.js에서 가져옴)
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
      ['협력적 소통', '연구의 의도와 구체적 전략을 충분히 설득적으로 설명하고 있는가? 연구 결과를 얼마나 알기 쉽게 수치 및 시각적으로 전달할 수 있는가? 탐침질문 등을 통해 타인의 시각을 얼마나 유연성있게 받아들이고 자신의 전략을 개선할 수 있는가?'],
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

  // 탐침 질문 테이블 초기화 (health_inequality.js의 데이터 사용)
  const probingContainer = document.getElementById('probing-questions-table');
  if (probingContainer) {
    const probingData = [
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
