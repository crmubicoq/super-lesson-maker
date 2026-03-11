# Lecture Slide Maker

**Lecture Slide Maker**는 PDF, Word 등의 강의 원고 파일을 업로드하면 AI(Gemini)가 문서를 분석하여 자동으로 스마트한 PPTX 강의 교안을 생성해 주는 지능형 프레젠테이션 설계 도구입니다.

## 주요 기능 (Features)
- **원고 자동 분석**: 다양한 형식의 학술 문서, 매뉴얼, 스크립트 등을 업로드하여 자동 목차 추출 및 핵심 요약
- **파이프라인 워크플로우**: 원고 업로드 -> AI 문서 분석 -> 목차 및 분량 구성 -> 디자인 옵션 설정 -> AI 슬라이드 렌더링 -> 슬라이드 상세 검수 -> 최종 내보내기의 직관적인 7단계 프로세스
- **AI 이미지 생성 보조**: 슬라이드 구조에 맞게 어울리는 배경 이미지 및 아이콘 요소 등을 프롬프트로 제안
- **클라이언트 사이드 로컬 저장**: File System Access API를 활용해 백엔드 서버를 거치지 않고 사용자의 로컬 환경에 직접 안전하게 PDF 및 PPTX 형태로 다운로드
- **유연한 레이아웃**: Cover, Bullet List, Grid 2x2 등 내용에 맞는 자체 알고리즘 기반 슬라이드 레이아웃 동적 배치

## 기술 스택 (Tech Stack)
- **Framework**: Next.js 14, React 18
- **Styling**: Tailwind CSS, Framer Motion, GSAP
- **AI / LLM**: Google Gemini 2.5 Pro (Generative Language API)
- **File Processing**: PDF.js, Mammoth (docx), PPTXGenJS, jsPDF

## 시작하기 (Getting Started)

### 환경 변수 설정
프로젝트 최상단에 `.env.local` 파일을 생성하고 발급받은 Gemini API Key를 입력하세요.
```env
GEMINI_API_KEY=your_api_key_here
```

### 설치 및 실행
```bash
npm install
npm run dev
```

[http://localhost:3000](http://localhost:3000) 주소를 브라우저에서 열어 확인할 수 있습니다.
