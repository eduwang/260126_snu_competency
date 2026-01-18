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

// 제시문 탭 전환 기능
function initDocumentTabs() {
  const documentTabButtons = document.querySelectorAll('.document-tab-button');
  const documentTabContents = document.querySelectorAll('.document-tab-content');
  
  documentTabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const targetDocument = button.getAttribute('data-document');
      
      documentTabButtons.forEach(btn => btn.classList.remove('active'));
      documentTabContents.forEach(content => content.classList.remove('active'));
      
      button.classList.add('active');
      const targetContent = document.getElementById(`document-${targetDocument}-content`);
      if (targetContent) {
        targetContent.classList.add('active');
      }
    });
  });
}

// 질문별 탭 전환 기능
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
  // 질문별 평가 기준 데이터
  const criteriaData = {
    1: [
      ['종합적 사고', '알고리즘에 대한 설명과 수치적 예측 결과에 근거해 두 알고리즘의 차이를 해석할 수 있는가? 두 알고리즘으로부터 다른 합격자 결과가 나올 수 있다는 점을 이해하는가? 예측 결과 그래프에 따르면 Aware 알고리즘의 결과가 하위 성적자 비율을 더 낮게 만드는 것에 주목하여 두 알고리즘의 차이를 해석하는가?'],
      ['지식 탐구', '흑인 합격 비율이 정해져 있다고 할 때, 그래프에서 x축의 값을 고정한 상태에서 Blind 알고리즘과 Aware 알고리즘의 y값을 비교하여 Aware 알고리즘으로 예측한 GPA가 낮은 비율이 더 적음을 판단할 수 있는가?']
    ],
    2: [
      ['종합적 사고', '명확한 기준을 설정하여 두 알고리즘 중 더 적절하다고 생각하는 생각하는 알고리즘을 평가하고 있는가? 판단 기준을 잘 정의하고 개념화화며, 이에 따라 규범적 지향이 정합적으로 구성되고 있는가? 예측 정확도 문제 등 주어진 자료에 대한 비판적 태도와 오류 가능성을 고려하는가?'],
      ['지식탐구', '그래프, 수치 및 도표와 같은 계량적 정보를 정확히 이해하고, 규범적 원칙과 같은 정성적인 정보와 융합할 수 있는가? 다양한 양태의 정보를 깊게 이해하고 연관 짓는 능력을 보이는가?'],
      ['창의적 사고', '판단 기준이 틀에 박히지 않고, 창의적인 면모를 보이는가?'],
      ['공동체', '적극적 우대조치의 의미와 의의에 대해 이해하고 있으며, 그런 정책을 파생시킨 인종 관련 사회적 문제에 대한 이해와 공감을 보이는가?']
    ],
    3: [
      ['종합적 사고', '제시문 1에 대한 질문 1, 2번에서의 주장과 정합성과 일관성을 보이는 난민 배치 알고리즘에 대한 입장을 선택하고 있는가? 그러한 입장을 왜 선택하였는지 논리적인 근거를 제시문의 정보를 이용하여 제시하고 있는가? 공정성과 효율성과 같은 반대되는 가치의 틀을 가지고 정책에 대한 입장을 비교 평가할 수 있는가?'],
      ['지식탐구', '제시된 그래프에서 수용 인원 정보, 실제 취업률과 알고리즘의 취업률을 비교하고 해석할 수 있는가? 난민들의 특성을 반영한 알고리즘을 이용한 지역 배치 방법의 일반화 방식을 이해하고, 그 한계를 이해하고 있는가?'],
      ['창의적 사고', '숨겨진 쟁점을 발견하고 합리적인 대안을 도출하는 능력을 보이는가? 알고리즘에 의한 예측 정확성과 오류라는 측면을 고려하고 있는가?'],
      ['공동체', '난민 수용 과정에서 발생할 수 있는, 개인의 어려움에 대한 이해와 공감을 바탕으로 주장을 구성하고 있는가?']
    ]
  };

  // 질문 1~3 평가 기준 테이블 초기화
  for (let i = 1; i <= 3; i++) {
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
      ['협력적 소통', '한쪽 주장에 매몰되지 않고, 서로 다른 가치를 추구하는 입장을 잘 이해하여 쟁점을 좁히고 정리하는 능력을 보이는가? 자신의 주장이나 근거의 논리적 문제를 지적받을 때 이를 적절하게 수정하거나 설득적으로 반박할 수 있는가?'],
      ['자기 관리', '주장을 구성하고 개선하는 과정에서 학습과 탐구의 주도성을 보이고 있는가? 지원 분야에 대한 자신감과 주도적 진로 설계 역량을 드러내는가?']
    ];
    
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
      height: 200,
      stretchH: 'all',
      manualRowResize: true,
      manualColumnResize: true,
      autoWrapRow: true,
      autoWrapCol: true,
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
      ['흑인이 입학 비율이 고정되어 있다는 점을 고려하지 않은 경우 (질문 1)', '흑인에 대한 적극적 우대조치로 인해 입학 비율이 고정되어 있다고 가정하면 그래프에서 발견할 수 있는 것은 무엇인가요?'],
      ['제시문 1의 그래프를 잘 해석하지 못하는 경우 (질문 1)', 'y축의 값은 무슨 의미인가요? x축의 값은 무슨 의미인가요?\nx축의 값이 고정되어 있을 때 알고리즘의 결과의 차이가 어떻게 다르다고 할 수 있을까요?'],
      ['Blind와 Aware 알고리즘에 대한 선택 기준을 명확히 설명하지 않은 경우 (질문 2)', '그 알고리즘이 더 좋다고 판단한 기준은 무엇인가요? 그 기준을 좀 더 구체적으로 설명하고, 그 기준에 따르면 왜 그 알고리즘이 더 나은 것인가'],
      ['Aware 알고리즘이 더 낫다고 한 경우 반박 (질문 2)', '입학 지원 서류 상 대동소이한 두 지원자가 본인이 선택할 수 없는 특성인 인종이 다르다는 이유로 다른 기준으로 평가 받아도 되는가? 라는 질문에 대해 어떻게 반박할 수 있을까요?'],
      ['Blind 알고리즘이 더 낫다고 한 경우 반박 (질문 2)', 'Aware 알고리즘 이용 시, 더 좋은 예측 결과가 나온다는 사실을 고려하지 않은 이유는 무엇인가요?'],
      ['적극적 우대 조치 등에 대한 부정적인 입장을 가진 경우(질문 2)', '적극적 우대 조치 자체가 문제라고 생각하는 경우, 소수 인종에 대한 교육 기회 확대 제공과 관련된 입장은 어떤 것이며, 대안은 무엇인가요?'],
      ['제시문 1의 문제의식과 다른 입장으로 질문 3을 답변한 경우 (질문 3)', '1, 2번에서의 입장과 조금 다른 입장에서 난민 배치 방법을 선택한 것 같은데, 각각 기준을 다시 정리해 보고 왜 그렇게 생각하는지 설명해 줄 수 있을까요?\n제시문 1과 제시문 2에서 공정성과 효율성(혹은 면접자의 용어 사용)이 충돌하고 있다고 본다면, 본인의 입장을 동일한 문제의식으로 정리할 수 있을까요? 그때 질문 3의 답변은 여전히 유효한가요?'],
      ['수학적 모델을 보완 (질문 3)', '난민 배치 알고리즘에 실제로 어떤 요소들을 추가 변수로 고려하여 최적화된 배치를 할 수 있을까요?'],
      ['난민 배치 알고리즘에 부정적인 경우 (질문 3)', '평균적인 취업률 향상이라는 효율적인 결과를 유도할 있음에도, 알고리즘에 의한 배치를 배제하는 이유는 무엇인가요?'],
      ['난민 배치 알고리즘에 긍정적인 경우 (질문 3)', '알고리즘에 의해 난민 수용 지역을 배치하는 경우 모국어나 출신 지역 등 난민이 본인이 선택할 수 없는 조건에 따라 취업 성공 확률이 달라지게 될텐데, 이를 공정한 것이라고 생각하나요? 특정한 집단에게 더 구조적인 불평등을 가져오지 않을까요?'],
      ['난민 문제에 대한 공동체적 관점 확인 (질문 3)', '난민들의 취업률을 높여야 하는 이유는 무엇인가요? 이를 위한 사회적 노력이 필요하다고 생각하나요?'],
      ['[심화] 비슷한 관점 충돌이 있을 수 있는 문제 확인', '위 문제에서 형성된 문제 의식을 한국의 대학 입시 제도, 혹은 공정성 논의가 존재할 수 있는 다른 사회적 분배 문제에 적용할 수 있을까요?']
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
  initDocumentTabs();
  initQuestionTabs();
  initCriteriaTables();
  initViewProbingQuestionsBtn();
  initImagePopups();
  initBackToMainBtn();
  initLogoutBtn();
});

