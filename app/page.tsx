/**
 * 地址映射主页面
 * @author sgz
 * @since 2025-11-28
 */

'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { Upload, FileSpreadsheet, Download, AlertCircle, CheckCircle2, Loader2, FileDown, ChevronLeft, ChevronRight, Filter, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Input } from '@/components/ui/input';
import type { AddressMatchResult } from '@/lib/types';

const ITEMS_PER_PAGE = 50; // 每页显示条数

// 局方地址数据结构
interface OperAddressData {
  provinces: Map<string, { code: string; name: string }>;
  cities: Map<string, { code: string; name: string; provinceCode: string; provinceName: string }>;
  districts: Map<string, { code: string; name: string; cityCode: string; cityName: string; provinceCode: string; provinceName: string }>;
}

// 三级联动数据结构
interface OperAddressHierarchy {
  [provinceName: string]: {
    code: string;
    cities: {
      [cityName: string]: {
        code: string;
        districts: {
          [districtName: string]: string; // district code
        };
      };
    };
  };
}

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
  
  // 筛选状态
  const [filterConfidence, setFilterConfidence] = useState<string>('all');
  const [filterProvince, setFilterProvince] = useState<string>('all');
  const [filterCity, setFilterCity] = useState<string>('all');
  
  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  
  // 记录修改过的行索引
  const [modifiedRows, setModifiedRows] = useState<Set<number>>(new Set());

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
      setModifiedRows(new Set()); // 清空修改记录
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

      // 优先使用 Node Function（支持更长的执行时间，避免 30 秒超时）
      // 在本地开发时，默认使用 /api/upload（Next.js API Route）
      // 部署到 EdgeOne 后，会自动使用 /upload（Node Function）
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 分钟超时
      
      // 检测是否为本地开发环境
      const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      
      let response: Response;
      let apiUrl = '/api/upload'; // 默认使用 API route
      
      // 如果不是本地开发，尝试使用 Node Function
      if (!isLocalDev) {
        try {
          response = await fetch('/upload', {
            method: 'POST',
            body: formData,
            signal: controller.signal,
          });
          
          // 如果 Node Function 返回 404，回退到 API route
          if (response.status === 404) {
            console.log('Node Function 不可用，使用 API route...');
            apiUrl = '/api/upload';
            response = await fetch(apiUrl, {
              method: 'POST',
              body: formData,
              signal: controller.signal,
            });
          }
        } catch (err) {
          // 如果 Node Function 失败，使用 API route
          if (err instanceof Error && err.name !== 'AbortError') {
            console.log('Node Function 失败，使用 API route...');
            apiUrl = '/api/upload';
            response = await fetch(apiUrl, {
              method: 'POST',
              body: formData,
              signal: controller.signal,
            });
          } else {
            throw err;
          }
        }
      } else {
        // 本地开发直接使用 API route
        response = await fetch(apiUrl, {
          method: 'POST',
          body: formData,
          signal: controller.signal,
        });
      }
      
      clearTimeout(timeoutId);

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
        setModifiedRows(new Set()); // 清空修改记录
      } else {
        throw new Error('处理结果格式错误');
      }
    } catch (err) {
      // 如果是超时或网络错误，尝试使用原 API route 作为回退
      if (err instanceof Error && (err.name === 'AbortError' || err.message.includes('fetch'))) {
        try {
          console.log('Node Function 超时或失败，尝试使用原 API route...');
          const formData = new FormData();
          formData.append('file', file);
          
          const fallbackResponse = await fetch('/api/upload', {
            method: 'POST',
            body: formData,
          });
          
          const fallbackData = await fallbackResponse.json();
          
          if (fallbackResponse.ok && fallbackData.success && fallbackData.data) {
            const resultsData = Array.isArray(fallbackData.data) 
              ? fallbackData.data 
              : fallbackData.data.results || [];
            const originalInputs = Array.isArray(fallbackData.data)
              ? []
              : fallbackData.data.originalInputs || [];
            
            setResults(resultsData);
            setOriginalOperInputs(JSON.parse(JSON.stringify(originalInputs)));
            setModifiedRows(new Set());
            return; // 成功，直接返回
          }
        } catch (fallbackErr) {
          setError('处理超时，请尝试上传较小的文件或联系管理员');
          console.error('回退 API 也失败:', fallbackErr);
        }
      } else {
        setError(err instanceof Error ? err.message : '处理失败');
      }
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

    // 如果有修改，给用户提示
    if (modifiedRows.size > 0) {
      const confirmed = window.confirm(
        `您已修改了 ${modifiedRows.size} 条记录，这些修改将包含在导出的文件中。是否继续导出？`
      );
      if (!confirmed) {
        return;
      }
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
   * 构建局方地址三级联动数据结构（从原始导入数据提取）
   */
  const operAddressData = useMemo((): OperAddressData => {
    const provinces = new Map<string, { code: string; name: string }>();
    const cities = new Map<string, { code: string; name: string; provinceCode: string; provinceName: string }>();
    const districts = new Map<string, { code: string; name: string; cityCode: string; cityName: string; provinceCode: string; provinceName: string }>();

    results.forEach(result => {
      const { input } = result;
      
      // 收集省份数据 - 只要有省份名称或编码就收集
      if (input.省份名称 || input.省份编码) {
        const code = input.省份编码 || '';
        const name = input.省份名称 || '';
        const key = `${code}-${name}`;
        if (!provinces.has(key)) {
          provinces.set(key, { code, name });
        }
      }
      
      // 收集城市数据 - 只要有城市名称或编码就收集
      if (input.地市名称 || input.地市编码) {
        const code = input.地市编码 || '';
        const name = input.地市名称 || '';
        const provinceCode = input.省份编码 || '';
        const provinceName = input.省份名称 || '';
        const key = `${code}-${name}`;
        if (!cities.has(key)) {
          cities.set(key, { 
            code, 
            name,
            provinceCode,
            provinceName
          });
        }
      }
      
      // 收集区县数据 - 只要有区县名称或编码就收集
      if (input.区县名称 || input.区县编码) {
        const code = input.区县编码 || '';
        const name = input.区县名称 || '';
        const cityCode = input.地市编码 || '';
        const cityName = input.地市名称 || '';
        const provinceCode = input.省份编码 || '';
        const provinceName = input.省份名称 || '';
        const key = `${code}-${name}`;
        if (!districts.has(key)) {
          districts.set(key, { 
            code, 
            name,
            cityCode,
            cityName,
            provinceCode,
            provinceName
          });
        }
      }
    });

    return { provinces, cities, districts };
  }, [results]);

  /**
   * 构建局方地址三级联动层级结构（用于下拉选择）
   * 从原始上传的局方地址数据构建，确保所有未匹配的数据也能在下拉框中显示
   * 同时包含当前所有已选择的值（即使不在原始数据中）
   */
  const operAddressHierarchy = useMemo((): OperAddressHierarchy => {
    const hierarchy: OperAddressHierarchy = {};

    // 首先从原始上传的局方地址数据构建（包含所有未匹配的数据）
    originalOperInputs.forEach(input => {
      const provinceName = input.省份名称 || '';
      const provinceCode = input.省份编码 || '';
      const cityName = input.地市名称 || '';
      const cityCode = input.地市编码 || '';
      const districtName = input.区县名称 || '';
      const districtCode = input.区县编码 || '';

      if (provinceName) {
        if (!hierarchy[provinceName]) {
          hierarchy[provinceName] = {
            code: provinceCode,
            cities: {},
          };
        }

        if (cityName) {
          if (!hierarchy[provinceName].cities[cityName]) {
            hierarchy[provinceName].cities[cityName] = {
              code: cityCode,
              districts: {},
            };
          }

          if (districtName) {
            hierarchy[provinceName].cities[cityName].districts[districtName] = districtCode;
          }
        }
      }
    });

    // 然后添加当前所有已选择的值（确保用户修改后的值也能在下拉列表中显示）
    results.forEach(result => {
      const provinceName = result.output.oper_province_name || '';
      const cityName = result.output.oper_city_name || '';
      const districtName = result.output.oper_district_name || '';
      const provinceCode = result.input.省份编码 || '';
      const cityCode = result.input.地市编码 || '';
      const districtCode = result.input.区县编码 || '';

      if (provinceName) {
        if (!hierarchy[provinceName]) {
          hierarchy[provinceName] = {
            code: provinceCode,
            cities: {},
          };
        }

        if (cityName) {
          if (!hierarchy[provinceName].cities[cityName]) {
            hierarchy[provinceName].cities[cityName] = {
              code: cityCode,
              districts: {},
            };
          }

          if (districtName) {
            hierarchy[provinceName].cities[cityName].districts[districtName] = districtCode;
          }
        }
      }
    });

    return hierarchy;
  }, [originalOperInputs, results]);

  /**
   * 获取所有唯一的局方省份列表
   */
  const operProvinceList = useMemo(() => {
    return Object.keys(operAddressHierarchy).sort();
  }, [operAddressHierarchy]);

  /**
   * 缓存城市列表（按省份分组）
   */
  const citiesByProvinceCache = useMemo(() => {
    const cache = new Map<string, string[]>();
    Object.keys(operAddressHierarchy).forEach(provinceName => {
      const cities = Object.keys(operAddressHierarchy[provinceName].cities).sort();
      cache.set(provinceName, cities);
    });
    return cache;
  }, [operAddressHierarchy]);

  /**
   * 缓存区县列表（按省份+城市分组）
   */
  const districtsByCityCache = useMemo(() => {
    const cache = new Map<string, string[]>();
    Object.keys(operAddressHierarchy).forEach(provinceName => {
      Object.keys(operAddressHierarchy[provinceName].cities).forEach(cityName => {
        const key = `${provinceName}-${cityName}`;
        const districts = Object.keys(operAddressHierarchy[provinceName].cities[cityName].districts).sort();
        cache.set(key, districts);
      });
    });
    return cache;
  }, [operAddressHierarchy]);

  /**
   * 根据省份获取城市列表（使用缓存）
   */
  const getOperCitiesByProvince = (provinceName: string): string[] => {
    return citiesByProvinceCache.get(provinceName) || [];
  };

  /**
   * 根据省份和城市获取区县列表（使用缓存）
   */
  const getOperDistrictsByCity = (provinceName: string, cityName: string): string[] => {
    const key = `${provinceName}-${cityName}`;
    return districtsByCityCache.get(key) || [];
  };

  /**
   * 缓存地址编码（优化性能）
   */
  const provinceCodeCache = useMemo(() => {
    const cache = new Map<string, string>();
    Object.keys(operAddressHierarchy).forEach(provinceName => {
      cache.set(provinceName, operAddressHierarchy[provinceName].code || '');
    });
    return cache;
  }, [operAddressHierarchy]);

  const cityCodeCache = useMemo(() => {
    const cache = new Map<string, string>();
    Object.keys(operAddressHierarchy).forEach(provinceName => {
      Object.keys(operAddressHierarchy[provinceName].cities).forEach(cityName => {
        const key = `${provinceName}-${cityName}`;
        cache.set(key, operAddressHierarchy[provinceName].cities[cityName].code || '');
      });
    });
    return cache;
  }, [operAddressHierarchy]);

  const districtCodeCache = useMemo(() => {
    const cache = new Map<string, string>();
    Object.keys(operAddressHierarchy).forEach(provinceName => {
      Object.keys(operAddressHierarchy[provinceName].cities).forEach(cityName => {
        Object.keys(operAddressHierarchy[provinceName].cities[cityName].districts).forEach(districtName => {
          const key = `${provinceName}-${cityName}-${districtName}`;
          cache.set(key, operAddressHierarchy[provinceName].cities[cityName].districts[districtName] || '');
        });
      });
    });
    return cache;
  }, [operAddressHierarchy]);

  /**
   * 获取地址编码（使用缓存优化）
   */
  const getOperProvinceCode = useCallback((provinceName: string): string => {
    return provinceCodeCache.get(provinceName) || '';
  }, [provinceCodeCache]);

  const getOperCityCode = useCallback((provinceName: string, cityName: string): string => {
    const key = `${provinceName}-${cityName}`;
    return cityCodeCache.get(key) || '';
  }, [cityCodeCache]);

  const getOperDistrictCode = useCallback((provinceName: string, cityName: string, districtName: string): string => {
    const key = `${provinceName}-${cityName}-${districtName}`;
    return districtCodeCache.get(key) || '';
  }, [districtCodeCache]);

  /**
   * 获取所有唯一的省份列表（骏伯）
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
   * 获取所有唯一的城市列表（根据选中的省份筛选）（骏伯）
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
   * 重置所有筛选
   */
  const handleResetFilters = () => {
    setFilterConfidence('all');
    setFilterProvince('all');
    setFilterCity('all');
    setCurrentPage(1);
  };

  /**
   * 检查是否有筛选条件
   */
  const hasActiveFilters = filterConfidence !== 'all' || filterProvince !== 'all' || filterCity !== 'all';

  /**
   * 处理局方地址修改（使用 useCallback 优化）
   */
  const handleAddressChange = useCallback((
    rowIndex: number,
    type: 'province' | 'city' | 'district',
    value: string
  ) => {
    setResults(prevResults => {
      const newResults = [...prevResults];
      const result = newResults[rowIndex];
      
      if (!result) return prevResults;

      const newOutput = { ...result.output };

      if (type === 'province') {
        // 修改省份
        newOutput.oper_province_name = value;
        const provinceCode = getOperProvinceCode(value);
        newOutput.oper_province_code = provinceCode; // 更新省份编码
        
        // 清空城市和区县
        newOutput.oper_city_name = '';
        newOutput.oper_city_code = '';
        newOutput.oper_district_name = '';
        newOutput.oper_district_code = '';
        
        // 同时更新 input 数据
        const newInput = { ...result.input };
        newInput.省份名称 = value;
        newInput.省份编码 = provinceCode;
        newInput.地市名称 = '';
        newInput.地市编码 = '';
        newInput.区县名称 = '';
        newInput.区县编码 = '';
        
        newResults[rowIndex] = {
          ...result,
          input: newInput,
          output: newOutput,
        };
      } else if (type === 'city') {
        // 修改城市
        const provinceName = result.output.oper_province_name || '';
        newOutput.oper_city_name = value;
        const cityCode = getOperCityCode(provinceName, value);
        newOutput.oper_city_code = cityCode; // 更新城市编码
        
        // 清空区县
        newOutput.oper_district_name = '';
        newOutput.oper_district_code = '';
        
        // 同时更新 input 数据
        const newInput = { ...result.input };
        newInput.地市名称 = value;
        newInput.地市编码 = cityCode;
        newInput.区县名称 = '';
        newInput.区县编码 = '';
        
        newResults[rowIndex] = {
          ...result,
          input: newInput,
          output: newOutput,
        };
      } else if (type === 'district') {
        // 修改区县
        const provinceName = result.output.oper_province_name || '';
        const cityName = result.output.oper_city_name || '';
        newOutput.oper_district_name = value;
        const districtCode = getOperDistrictCode(provinceName, cityName, value);
        newOutput.oper_district_code = districtCode; // 更新区县编码
        
        // 同时更新 input 数据
        const newInput = { ...result.input };
        newInput.区县名称 = value;
        newInput.区县编码 = districtCode;
        
        newResults[rowIndex] = {
          ...result,
          input: newInput,
          output: newOutput,
        };
      }

      // 记录修改的行
      setModifiedRows(prev => new Set(prev).add(rowIndex));

      return newResults;
    });
  }, [getOperProvinceCode, getOperCityCode, getOperDistrictCode]);


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

  /**
   * 匹配状态映射（中文 -> 英文）
   */
  const confidenceMap: Record<string, string> = {
    '精确匹配': 'high',
    '模糊匹配': 'medium',
    '低置信度': 'low',
    '未匹配': 'none',
  };

  /**
   * 匹配状态反向映射（英文 -> 中文）
   */
  const confidenceReverseMap: Record<string, string> = {
    'high': '精确匹配',
    'medium': '模糊匹配',
    'low': '低置信度',
    'none': '未匹配',
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 md:p-6 lg:p-8">
      <div className="max-w-[80%] mx-auto">
        {/* 标题区域 */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">地址映射转换工具</h1>
          <p className="text-gray-600">以骏伯地址库为主，匹配局方地址（显示所有骏伯地址条目）</p>
        </div>

        {/* 主要操作区域 */}
        <div className="bg-white rounded-lg shadow-xl p-4 md:p-6 lg:p-8 mb-6 md:mb-8">
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
          <div className="bg-white rounded-lg shadow-xl p-4 md:p-6 lg:p-8">
            <div className="mb-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-900 mb-4 md:mb-0">
                  转换结果（显示所有骏伯地址库条目）
                </h2>
              </div>
              
              {/* 筛选控件区域 */}
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-4 md:p-5 border border-gray-200 shadow-sm">
                <div className="flex flex-col gap-4">
                  {/* 筛选标题栏 */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Filter className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-semibold text-gray-800">筛选条件</span>
                      {hasActiveFilters && (
                        <span className="px-2.5 py-1 text-xs font-medium bg-blue-500 text-white rounded-full shadow-sm">
                          已筛选
                        </span>
                      )}
                    </div>
                    {hasActiveFilters && (
                      <button
                        onClick={handleResetFilters}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-white rounded-md transition-all border border-gray-300 hover:border-gray-400 hover:shadow-sm"
                      >
                        <X className="w-3.5 h-3.5" />
                        清空筛选
                      </button>
                    )}
                  </div>

                  {/* 筛选控件 */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">匹配状态</label>
                      <SearchableSelect
                        value={filterConfidence === 'all' ? '' : (confidenceReverseMap[filterConfidence] || '')}
                        onValueChange={(value) => {
                          const mappedValue = value ? confidenceMap[value] || value : 'all';
                          handleFilterChange('confidence', mappedValue);
                        }}
                        options={['精确匹配', '模糊匹配', '低置信度', '未匹配']}
                        placeholder="全部状态"
                        className="w-full"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Junbo 省份</label>
                      <SearchableSelect
                        value={filterProvince === 'all' ? '' : filterProvince}
                        onValueChange={(value) => handleFilterChange('province', value || 'all')}
                        options={uniqueProvinces}
                        placeholder="全部省份"
                        className="w-full"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Junbo 地市</label>
                      <SearchableSelect
                        value={filterCity === 'all' ? '' : filterCity}
                        onValueChange={(value) => handleFilterChange('city', value || 'all')}
                        options={uniqueCities}
                        placeholder="全部地市"
                        disabled={filterProvince === 'all'}
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 统计信息 */}
            <div className="mb-4 text-sm text-gray-600">
              共 {filteredResults.length} 条数据（筛选后），共 {results.length} 条（全部）
            </div>

            {/* 表格 */}
            <div className="overflow-x-auto mb-6 -mx-2 md:-mx-4">
              <div className="inline-block min-w-full align-middle px-2 md:px-4">
                <table className="w-full text-sm text-left text-gray-700">
                  <thead className="text-xs text-gray-700 uppercase bg-gray-100">
                    <tr>
                      <th className="px-3 py-3 w-16">序号</th>
                      <th className="px-3 py-3 min-w-[120px]">Junbo 省份</th>
                      <th className="px-3 py-3 min-w-[140px]">局方省份</th>
                      <th className="px-3 py-3 min-w-[120px]">Junbo 地市</th>
                      <th className="px-3 py-3 min-w-[140px]">局方地市</th>
                      <th className="px-3 py-3 min-w-[120px]">Junbo 区县</th>
                      <th className="px-3 py-3 min-w-[140px]">局方区县</th>
                      <th className="px-3 py-3 w-24">匹配状态</th>
                    </tr>
                  </thead>
                <tbody>
                  {paginatedResults.map((result, index) => {
                    const globalIndex = (currentPage - 1) * ITEMS_PER_PAGE + index + 1;
                    // 优化：直接使用索引计算，避免 findIndex 的性能问题
                    const filteredIndex = (currentPage - 1) * ITEMS_PER_PAGE + index;
                    // 从 filteredResults 中找到对应的 result，然后在 results 中查找
                    const actualRowIndex = filteredIndex < filteredResults.length 
                      ? results.findIndex(r => r === filteredResults[filteredIndex])
                      : -1;
                    const isModified = actualRowIndex >= 0 && modifiedRows.has(actualRowIndex);
                    
                    // 获取当前行的局方地址值
                    const currentProvince = result.output.oper_province_name || '';
                    const currentCity = result.output.oper_city_name || '';
                    const currentDistrict = result.output.oper_district_name || '';
                    
                    // 获取可用的选项列表（使用缓存的函数）
                    const availableCities = currentProvince ? getOperCitiesByProvince(currentProvince) : [];
                    const availableDistricts = currentProvince && currentCity ? getOperDistrictsByCity(currentProvince, currentCity) : [];

                    return (
                      <tr 
                        key={`${currentPage}-${index}`} 
                        className={`border-b hover:bg-gray-50 ${isModified ? 'bg-yellow-50' : ''}`}
                      >
                        <td className="px-3 py-3">{globalIndex}</td>
                        <td className="px-3 py-3">{result.output.junbo_province_name || '-'}</td>
                        
                        {/* 局方省份 - 可编辑下拉框 */}
                        <td className="px-3 py-3">
                          <SearchableSelect
                            value={currentProvince}
                            onValueChange={(value) => handleAddressChange(actualRowIndex, 'province', value)}
                            options={operProvinceList}
                            placeholder="选择省份"
                            className="w-full"
                          />
                        </td>
                        
                        <td className="px-3 py-3">{result.output.junbo_city_name || '-'}</td>
                        
                        {/* 局方城市 - 可编辑下拉框 */}
                        <td className="px-3 py-3">
                          <SearchableSelect
                            value={currentCity}
                            onValueChange={(value) => handleAddressChange(actualRowIndex, 'city', value)}
                            options={availableCities}
                            placeholder={currentProvince ? "选择城市" : "请先选择省份"}
                            disabled={!currentProvince}
                            className="w-full"
                          />
                        </td>
                        
                        <td className="px-3 py-3">{result.output.junbo_district_name || '-'}</td>
                        
                        {/* 局方区县 - 可编辑下拉框 */}
                        <td className="px-3 py-3">
                          <SearchableSelect
                            value={currentDistrict}
                            onValueChange={(value) => handleAddressChange(actualRowIndex, 'district', value)}
                            options={availableDistricts}
                            placeholder={currentProvince && currentCity ? "选择区县" : "请先选择城市"}
                            disabled={!currentProvince || !currentCity}
                            className="w-full"
                          />
                        </td>
                        
                        <td className="px-3 py-3">{getMatchStatusBadge(result.output.confidence)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
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
