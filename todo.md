# Super Lesson Maker Technical Roadmap

## [DONE] Milestone 1 - 기초 및 엔진 기틀
- [x] 레이아웃/스크롤 버그 수정: 8-stage 워크플로우 안정화
- [x] PDF/Text Slicing Engine: 물리적/논리적 분할 정밀 로직 구현
- [x] Draft Editor Interface: 실시간 슬라이드 수정 및 레이아웃 선택기
- [x] Workflow Orchestration: 단계별 상태 전이 로직 완성

## [DONE] Milestone 2 - 코드 품질 및 브랜딩
- [x] Tailwind CSS v4 호환성 수정 (@import "tailwindcss")
- [x] handleGenerateSlides await 누락 수정
- [x] useLayoutEffect -> useEffect SSR 경고 해결
- [x] tailwindcss-animate 누락 -> CSS keyframes 직접 정의
- [x] catch(e: any) -> catch(e: unknown) 타입 안전성
- [x] FileUploader 불필요한 2초 딜레이 제거
- [x] 미사용 import/state 정리 (useRouter, splitResults, Loader2 등)
- [x] NanoBanana 브랜딩 -> Super Lesson Maker로 전체 복원
- [x] SlideEditor yellow 색상 -> blue 계열 통일

## [DONE] Milestone 3 - 슬라이드 생성 엔진 수정
- [x] Unsplash 잘못된 이미지 URL -> picsum.photos (fallback용)
- [x] slideGenerator.ts 미사용 변수(systemPrompt, userPrompt) 제거
- [x] textProcessor.ts 제목 매칭 로직 개선 (대소문자 무시 + 키워드 부분매칭 + 균등분할 fallback)
- [x] Gemini API 이미지 생성 연동
  - API Route: src/app/api/generate-image/route.ts
  - .env.local에 GEMINI_API_KEY 설정
  - slideGenerator.ts에서 /api/generate-image 호출
  - 실패 시 picsum.photos fallback
- [x] Gemini 모델 업그레이드: gemini-2.0-flash-exp → gemini-3-pro-image-preview
  - x-goog-api-key 헤더 인증 방식으로 변경
  - imageConfig aspectRatio 16:9 설정 추가

## [DONE] Milestone 3.5 - 이미지 생성 엔진 고도화
- [x] 프레젠테이션 전용 프롬프트 템플릿 생성 (slideImagePrompt.ts)
  - KOREAN_GUARD_PROMPT 제거 → 프레젠테이션 일러스트 프롬프트로 교체
  - 슬라이드 위치별 시각 차별화 (오프닝/디테일/클로징)
  - 사용자 스타일 키워드 → 구체적 색상/무드 자동 해석 (interpretStyle)
  - 텍스트 렌더링 금지 지시 (이미지에 글자 삽입 방지)
  - 네거티브 스페이스 40% 확보 (텍스트 오버레이 공간)
- [x] 이미지 생성 병렬 처리 (최대 3개 동시 → 약 3배 속도 향상)
- [x] 진행률 콜백 + 프로그레스 바 UI (현재 섹션명 + 완료/전체 카운트)
- [x] handleGenerateSlides try/catch 에러 핸들링 (실패 시 configure로 복귀 + 에러 표시)
- [x] API Route 타임아웃 (AbortController) — 45초→2분으로 수정 (이미지 생성 30초+ 소요)
- [x] 클라이언트 타임아웃 (AbortController) — 30초→2분으로 수정
- [x] GenerationProgress 타입 추가 (slide.ts)

## [DONE] Milestone 3.6 - 이미지 저장 시스템
- [x] public/generated/ 저장 폴더 생성 + .gitignore 설정
- [x] API Route에서 base64 → 파일 저장 + URL 경로 반환
- [x] SlideEditor 프리뷰 컨테이너에서 파일 URL로 이미지 표시 (기존 호환)
- [x] 빌드 검증 통과

