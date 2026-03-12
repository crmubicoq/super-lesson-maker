"use client";

import React from 'react';
import {
  FileText,
  Sparkles,
  Eye,
  Palette,
  Layout,
  Edit3,
  Download,
  Check,
} from 'lucide-react';

const steps = [
  { id: 1, name: '원고 업로드', icon: FileText },
  { id: 2, name: 'AI 문서 분석', icon: Sparkles },
  { id: 3, name: '목차 및 분량 구성', icon: Eye },
  { id: 4, name: '디자인 옵션 설정', icon: Palette },
  { id: 5, name: 'AI 슬라이드 렌더링', icon: Layout },
  { id: 6, name: '슬라이드 상세 검수', icon: Edit3 },
  { id: 7, name: '최종 내보내기', icon: Download },
];

// 클릭 불가 단계 (AI 처리 중이므로 중간에 돌아갈 수 없음)
const NON_CLICKABLE_STEPS = new Set([2, 5]);

interface SidebarProps {
  currentStep: number;
  onStepClick?: (stepNumber: number) => void;
}

export default function Sidebar({ currentStep, onStepClick }: SidebarProps) {
  return (
    <aside className="w-64 bg-[#0F172A] glass h-screen border-r border-white/10 flex flex-col z-20 relative">
      <div className="p-6">
        <div className="flex items-center gap-3 mb-10">
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
            Lecture Slide Maker
          </h1>
        </div>

        <nav className="space-y-2 flex-1 overflow-y-auto pr-2 custom-scrollbar">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-4 opacity-70">워크플로우 공정</p>
          {steps.map((step) => {
            const isCompleted = step.id < currentStep;
            const isCurrent = step.id === currentStep;
            const isFuture = step.id > currentStep;
            const isClickable = isCompleted && !NON_CLICKABLE_STEPS.has(step.id) && onStepClick;

            return (
              <div
                key={step.id}
                onClick={() => isClickable && onStepClick(step.id)}
                className={`flex items-center gap-4 p-3 rounded-xl transition-all duration-300 group ${
                  isCurrent
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.1)]'
                    : isClickable
                      ? 'text-emerald-400/80 hover:bg-emerald-500/10 hover:text-emerald-300 cursor-pointer'
                      : isCompleted
                        ? 'text-slate-500'
                        : isFuture
                          ? 'text-slate-600 opacity-50'
                          : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                }`}
              >
                <div className={`p-1.5 rounded-lg transition-colors ${
                  isCurrent
                    ? 'bg-blue-500/20'
                    : isCompleted
                      ? 'bg-emerald-500/10'
                      : 'bg-transparent group-hover:bg-white/5'
                }`}>
                  {isCompleted ? <Check size={18} /> : <step.icon size={18} />}
                </div>
                <span className="font-semibold text-sm tracking-tight">{step.name}</span>
                {isCurrent && (
                  <div className="ml-auto flex items-center gap-1">
                    <span className="text-[10px] font-bold opacity-60">진행중</span>
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse shadow-[0_0_8px_#3b82f6]" />
                  </div>
                )}
                {isClickable && (
                  <div className="ml-auto">
                    <span className="text-[10px] font-bold text-emerald-500/0 group-hover:text-emerald-500/60 transition-colors">이동</span>
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
