"use client";

import React, { useCallback } from 'react';
import { Upload, FileUp } from 'lucide-react';

interface FileUploaderProps {
    onFilesSelected: (files: File[]) => void;
}

export default function FileUploader({ onFilesSelected }: FileUploaderProps) {
    const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const fileList = e.target.files;
        if (!fileList || fileList.length === 0) return;

        const allowedExtensions = [
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'text/markdown',
            'text/plain',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation'
        ];

        const validFiles: File[] = [];
        for (let i = 0; i < fileList.length; i++) {
            const file = fileList[i];
            const isMD = file.name.endsWith('.md');
            if (allowedExtensions.includes(file.type) || isMD) {
                validFiles.push(file);
            }
        }

        if (validFiles.length === 0) {
            alert('지원하지 않는 파일 형식입니다. (PDF, Word, MD, PPT, TXT 가능)\\n\\n※ 한글(.hwp) 파일은 PDF나 Word(.docx)로 변환 후 업로드해 주세요.');
            return;
        }

        onFilesSelected(validFiles);
    }, [onFilesSelected]);

    return (
        <div className="flex flex-col items-center justify-center px-6">
            <div className="w-full max-w-2xl relative">
                <input
                    type="file"
                    accept=".pdf,.docx,.md,.txt,.pptx"
                    multiple
                    onChange={onFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />

                <div className="w-full aspect-video rounded-[2rem] border-2 border-dashed relative border-slate-700 bg-slate-900/50 hover:border-blue-500 group transition-all duration-500 flex items-center justify-center overflow-hidden">
                    <div className="absolute inset-0 bg-blue-600/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-[2rem]" />

                    <div className="flex flex-col items-center text-center p-12">
                        <div className="w-20 h-20 rounded-full bg-blue-600/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
                            <Upload className="text-blue-500" size={40} />
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-3">파일을 드래그하거나 클릭하여 업로드</h3>
                        <p className="text-slate-400 mb-8 max-w-md italic">
                            PDF, Word, MD 등 다양한 원고를 업로드하면 AI가 분석해 드립니다. 여러 파일을 한번에 선택할 수 있습니다.
                        </p>
                        <div className="px-8 py-4 bg-blue-600 group-hover:bg-blue-500 text-white font-bold rounded-2xl shadow-lg shadow-blue-900/40 transition-all flex items-center gap-3 active:scale-95">
                            <FileUp size={20} />
                            원고 파일 선택
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