## [DONE] Milestone 4 - 템플릿 기반 슬라이드 시스템
- [x] 타입 시스템 확장: ContentBlock, StructuredSlideContent, 8개 레이아웃 타입
- [x] 테마 매퍼 (themeMapper.ts): designStyle → CSS 색상 자동 변환
- [x] 아이콘 프롬프트 빌더 (iconPrompt.ts): Gemini 아이콘 생성 프롬프트
- [x] AI Service 구조화: optimizeSlideContentStructured() — 레이아웃 자동 추천 + ContentBlock 생성
- [x] 슬라이드 생성기 리팩토링: 레이아웃별 조건부 이미지/아이콘 생성
- [x] API Route aspectRatio 파라미터화: 슬라이드(16:9) / 아이콘(1:1) 분리
- [x] 8개 슬라이드 템플릿 컴포넌트 생성 (CoverSlide, BulletListSlide, Grid2x2Slide 등)
- [x] SlideRenderer 디스패처 + SlideFooter 공통 컴포넌트
- [x] SlideEditor 통합: SlideRenderer 프리뷰 + 레이아웃별 편집 패널 분기
- [x] 빌드 검증 통과

## [DONE] Milestone 5 - v3 AI 이미지 기반 파이프라인
- [x] 타입 시스템 확장: PipelineStage, PipelineProgress, StyleProfile, SlideContent 추가
- [x] sharp 설치 + imageProcessor.ts (이미지 정규화 1920×1080)
- [x] API 라우트: analyze-style (Gemini Vision 스타일 분석), generate-slide-image (Gemini 슬라이드 이미지 생성), validate-text (텍스트 검증)
- [x] slideImageGenerator.ts: 6단계 파이프라인 오케스트레이터 (normalizing → analyzing_style → analyzing_content → generating → validating_text → completed)
- [x] PipelineProgress.tsx: 6단계 진행률 UI 컴포넌트
- [x] page.tsx 워크플로우 통합: SlideImageGenerator 연동 + 스타일 참고 이미지 업로드 + PipelineProgress UI
- [x] SlideEditor 이미지 프리뷰 + 재생성: 생성된 이미지 표시, 개별 슬라이드 재생성 버튼, 텍스트 검증 상태 표시
- [x] 빌드 검증 통과
- [x] 재생성 버튼 스타일 일관성 버그 수정
  - slideImageGenerator.ts: designStyle에 분석된 전체 스타일 설명 저장 (raw userStyle → styleDesc)
  - page.tsx: styleReferenceImage를 SlideEditor에 prop 전달
  - SlideEditor.tsx: 재생성 시 referenceImageBase64 전송

## [DONE] Milestone 5.5 - SlideEditor UI 단순화 + Partial Edit
- [x] 좌측 패널 단순화: 6개 섹션 → 통합 텍스트 편집 영역 1개
  - 레이아웃 선택기, 발표자 노트, 콘텐츠 블록/불릿 편집기 삭제
  - 첫 줄 = 제목, 이후 줄 = 본문으로 자동 파싱
- [x] Partial Edit (AI 수정 지시) 기능 구현
  - API Route: /api/partial-edit (기존 이미지 + 수정 지시 → Gemini 재생성)
  - SlideEditor: 수정 지시 입력 UI + 적용 버튼
- [x] 빌드 검증 통과

## [DONE] Milestone 6.3 - 초안 생성 모델 전환 + Flash 프롬프트 최적화
- [x] generate-full-draft/route.ts MODEL 변경 (gemini-2.5-flash)
- [x] serverSlideUtils.ts MODEL 변경 (gemini-2.5-flash)
- [x] generate-slide-content/route.ts MODEL 통일 (gemini-2.0-flash → gemini-2.5-flash)
- [x] analyzeStructure() 프롬프트: 단계별 사고 지시 + JSON 예시 보강
- [x] generateAllInOne() 프롬프트: 슬라이드 예시 추가 + 분량 규칙 강화
- [x] extractKeyPoints() 프롬프트: 요약 분량 상향 (1500~2000자) + 수치 보존 강조
- [x] buildBatchPrompt() 프롬프트: 좋은 슬라이드 예시 + 분량 규칙 전면 강화
- [x] 빌드 검증 통과

