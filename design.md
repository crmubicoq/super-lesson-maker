# UI/UX 전략: 슈퍼교안 제작기 (Super Lesson Maker)

## 1. 디자인 키워드 (Design Vibrancy)
- **High-Tech & Sleek**: 다크 모드 기반의 글래스모피즘(Glassmorphism) 적용.
- **Dynamic Feedback**: 모든 클릭과 상태 변화에 부드러운 애니메이션(GSAP) 반응.
- **Intuitive Flow**: 왼쪽에서 오른쪽으로 흐르는 자연스러운 작업 동선.

## 2. 컬러 팔레트 (Color Palette)
- **Primary**: `#3B82F6` (Electric Blue) - 신뢰와 기술력
- **Secondary**: `#8B5CF6` (Vibrant Violet) - AI와 창의성
- **Base**: `#0F172A` (Deep Slate) - 전문적인 다크 모드 배경
- **Accent**: `#10B981` (Emerald Green) - 성공 및 완료 상태

## 3. 핵심 레이아웃 구성
### 가. 글로벌 네비게이션 (Sidebar)
- 1~8단계 공정에 맞춘 시각적 진행 상태바 포함.
- 각 단계 클릭 시 해당 공정으로 즉시 이동.

### 나. 메인 작업창 (Workspace)
- **Split View**: 원본 PDF/데이터와 생성 중인 교안을 좌우로 배치하여 직관적 비교 가능.
- **Floating Toolbar**: 이미지 강조, 텍스트 편집 등 자주 쓰는 도구를 맥 OS의 Dock처럼 하단에 배치.

### 다. AI 스타일 컨트롤러 (Control Panel)
- **Prompt Input Core**: 팀장님이 말씀하신 "바이브 입력창"을 우측 하단에 고정 배치.
- 나노바나나 API가 제안하는 디자인 프리셋 카드 형태 제공.

## 4. 사용자 경험(UX) 포인트
- **Micro-interactions**: 버튼 하나를 눌러도 GSAP가 부드러운 스케일링 효과를 주어 '내가 무언가 대단한 걸 만들고 있다'는 느낌을 전달.
- **Progressive Disclosure**: 초보자에게는 핵심 기능만, 팀장님 같은 전문가에게는 상세 옵션을 제공.
