export interface DesignTemplate {
  id: string;
  name: string;
  description: string;
  emoji: string;
  prompt: string;
}

export const DESIGN_TEMPLATES: DesignTemplate[] = [
  {
    id: 'minimal_white',
    name: '미니멀 화이트',
    emoji: '⬜',
    description: '여백 중심의 깔끔한 프로페셔널',
    prompt: '흰색 배경, 검은색 제목, 회색 본문, 넓은 여백, 미니멀한 선 장식, 깔끔한 레이아웃',
  },
  {
    id: 'dark_corporate',
    name: '다크 코퍼레이트',
    emoji: '🖤',
    description: '어두운 배경의 세련된 기업 발표용',
    prompt: '짙은 네이비 또는 차콜 배경, 흰색 텍스트, 밝은 파란색 포인트 색상, 모던하고 세련된 기업 스타일',
  },
  {
    id: 'blue_professional',
    name: '블루 프로페셔널',
    emoji: '🔵',
    description: '신뢰감 있는 파란색 기반 비즈니스',
    prompt: '파란색 헤더 배경(#1E3A8A), 흰색 본문 영역, 파란색 계열 그라데이션, 전문적인 기업 보고서 스타일',
  },
  {
    id: 'colorful_education',
    name: '컬러풀 에듀케이션',
    emoji: '🌈',
    description: '교육용 밝고 생동감 있는 스타일',
    prompt: '밝고 다채로운 색상, 친근한 폰트, 노란색·초록색·주황색 포인트, 교육적이고 활기찬 강의 자료 스타일',
  },
  {
    id: 'elegant_beige',
    name: '엘레강트 베이지',
    emoji: '🌿',
    description: '고급스럽고 따뜻한 세미나 스타일',
    prompt: '크림색 또는 베이지 배경, 브라운 계열 텍스트, 골드 포인트 색상, 우아하고 고급스러운 세미나 발표 스타일',
  },
  {
    id: 'tech_gradient',
    name: '테크 그라데이션',
    emoji: '💜',
    description: '보라-파랑 그라데이션 IT/테크 스타일',
    prompt: '보라색에서 파란색으로 이어지는 그라데이션 배경, 흰색 텍스트, 네온 포인트 색상, 현대적인 IT 기술 스타일',
  },
  {
    id: 'green_clean',
    name: '그린 클린',
    emoji: '🟢',
    description: '초록색 포인트의 환경·건강 스타일',
    prompt: '흰색 배경, 초록색(#16A34A) 헤더 및 포인트 색상, 깔끔한 레이아웃, 환경·건강·웰니스 주제에 적합한 신선한 스타일',
  },
  {
    id: 'custom',
    name: '직접 입력',
    emoji: '✏️',
    description: '원하는 스타일을 직접 텍스트로 입력',
    prompt: '',
  },
];