## [DONE] Milestone 6.3.1 - "Pro 모델" 문구 제거
- [x] page.tsx: 진행바 레이블에서 "(Pro 모델 연산 중)" 제거
- [x] page.tsx: 타임아웃 에러 메시지에서 "Pro 모델은" 제거
- [x] route.ts: maxDuration 주석 "Pro 모델" → "AI 모델"로 변경
- [x] 빌드 검증 통과

## [DONE] Milestone 6.3.2 - 참고 이미지 드래그 앤 드롭 업로드
- [x] page.tsx: handleRefImageFiles/handleRefDrop 헬퍼 함수 추가
- [x] 초기 빈 영역: 드래그 앤 드롭 이벤트 + 드래그 오버 시각 피드백
- [x] 이미지 그리드 영역: 드래그 앤 드롭으로 추가 업로드
- [x] 빌드 검증 통과

## [DONE] Milestone 6.4 - 워크플로우 단계 네비게이션 (이전 단계 돌아가기)
- [x] Sidebar.tsx: 완료 단계 클릭 이동 (체크마크 + 호버 "이동" 텍스트)
- [x] page.tsx: handleStepClick() 함수 + Sidebar onStepClick prop 전달
- [x] SlideEditor.tsx: onBack prop + "이전 단계" 버튼 추가 (헤더 영역)
- [x] AI 처리 단계(analyzing/generating) 이동 차단 (NON_CLICKABLE_STEPS)
- [x] 뒤로 이동 시 기존 slides/이미지 상태 보존
- [x] 빌드 검증 통과

## ✨ 최근 완료된 작업 (Recent Achievements)
- [x] **서버사이드 로컬 폴더 기반 PDF 다운로드 기능 추가**: 브라우저 기본 다운로드 대신 `/api/save-export` 라우트를 구축하여, 프로젝트 최상위의 `outputs/[강의제목]/` 디렉터리에 `슈퍼교안_[강의제목].pdf`와 개별 슬라이드 원본 이미지(`slides/`)들을 한 번에 묶어서 깔끔하게 저장하도록 엔터프라이즈급 내보내기 환경 완성.
- [x] **Gemini 2.5 Flash 기반 OCR 파이프라인 연동**: 스캔된 PDF/이미지 등 텍스트 메타데이터가 없는 문서 감지 시 빈 값(Hallucination 버그)으로 넘기지 않고 `Gemini Vision` 모델로 파일백하여 전체 텍스트를 정확하게 추출해내는 강력한 호환성 완성.
- [x] **슬라이드 목표 장수 커스텀 지정 및 재생성 기능**: `SlideContentPreview` 에서 사용자가 슬라이드의 장수를 지정하고 해당 장수에 맞게 재생성할 수 있는 기능 추가.
- [x] **전체 구조 분석 최적화**: 너무 긴 원고일 경우 전체의 주제를 파악하지 못하는 문제 해결. 처음 구조 분석 시 `overallTitle`을 뽑아 각 챕터와 상관없이 첫 슬라이드의 제목으로 고정 사용.

## [DONE] Milestone 5.6 - 콘텐츠 미리보기 단계 추가
- [x] 파이프라인 분리: 텍스트 콘텐츠 생성 → 미리보기 → 이미지 생성 (2단계)
- [x] SlideContentPreview 컴포넌트: 챕터별 슬라이드 상세 내용 표시 + 인라인 편집
- [x] SlideImageGenerator.generateImagesForSlides(): 기존 슬라이드에 이미지만 생성하는 메서드
- [x] page.tsx 플로우: content_preview 단계 추가, handleSplit → 콘텐츠만 생성, handleStartImageGeneration 분리
- [x] Sidebar 8단계 재구성: 콘텐츠 확인 단계 신설, 단계명 현행화
- [x] 빌드 검증 통과

## [DONE] Milestone 5.7 - 목차 분석 AI 엔진 교체 + 콘텐츠 파이프라인 수정
- [x] /api/analyze-toc API Route 신설 (Gemini gemini-2.0-flash 기반)
- [x] aiService.ts analyzeTOC() → Gemini API 호출 방식으로 전면 교체
- [x] 폴백: 기존 휴리스틱 로직 개선 ([Page] 마커 필터링 추가)
- [x] splitByTOC 텍스트 추출 실패 문제 해결
  - extractedText 상태로 추출된 텍스트 보존
  - getTextForPageRange() 헬퍼로 [Page N] 마커 기반 텍스트 분할
  - handleSplit에서 splitByTOC 의존 제거 → 저장된 텍스트 직접 사용
