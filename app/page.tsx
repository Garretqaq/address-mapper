/**
 * 地址映射主页面
 * @author sgz
 * @since 2025-11-28
 */

'use client';

import { useState, useMemo } from 'react';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2, FileDown, ArrowLeft } from 'lucide-react';
import type { AddressMatchResult } from '@/lib/types';
import { ResultsTable } from '@/components/results-table';

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [results, setResults] = useState<AddressMatchResult[]>([]);
  // 保存原始上传的局方地址数据（用于构建下拉选项，包含所有未匹配的数据）
  const [originalOperInputs, setOriginalOperInputs] = useState<Array<{
    省份名称: string;
    省份编码: string;
    地市名称: string;
    地市编码: string;
    区县名称: string;
    区县编码: string;
  }>>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string>('');
  
  // 页面状态：'upload' | 'results'
  const [currentPage, setCurrentPage] = useState<'upload' | 'results'>('upload');

  /**
   * 处理文件选择
   */
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError('');
      setResults([]);
      setOriginalOperInputs([]);
      setCurrentPage('upload'); // 重置到上传页面
    }
  };

  /**
   * 上传并处理文件
   */
  const handleUpload = async () => {
    if (!file) {
      setError('请先选择文件');
      return;
    }

    setIsProcessing(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '上传失败');
      }

      if (data.success && data.data) {
        // 处理新的数据结构（包含 results 和 originalInputs）
        const resultsData = Array.isArray(data.data) 
          ? data.data 
          : data.data.results || [];
        const originalInputs = Array.isArray(data.data)
          ? []
          : data.data.originalInputs || [];
        
        setResults(resultsData);
        // 保存原始上传的局方地址数据
        setOriginalOperInputs(JSON.parse(JSON.stringify(originalInputs)));
        // 转换成功后切换到结果页面
        setCurrentPage('results');
      } else {
        throw new Error('处理结果格式错误');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '处理失败');
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * 下载模板文件
   */
  const handleDownloadTemplate = async () => {
    try {
      const response = await fetch('/api/template');
      if (!response.ok) {
        throw new Error('下载模板失败');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'address-template.xlsx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError(err instanceof Error ? err.message : '下载模板失败');
    }
  };

  /**
   * 导出结果为 Excel（仅用于导出全部，其他导出类型在 ResultsTable 组件内部处理）
   */
  const handleExport = async (exportType: 'all' | 'filtered' | 'selected') => {
    // 导出全部数据（其他类型由 ResultsTable 组件处理）
    if (exportType !== 'all') {
      return;
    }

    if (results.length === 0) {
      setError('没有可导出的数据');
      return;
    }

    try {
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ results }),
      });

      if (!response.ok) {
        throw new Error('导出失败');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `address-mapping-result-全部-${Date.now()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError(err instanceof Error ? err.message : '导出失败');
    }
  };

  /**
   * 将后端返回的 confidence 转换为前端显示的状态
   */
  const normalizeConfidence = (confidence: string): string => {
    if (confidence === 'high' || confidence === 'medium') {
      return 'high';
    }
    if (confidence === 'low') {
      return 'low';
    }
    return 'none';
  };

  // 如果当前在结果页面，显示结果表格
  if (currentPage === 'results' && results.length > 0) {
    return (
      <main className="h-screen flex flex-col bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="flex-shrink-0 p-4 bg-white border-b border-gray-200">
          <div className="max-w-full mx-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setCurrentPage('upload')}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  返回导入
                </button>
                <h1 className="text-xl font-bold text-gray-900">地址映射转换结果</h1>
              </div>
            </div>
          </div>
        </div>

        {/* 结果表格区域 - 占据剩余空间，可滚动 */}
        <div className="flex-1 overflow-hidden p-4">
          <div className="h-full max-w-full mx-auto">
            <ResultsTable
              results={results}
              originalOperInputs={originalOperInputs}
              onResultsChange={setResults}
              onExport={handleExport}
            />
          </div>
        </div>
      </main>
    );
  }

  // 导入页面
  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 md:p-6 lg:p-8">
        <div className="max-w-4xl mx-auto">
        {/* 标题区域 */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">地址映射转换工具</h1>
          <p className="text-gray-600">以骏伯地址库为主，匹配局方地址（显示所有骏伯地址条目）</p>
        </div>

        {/* 主要操作区域 */}
          <div className="bg-white rounded-lg shadow-xl p-4 md:p-6 lg:p-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
            {/* 文件上传区域 */}
            <div className="flex-1 w-full">
              <label
                htmlFor="file-upload"
                className="flex items-center justify-center w-full h-32 px-4 transition bg-white border-2 border-gray-300 border-dashed rounded-lg appearance-none cursor-pointer hover:border-gray-400 focus:outline-none"
              >
                <div className="flex flex-col items-center space-y-2">
                  <Upload className="w-8 h-8 text-gray-400" />
                  <span className="font-medium text-gray-600">
                    {file ? file.name : '点击选择 Excel 文件'}
                  </span>
                  <span className="text-sm text-gray-500">支持 .xlsx, .xls 格式</span>
                </div>
                <input
                  id="file-upload"
                  type="file"
                  className="hidden"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  disabled={isProcessing}
                />
              </label>
            </div>

            {/* 操作按钮 */}
            <div className="flex flex-col gap-3 w-full md:w-auto">
              <button
                onClick={handleDownloadTemplate}
                className="flex items-center justify-center gap-2 px-6 py-3 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                disabled={isProcessing}
              >
                <FileDown className="w-4 h-4" />
                下载模板
              </button>

              <button
                onClick={handleUpload}
                disabled={!file || isProcessing}
                className="flex items-center justify-center gap-2 px-6 py-3 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    处理中...
                  </>
                ) : (
                  <>
                    <FileSpreadsheet className="w-4 h-4" />
                    开始转换
                  </>
                )}
              </button>
            </div>
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="flex items-center gap-2 p-4 mb-4 text-red-700 bg-red-100 rounded-lg">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* 成功提示 */}
          {results.length > 0 && !error && (
            <div className="flex items-center gap-2 p-4 text-green-700 bg-green-100 rounded-lg">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
              <span className="font-medium">成功处理 {results.length} 条骏伯地址数据，已自动跳转到结果页面</span>
          </div>
            )}
          </div>
        </div>
      </main>
  );
}
