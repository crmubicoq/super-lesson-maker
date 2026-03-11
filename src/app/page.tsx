"use client";

import React, { useState, useEffect, useRef } from 'react';
import Sidebar from '@/components/Sidebar';
import FileUploader from '@/components/FileUploader';
import { FileUp, Sparkles, FileText, Palette, ArrowRight, ArrowLeft, Zap, Download, CheckCircle2, Image, BookOpen, Plus, Minus, Loader2 } from 'lucide-react';
import { PdfProcessor } from '@/utils/pdfProcessor';
import { TextProcessor } from '@/utils/textProcessor';
import { SlideImageGenerator } from '@/utils/slideImageGenerator';
import { Slide, PipelineProgress as PipelineProgressType, SlideTemplateId, SlideRole } from '@/types/slide';
import SlideEditor from '@/components/SlideEditor';
import SlideContentPreview from '@/components/SlideContentPreview';
import PipelineProgress from '@/components/PipelineProgress';
import { gsap } from 'gsap';
import { jsPDF } from 'jspdf';

type Step = 'upload' | 'analyzing' | 'draft_preview' | 'configure_visual' | 'generating' | 'draft' | 'animation' | 'export' | 'publish';

function AnalyzingProgress() {
  const [progress, setProgress] = useState(0);
  const [timeElapsed, setTimeElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeElapsed(prev => prev + 1);
      setProgress(prev => {
        if (prev >= 98) return prev; // 98%에서 잠시 대기
        const add = Math.max(0.1, (98 - prev) * 0.04);
        return prev + add;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full max-w-md mt-8">
      <div className="flex justify-between items-end mb-2">
        <span className="text-xs font-bold text-blue-400">명품 초안 설계 진행률 (Pro 모델 연산 중)</span>
        <span className="text-xs font-bold text-slate-300">{Math.floor(progress)}%</span>
      </div>
      <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden border border-white/5 relative">
        <div
          className="h-full bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-500 transition-all duration-1000 ease-linear"
          style={{ width: `${progress}%` }}
        />
        <div className="absolute top-0 left-0 w-full h-full bg-white/20 animate-pulse" />
      </div>
      <div className="flex justify-between items-center mt-3 px-1">
        <p className="text-[10px] text-slate-500 font-medium">경과 시간: {Math.floor(timeElapsed / 60)}분 {(timeElapsed % 60).toString().padStart(2, '0')}초</p>
        <p className="text-[10px] text-indigo-400 font-medium">※ 최대 2~4분 소요</p>
      </div>
    </div>
  );
}

export default function Home() {
  const [step, setStep] = useState<Step>('upload');
  const mainContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (mainContentRef.current) {
      gsap.fromTo(mainContentRef.current,
        { opacity: 0, y: 15 },
        { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" }
      );
    }
  }, [step]);

  // 상태
  const [files, setFiles] = useState<File[]>([]);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [userStyle, setUserStyle] = useState('');
  const [pipelineProgress, setPipelineProgress] = useState<PipelineProgressType | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [styleReferenceImages, setStyleReferenceImages] = useState<string[]>([]);
  const [slideTemplate, setSlideTemplate] = useState<SlideTemplateId>('lecture');

  // 새 상태: AI 분석 결과
  const [overallTitle, setOverallTitle] = useState('');
  const [addingSlide, setAddingSlide] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // 파일 선택 (분석은 아직 시작하지 않음)
  const handleFilesSelected = (selectedFiles: File[]) => {
    setFiles(selectedFiles);
  };

  // 텍스트 추출 유틸
  const extractTextFromFiles = async (targetFiles: File[]): Promise<string> => {
    let combinedText = '';
    let pageOffset = 0;

    for (const file of targetFiles) {
      let fileText = '';

      if (file.type === 'application/pdf') {
        const processor = new PdfProcessor(file);
        fileText = await processor.extractText();

        if (pageOffset > 0) {
          fileText = fileText.replace(/\[Page (\d+)\]/g, (_, num) => {
            return `[Page ${parseInt(num, 10) + pageOffset}]`;
          });
        }

        const pageMatches = fileText.matchAll(/\[Page (\d+)\]/g);
        let maxPage = pageOffset;
        for (const m of pageMatches) {
          const p = parseInt(m[1], 10);
          if (p > maxPage) maxPage = p;
        }
        pageOffset = maxPage;
      } else {
        const processor = new TextProcessor(file);
        await processor.load();
        const rawText = processor.getTextContent() || '';
        pageOffset++;
        fileText = `[Page ${pageOffset}]\n${rawText}\n\n`;
      }

      combinedText += fileText;
    }

    return combinedText;
  };

  // 분석 시작 → AI가 전체 슬라이드 초안 생성
  const handleStartAnalysis = async (targetCount?: number) => {
    if (files.length === 0) return;
    setStep('analyzing');
    setGenerationError(null);

    try {
      // 1. 텍스트 기본 추출 (pdf.js 등)
      let fullText = await extractTextFromFiles(files);

      // [Fallback 로직] 기본 추출로 텍스트가 나오지 않는 경우 (예: 스캔본 PDF)
      const realTextLength = fullText.replace(/\[Page \d+\]/g, '').trim().length;
      if (realTextLength < 20) {
        const pdfFile = files.find(f => f.type === 'application/pdf');
        if (pdfFile) {
          console.log('[handleStartAnalysis] 스캔본 문서로 추정, Gemini Vision OCR Fallback 시작...');

          const formData = new FormData();
          formData.append('file', pdfFile);

          // 안전한 타임아웃: AbortController + setTimeout
          const ocrController = new AbortController();
          const ocrTimeoutId = setTimeout(() => ocrController.abort(), 360000); // 6분 (서버 maxDuration 300초 + 여유 60초)

          let ocrResponse: Response;
          try {
            ocrResponse = await fetch('/api/extract-pdf-ocr', {
              method: 'POST',
              body: formData,
              signal: ocrController.signal,
            });
          } finally {
            clearTimeout(ocrTimeoutId);
          }

          if (!ocrResponse.ok) {
            const err = await ocrResponse.json().catch(() => ({ error: `HTTP ${ocrResponse.status}` }));
            throw new Error(err.error || '스캔본 문서 텍스트 추출 처리에 실패했습니다.');
          }

          const ocrResult = await ocrResponse.json();
          fullText = ocrResult.text;
          console.log(`[handleStartAnalysis] OCR 대체 추출 성공, 텍스트 길이: ${fullText.length}`);

          if (fullText.length < 20) {
            throw new Error('OCR 추출 후에도 텍스트 정보가 너무 부족합니다. 다른 문서를 시도해주세요.');
          }
        } else {
          throw new Error('문서에서 텍스트를 추출하지 못했습니다. (지원되지 않는 파일 형식이거나 내용이 비어있음)');
        }
      }

      // 안전한 타임아웃: AbortController + setTimeout (AbortSignal.timeout 대신)
      const draftController = new AbortController();
      const draftTimeoutId = setTimeout(() => draftController.abort(), 660000); // 11분 (서버 maxDuration 600초 + 여유 60초)

      let response: Response;
      try {
        response = await fetch('/api/generate-full-draft', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fullText,
            fileName: files.map(f => f.name).join(', '),
            template: slideTemplate,
            targetSlideCount: targetCount,
          }),
          signal: draftController.signal,
        });
      } finally {
        clearTimeout(draftTimeoutId);
      }

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
        throw new Error(err.error || `서버 오류: ${response.status}`);
      }

      const result = await response.json();

      // 3. 결과 저장
      setOverallTitle(result.overallTitle || '');
      if (result.styleSuggestions) setUserStyle(result.styleSuggestions);

      // 4. Slide[] 배열로 변환
      const style = result.styleSuggestions || 'Professional and Clean';
      const assembledSlides: Slide[] = (result.slides || []).map((s: {
        chapterId: string;
        chapterTitle: string;
        slideTitle?: string;
        layout?: string;
        bulletPoints?: string[];
        bodyText?: string;
        contentBlocks?: Array<{ subtitle: string; body: string }>;
        speakerNotes?: string;
        slideRole?: SlideRole;
      }, i: number) => ({
        id: `slide-${s.chapterId}-${i + 1}`,
        chapterId: s.chapterId,
        chapterTitle: s.chapterTitle,
        slideTitle: s.slideTitle || `슬라이드 ${i + 1}`,
        content: Array.isArray(s.bulletPoints)
          ? s.bulletPoints.map((bp: any) => typeof bp === 'string' ? bp : (bp.item || bp.text || bp.value || String(bp)))
          : [],
        contentBlocks: Array.isArray(s.contentBlocks)
          ? s.contentBlocks.map((cb: any) => ({
            subtitle: typeof cb.subtitle === 'string' ? cb.subtitle : String(cb.subtitle || ''),
            body: typeof cb.body === 'string' ? cb.body : String(cb.body || '')
          }))
          : undefined,
        bodyText: s.bodyText || '',
        layout: s.layout || 'bullet_list',
        designStyle: style,
        speakerNotes: s.speakerNotes || '',
        slideRole: s.slideRole,
      }));

      if (assembledSlides.length === 0) {
        throw new Error('슬라이드 초안이 생성되지 않았습니다.');
      }

      setSlides(assembledSlides);
      setStep('draft_preview');
    } catch (e: any) {
      console.error('[handleStartAnalysis]', e);
      let errorMessage = '분석 중 오류가 발생했습니다.';
      if (e instanceof Error || e.name) {
        if (e.name === 'TimeoutError' || e.name === 'AbortError' || (e.message && e.message.includes('aborted'))) {
          errorMessage = 'AI 처리 시간이 초과되었습니다. Pro 모델은 복잡한 원고 분석에 수 분이 소요될 수 있습니다. 목표 슬라이드 장수를 줄이거나 잠시 후 다시 시도해주세요.';
        } else if (e.message && e.message.includes('시간 초과') || e.message && e.message.includes('시간이 초과')) {
          errorMessage = e.message;
        } else {
          errorMessage = e.message || errorMessage;
        }
      }
      alert(errorMessage);
      setStep('upload');
    }
  };

  const handleUpdateSlide = (updatedSlide: Slide) => {
    setSlides(prev => prev.map(s => s.id === updatedSlide.id ? updatedSlide : s));
  };

  // 이미지 생성 시작
  const handleStartImageGeneration = async () => {
    setStep('generating');
    setGenerationError(null);
    setPipelineProgress(null);

    try {
      const generator = new SlideImageGenerator({
        userStyle: userStyle || "Professional and Clean",
        slidesPerSection: 0,
        styleReferenceImages,
        onProgress: (progress) => setPipelineProgress(progress),
      });

      const updatedSlides = await generator.generateImagesForSlides([...slides]);
      setSlides(updatedSlides);
      setStep('draft');
    } catch (e: any) {
      console.error('[Generation Error]', e);
      let errorMessage = "슬라이드 생성 중 알 수 없는 오류가 발생했습니다.";
      if (e instanceof Error || e.name) {
        if (e.name === 'TimeoutError' || e.name === 'AbortError' || (e.message && e.message.includes('aborted'))) {
          errorMessage = '이미지 생성 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.';
        } else {
          errorMessage = e.message || errorMessage;
        }
      }
      setGenerationError(errorMessage);
      setStep('configure_visual');
    } finally {
      setPipelineProgress(null);
    }
  };

  const getWorkflowStep = () => {
    switch (step) {
      case 'upload': return 1;
      case 'analyzing': return 2;
      case 'draft_preview': return 3;
      case 'configure_visual': return 4;
      case 'generating': return 5;
      case 'draft': return 6;
      case 'export':
      case 'publish': return 7;
      default: return 1;
    }
  };

  const getTitle = () => {
    switch (step) {
      case 'upload': return '원고 업로드';
      case 'analyzing': return 'AI 초안 생성 중...';
      case 'draft_preview': return '슬라이드 초안 확인';
      case 'configure_visual': return '비주얼 설정';
      case 'generating': return 'AI 슬라이드 디자인 중...';
      case 'draft': return '슬라이드 편집';
      case 'export': return '교안 내보내기';
      case 'publish': return '배포 및 회고';
      default: return '';
    }
  };

  return (
    <div className="flex h-screen bg-[#0F172A] text-slate-200 font-sans selection:bg-blue-500/30 overflow-hidden">
      <Sidebar currentStep={getWorkflowStep()} />

      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* TOP BAR */}
        <div className="h-16 border-b border-white/5 bg-black/40 backdrop-blur-xl flex items-center justify-between px-8 z-50 flex-none">
          <div className="flex items-center gap-3">
            <div className="px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-[10px] font-bold text-blue-400 tracking-wider uppercase">
              Project: {files.length > 0 ? (files.length === 1 ? files[0].name.split('.')[0] : `${files[0].name.split('.')[0]} 외 ${files.length - 1}개`) : 'New Lesson Project'}
            </div>
            <div className="h-4 w-[1px] bg-white/10" />
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-amber-400" />
              <span className="text-xs font-medium text-slate-400">Generative AI Mode</span>
            </div>
          </div>
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-[10px] font-bold">G</div>
        </div>

        {/* CONTENT BODY */}
        <div className="flex-1 relative overflow-hidden flex flex-col">
          <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden z-0">
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600/5 blur-[120px]" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-purple-600/5 blur-[120px]" />
          </div>

          {step === 'draft' ? (
            <SlideEditor
              slides={slides}
              onUpdateSlide={handleUpdateSlide}
              onNextStep={() => setStep('export')}
              onAddSlide={(afterIndex) => {
                const newSlide: Slide = {
                  id: `slide-new-${Date.now()}`,
                  chapterId: slides[afterIndex]?.chapterId || 'all',
                  chapterTitle: slides[afterIndex]?.chapterTitle || '',
                  slideTitle: '새로운 빈 슬라이드',
                  content: ['여기에 내용을 입력하세요.'],
                  bodyText: '',
                  layout: slides[afterIndex]?.layout || 'bullet_list', // 이전 슬라이드 레이아웃/스타일 상속
                  designStyle: slides[afterIndex]?.designStyle || userStyle || 'Professional and Clean',
                  speakerNotes: '',
                  slideRole: 'content',
                };
                setSlides(prev => {
                  const arr = [...prev];
                  arr.splice(afterIndex + 1, 0, newSlide);
                  return arr;
                });
              }}
              onDeleteSlide={(index) => {
                if (slides.length <= 1) {
                  alert("마지막 1장 남은 슬라이드는 삭제할 수 없습니다.");
                  return;
                }
                if (window.confirm("이 슬라이드를 삭제하시겠습니까?")) {
                  setSlides(prev => prev.filter((_, i) => i !== index));
                }
              }}
              styleReferenceImages={styleReferenceImages}
            />
          ) : (
            <div ref={mainContentRef} className="flex-1 overflow-y-auto custom-scrollbar z-10">
              <div className="max-w-5xl mx-auto px-8 py-10 flex flex-col min-h-full">

                {/* Workflow Header */}
                <header className="mb-10 flex-none">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">Workflow Step {String(getWorkflowStep()).padStart(2, '0')}</span>
                    <div className="h-[2px] w-8 bg-blue-500/30 rounded-full" />
                  </div>
                  <h2 className="text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-slate-500 tracking-tighter">
                    {getTitle()}
                  </h2>
                </header>

                {/* Step Content */}
                <div className="flex-1 flex flex-col">

                  {/* ===== STEP 1: Upload + Template ===== */}
                  {step === 'upload' && (
                    <div className="flex-1 flex flex-col items-center justify-center py-6 w-full">
                      <FileUploader onFilesSelected={handleFilesSelected} />

                      {/* 선택된 파일 표시 */}
                      {files.length > 0 && (
                        <div className="mt-6 w-full max-w-2xl p-4 rounded-xl bg-white/5 border border-white/10">
                          <div className="flex items-center gap-2 mb-3">
                            <FileText size={14} className="text-blue-400" />
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">선택된 파일 ({files.length}개)</span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {files.map((f, i) => (
                              <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20">
                                <FileUp size={12} className="text-blue-400" />
                                <span className="text-xs text-blue-300 font-medium">{f.name}</span>
                                <span className="text-[10px] text-slate-500">{(f.size / 1024).toFixed(0)}KB</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 교안 형식 선택 */}
                      {files.length > 0 && (
                        <div className="mt-6 w-full max-w-2xl glass-card p-6">
                          <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400"><BookOpen size={20} /></div>
                            <h3 className="text-lg font-bold text-white">교안 형식</h3>
                          </div>
                          <div className="grid grid-cols-3 gap-3">
                            {([
                              { id: 'lecture' as SlideTemplateId, name: '강의 교안', desc: '강의 제목 → 학습목표 → 본문 → 학습정리' },
                              { id: 'seminar' as SlideTemplateId, name: '세미나/발표', desc: '발표 제목 → 본문 → 핵심 요약 & Q&A' },
                              { id: 'free' as SlideTemplateId, name: '자유형', desc: '표지 → 자유 배치 → 요약' },
                            ]).map((t) => (
                              <button
                                key={t.id}
                                onClick={() => setSlideTemplate(t.id)}
                                className={`p-4 rounded-xl border text-left transition-all ${slideTemplate === t.id
                                  ? 'border-emerald-500/50 bg-emerald-500/10 shadow-[0_0_15px_rgba(16,185,129,0.1)]'
                                  : 'border-white/10 bg-black/20 hover:border-white/20 hover:bg-white/5'
                                  }`}
                              >
                                <p className={`text-sm font-bold mb-1 ${slideTemplate === t.id ? 'text-emerald-400' : 'text-white'}`}>{t.name}</p>
                                <p className="text-[10px] text-slate-400 leading-relaxed">{t.desc}</p>
                              </button>
                            ))}
                          </div>

                          {/* 분석 시작 버튼 */}
                          <div className="flex justify-center mt-6">
                            <button
                              onClick={() => handleStartAnalysis()}
                              className="flex items-center gap-3 px-10 py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-lg shadow-blue-500/20 transition-all active:scale-95 group"
                            >
                              <Sparkles size={20} />
                              분석 시작
                              <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Feature Cards */}
                      <div className="mt-10 grid grid-cols-3 gap-6 w-full max-w-4xl">
                        <FeatureCard icon={<FileText size={24} />} title="자동 초안 생성" desc="원고를 분석하여 전체 슬라이드 초안을 한 번에 생성합니다." color="blue" />
                        <FeatureCard icon={<Sparkles size={24} />} title="AI 학습목표 추출" desc="원고 내용에서 학습목표를 자동으로 추출합니다." color="purple" />
                        <FeatureCard icon={<FileUp size={24} />} title="모든 교안 포맷 지원" desc="PDF, Word, TXT, Markdown 파일을 완벽하게 분석합니다." color="emerald" />
                      </div>
                    </div>
                  )}

                  {/* ===== STEP 2: Analyzing ===== */}
                  {step === 'analyzing' && (
                    <div className="flex-1 flex flex-col items-center justify-center py-20">
                      <div className="relative w-24 h-24 mb-10">
                        <div className="absolute inset-0 rounded-full border-4 border-blue-500/10" />
                        <div className="absolute inset-0 rounded-full border-4 border-t-blue-500 animate-spin" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Sparkles size={32} className="text-blue-500 animate-pulse" />
                        </div>
                      </div>
                      <h3 className="text-2xl font-bold text-white mb-4 text-center">원고를 분석하고 슬라이드 초안을 생성하고 있습니다...</h3>
                      <p className="text-slate-400 text-center max-w-md text-sm leading-relaxed">
                        목차 파악, 강의 제목 추출, 학습목표 생성, 챕터별 슬라이드 콘텐츠 작성이 자동으로 진행됩니다.
                      </p>
                      <AnalyzingProgress />
                    </div>
                  )}

                  {/* ===== STEP 3: Draft Preview ===== */}
                  {step === 'draft_preview' && (
                    <SlideContentPreview
                      slides={slides}
                      onUpdateSlide={handleUpdateSlide}
                      onConfirm={() => setStep('configure_visual')}
                      onBack={() => setStep('upload')}
                      onRegenerate={(count) => handleStartAnalysis(count)}
                    />
                  )}

                  {/* ===== STEP 4: Configure Visual ===== */}
                  {step === 'configure_visual' && (
                    <div className="w-full max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4">
                      {generationError && (
                        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                          <strong>생성 오류:</strong> {generationError}
                          <br />
                          <span className="text-red-400/70 text-xs">설정을 확인한 후 다시 시도해 주세요.</span>
                        </div>
                      )}

                      {/* 슬라이드 수 조정 */}
                      <div className="glass-card p-8">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400"><BookOpen size={20} /></div>
                          <h3 className="text-lg font-bold text-white">슬라이드 구성</h3>
                        </div>
                        <div className="flex items-center gap-4 p-4 rounded-xl bg-black/20 border border-white/5">
                          <div className="flex-1">
                            <p className="text-sm font-bold text-white">{overallTitle || '강의 교안'}</p>
                            <p className="text-[10px] text-slate-500 mt-1">총 {slides.length}장의 슬라이드가 이미지로 생성됩니다.</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="px-4 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20 min-w-[60px] text-center">
                              <span className="text-lg font-bold text-blue-400">{slides.length}</span>
                              <span className="text-xs text-blue-400/70 ml-1">장</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-600 mt-3 text-center">
                        슬라이드의 구체적인 추가 및 삭제는 다음 '개별 슬라이드 수정' 단계에서 진행할 수 있습니다.
                      </p>

                      {/* 슬라이드 컨셉 프롬프트 */}
                      <div className="glass-card p-8">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="p-2 rounded-lg bg-violet-500/20 text-violet-400"><Palette size={20} /></div>
                          <h3 className="text-lg font-bold text-white">슬라이드 컨셉</h3>
                        </div>
                        <textarea
                          placeholder="예: '전체적으로 미니멀하면서 파란색 포인트가 들어간 디자인으로 해줘'"
                          className="w-full h-32 bg-black/40 border border-white/10 rounded-xl p-4 text-sm focus:border-violet-500/50 outline-none transition-all resize-none"
                          value={userStyle}
                          onChange={(e) => setUserStyle(e.target.value)}
                        />
                      </div>

                      {/* 참고 슬라이드 이미지 업로드 */}
                      <div className="glass-card p-8">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400"><Image size={20} /></div>
                          <h3 className="text-lg font-bold text-white">참고 슬라이드 이미지 (선택)</h3>
                        </div>
                        <p className="text-xs text-slate-400 mb-4">원하는 슬라이드 디자인의 참고 이미지를 업로드하면 해당 스타일을 분석하여 반영합니다.</p>
                        {styleReferenceImages.length > 0 ? (
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                              {styleReferenceImages.map((img, idx) => (
                                <div key={idx} className="relative group aspect-video">
                                  <img src={img} alt={`스타일 참고 ${idx + 1}`} className="w-full h-full object-cover rounded-lg border border-white/10" />
                                  <button
                                    onClick={() => setStyleReferenceImages(prev => prev.filter((_, i) => i !== idx))}
                                    className="absolute top-2 right-2 w-6 h-6 rounded-lg bg-red-500/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-500 transition-all font-bold text-xs"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ))}
                              {styleReferenceImages.length < 5 && (
                                <label className="flex flex-col items-center justify-center w-full h-full aspect-video border-2 border-dashed border-white/10 rounded-lg cursor-pointer hover:border-amber-500/40 hover:bg-amber-500/5 transition-all relative">
                                  <Plus size={20} className="text-slate-500 mb-1" />
                                  <span className="text-[10px] text-slate-500">추가 업로드</span>
                                  <input
                                    type="file"
                                    accept="image/png,image/jpeg,image/webp"
                                    multiple
                                    className="hidden"
                                    onChange={(e) => {
                                      const files = Array.from(e.target.files || []);
                                      files.forEach(f => {
                                        const reader = new FileReader();
                                        reader.onload = () => {
                                          setStyleReferenceImages(prev => [...prev.slice(0, 4), reader.result as string]); // 최대 5장 제한
                                        };
                                        reader.readAsDataURL(f);
                                      });
                                    }}
                                  />
                                </label>
                              )}
                            </div>
                            <p className="text-[10px] text-amber-400 text-right">최대 5장까지 첨부 가능</p>
                          </div>
                        ) : (
                          <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-white/10 rounded-xl cursor-pointer hover:border-amber-500/40 hover:bg-amber-500/5 transition-all">
                            <Image size={24} className="text-slate-500 mb-2" />
                            <span className="text-xs text-slate-500">클릭하여 여러 장의 참고 이미지를 한 번에 선택(업로드)할 수 있습니다 (최대 5장)</span>
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/webp"
                              multiple
                              className="hidden"
                              onChange={(e) => {
                                const files = Array.from(e.target.files || []);
                                files.forEach(f => {
                                  const reader = new FileReader();
                                  reader.onload = () => setStyleReferenceImages(prev => [...prev.slice(0, 4), reader.result as string]);
                                  reader.readAsDataURL(f);
                                });
                              }}
                            />
                          </label>
                        )}
                      </div>

                      {/* 버튼 */}
                      <div className="flex justify-center gap-4 pt-4 pb-8">
                        <button
                          onClick={() => setStep('draft_preview')}
                          className="flex items-center gap-2 px-8 py-4 rounded-2xl border border-white/10 text-slate-400 font-bold hover:bg-white/5 transition-all"
                        >
                          <ArrowLeft size={18} />
                          초안으로 돌아가기
                        </button>
                        <button
                          onClick={handleStartImageGeneration}
                          className="flex items-center gap-3 px-10 py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-lg shadow-blue-500/20 transition-all active:scale-95 group"
                        >
                          슬라이드 이미지 생성
                          <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ===== STEP 5: Generating ===== */}
                  {step === 'generating' && (
                    <div className="flex-1 flex flex-col items-center justify-center py-20">
                      <h3 className="text-2xl font-bold text-white mb-8 text-center">AI 슬라이드 이미지 생성 파이프라인</h3>
                      <PipelineProgress progress={pipelineProgress} />
                      <p className="text-slate-400 text-center max-w-sm mt-8 text-sm">
                        Gemini AI가 슬라이드 이미지를 직접 생성하고 있습니다. 각 단계가 순차적으로 진행됩니다.
                      </p>
                    </div>
                  )}

                  {/* ===== Later Steps (unchanged) ===== */}
                  {step === 'export' && (
                    <div className="flex-1 flex flex-col items-center justify-center py-20 animate-in fade-in zoom-in-95 duration-500">
                      <div className="w-20 h-20 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-6 shadow-lg shadow-emerald-500/10">
                        <Download size={40} />
                      </div>
                      <h3 className="text-2xl font-bold text-white mb-2">교안 내보내기</h3>
                      <p className="text-slate-400 text-center max-w-md mb-10 text-sm leading-relaxed">완성된 교안을 PDF로 변환하여 다운로드할 준비가 되었습니다.</p>
                      <div className="flex gap-4">
                        <button
                          onClick={() => setStep('draft')}
                          className="flex items-center gap-2 px-8 py-4 rounded-2xl border border-white/10 text-slate-400 font-bold hover:bg-white/5 transition-all"
                        >
                          <ArrowLeft size={18} />
                          이전 단계로 돌아가기
                        </button>
                        <button
                          onClick={async () => {
                            if (slides.length === 0 || isDownloading) return;
                            try {
                              // 디렉토리 핸들 얻기 (사용자 폴더 선택창 호출)
                              let dirHandle;
                              try {
                                dirHandle = await (window as any).showDirectoryPicker({
                                  mode: 'readwrite'
                                });
                              } catch (err: any) {
                                if (err.name === 'AbortError') return; // 사용자가 취소한 경우
                                throw err;
                              }

                              setIsDownloading(true);
                              // pptxgenjs 동적 임포트 (클라이언트 전용)
                              const PptxGenJS = (await import('pptxgenjs')).default;

                              const doc = new jsPDF({
                                orientation: 'landscape',
                                unit: 'px',
                                format: [1280, 720]
                              });

                              const pptx = new PptxGenJS();
                              pptx.layout = 'LAYOUT_16x9'; // 16:9 비율 설정 (가로 약 10인치 x 세로 약 5.625인치)

                              let addedFirst = false;
                              for (let i = 0; i < slides.length; i++) {
                                const slide = slides[i];
                                // AI 엔진이 직접 생성한 원본(generatedImageBase64)이 없으면, UI 캡처본(finalCapturedBase64)으로 대체
                                const base64Data = slide.generatedImageBase64 || slide.finalCapturedBase64;
                                if (base64Data) {
                                  // 1. PDF 데이터 추가
                                  if (addedFirst) {
                                    doc.addPage([1280, 720], 'landscape');
                                  }
                                  doc.addImage(base64Data, 'PNG', 0, 0, 1280, 720);

                                  // 2. PPTX 데이터 추가
                                  const pptxDataUrl = base64Data.startsWith('data:') ? base64Data.split('base64,')[1] : base64Data;
                                  const slidePptx = pptx.addSlide();
                                  slidePptx.background = { data: pptxDataUrl };

                                  addedFirst = true;

                                  // 브라우저 "응답 없음" 멈춤 방지를 위해 이벤트 루프 양보
                                  await new Promise(r => setTimeout(r, 20));
                                }
                              }

                              if (addedFirst) {
                                // PDF 데이터를 Blob으로 추출
                                const pdfBlob = doc.output('blob');

                                // PPTX 데이터를 Blob으로 추출
                                const pptxBlob = (await pptx.write({ outputType: 'blob' })) as Blob;

                                // 폴더 하위에 강의 제목으로 새 폴더 생성
                                const folderName = 'Lecture_Slide_' + (overallTitle || '무제').replace(/[<>:"/\\|?*]+/g, '_').trim();
                                const folderHandle = await dirHandle.getDirectoryHandle(folderName, { create: true });

                                // 1. PDF 저장
                                const pdfFileHandle = await folderHandle.getFileHandle(`${folderName}.pdf`, { create: true });
                                const pdfWritable = await pdfFileHandle.createWritable();
                                await pdfWritable.write(pdfBlob);
                                await pdfWritable.close();

                                // 2. PPTX 저장
                                const pptxFileHandle = await folderHandle.getFileHandle(`${folderName}.pptx`, { create: true });
                                const pptxWritable = await pptxFileHandle.createWritable();
                                await pptxWritable.write(pptxBlob);
                                await pptxWritable.close();

                                alert(`성공적으로 저장되었습니다!\n저장 위치: 선택하신 폴더의 [${folderName}] 안`);
                              } else {
                                alert('생성된 슬라이드 이미지가 없습니다.');
                              }
                            } catch (e: any) {
                              console.error(e);
                              if (e.name === 'NotAllowedError') {
                                alert('폴더 접근 권한이 거부되었습니다.');
                              } else if (e.name !== 'AbortError') {
                                alert('PDF 생성 및 저장 중 오류가 발생했습니다.');
                              }
                            } finally {
                              setIsDownloading(false);
                            }
                          }}
                          disabled={isDownloading}
                          className="px-10 py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-lg shadow-emerald-500/20 transition-all active:scale-95 disabled:opacity-50"
                        >
                          {isDownloading ? 'PDF 생성 중...' : 'PDF 다운로드 (16:9)'}
                        </button>
                        <button onClick={() => setStep('publish')} className="px-10 py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-lg shadow-blue-500/20 transition-all active:scale-95 group">
                          최종 완료 <ArrowRight size={20} className="inline ml-2 group-hover:translate-x-1 transition-transform" />
                        </button>
                      </div>
                    </div>
                  )}

                  {step === 'publish' && (
                    <div className="flex-1 flex flex-col items-center justify-center py-20 animate-in fade-in zoom-in-95 duration-500">
                      <div className="w-20 h-20 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center mb-6 shadow-lg shadow-indigo-500/10">
                        <CheckCircle2 size={40} />
                      </div>
                      <h3 className="text-2xl font-bold text-white mb-2">제작 완료 및 회고</h3>
                      <p className="text-slate-400 text-center max-w-md mb-10 text-sm leading-relaxed">축하합니다! 성공적으로 교안 작성을 마쳤습니다.</p>
                      <button onClick={() => {
                        setStep('upload');
                        setFiles([]);
                        setSlides([]);
                        setOverallTitle('');
                      }} className="px-10 py-4 rounded-2xl border border-white/10 text-white font-bold hover:bg-white/5 transition-all active:scale-95">
                        새로운 교안 만들기
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function FeatureCard({ icon, title, desc, color }: { icon: React.ReactNode, title: string, desc: string, color: 'blue' | 'purple' | 'emerald' }) {
  const colors = { blue: "bg-blue-500/20 text-blue-400", purple: "bg-purple-500/20 text-purple-400", emerald: "bg-emerald-500/20 text-emerald-400" };
  return (
    <div className="p-6 rounded-2xl glass-card border-white/5 hover:border-white/10 transition-all hover:-translate-y-1">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${colors[color]}`}>{icon}</div>
      <h3 className="font-bold text-lg mb-2 text-white">{title}</h3>
      <p className="text-sm text-slate-400 leading-relaxed">{desc}</p>
    </div>
  );
}