- [x] generate-slide-content API 빈 rawText 허용 + 제목 기반 폴백 프롬프트
- [x] 빌드 검증 통과

## [DONE] Milestone 5.8 - 멀티 파일 업로드 지원
- [x] FileUploader.tsx: multiple 속성 추가, File[] 콜백으로 변경
- [x] page.tsx: file → files 상태 변경, 멀티 파일 순차 텍스트 추출 + 페이지 번호 연속 부여
- [x] PDF 파일 간 [Page N] 마커 오프셋 처리, 비PDF 파일 인위적 마커 부여
- [x] Top Bar 파일명 표시: 단일/복수 파일 분기
- [x] 목차 분석 단계에서 업로드된 파일 목록 UI 표시 (파일명 + 용량)
- [x] 이미지 생성 429 Rate Limit 자동 재시도 (fetchWithRetry, 동시 요청 2개로 제한)
- [x] 빌드 검증 통과

## [DONE] Milestone 5.9 - 콘텐츠 생성 파이프라인 고도화 (Progressive Summarization)
- [x] extractKeyPoints(): 4000자 초과 원고를 청크별로 핵심 추출 후 합산
- [x] buildBatchPrompt() 연동: 추출된 핵심을 기반으로 슬라이드 구조 생성
- [x] 짧은 섹션 (≤4000자) 기존 로직 유지 (불필요한 추가 호출 방지)
- [x] 타임아웃 조정 (서버 60초, 클라이언트 180초)
- [x] 빌드 검증 통과

## [DONE] Milestone 5.10 - 교안 형식 템플릿 시스템
- [x] SlideTemplateId 타입 추가 ('lecture' | 'seminar' | 'free')
- [x] getTemplateStructure(): 템플릿별 Gemini 프롬프트 구조 규칙 생성
- [x] buildBatchPrompt()에 template 파라미터 연동
- [x] validateSlide()에서 강의 교안 템플릿 구조 보정 (학습목표/학습정리)
- [x] aiService.ts generateSectionSlides()에 template 전달
- [x] configure UI에 교안 형식 선택기 카드 추가 (3종 프리셋)
- [x] 사이드바 9단계 재구성 (원고 핵심 분석 단계 분리)
- [x] 빌드 검증 통과

## [DONE] Milestone 6 - 파이프라인 대개편 (원고 분석 → 전체 초안 → 비주얼 설정)
- [x] `src/utils/textSplitter.ts` 생성 — `getTextForPageRange()` 서버/클라이언트 공유 유틸 추출
- [x] `src/utils/serverSlideUtils.ts` 생성 — 서버사이드 유틸 추출 (extractKeyPoints, buildBatchPrompt, getTemplateStructure, validateSlide, generateSlidesFromPrompt)
- [x] `src/types/slide.ts` — SlideRole, ChapterMeta, FullDraftResult 타입 확장
- [x] `/api/generate-full-draft/route.ts` 신규 — 2단계 처리 (구조 분석 → 챕터별 콘텐츠 생성)
- [x] `/api/generate-slide-content/route.ts` — 공유 유틸 import 리팩터
- [x] `FileUploader.tsx` — prop 이름 변경 (onAnalysisComplete → onFilesSelected)
- [x] `page.tsx` — 상태/함수/UI 전면 개편 (9단계 → 7단계 파이프라인)
  - Step 타입: upload → analyzing → draft_preview → configure_visual → generating → draft → export
  - 핵심 함수: handleStartAnalysis (분석+초안 통합), handleRegenerateChapter (챕터별 재생성)
