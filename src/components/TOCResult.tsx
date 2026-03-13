"use client";

import React from 'react';
import { ListChecks, ChevronRight, Edit3, Trash2, Plus, ArrowRight } from 'lucide-react';

interface TOCItem {
    id: string;
    title: string;
    pageRange: string;
}

interface TOCResultProps {
    items: TOCItem[];
    onConfirm: () => void;
    onUpdateItems: (newItems: TOCItem[]) => void;
    onReAnalyze: () => void;
}

export default function TOCResult({ items, onConfirm, onUpdateItems, onReAnalyze }: TOCResultProps) {
    const [editingId, setEditingId] = React.useState<string | null>(null);
    const [editTitle, setEditTitle] = React.useState("");
    const [editRange, setEditRange] = React.useState("");

    const startEdit = (item: TOCItem) => {
        setEditingId(item.id);
        setEditTitle(item.title);
        setEditRange(item.pageRange);
    };

    const saveEdit = (id: string) => {
        const newItems = items.map(item =>
            item.id === id ? { ...item, title: editTitle, pageRange: editRange } : item
        );
        onUpdateItems(newItems);
        setEditingId(null);
    };

    const deleteItem = (id: string) => {
        const newItems = items.filter(item => item.id !== id);
        onUpdateItems(newItems);
    };

    const addItem = () => {
        const newId = `new-${Date.now()}`;
        const newItem: TOCItem = {
            id: newId,
            title: "새 항목 제목을 입력하세요",
            pageRange: "1-1"
        };
        onUpdateItems([...items, newItem]);
        setTimeout(() => startEdit(newItem), 50);
    };
    return (
        <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-600/20 text-blue-400">
                        <ListChecks size={24} />
                    </div>
                    <h3 className="text-2xl font-bold text-white">추출된 목차 분석 결과</h3>
                </div>
                <button
                    onClick={addItem}
                    className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
                >
                    <Plus size={16} />
                    항목 추가
                </button>
            </div>

            <div className="space-y-3 mb-10">
                {items.map((item, index) => (
                    <div
                        key={item.id}
                        className="flex items-center gap-4 p-4 rounded-2xl glass-card group hover:bg-white/10 transition-all border-white/10"
                    >
                        <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-400 border border-white/15">
                            {index + 1}
                        </div>
                        <div className="flex-1">
                            {editingId === item.id ? (
                                <div className="space-y-2 py-1">
                                    <input
                                        autoFocus
                                        value={editTitle}
                                        onChange={(e) => setEditTitle(e.target.value)}
                                        className="w-full bg-slate-700/60 border border-blue-500/50 rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:ring-1 focus:ring-blue-500/50"
                                        onKeyDown={(e) => e.key === 'Enter' && saveEdit(item.id)}
                                    />
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] text-slate-500 uppercase font-bold">Range:</span>
                                        <input
                                            value={editRange}
                                            onChange={(e) => setEditRange(e.target.value)}
                                            className="w-24 bg-slate-700/60 border border-white/15 rounded-lg px-2 py-0.5 text-xs text-slate-300 outline-none"
                                            onKeyDown={(e) => e.key === 'Enter' && saveEdit(item.id)}
                                        />
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <p className="text-white font-medium">{item.title}</p>
                                    <p className="text-xs text-slate-500 mt-1">페이지 범위: {item.pageRange}</p>
                                </>
                            )}
                        </div>
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            {editingId === item.id ? (
                                <>
                                    <button
                                        onClick={() => saveEdit(item.id)}
                                        className="p-2 rounded-lg bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 transition-colors"
                                    >
                                        <ListChecks size={16} />
                                    </button>
                                    <button
                                        onClick={() => setEditingId(null)}
                                        className="p-2 rounded-lg hover:bg-white/5 text-slate-500 transition-colors"
                                    >
                                        <Plus className="rotate-45" size={16} />
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button
                                        onClick={() => startEdit(item)}
                                        title="목차 편집"
                                        className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
                                    >
                                        <Edit3 size={16} />
                                    </button>
                                    <button
                                        onClick={() => deleteItem(item.id)}
                                        title="목차 삭제"
                                        className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-red-400 transition-colors"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <div className="flex items-center justify-center gap-6">
                <button
                    onClick={onReAnalyze}
                    className="px-8 py-4 rounded-2xl border border-white/15 text-slate-400 font-bold hover:bg-white/5 transition-all"
                >
                    다시 분석하기
                </button>
                <button
                    onClick={onConfirm}
                    className="px-10 py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-lg shadow-blue-900/40 transition-all flex items-center gap-3 active:scale-95"
                >
                    이 목차로 슬라이드 생성하기
                    <ArrowRight size={20} />
                </button>
            </div>
        </div>
    );
}
