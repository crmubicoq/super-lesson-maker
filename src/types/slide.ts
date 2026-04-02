// 콘텐츠 블록 (grid 레이아웃의 각 셀)
export interface ContentBlock {
    subtitle: string;       // 블록 소제목 (예: "조기 발견")
    body: string;           // 블록 설명 텍스트
    iconUrl?: string;       // Gemini 생성 아이콘 이미지 URL
    iconPrompt?: string;    // 아이콘 생성에 사용된 프롬프트
}

// 교안 형식 템플릿
export type SlideTemplateId = 'lecture' | 'seminar' | 'free';

// 슬라이드 레이아웃 타입
export type SlideLayout =
    | 'cover'               // 표지 슬라이드
    | 'title_body'          // 제목 + 본문
    | 'bullet_list'         // 제목 + 불릿 포인트 (기존 호환)
    | 'grid_2x2'            // 2x2 그리드 (아이콘 + 소제목 + 설명)
    | 'grid_1x3'            // 1행 3열 그리드
    | 'content_image'       // 텍스트 + 이미지
    | 'image_background'    // 배경 이미지 + 오버레이 텍스트
    | 'section_divider';    // 챕터 구분 슬라이드

export type SlideRole = 'cover' | 'objectives' | 'content' | 'chapter_divider' | 'summary';

export interface Slide {
    id: string;
    chapterId: string;
    chapterTitle: string;
    slideTitle: string;
    content: string[];              // 불릿 포인트 (bullet_list 호환)
    contentBlocks?: ContentBlock[]; // grid 레이아웃용 구조화 콘텐츠
    bodyText?: string;              // title_body 레이아웃용 본문
    accentColor?: string;           // 테마 액센트 색상 (hex)
    imagePrompt?: string;
    imageUrl?: string;
    layout: SlideLayout;
    designStyle: string;
    speakerNotes?: string;
    slideRole?: SlideRole;          // 슬라이드의 의미적 역할
    // v3: AI 이미지 기반 파이프라인
    generatedImageUrl?: string;     // 최종 생성된 슬라이드 이미지 경로
    generatedImageBase64?: string;  // 최종 생성된 슬라이드의 순수 Base64 데이터 (로컬 내보내기용)
    finalCapturedBase64?: string;   // 화면에서 캡처된 UI 기반 최종 Base64 데이터 (PDF 포함용)
    previousImageUrl?: string;      // 재생성 직전 이미지 URL (되돌리기용)
    previousImageBase64?: string;   // 재생성 직전 이미지 base64 (되돌리기용)
    textValidated?: boolean;        // 텍스트 검증 통과 여부
    validationIssues?: string[];    // 발견된 텍스트 불일치 문제점들
    validationAttempts?: number;    // 검증 시도 횟수
}

// 챕터 메타 정보 (AI 분석 결과)
export interface ChapterMeta {
    id: string;
    title: string;
    pageRange: string;
    suggestedSlideCount: number;
}

// generate-full-draft API 응답 타입
export interface FullDraftResult {
    overallTitle: string;
    learningObjectives: string[];
    chapters: ChapterMeta[];
    slides: Array<StructuredSlideContent & {
        chapterId: string;
        chapterTitle: string;
        slideRole: SlideRole;
    }>;
    styleSuggestions: string;
}

export type GenerationStatus = 'idle' | 'generating' | 'completed' | 'failed';

// v3: 6단계 파이프라인 스테이지
export type PipelineStage =
    | 'normalizing'       // 이미지 정규화
    | 'analyzing_style'   // 스타일 분석
    | 'analyzing_content' // 콘텐츠 분석
    | 'generating'        // 이미지 생성
    | 'validating_text'   // 텍스트 검증
    | 'completed';        // 완료

export interface PipelineProgress {
    stage: PipelineStage;
    stageProgress: number;      // 0-100 (현재 단계 내)
    overallProgress: number;    // 0-100 (전체)
    currentSlide?: number;
    totalSlides?: number;
    message: string;
}

export interface StyleProfile {
    colorPalette: string[];      // 주요 색상 (hex)
    layoutStyle: string;         // "minimal" | "corporate" | "creative" 등
    typography: string;          // 타이포그래피 설명
    mood: string;                // 분위기 설명
    rawDescription: string;      // 전체 스타일 분석 텍스트
    referenceImagesBase64?: string[]; // 참고 이미지 (생성 시 전달용)
}

export interface SlideContent {
    slideTitle: string;
    bodyText?: string;
    bulletPoints?: string[];
    layoutHint?: string;
    originalImageBase64?: string;
}

export interface GenerationProgress {
    totalSlides: number;
    completedSlides: number;
    currentSection: string;
    status: GenerationStatus;
}

// 프로젝트 저장용 슬라이드 (base64 필드 제외)
export type SavedSlide = Omit<Slide, 'generatedImageBase64' | 'finalCapturedBase64'>;

// 저장된 프로젝트 구조
export interface SavedProject {
    version: 1;
    savedAt: string;
    overallTitle: string;
    userStyle: string;
    slideTemplate: SlideTemplateId;
    slides: SavedSlide[];
}

// 텍스트 오버레이 편집 관련 타입
export interface OverlayRect {
    x: number;
    y: number;
    width: number;
    height: number;
}

export type VerticalAlign = 'top' | 'middle' | 'bottom';
export type HorizontalAlign = 'left' | 'center' | 'right';

export interface TextOverlay {
    id: string;
    rect: OverlayRect;
    originalText: string;
    newText: string;
    fontSize: number;
    fontWeight: string;
    fontColor: string;
    fontFamily: string;
    backgroundColor: string;
    backgroundPadding?: number;
    edgeBlur?: number;
    vAlign: VerticalAlign;
    hAlign: HorizontalAlign;
    letterSpacing?: number;
}

export interface OCRAnalysisResult {
    text: string;
    fontSize: number;
    fontWeight: string;
    fontColor: string;
    fontFamily: string;
    backgroundColor: string;
}

// AI 서비스 반환 타입
export interface StructuredSlideContent {
    slideTitle: string;
    layout: SlideLayout;
    contentBlocks?: ContentBlock[];
    bulletPoints?: string[];
    bodyText?: string;
    speakerNotes?: string;
}
