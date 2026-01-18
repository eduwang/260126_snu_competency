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

// 문항별 탭 전환 기능
function initQuestionTabs() {
  const questionTabButtons = document.querySelectorAll('.question-tab-button');
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

// 평가 기준 Handsontable 초기화
function initCriteriaTables() {
  // 문제별 평가 기준 데이터
  const criteriaData = {
    1: [
      ['종합적 사고', '시각적으로 관찰되는 유의미한 패턴 규칙을 여러 개 제시하는가? 특히, 압력을 높이는 실험 조건의 변화와 균열 패턴의 변화를 연결하여 규칙을 설명하고 있는가? (예시 답안 참조)'],
      ['창의적 사고', '패턴 규칙을 최대한 많이 제시하려고 하고, 의외의 시각이나 틀을 벗어난 사고(thinking out-of-box)의 경향이 있는가?'],
      ['협력적 소통', '패턴 규칙을 분명하고 명확한 표현을 사용해 구체적으로 제시하는가? "균열이 점점 많아진다" 와 같이 단순한 답변보다 균열의 위치, 모양, 변화의 양상을 상세하고 구체적으로 묘사하고 있는가?']
    ],
    2: [
      ['종합적 사고', '식 1), 2)에 주어진 여러 요인 사이의 관계 중 중요한 규칙을 잘 제시하고 있는가? 압력, 저항, 균형, 탄성 사이의 관계를 실제적으로 해석하면서 유리병의 균열 상황을 분석하고 있으며, 문제 1의 관찰과 연결하려고 하는가?'],
      ['지식탐구', '압력의 크기가 더 크고, 더 작은 경우를 비교하면서 압력이 더 커질때 같은 균열진적력에 도달하는 $\\Delta C$가 작아진다는 것을 발견하고, 이를 이용해 문제 1에서 발견한 압력이 클 때 가지치기가 발생하는 균열의 길이가 짧아진다는 규칙과 연결할 수 있는가? 이를 그래프나 식으로 나타내어 명확히 이해할 수 있는가? 그 외 식에서 발견되는 사실을 1에서 답변한 내용과 연결할 수 있는가?']
    ],
    3: [
      ['종합적 사고', '문제 2의 식을 활용하여 압력에 커질 때 그에 따라 균열이 갈라지는 위치에 대한 규칙, 문제 1의 패턴에서 갈라짐의 단계가 몇 번 나타나는지에 대한 패턴 규칙을 적절하게 활용해서 길이를 구하는 전략을 세우고 있는가? 각자 설정한 조건과 가정에 따라 합리적인 문제해결의 전략을 채택하고 있는가?'],
      ['지식탐구', '균열이 갈라지는 패턴을 수열이나 점화식 등으로 표현하고, 수열의 합이나 여러 수학적 방법을 잘 이용해서 문제를 효율적으로 해결하는가? 병의 모양 조건등 제한 조건, 예외 조건에 대한 인식을 통해 좀 더 정확한 길이 추정을 시도하려고 하거나, 그것의 필요성을 인식하고 있는가?']
    ],
    4: [
      ['종합적 사고', '탄산음료를 담기에 안전한 유리병을 제작하기 위해 문제1~3을 푼 결과를 통해 발견한 사실에 근거하여 적절한 제안을 하고 있는가?'],
      ['창의적 사고', '안전한 유리병의 제작을 위한 아이디어나 새로운 실험 아이디어를 창의적으로 제안하는가?'],
      ['지식탐구', '안전한 유리병의 제작을 위한 새로운 실험 아이디어를 구현하기 위한 실험의 조건을 합리적으로 설정할 수 있는가?']
    ]
  };

  // 문제 1~4 평가 기준 테이블 초기화
  for (let i = 1; i <= 4; i++) {
    const container = document.getElementById(`criteria-table-${i}`);
    if (container) {
      const data = criteriaData[i] || [['역량', '평가 기준']];
      const rowCount = data.length;
      // 행 수에 따라 높이 자동 계산 (헤더 1줄 + 데이터 행 수, 각 행 약 50px + 여유 공간)
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
        wordWrap: true,
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
            className: 'htLeft',
            renderer: function(instance, td, row, col, prop, value, cellProperties) {
              Handsontable.renderers.TextRenderer.apply(this, arguments);
              // MathJax 렌더링을 위해 텍스트를 그대로 유지
            }
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
          
          // Handsontable 렌더링 후 MathJax 실행
          if (window.MathJax && window.MathJax.typesetPromise) {
            window.MathJax.typesetPromise([container]).catch(function(err) {
              console.error('MathJax typeset error:', err);
            });
          }
        }
      });
    }
  }

  // 종합 평가 기준 테이블 초기화
  const summaryContainer = document.getElementById('summary-criteria-table');
  if (summaryContainer) {
    const summaryData = [
      ['협력적 소통', '문제해결의 방법과 결과를 이해하기 쉽게 설명하고 있으며, 구체적인 이해를 위해 적절한 표현 수단과 표상을 사용하고 있는가? 면접위원의 탐침질문을 이해하고 답변을 적절히 개선하는 유연성을 가지고 있는가?'],
      ['자기 관리', '과제 수행 및 개선 과정에서 지원 분야에 대한 자신감, 학습과 탐구, 진로 설계의 자기주도성을 보이고 있는가? 적절한 학습 전략을 설정하고 이끌어갈 수 있는 역량을 드러내었는가?'],
      ['공동체', '생산자가 소비자의 안전한 사용을 위해 안전한 용기의 확보를 보장하기 위해 노력해야 하는 의무를 전반적으로 이해하고 있으며, 과학적 사실을 통해 이를 도달할 수 있음을 이해하고 있는가?']
    ];
    
    const summaryRowCount = summaryData.length;
    const summaryCalculatedHeight = Math.max(150, (summaryRowCount + 1) * 50 + 20);
    
    criteriaTables['summary'] = new Handsontable(summaryContainer, {
      data: summaryData,
      colHeaders: ['역량', '평가 기준'],
      rowHeaders: true,
      contextMenu: true,
      colWidths: [150, 400],
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
      wordWrap: true,
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
        
        // Handsontable 렌더링 후 MathJax 실행
        if (window.MathJax && window.MathJax.typesetPromise) {
          window.MathJax.typesetPromise([summaryContainer]).catch(function(err) {
            console.error('MathJax typeset error:', err);
          });
        }
      }
    });
  }

  // 탐침 질문 테이블 초기화
  const probingContainer = document.getElementById('probing-questions-table');
  if (probingContainer) {
    const probingData = [
      ['패턴 규칙을 너무 단순한 방식이나 일부만 제시하는 경우 (문제 1)', '패턴 규칙을 더 찾아 볼 수 있을까요? 균열이 진행하다 갈라지는 현상이 보이는데 이에 관해 어떤 패턴이 보이나요?'],
      ['압력의 변화라는 조건과 패턴 규칙을 연결하지 못하는 경우 (문제 1)', '압력의 변화에 따라 패턴이 어떻게 달라지고 있는지 설명할 수 있을까요?'],
      ['문제 1의 패턴 규칙과 문제 2의 공식 사이의 연결점을 찾지 못하는 경우 (문제 2)', '탄성계수 $E$가 일정하다고 할 때, 압력의 크기가 다른 즉, $F_{1}>F_{2}$의 두 경우를 비교해볼까요? 어떤 점이 다른 가요?'],
      ['문제를 해결하는데 도움을 주는 그래프나 도식을 그리지 못하는 경우 (문제 2)', '압력 $F$와 탄성계수 $E$가 일정하다고 할 때, $\\Delta C$와 $G$의 관계는 어떻게 되나요? 식 (2)에 의하면 어떻게 되나요? 이를 그래프로 나타내볼까요?'],
      ['갈라짐에 의해 생기는 길이의 변화를 균열이 계속됨에 따라 일반화하여 나타내지 못하는 경우 (문제 3)', '매 단계마다 끝쪽 가지에서 똑같은 비율로 갈라지는 일이 발생한다고 하면 갈라지기 전의 길이를 $b_{n}$이라고 할 때, 갈라지고 난 후의 길이를 어떻게 나타낼 수 있을까요?'],
      ['세부 길이의 상황을 구했지만 전체길이를 구하지 못하는 경우 (문제 3)', '동일한 길이를 가지는 균열 부분이 각각 몇 번 나타날지 추측해 보고, 전체 합을 구하는 길이를 세워 보세요.'],
      ['병의 모양의 제한 조건 때문에 문제를 해결하는 전략을 일반화하여 세우지 못하거나, 문제해결 전략이 너무 복잡해서 최종 해결방법을 구하지 못한 경우 (문제 3)', '병의 모양의 제한 조건은 잠시 고려하지 말고, 먼저 균열의 길이를 구해 봅시다.\n병의 모양의 제한 조건을 단순화 하여, 좀 더 간단한 해결 방법을 먼저 찾아볼까요?'],
      ['결과에 대한 해석이 수학적인 것에 그치고, 실제 유리병의 제작 맥락에 연결되지 않는 경우 (문제 4)', '유리병의 균열 패턴과 길이 등에 대한 탐색이 유리병을 안전하게 제작하는데 어떤 도움이 된다고 생각하나요?\n안전한 유리병을 제작하려면 어떤 것들을 고려해야 할까요?'],
      ['실험에 대한 아이디어는 제시하나 실험의 구체성이 부족하거나 실험의 목적이 불분명한 경우 (문제 4)', '구체적으로 어떤 방식으로 그런 실험 조건을 만들 수 있을까요?\n그와 같은 실험을 통해 어떤 것을 확인할 수 있을까요? 그것은 안전한 유리병의 제작에 어떤 도움이 될까요?'],
      ['[심화] 안전한 유리병 제조 실험 아이디어를 다양하게 탐색해 보고자 하는 경우 (문제 4)', '압력 외에 다른 요인들을 실험에서 고려해 볼 수 있을까요?\n유리병 재질 외에 유리병의 안전을 위해 고려해야하는 요소는 어떤 것들이 더 있을까요?\n문제에서 언급한 모양에 대한 아이디어가 있나요?']
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
      autoWrapCol: true,
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
              // bullet 처리
              const lines = value.split('\n').filter(line => line.trim());
              if (lines.length > 0) {
                td.innerHTML = '<ul style="margin: 0; padding-left: 1.5rem;">' +
                  lines.map(line => `<li>${line.trim()}</li>`).join('') +
                  '</ul>';
              }
            }
          }
        }
      ],
      afterRender: function() {
        // Handsontable 렌더링 후 MathJax 실행
        if (window.MathJax && window.MathJax.typesetPromise) {
          window.MathJax.typesetPromise([probingContainer]).catch(function(err) {
            console.error('MathJax typeset error:', err);
          });
        }
      }
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
        confirmButtonText: '닫기',
        didOpen: () => {
          // 팝업이 열린 후 MathJax 실행
          if (window.MathJax && window.MathJax.typesetPromise) {
            window.MathJax.typesetPromise().catch(function(err) {
              console.error('MathJax typeset error:', err);
            });
          }
        }
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
  initCriteriaTables();
  initViewProbingQuestionsBtn();
  initImagePopups();
  initBackToMainBtn();
  initLogoutBtn();
});

