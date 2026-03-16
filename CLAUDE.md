# Super Lesson Maker - Claude Code 프로젝트 가이드

## 프로젝트 개요
PDF/텍스트 원고를 업로드하면 AI(Gemini/Claude)가 자동으로 강의용 슬라이드를 생성해주는 웹 애플리케이션.

## 기술 스택
- **프레임워크**: Next.js 16 + React 19 + TypeScript
- **스타일**: Tailwind CSS v4 (`@theme` 블록 in globals.css, tailwind.config.ts 없음)
- **AI**: Gemini API (이미지 생성 + 텍스트), Claude API (텍스트 대안)
- **이미지 처리**: sharp (서버), html-to-image (클라이언트)
- **내보내기**: jsPDF (PDF), pptxgenjs (PPTX), File System Access API (PNG)
- **PDF 처리**: pdfjs-dist (클라이언트 PDF 파싱), pdf-lib

## 작업 규칙 (반드시 준수)
1. 모든 작업 완료 후 `todo.md`와 `history.md`를 업데이트할 것
   - `todo.md`: 마일스톤별 체크리스트 형식
   - `history.md`: 날짜별 진행 내용 + 핵심 원리 기록
2. 코드 변경 후 반드시 `npx next build`로 빌드 검증
3. 한국어로 대화할 것

## 핵심 파이프라인 (7단계)
```
upload → analyzing → draft_preview → configure_visual → generating → draft → export
```
1. **upload**: 파일 업로드 (PDF/텍스트, 멀티파일 지원) 또는 기존 슬라이드 이미지/프로젝트 불러오기
2. **analyzing**: AI가 원고 구조 분석 + 전체 초안 생성
3. **draft_preview**: 슬라이드 텍스트 콘텐츠 미리보기 + 인라인 편집
4. **configure_visual**: 비주얼 스타일 설정 (참고 이미지, 디자인 스타일, 슬라이드 수 조정)
5. **generating**: AI 이미지 생성 (Gemini Vision)
6. **draft**: 완성된 슬라이드 편집 (SlideEditor) + Partial Edit (AI 수정 지시)
7. **export**: PDF + PPTX + PNG 내보내기

## 디렉토리 구조
```
src/
├── app/
│   ├── page.tsx              # 메인 앱 (상태 관리 + 7단계 워크플로우)
│   ├── globals.css           # CSS 변수 + glass 효과 + Tailwind v4 @theme
│   ├── layout.tsx
│   └── api/                  # 14개 API 라우트
│       ├── generate-full-draft/   # 구조 분석 + 초안 생성 (핵심)
│       ├── generate-slide-content/ # 개별 슬라이드 콘텐츠 생성
│       ├── generate-slide-image/  # Gemini 이미지 생성
│       ├── analyze-toc/           # 목차 분석
│       ├── analyze-style/         # 스타일 참고 이미지 분석
│       ├── partial-edit/          # AI 수정 지시 (기존 이미지 + 지시문)
│       ├── validate-text/         # 생성 이미지 텍스트 검증
│       ├── extract-pdf-ocr/       # Gemini Vision OCR
│       ├── save-export/           # 서버사이드 내보내기
│       ├── save-project/          # 프로젝트 JSON 저장
│       ├── load-project/          # 프로젝트 JSON 불러오기
│       ├── list-projects/         # 프로젝트 목록 조회
│       ├── upload-slide-images/   # 외부 이미지 업로드 + 리사이즈
│       └── save-slide/            # 개별 슬라이드 저장
├── components/
│   ├── FileUploader.tsx       # 파일 업로드 (드래그앤드롭, 멀티파일)
│   ├── Sidebar.tsx            # 7단계 네비게이션 사이드바
│   ├── SlideEditor.tsx        # 슬라이드 편집기 (프리뷰 + 텍스트 편집 + Partial Edit)
│   ├── SlideContentPreview.tsx # 텍스트 콘텐츠 미리보기 + 인라인 편집
│   ├── TOCResult.tsx          # 목차 분석 결과 표시
│   ├── PipelineProgress.tsx   # 진행률 UI
│   ├── SettingsModal.tsx      # AI 프로바이더 + API 키 설정 모달
│   ├── ProjectLoader.tsx      # 프로젝트 불러오기 모달
│   └── slide-templates/       # 8개 슬라이드 렌더링 템플릿
│       ├── SlideRenderer.tsx  # 디스패처
│       ├── CoverSlide.tsx
│       ├── BulletListSlide.tsx
│       ├── TitleBodySlide.tsx
│       ├── ContentImageSlide.tsx
│       ├── Grid2x2Slide.tsx
│       ├── Grid1x3Slide.tsx
│       ├── ImageBackgroundSlide.tsx
│       ├── SectionDividerSlide.tsx
│       └── SlideFooter.tsx
├── types/
│   └── slide.ts               # 모든 타입 정의 (Slide, SlideContent, SavedProject 등)
└── utils/
    ├── aiProvider.ts          # 멀티 AI 프로바이더 추상화 (Gemini/Claude)
    ├── aiService.ts           # 텍스트 처리 AI 서비스 (analyzeTOC 등)
    ├── pdfProcessor.ts        # PDF 텍스트 추출 + OCR 폴백
    ├── serverSlideUtils.ts    # 서버사이드 유틸 (extractKeyPoints, buildBatchPrompt 등)
    ├── slideImageGenerator.ts # 이미지 생성 파이프라인 오케스트레이터
    ├── textProcessor.ts       # 텍스트 분할/처리
    ├── textSplitter.ts        # 페이지 범위 텍스트 추출 유틸
    └── prompts/
        ├── slideImagePrompt.ts # 슬라이드 이미지 생성 프롬프트
        ├── iconPrompt.ts       # 아이콘 생성 프롬프트
        └── koreanGuard.ts      # (레거시)
```

## 환경 변수
```
GEMINI_API_KEY=...   # 필수 (서버 .env.local)
```
※ 클라이언트에서 API 키를 입력하면 X-Gemini-Key / X-Claude-Key 헤더로 전달

## 테마 (소프트 다크 모드)
- 메인 배경: `#1E293B` (slate-800)
- 카드/모달: `#334155` (slate-700)
- glass 효과: `rgba(51,65,85,0.7)` + `backdrop-blur`
- 보더: `border-white/10` ~ `border-white/15`

## 주요 패턴
- **AI 호출**: 모든 API 라우트에서 `aiProvider.ts`의 `generateText()` 사용
- **이미지 생성**: Gemini 전용 (generate-slide-image), 429 Rate Limit 자동 재시도
- **상태 관리**: page.tsx에서 useState로 전체 관리 (전역 상태 라이브러리 미사용)
- **이미지 저장**: `public/generated/slides/`에 서버사이드 저장 → URL로 참조
- **프로젝트 저장**: `outputs/[제목]/project.json` (base64 이미지 제외)

## 진행 상황
- 현재 버전: v2.1.0
- 완료된 마일스톤: 6.9까지 (상세: todo.md 참고)
- 작업 이력: history.md 참고
