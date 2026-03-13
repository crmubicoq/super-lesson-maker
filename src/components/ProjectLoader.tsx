'use client';

import { useState, useEffect } from 'react';
import { X, FolderOpen, Layers, Clock, Loader2, Inbox } from 'lucide-react';

interface ProjectSummary {
    folderName: string;
    overallTitle: string;
    slideCount: number;
    savedAt: string | null;
    slideTemplate: string;
}

interface ProjectLoaderProps {
    isOpen: boolean;
    onClose: () => void;
    onLoadProject: (folderName: string) => void;
}

export default function ProjectLoader({ isOpen, onClose, onLoadProject }: ProjectLoaderProps) {
    const [projects, setProjects] = useState<ProjectSummary[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingProject, setLoadingProject] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            fetchProjects();
        }
    }, [isOpen]);

    const fetchProjects = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/list-projects');
            if (!res.ok) throw new Error('프로젝트 목록을 불러올 수 없습니다.');
            const data = await res.json();
            setProjects(data.projects || []);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : '오류가 발생했습니다.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSelect = (folderName: string) => {
        setLoadingProject(folderName);
        onLoadProject(folderName);
    };

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        const month = d.getMonth() + 1;
        const day = d.getDate();
        const hours = d.getHours().toString().padStart(2, '0');
        const minutes = d.getMinutes().toString().padStart(2, '0');
        return `${month}/${day} ${hours}:${minutes}`;
    };

    const templateLabel = (t: string) => {
        switch (t) {
            case 'lecture': return '강의 교안';
            case 'seminar': return '세미나';
            case 'free': return '자유 형식';
            default: return t;
        }
    };

    if (!isOpen) return null;

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
                    <div className="flex items-center gap-2">
                        <FolderOpen size={18} className="text-blue-400" />
                        <h2 className="text-lg font-bold text-white">프로젝트 불러오기</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-all"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div className="px-6 py-4 max-h-[400px] overflow-y-auto">
                    {isLoading && (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 size={24} className="animate-spin text-blue-400" />
                        </div>
                    )}

                    {error && (
                        <div className="text-center py-8 text-red-400 text-sm">{error}</div>
                    )}

                    {!isLoading && !error && projects.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                            <Inbox size={40} className="mb-3 opacity-50" />
                            <p className="text-sm font-bold">저장된 프로젝트가 없습니다</p>
                            <p className="text-xs mt-1">슬라이드를 생성하면 자동으로 저장됩니다</p>
                        </div>
                    )}

                    {!isLoading && !error && projects.length > 0 && (
                        <div className="space-y-2">
                            {projects.map((project) => (
                                <button
                                    key={project.folderName}
                                    onClick={() => handleSelect(project.folderName)}
                                    disabled={loadingProject !== null}
                                    className="w-full flex items-center gap-4 p-4 rounded-xl border border-white/15 hover:border-blue-500/30 hover:bg-blue-500/5 transition-all text-left disabled:opacity-50"
                                >
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-white truncate">
                                            {project.overallTitle}
                                        </p>
                                        <div className="flex items-center gap-3 mt-1.5">
                                            <span className="flex items-center gap-1 text-[11px] text-slate-400">
                                                <Layers size={11} />
                                                {project.slideCount}장
                                            </span>
                                            <span className="text-[11px] text-slate-500">
                                                {templateLabel(project.slideTemplate)}
                                            </span>
                                            {project.savedAt && (
                                                <span className="flex items-center gap-1 text-[11px] text-slate-500">
                                                    <Clock size={11} />
                                                    {formatDate(project.savedAt)}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    {loadingProject === project.folderName ? (
                                        <Loader2 size={16} className="animate-spin text-blue-400 flex-shrink-0" />
                                    ) : (
                                        <span className="text-xs text-slate-500 flex-shrink-0">불러오기</span>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end px-6 py-3 border-t border-white/10">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-all"
                    >
                        닫기
                    </button>
                </div>
            </div>
        </div>
    );
}
