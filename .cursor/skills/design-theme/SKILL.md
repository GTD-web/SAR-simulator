---
name: design-theme
description: Applies the Amethyst design theme with defined color palette. Use when creating or modifying UI components, stylesheets, CSS variables, color schemes, or any visual design elements in the project.
---

# Amethyst 디자인 테마

## 적용 시점

다음 작업 시 이 테마를 적용한다:
- UI 컴포넌트 생성/수정
- CSS, SCSS, 스타일시트 작성
- 색상, 테마 관련 코드 작성
- 시각적 디자인 요소 추가

## 색상 팔레트 (필수)

프로젝트의 모든 색상은 아래 CSS 변수를 사용한다. 하드코딩된 hex 값 대신 변수명을 사용한다.

```css
:root {
  /* 어두운 보라 - 배경, 헤더, 강조 영역 */
  --dark-amethyst: #231942ff;

  /* 먼지 보라 - 보조 배경, 구분선 */
  --dusty-grape: #5e548eff;

  /* 연보라 연기 - 호버, 비활성 상태 */
  --amethyst-smoke: #9f86c0ff;

  /* 라일락 - 액센트, 버튼, 링크 */
  --lilac: #be95c4ff;

  /* 핑크 오키드 - 강조, CTA, 활성 상태 */
  --pink-orchid: #e0b1cbff;
}
```

## 사용 가이드

| 변수 | 용도 | 예시 |
|------|------|------|
| `--dark-amethyst` | 메인 배경, 헤더, 푸터, 카드 배경 | `background: var(--dark-amethyst)` |
| `--dusty-grape` | 보조 배경, 테두리, 구분선 | `border-color: var(--dusty-grape)` |
| `--amethyst-smoke` | 호버, 비활성, 플레이스홀더 | `color: var(--amethyst-smoke)` |
| `--lilac` | 액센트, 버튼, 링크, 아이콘 | `background: var(--lilac)` |
| `--pink-orchid` | CTA, 활성, 포커스, 강조 | `color: var(--pink-orchid)` |

## 규칙

1. **변수 사용**: hex 값(`#231942` 등)을 직접 쓰지 않고 `var(--dark-amethyst)` 형태로 사용한다.
2. **일관성**: 새 색상을 추가할 때는 기존 팔레트에서 선택한다. 부득이한 경우 `:root`에 새 변수를 정의하고 문서화한다.
3. **대비**: 텍스트 가독성을 위해 `--dark-amethyst` 배경에는 `--pink-orchid` 또는 `--lilac` 계열 텍스트를 사용한다.

## 예시

```css
/* 좋은 예 */
.button-primary {
  background: var(--lilac);
  color: var(--dark-amethyst);
}

.card {
  background: var(--dark-amethyst);
  border: 1px solid var(--dusty-grape);
}

/* 나쁜 예 - hex 하드코딩 */
.button-primary {
  background: #be95c4;  /* ❌ var(--lilac) 사용 */
}
```
