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

interface SidebarProps {
  currentStep: number;
}

export default function Sidebar({ currentStep }: SidebarProps) {
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
          {steps.map((step) => (
            <div
              key={step.id}
              className={`flex items-center gap-4 p-3 rounded-xl transition-all duration-300 group ${step.id === currentStep
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.1)]'
                : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                }`}
            >
              <div className={`p-1.5 rounded-lg transition-colors ${step.id === currentStep ? 'bg-blue-500/20' : 'bg-transparent group-hover:bg-white/5'}`}>
                <step.icon size={18} />
              </div>
              <span className="font-semibold text-sm tracking-tight">{step.name}</span>
              {step.id === currentStep && (
                <div className="ml-auto flex items-center gap-1">
                  <span className="text-[10px] font-bold opacity-60">진행중</span>
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse shadow-[0_0_8px_#3b82f6]" />
                </div>
              )}
            </div>
          ))}
        </nav>
      </div>
    </aside>
  );
}