- [x] `SlideContentPreview.tsx` — 버튼 텍스트 변경
- [x] `Sidebar.tsx` — 9단계 → 7단계 재구성
- [x] 커버 슬라이드 bodyText 제거 (챕터 설명 대신 제목만 표시)
- [x] partial-edit ENOENT 버그 수정 (이미지 URL 쿼리스트링 `?t=` 제거)
- [x] 챕터 그룹핑 제거 — 슬라이드를 하나의 연속 흐름으로 출력
  - API: 내부 구간별 생성은 유지, 출력은 플랫 리스트 (chapterId='all')
  - SlideContentPreview: 챕터 접기/펼치기 제거 → 번호 매긴 플랫 리스트
  - page.tsx: chapterMeta/extractedText/regeneratingChapter 상태 제거, handleRegenerateChapter 삭제
  - configure_visual: 챕터별 장수 조정 UI → 전체 슬라이드 수 표시로 단순화
- [x] 빌드 검증 통과

## [DONE] Milestone 6.1 - 프롬프트 고도화 + 슬라이드 수 조정
- [x] buildBatchPrompt() 프롬프트 전면 개편: 샘플 슬라이드 초안 구조 반영
  - 화면 구성 (→ layout 선택 가이드)
  - 핵심 내용 (→ slideTitle/bulletPoints/bodyText 작성 가이드)
  - 강사 스크립트 팁 (→ speakerNotes 실전 구어체 가이드)
- [x] section_content 템플릿에 강사 스크립트 팁 지시 추가
- [x] configure_visual에 전체 슬라이드 수 +/- 조정 버튼 추가
  - content 역할 슬라이드만 추가/삭제 (cover/objectives/summary 보호)
  - 마지막 content 슬라이드 뒤에 새 슬라이드 삽입
- [x] 빌드 검증 통과

## [DONE] Milestone 6.2 - 콘텐츠 균일성 + 슬라이드 추가 개선
- [x] buildBatchPrompt()에 콘텐츠 균일성 규칙 추가
  - 모든 슬라이드에 실질적 내용 필수 (빈 슬라이드 금지)
  - bullet_list: bulletPoints 최소 3개, speakerNotes 최소 2문장
  - 슬라이드 간 내용 분량 균등 배분 지시
- [x] + 버튼 클릭 시 AI 콘텐츠 자동 생성
  - 주변 슬라이드 맥락(최근 3개 제목)을 generate-slide-content API에 전달
  - 로딩 스피너 표시, 실패 시 폴백 슬라이드 삽입
- [x] 빌드 검증 통과

## [DONE] Milestone 6.5 - API 키 입력 UI + 멀티 AI 프로바이더 (Gemini / Claude)
- [x] `src/utils/aiProvider.ts` 신규 생성 — 통합 텍스트 생성 추상화 (generateText, callGemini, callClaude)
- [x] `src/components/SettingsModal.tsx` 신규 생성 — 설정 모달 UI (프로바이더 선택 + API 키 입력)
- [x] `page.tsx` — aiConfig 상태 + localStorage 저장/복원 + 헤더 설정 버튼 + API 호출 헤더 전달
- [x] `generate-full-draft/route.ts` — generateText() 적용 + config 매개변수 전달
- [x] `generate-slide-content/route.ts` — generateText() 적용 리라이트
- [x] `analyze-toc/route.ts` — generateText() 적용 리라이트
- [x] `serverSlideUtils.ts` — extractKeyPoints/generateSlidesFromPrompt에 config 매개변수 추가
- [x] 이미지 전용 라우트 5개 (generate-slide-image, partial-edit, validate-text, analyze-style, extract-pdf-ocr) — X-Gemini-Key 헤더 fallback 추가
- [x] `SlideEditor.tsx` — geminiApiKey prop 전달 (partial-edit, generate-slide-image)
- [x] `slideImageGenerator.ts` — geminiApiKey 옵션 전달 (analyze-style, validate-text, generate-slide-image)
- [x] 빌드 검증 통과

## [LATER] Milestone 7 - 기능 고도화
- [ ] GSAP Animation Module: 애니메이션 프리셋(Fade, Zoom) 로직 구현
- [ ] Exporter Engine: 내보내기 기능
- [ ] Project Persistence: 로컬 스토리지 또는 DB 활용 진행 상황 저장
- [ ] 429 Rate Limit 재시도: generateSlidesFromPrompt()에 지수 백오프 적용
