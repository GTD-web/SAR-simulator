/**
 * 폼 UI 생성 유틸리티
 */

/**
 * 섹션 생성
 */
export function createSection(title: string): HTMLElement {
  const section = document.createElement('div');
  section.style.marginTop = '20px';
  section.style.paddingTop = '15px';
  section.style.borderTop = '1px solid var(--dusty-grape)';

  const sectionTitle = document.createElement('h4');
  sectionTitle.textContent = title;
  sectionTitle.style.marginBottom = '10px';
  sectionTitle.style.fontSize = '14px';
  sectionTitle.style.color = 'var(--amethyst-smoke)';
  section.appendChild(sectionTitle);

  return section;
}

/**
 * 입력 필드 생성 헬퍼 메서드
 */
export function createInputField(
  labelText: string,
  id: string,
  type: string,
  placeholder: string,
  defaultValue?: string,
  onFocus?: (id: string) => void,
  onBlur?: (id: string) => void,
  onInput?: () => void
): HTMLElement {
  const label = document.createElement('label');
  label.style.marginTop = '10px';
  label.style.display = 'block';
  label.textContent = labelText;

  const input = document.createElement('input');
  
  // 입력 필드 타입 설정
  input.type = type;
  
  // number 타입인 경우 추가 설정
  if (type === 'number') {
    input.inputMode = 'decimal'; // 모바일에서 숫자 키패드 표시
    input.step = 'any'; // 소수점 입력 허용
    
    // 포커스 이벤트 및 방향 화살표 표시
    input.addEventListener('focus', () => {
      if (onFocus) {
        onFocus(id);
      }
    });
    
    input.addEventListener('blur', () => {
      if (onBlur) {
        onBlur(id);
      }
    });
    
    // 다른 입력 필드로 포커스 이동 시에도 화살표 유지
    input.addEventListener('focusin', (e) => {
      // 다른 입력 필드로 포커스 이동 시에도 화살표 표시
      if (e.target === input && onFocus) {
        onFocus(id);
      }
    });
    
    // 키보드 이벤트 - Cesium이 키보드 이벤트를 가로채지 않도록 함
    input.addEventListener('keydown', (e) => {
      // 입력 필드에 포커스가 있을 때는 키보드 이벤트를 입력 필드가 처리하도록 함
      if (document.activeElement === input) {
        // 이벤트가 Cesium으로 전파되지 않도록 함
        e.stopPropagation();
      }
    }, { capture: true, passive: false });
    
    // 입력 필드 변경 시 엔티티 업데이트
    input.addEventListener('input', () => {
      if (onInput) {
        onInput();
      }
    });
  } else {
    // 입력 필드 변경 시 엔티티 업데이트
    input.addEventListener('input', () => {
      if (onInput) {
        onInput();
      }
    });
  }
  
  input.id = id;
  input.placeholder = placeholder;
  if (defaultValue !== undefined) {
    input.value = defaultValue;
  }
  
  input.style.width = '100%';
  input.style.marginTop = '4px';
  input.style.padding = '4px';

  label.appendChild(input);
  return label;
}
