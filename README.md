# Super Lesson Maker

**Super Lesson Maker**는 PDF, Word 등의 강의 원고 파일을 업로드하면 AI가 문서를 분석하여 자동으로 강의 교안 슬라이드를 생성해 주는 지능형 프레젠테이션 설계 도구입니다.

## 주요 기능

- **원고 자동 분석**: PDF, Word 등 다양한 형식의 문서를 업로드하면 AI가 자동으로 목차를 추출하고 핵심 내용을 요약
- **7단계 파이프라인 워크플로우**: 원고 업로드 → AI 문서 분석 → 초안 미리보기 → 디자인 설정 → AI 슬라이드 렌더링 → 슬라이드 검수 → 최종 내보내기
- **AI 슬라이드 이미지 생성**: Gemini 이미지 모델로 슬라이드 배경, 레이아웃, 텍스트를 포함한 완성된 슬라이드 이미지를 자동 생성
- **부분 수정 (Partial Edit)**: 생성된 슬라이드에 자연어 수정 지시를 입력하면 AI가 해당 부분만 수정
- **스타일 참고 이미지**: 원하는 디자인의 참고 슬라이드 이미지를 업로드하면 해당 스타일을 분석하여 반영 (드래그 앤 드롭 지원)
- **멀티 AI 프로바이더**: 텍스트 분석에 Gemini 또는 Claude API 중 선택 가능
- **OCR 지원**: 스캔된 PDF 등 텍스트 메타데이터가 없는 문서도 Gemini Vision으로 텍스트 추출
- **로컬 내보내기**: 프로젝트 `outputs/` 폴더에 PDF + 개별 슬라이드 이미지를 저장

## 기술 스택

- **Framework**: Next.js 16, React 19, TypeScript
- **Styling**: Tailwind CSS v4
- **AI / LLM**:
  - Google Gemini (gemini-2.5-flash: 텍스트 분석, gemini-2.0-flash: 비전/검증, gemini-3-pro-image-preview: 이미지 생성)
  - Anthropic Claude (claude-sonnet-4-6: 텍스트 분석 대안)
- **File Processing**: PDF.js, sharp, jsPDF, PPTXGenJS, html-to-image

## 시작하기

### 1. 설치
```bash
npm install
```

### 2. 환경 변수 설정 (선택)
프로젝트 최상단에 `.env.local` 파일을 생성하고 API 키를 입력합니다.
```env
GEMINI_API_KEY=your_gemini_api_key_here
```
> 환경 변수 없이도 앱 상단의 설정(톱니바퀴) 버튼에서 API 키를 직접 입력할 수 있습니다.

### 3. 실행
```bash
npm run dev
```
[http://localhost:3000](http://localhost:3000)에서 확인할 수 있습니다.

## AI 프로바이더 설정

앱 상단 헤더의 **설정 버튼**을 클릭하여 AI 프로바이더와 API 키를 설정합니다.

| 프로바이더 | 용도 | API 키 발급 |
|---|---|---|
| **Gemini** | 텍스트 분석 + 이미지 생성 | [Google AI Studio](https://aistudio.google.com/) |
| **Claude** | 텍스트 분석 (이미지 생성은 Gemini 사용) | [Anthropic Console](https://console.anthropic.com/) |

- Gemini 선택 시: Gemini API 키 1개만 필요
- Claude 선택 시: Claude API 키 + Gemini API 키 (이미지 생성용) 2개 필요
