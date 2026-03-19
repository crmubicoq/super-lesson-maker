'use client';

import { useState } from 'react';
import { X, Eye, EyeOff, ExternalLink } from 'lucide-react';

export type AIProvider = 'gemini' | 'claude';

export interface AIConfigState {
    provider: AIProvider;
    apiKey: string;
    geminiApiKey: string; // Claude 사용 시 이미지 생성용 Gemini 키
}

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    config: AIConfigState;
    onSave: (config: AIConfigState) => void;
}

export default function SettingsModal({ isOpen, onClose, config, onSave }: SettingsModalProps) {
    const [localConfig, setLocalConfig] = useState<AIConfigState>(config);
    const [showApiKey, setShowApiKey] = useState(false);
    const [showGeminiKey, setShowGeminiKey] = useState(false);

    if (!isOpen) return null;

    const handleSave = () => {
        onSave(localConfig);
        onClose();
    };

    const handleOverlayClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) onClose();
    };

    return (
        <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
            onClick={handleOverlayClick}
        >
            <div className="w-full max-w-lg bg-[#334155] border border-white/15 rounded-2xl shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                    <h2 className="text-lg font-bold text-white">AI 설정</h2>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-all"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div className="px-6 py-5 space-y-6">
                    {/* AI Provider 선택 */}
                    <div>
                        <label className="block text-sm font-bold text-slate-300 mb-3">텍스트 AI 프로바이더</label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setLocalConfig(prev => ({ ...prev, provider: 'gemini' }))}
                                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                                    localConfig.provider === 'gemini'
                                        ? 'border-blue-500 bg-blue-500/10'
                                        : 'border-white/15 hover:border-white/20 bg-white/5'
                                }`}
                            >
                                <span className="text-2xl">✦</span>
                                <span className="text-sm font-bold text-white">Google Gemini</span>
                                <span className="text-[10px] text-slate-400">gemini-2.5-flash</span>
                            </button>
                            <button
                                onClick={() => setLocalConfig(prev => ({ ...prev, provider: 'claude' }))}
                                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                                    localConfig.provider === 'claude'
                                        ? 'border-amber-500 bg-amber-500/10'
                                        : 'border-white/15 hover:border-white/20 bg-white/5'
                                }`}
                            >
                                <span className="text-2xl">◈</span>
                                <span className="text-sm font-bold text-white">Anthropic Claude</span>
                                <span className="text-[10px] text-slate-400">claude-sonnet-4-6</span>
                            </button>
                        </div>
                        <p className="mt-2 text-[10px] text-slate-500">
                            문서 분석, 목차 구성, 슬라이드 콘텐츠 생성에 사용됩니다. 이미지 생성은 항상 Gemini를 사용합니다.
                        </p>
                    </div>

                    {/* API Key */}
                    <div>
                        <label className="block text-sm font-bold text-slate-300 mb-2">
                            {localConfig.provider === 'gemini' ? 'Gemini API 키' : 'Claude API 키'}
                        </label>
                        <div className="relative">
                            <input
                                type={showApiKey ? 'text' : 'password'}
                                value={localConfig.apiKey}
                                onChange={(e) => setLocalConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                                placeholder={localConfig.provider === 'gemini' ? 'AIzaSy...' : 'sk-ant-...'}
                                className="w-full px-4 py-3 pr-20 bg-slate-800/60 border border-white/15 rounded-xl text-sm text-white placeholder-slate-500 focus:border-blue-500/50 outline-none transition-all"
                            />
                            <button
                                onClick={() => setShowApiKey(!showApiKey)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-300 transition-colors"
                            >
                                {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                        <a
                            href={localConfig.provider === 'gemini'
                                ? 'https://aistudio.google.com/app/apikey'
                                : 'https://console.anthropic.com/settings/keys'
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 mt-2 text-[11px] text-blue-400 hover:text-blue-300 transition-colors"
                        >
                            API 키 발급받기 <ExternalLink size={10} />
                        </a>
                    </div>

                    {/* Claude 선택 시 Gemini 이미지 키 */}
                    {localConfig.provider === 'claude' && (
                        <div>
                            <label className="block text-sm font-bold text-slate-300 mb-2">
                                Gemini API 키 <span className="text-[10px] font-normal text-slate-500">(이미지 생성용)</span>
                            </label>
                            <div className="relative">
                                <input
                                    type={showGeminiKey ? 'text' : 'password'}
                                    value={localConfig.geminiApiKey}
                                    onChange={(e) => setLocalConfig(prev => ({ ...prev, geminiApiKey: e.target.value }))}
                                    placeholder="AIzaSy... (필수 입력)"
                                    className="w-full px-4 py-3 pr-20 bg-slate-800/60 border border-white/15 rounded-xl text-sm text-white placeholder-slate-500 focus:border-blue-500/50 outline-none transition-all"
                                />
                                <button
                                    onClick={() => setShowGeminiKey(!showGeminiKey)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-300 transition-colors"
                                >
                                    {showGeminiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                            <p className="mt-1 text-[10px] text-slate-500">
                                슬라이드 이미지 생성에 필요합니다. 반드시 입력해주세요.
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/10">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-all"
                    >
                        취소
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-bold text-white transition-all"
                    >
                        저장
                    </button>
                </div>
            </div>
        </div>
    );
}
