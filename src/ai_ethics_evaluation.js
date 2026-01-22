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
  // 각 과제별 초기 데이터 정의 (나중에 채워넣을 예정)
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
      ['협력적 소통', '한쪽 주장에 매몰되지 않고, 서로 다른 가치를 추구하는 입장을 잘 이해하여 쟁점을 좁히고 정리하는 능력을 보이는가? 자신의 주장이나 근거의 논리적 문제를 지적받을 때 이를 적절하게 수정하거나 설득적으로 반박할 수 있는가?'],
      ['자기 관리', '주장을 구성하고 개선하는 과정에서 학습과 탐구의 주도성을 보이고 있는가? 지원 분야에 대한 자신감과 주도적 진로 설계 역량을 드러내는가?']
    ];
    
    const rowCount = summaryCriteriaData.length;
    const calculatedHeight = Math.max(150, (rowCount + 1) * 50 + 20);
    
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

  // 탐침 질문 테이블 초기화
  const probingContainer = document.getElementById('probing-questions-table');
  if (probingContainer) {
    const probingData = [
      ['기술 발전에 따른 윤리적 문제를 해결하기 위한 원칙이 모호한 경우 (과제 1)', '지금 제안한 원칙을 좀 더 명확하게 표현해 볼 수 있을까요?\n 지금 제안한 원칙이 윤리적 문제를 해결하기 위한 원칙이라고 볼 수 있을까요?'],
      ['기술 발전에 따른 윤리적 원칙을 사례 2와 사례 3에 어떻게 적용하는지 불분명한 경우 (과제 1)', '제안한 원칙을 사례 2와 사례 3에 적용하면 어떤 의사결정을 해야한다고 생각하나요?\n 제안한 원칙이 사례 2나 사례 2의 문제들을 해결하는데 기준을 제공하는 원칙인가요?'],
      ['자율주행차가 다수를 위해 소수를 희생시키는 결정에 대해 인간의 존엄성과 생명권을 근거로 정당하지 않다고 주장하는 경우 (과제 2)', '인간의 생명권을 원칙으로 하는 경우 다수를 희생하는 결정도 자율주행차는 할 수가 없다는 뜻이기 때문에, 이는 자율주행 기술을 사용하지 않거나 매우 제한하여 사용해야 한다는 의미인가요?\n 인간의 생명권 중심을 입장으로 기술을 발전시키지 않는 경우, 날로 경쟁이 심해지는 국제 사회에서 기술적으로 경제적으로 우리가 뒤쳐지지는 않을까요?'],
      ['자율주행차가 다수를 위해 소수를 희생시키는 결정은 하는 것은 막을 수 없는 상황에서 피해를 최소화하는 합리적인 선택이라고 주장하는 경우 (과제 2)', '다수를 위해 소수를 희생하는 것을 정당화한다면, 결국 소수를 더 큰 목적을 위한 도구로 전락시키고 결국 목적을 위해 인간을 수단화 하는 생명 경시 풍조를 강화하지 않을까요?\n 자율주행 기술이 어떤 예측을 하여 소수를 희생시킨 다고 할 때, 이러한 예측에 오류 가능성이 있다면 그래도 소수를 희생시키는 것이 정당화 될까요?'],
      ['자율주행차의 윤리적 의사결정의 신뢰성에 대한 문제를 심층적으로 논의하려는 경우 (과제 2)', '자율주행차가 탑승자를 희생시키는 의사결정을 하는 알고리즘을 탑재하게 되면 구매자가 그 기술을 신뢰하고 상품을 구매할 수 있을까요?\n 자율주행의 의사결정의 피해자는 누구에게 책임을 물어야 할까요?'],
      ['윤리적 문제로 인해 우리 사회가 자율주행을 허용하지 않는다면, 다른 누군가는 해당 기술을 개발할 것이며, 자칫 우리나라가 기술 개발에서 뒤처지게 되어 국가 경쟁력 저하를 초래할 수 있다고 주장하는 경우 (과제 2)', '기술의 발전이 과연 인간 생명의 존엄성과 사회적 안전보다 우선시될 수 있을까요?\n 그렇게 이루어진 기술 발전이 과연 인간 문명의 진보라고 할 수 있을까요?'],
      ['사례 3의 인공지능의 채용 결과에 대해 문제가 없다는 주장에 찬성하는 경우 (과제 3)', '데이터는 인간이 가진 편견과 편향을 그대로 반영한 기록인데, 이를 기준으로 의사결정을 함으로써 차별을 강화하지 않을까요?\n 기업의 과거의 편향적 의사결정 사례가 데이터에 누적되었다고 하여, 변화하는 미래에도 그를 답습하는 결정이 기업의 이익을 보장한다고 할 수 있을까요?'],
      ['사례 3의 인공지능의 채용 결과에 대해 문제가 없다는 주장에 반대하는 경우 (과제 3)', '데이터가 제공하는 결정에 인간이 특정한 윤리적 지향에 따라 임의적이거나 주관적으로 개입하는 것을 허용하는 자체가 오히려 객관적 판단을 어렵게 하고 역차별을 가져오지 않을까요?\n 완벽하게 편견과 편향의 문제가 없는 데이터를 이용해 인공지능을 학습시킬 수 있을까요?\n 인공지능에게 결함이 좀 있다고 해도, 편견과 주관이 강한 인간이 채용의 의사결정을 하는 것 보다는 중립적이고 공정하지 않을까요?'],
      ['인공지능의 법률적 판단에서 과거 전과 기록이 있는 사람이나 경제적으로 빈곤 계층에 속하는 사람의 범죄 가능성을 높게 평가할 위험이 있고 이는 모든 사람이 평등하다는 정의의 원칙에 맞지 않다고 주장하는 경우 (과제 4)', '데이터를 보면 통계적으로 범죄율이 높게 나오는 상황이 있는 것은 어쩔 수 없는 사실인데 그러한 정보를 무시하면 예측의 정확도가 많이 떨어지지 않을까요?\n 데이터가 제공하는 법률적 판단은 확률적으로 최적의 판단으로 볼 수 있는데, 그런 판단을 쓰지 않아 범죄가 오히려 늘어나서 무고한 사람들이 피해를 받으면 안되지 않을까요?'],
      ['인공지능의 법률적 판단의 편향성의 문제를 정의의 원칙의 관점에서 설명하지 않는 경우 (과제 4)', '인공지능의 법률 판단이 만약 인종이나 성별 등 특정 집단의 특성으로 인해 개인을 판단하게 된다면, 이는 정의라고 볼 수 있을까요? 이때 개인의 권리나 공정성 측면에서 이런 판단의 문제를 바라보면 어떻게 생각할 수 있을까요?'],
      ['인공지능의 윤리적 문제를 사회적 합의에 의해 해결할 수 있다고 주장하는 경우 (과제 5)', '모든 사회 구성원이 동의하는 사회적 합의에 이를 수 있을까요? 모든 사회 구성원이 수긍할 수 있는 합의에 이르기 위한 제도나 법적 장치는 어떤게 있을까요?\n 기술발전의 속도가 빠르고 경쟁이 심각한 상황에서 의견이 분분한 윤리적 문제에 대해 사회가 합의에 이르고 제도를 갖추는 과정은 너무 느리게 진행되지 않을까요?'],
      ['인공지능의 윤리적 문제를 모두가 동의하는 사회적 합의에 의해 해결하는 것은 어려우므로, 기술의 윤리 문제를 잘 아는 전문가 집단이 신속하게 결정해야 한다고 주장하는 경우 (과제 5)', '전문가 집단을 충분히 신뢰할 수 있다는 보장이 있을까요? 기업의 이익에 더 쉽게 영향을 받거나, 엘리트주의적 독단에 빠지거나, 이들이 가진 특정한 신념에 좌우될 가능성이 있지 않을까요?\n 모두가 동의하는 사회적 합의에 이르지 않아도, 민주주의의 의사결정 원칙을 통해 다수결로 해결하는 것으로 충분하지 않을까요?\n사회적 합의의 과정이 처음에는 속도가 느리더라도, 결국 장기적으로 볼 때 사회 전체가 문제를 이해하고 해결하는데 도움이 되지 않을까요?'],
      ['[심화] 인공지능의 윤리적 문제가 충돌하는 다른 사례를 탐색', '인공지능의 의사결정을 활용하다가 발생할 수 있는 또 다른 윤리문제는 어떤 것이 있을까요? (의료, 교육 등의 주제 탐색)']
    ];
    
    const probingRowCount = probingData.length;
    const probingHeight = Math.max(400, (probingRowCount + 1) * 60 + 20);
    
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
      height: probingHeight,
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

// 영상 확인 버튼 초기화
function initVideoCheckBtn() {
  const videoCheckBtn = document.getElementById('video-check-btn');
  if (videoCheckBtn) {
    videoCheckBtn.addEventListener('click', () => {
      Swal.fire({
        title: '면접 영상',
        html: `
          <div style="display: flex; flex-direction: column; gap: 1rem; margin-top: 1rem;">
            <a href="https://drive.google.com/file/d/1v31K2WqCmKSzuVJ-fdT1SeB2i9Uz9S_G/view?usp=drive_link" id="video-link-a" target="_blank" rel="noopener noreferrer" style="padding: 0.75rem 1.5rem; background: #2563eb; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 1rem; text-align: center; transition: all 0.2s; display: block;">
              면접 영상(학생 A)
            </a>
            <a href="https://drive.google.com/file/d/1UOexm6-Y6Db5mxIZzQuwsr3UdZWSEPqQ/view?usp=drive_link" id="video-link-b" target="_blank" rel="noopener noreferrer" style="padding: 0.75rem 1.5rem; background: #2563eb; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 1rem; text-align: center; transition: all 0.2s; display: block;">
              면접 영상(학생 B)
            </a>
          </div>
        `,
        showConfirmButton: true,
        confirmButtonText: '닫기',
        width: '400px',
        customClass: {
          popup: 'video-popup',
          htmlContainer: 'video-popup-container'
        },
        didOpen: () => {
          // 링크가 설정되어 있으면 hover 효과 추가
          const linkA = document.getElementById('video-link-a');
          const linkB = document.getElementById('video-link-b');
          
          if (linkA && linkA.href) {
            linkA.addEventListener('mouseenter', () => {
              linkA.style.background = '#1d4ed8';
              linkA.style.transform = 'translateY(-2px)';
            });
            linkA.addEventListener('mouseleave', () => {
              linkA.style.background = '#2563eb';
              linkA.style.transform = 'translateY(0)';
            });
          }
          
          if (linkB && linkB.href) {
            linkB.addEventListener('mouseenter', () => {
              linkB.style.background = '#1d4ed8';
              linkB.style.transform = 'translateY(-2px)';
            });
            linkB.addEventListener('mouseleave', () => {
              linkB.style.background = '#2563eb';
              linkB.style.transform = 'translateY(0)';
            });
          }
        }
      });
    });
  }
}

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
  initVideoCheckBtn();
});
