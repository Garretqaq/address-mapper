/**
 * 地址映射主页面
 * @author sgz
 * @since 2025-11-28
 */

'use client';

import { useState, useMemo, useEffect } from 'react';
import { Upload, FileSpreadsheet, Download, AlertCircle, CheckCircle2, Loader2, FileDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { AddressMatchResult } from '@/lib/types';

const ITEMS_PER_PAGE = 50; // 每页显示条数

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [results, setResults] = useState<AddressMatchResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string>('');
  
  // 筛选状态
  const [filterConfidence, setFilterConfidence] = useState<string>('all');
  const [filterProvince, setFilterProvince] = useState<string>('all');
  const [filterCity, setFilterCity] = useState<string>('all');
  
  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);

  /**
   * 处理文件选择
   */
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError('');
      setResults([]);
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
        setResults(data.data);
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
   * 导出结果为 Excel
   */
  const handleExport = async () => {
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
      a.download = `address-mapping-result-${Date.now()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError(err instanceof Error ? err.message : '导出失败');
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
   * 获取所有唯一的省份列表
   */
  const uniqueProvinces = useMemo(() => {
    const provinces = new Set<string>();
    results.forEach(result => {
      if (result.output.junbo_province_name) {
        provinces.add(result.output.junbo_province_name);
      }
    });
    return Array.from(provinces).sort();
  }, [results]);

  /**
   * 获取所有唯一的城市列表（根据选中的省份筛选）
   */
  const uniqueCities = useMemo(() => {
    const cities = new Set<string>();
    results.forEach(result => {
      if (result.output.junbo_city_name) {
        // 如果选择了省份，只显示该省份下的城市
        if (filterProvince === 'all' || result.output.junbo_province_name === filterProvince) {
          cities.add(result.output.junbo_city_name);
        }
      }
    });
    return Array.from(cities).sort();
  }, [results, filterProvince]);

  /**
   * 筛选后的数据
   */
  const filteredResults = useMemo(() => {
    return results.filter(result => {
      // 匹配状态筛选
      if (filterConfidence !== 'all' && result.output.confidence !== filterConfidence) {
        return false;
      }
      
      // 省份筛选
      if (filterProvince !== 'all' && result.output.junbo_province_name !== filterProvince) {
        return false;
      }
      
      // 城市筛选
      if (filterCity !== 'all' && result.output.junbo_city_name !== filterCity) {
        return false;
      }
      
      return true;
    });
  }, [results, filterConfidence, filterProvince, filterCity]);

  /**
   * 分页数据
   */
  const paginatedResults = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return filteredResults.slice(startIndex, endIndex);
  }, [filteredResults, currentPage]);

  /**
   * 总页数
   */
  const totalPages = useMemo(() => {
    return Math.ceil(filteredResults.length / ITEMS_PER_PAGE);
  }, [filteredResults]);

  /**
   * 当省份变化时，检查城市筛选是否有效
   */
  useEffect(() => {
    if (filterCity !== 'all' && filterProvince !== 'all') {
      // 检查选中的城市是否在当前省份下
      const cityExists = uniqueCities.includes(filterCity);
      if (!cityExists) {
        setFilterCity('all');
      }
    }
  }, [filterProvince, uniqueCities, filterCity]);

  /**
   * 处理筛选变化
   */
  const handleFilterChange = (type: 'confidence' | 'province' | 'city', value: string) => {
    if (type === 'confidence') {
      setFilterConfidence(value);
    } else if (type === 'province') {
      setFilterProvince(value);
      setFilterCity('all'); // 重置城市筛选
    } else if (type === 'city') {
      setFilterCity(value);
    }
    setCurrentPage(1); // 重置到第一页
  };

  /**
   * 获取匹配状态徽章
   */
  const getMatchStatusBadge = (confidence: string) => {
    if (confidence === 'high') {
      return <Badge className="bg-green-500">精确匹配</Badge>;
    } else if (confidence === 'medium') {
      return <Badge className="bg-yellow-500">模糊匹配</Badge>;
    } else if (confidence === 'low') {
      return <Badge className="bg-orange-500">低置信度</Badge>;
    } else {
      return <Badge variant="destructive">未匹配</Badge>;
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-7xl mx-auto">
        {/* 标题区域 */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">地址映射转换工具</h1>
          <p className="text-gray-600">以骏伯地址库为主，匹配局方地址（显示所有骏伯地址条目）</p>
        </div>

        {/* 主要操作区域 */}
        <div className="bg-white rounded-lg shadow-xl p-8 mb-8">
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

              {results.length > 0 && (
                <button
                  onClick={handleExport}
                  className="flex items-center justify-center gap-2 px-6 py-3 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  导出结果
                </button>
              )}
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
            <div className="flex items-center gap-2 p-4 mb-4 text-green-700 bg-green-100 rounded-lg">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
              <span>成功处理 {results.length} 条骏伯地址数据（已匹配 {results.filter(r => r.output.confidence !== 'none').length} 条局方地址）</span>
            </div>
          )}
        </div>

        {/* 结果展示区域 */}
        {results.length > 0 && (
          <div className="bg-white rounded-lg shadow-xl p-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4 md:mb-0">
                转换结果（显示所有骏伯地址库条目）
              </h2>
              
              {/* 筛选控件 */}
              <div className="flex flex-wrap gap-3">
                <Select value={filterConfidence} onValueChange={(value) => handleFilterChange('confidence', value)}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="匹配状态" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部状态</SelectItem>
                    <SelectItem value="high">精确匹配</SelectItem>
                    <SelectItem value="medium">模糊匹配</SelectItem>
                    <SelectItem value="low">低置信度</SelectItem>
                    <SelectItem value="none">未匹配</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={filterProvince} onValueChange={(value) => handleFilterChange('province', value)}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Junbo 省份" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部省份</SelectItem>
                    {uniqueProvinces.map(province => (
                      <SelectItem key={province} value={province}>{province}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={filterCity} onValueChange={(value) => handleFilterChange('city', value)}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Junbo 地市" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部地市</SelectItem>
                    {uniqueCities.map(city => (
                      <SelectItem key={city} value={city}>{city}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* 统计信息 */}
            <div className="mb-4 text-sm text-gray-600">
              共 {filteredResults.length} 条数据（筛选后），共 {results.length} 条（全部）
            </div>

            {/* 表格 */}
            <div className="overflow-x-auto mb-6">
              <table className="w-full text-sm text-left text-gray-700">
                <thead className="text-xs text-gray-700 uppercase bg-gray-100">
                  <tr>
                    <th className="px-4 py-3">序号</th>
                    <th className="px-4 py-3">Junbo 省份</th>
                    <th className="px-4 py-3">局方省份</th>
                    <th className="px-4 py-3">Junbo 地市</th>
                    <th className="px-4 py-3">局方地市</th>
                    <th className="px-4 py-3">Junbo 区县</th>
                    <th className="px-4 py-3">局方区县</th>
                    <th className="px-4 py-3">匹配状态</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedResults.map((result, index) => {
                    const globalIndex = (currentPage - 1) * ITEMS_PER_PAGE + index + 1;
                    return (
                      <tr key={`${currentPage}-${index}`} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-3">{globalIndex}</td>
                        <td className="px-4 py-3">{result.output.junbo_province_name || '-'}</td>
                        <td className="px-4 py-3">{result.output.oper_province_name || '-'}</td>
                        <td className="px-4 py-3">{result.output.junbo_city_name || '-'}</td>
                        <td className="px-4 py-3">{result.output.oper_city_name || '-'}</td>
                        <td className="px-4 py-3">{result.output.junbo_district_name || '-'}</td>
                        <td className="px-4 py-3">{result.output.oper_district_name || '-'}</td>
                        <td className="px-4 py-3">{getMatchStatusBadge(result.output.confidence)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* 分页控件 */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  显示第 {((currentPage - 1) * ITEMS_PER_PAGE) + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, filteredResults.length)} 条，共 {filteredResults.length} 条
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    上一页
                  </button>
                  
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum: number;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                            currentPage === pageNum
                              ? 'bg-blue-600 text-white'
                              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>
                  
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    下一页
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        </div>
      </main>
  );
}
