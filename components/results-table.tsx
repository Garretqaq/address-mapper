/**
 * 转换结果展示组件
 * 实现冻结表头，只有表格内容可滚动，紧凑布局
 * @author sgz
 * @since 2025-11-28
 */

'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { Download, AlertCircle, ChevronLeft, ChevronRight, Filter, X, Search, Square, CheckSquare, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Input } from '@/components/ui/input';
import type { AddressMatchResult } from '@/lib/types';

const DEFAULT_ITEMS_PER_PAGE = 20; // 默认每页显示条数
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]; // 可选的每页显示条数

// 局方地址三级联动数据结构
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

interface ResultsTableProps {
  results: AddressMatchResult[];
  originalOperInputs: Array<{
    省份名称: string;
    省份编码: string;
    地市名称: string;
    地市编码: string;
    区县名称: string;
    区县编码: string;
  }>;
  onResultsChange: (results: AddressMatchResult[]) => void;
  onExport?: (exportType: 'all' | 'filtered' | 'selected') => void;
}

export function ResultsTable({
  results,
  originalOperInputs,
  onResultsChange,
  onExport,
}: ResultsTableProps) {
  // 筛选状态
  const [filterConfidence, setFilterConfidence] = useState<string>('all');
  const [filterProvince, setFilterProvince] = useState<string>('all');
  const [filterCity, setFilterCity] = useState<string>('all');
  
  // 搜索状态
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(DEFAULT_ITEMS_PER_PAGE);
  
  // 记录修改过的行索引
  const [modifiedRows, setModifiedRows] = useState<Set<number>>(new Set());
  
  // 批量选择状态
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [isSelectMode, setIsSelectMode] = useState(false);
  
  // 批量修改状态
  const [isBatchEditMode, setIsBatchEditMode] = useState(false);
  const [batchProvince, setBatchProvince] = useState<string>('');
  const [batchCity, setBatchCity] = useState<string>('');
  const [batchDistrict, setBatchDistrict] = useState<string>('');

  /**
   * 构建局方地址三级联动层级结构
   */
  const operAddressHierarchy = useMemo((): OperAddressHierarchy => {
    const hierarchy: OperAddressHierarchy = {};

    // 从原始上传的局方地址数据构建
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

    // 添加当前所有已选择的值
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
   * 根据省份获取城市列表
   */
  const getOperCitiesByProvince = (provinceName: string): string[] => {
    return citiesByProvinceCache.get(provinceName) || [];
  };

  /**
   * 根据省份和城市获取区县列表
   */
  const getOperDistrictsByCity = (provinceName: string, cityName: string): string[] => {
    const key = `${provinceName}-${cityName}`;
    return districtsByCityCache.get(key) || [];
  };

  /**
   * 缓存地址编码
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
   * 获取地址编码
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
        if (filterProvince === 'all' || result.output.junbo_province_name === filterProvince) {
          cities.add(result.output.junbo_city_name);
        }
      }
    });
    return Array.from(cities).sort();
  }, [results, filterProvince]);

  /**
   * 将后端返回的 confidence 转换为前端显示的状态
   */
  const normalizeConfidence = useCallback((confidence: string): string => {
    if (confidence === 'high' || confidence === 'medium') {
      return 'high';
    }
    if (confidence === 'low') {
      return 'low';
    }
    return 'none';
  }, []);

  /**
   * 筛选后的数据
   */
  const filteredResults = useMemo(() => {
    return results.filter(result => {
      // 搜索筛选
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const matchProvince = result.output.junbo_province_name?.toLowerCase().includes(query) ||
                             result.output.oper_province_name?.toLowerCase().includes(query);
        const matchCity = result.output.junbo_city_name?.toLowerCase().includes(query) ||
                         result.output.oper_city_name?.toLowerCase().includes(query);
        const matchDistrict = result.output.junbo_district_name?.toLowerCase().includes(query) ||
                             result.output.oper_district_name?.toLowerCase().includes(query);
        
        if (!matchProvince && !matchCity && !matchDistrict) {
          return false;
        }
      }
      
      // 匹配状态筛选
      if (filterConfidence !== 'all') {
        const normalizedConfidence = normalizeConfidence(result.output.confidence);
        const normalizedFilter = normalizeConfidence(filterConfidence);
        if (normalizedConfidence !== normalizedFilter) {
          return false;
        }
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
  }, [results, searchQuery, filterConfidence, filterProvince, filterCity, normalizeConfidence]);

  /**
   * 分页数据
   */
  const paginatedResults = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredResults.slice(startIndex, endIndex);
  }, [filteredResults, currentPage, itemsPerPage]);

  /**
   * 总页数
   */
  const totalPages = useMemo(() => {
    return Math.ceil(filteredResults.length / itemsPerPage);
  }, [filteredResults, itemsPerPage]);

  /**
   * 处理分页大小变化
   */
  const handlePageSizeChange = useCallback((size: string) => {
    const newSize = parseInt(size, 10);
    setItemsPerPage(newSize);
    // 使用函数式更新，确保使用最新的 filteredResults
    setCurrentPage(prevPage => {
      const newTotalPages = Math.ceil(filteredResults.length / newSize);
      // 如果当前页超出新总页数，跳转到最后一页，否则保持在当前页
      if (prevPage > newTotalPages && newTotalPages > 0) {
        return newTotalPages;
      } else if (newTotalPages === 0) {
        return 1;
      }
      return prevPage;
    });
  }, [filteredResults.length]);

  /**
   * 处理局方地址修改
   */
  const handleAddressChange = useCallback((
    rowIndex: number,
    type: 'province' | 'city' | 'district',
    value: string
  ) => {
    const newResults = [...results];
    const result = newResults[rowIndex];
    
    if (!result) return;

    const newOutput = { ...result.output };

    if (type === 'province') {
      newOutput.oper_province_name = value;
      const provinceCode = getOperProvinceCode(value);
      newOutput.oper_province_code = provinceCode;
      
      newOutput.oper_city_name = '';
      newOutput.oper_city_code = '';
      newOutput.oper_district_name = '';
      newOutput.oper_district_code = '';
      
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
      const provinceName = result.output.oper_province_name || '';
      newOutput.oper_city_name = value;
      const cityCode = getOperCityCode(provinceName, value);
      newOutput.oper_city_code = cityCode;
      
      newOutput.oper_district_name = '';
      newOutput.oper_district_code = '';
      
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
      const provinceName = result.output.oper_province_name || '';
      const cityName = result.output.oper_city_name || '';
      newOutput.oper_district_name = value;
      const districtCode = getOperDistrictCode(provinceName, cityName, value);
      newOutput.oper_district_code = districtCode;
      
      const newInput = { ...result.input };
      newInput.区县名称 = value;
      newInput.区县编码 = districtCode;
      
      newResults[rowIndex] = {
        ...result,
        input: newInput,
        output: newOutput,
      };
    }

    setModifiedRows(prev => new Set(prev).add(rowIndex));
    onResultsChange(newResults);
  }, [results, getOperProvinceCode, getOperCityCode, getOperDistrictCode, onResultsChange]);

  /**
   * 批量选择处理
   */
  const handleSelectRow = (rowIndex: number) => {
    setSelectedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(rowIndex)) {
        newSet.delete(rowIndex);
      } else {
        newSet.add(rowIndex);
      }
      return newSet;
    });
  };

  /**
   * 全选/取消全选当前页
   */
  const handleSelectAll = useCallback(() => {
    if (selectedRows.size === paginatedResults.length) {
      setSelectedRows(new Set());
    } else {
      const newSet = new Set<number>();
      paginatedResults.forEach((result, index) => {
        const filteredIndex = (currentPage - 1) * itemsPerPage + index;
        const actualRowIndex = filteredIndex < filteredResults.length 
          ? results.findIndex(r => r === filteredResults[filteredIndex])
          : -1;
        if (actualRowIndex >= 0) {
          newSet.add(actualRowIndex);
        }
      });
      setSelectedRows(newSet);
    }
  }, [selectedRows.size, paginatedResults, currentPage, filteredResults, results, itemsPerPage]);

  /**
   * 清空选择
   */
  const handleClearSelection = () => {
    setSelectedRows(new Set());
    setIsSelectMode(false);
    setIsBatchEditMode(false);
    setBatchProvince('');
    setBatchCity('');
    setBatchDistrict('');
  };

  /**
   * 批量修改地址
   */
  const handleBatchEdit = useCallback(() => {
    if (selectedRows.size === 0) {
      return;
    }

    if (!batchProvince) {
      return;
    }

    const newResults = [...results];
    const newModifiedRows = new Set(modifiedRows);

    selectedRows.forEach(rowIndex => {
      const result = newResults[rowIndex];
      if (!result) return;

      const newOutput = { ...result.output };
      const newInput = { ...result.input };

      const provinceCode = getOperProvinceCode(batchProvince);
      newOutput.oper_province_name = batchProvince;
      newOutput.oper_province_code = provinceCode;
      newInput.省份名称 = batchProvince;
      newInput.省份编码 = provinceCode;

      if (batchCity) {
        const cityCode = getOperCityCode(batchProvince, batchCity);
        newOutput.oper_city_name = batchCity;
        newOutput.oper_city_code = cityCode;
        newInput.地市名称 = batchCity;
        newInput.地市编码 = cityCode;

        if (batchDistrict) {
          const districtCode = getOperDistrictCode(batchProvince, batchCity, batchDistrict);
          newOutput.oper_district_name = batchDistrict;
          newOutput.oper_district_code = districtCode;
          newInput.区县名称 = batchDistrict;
          newInput.区县编码 = districtCode;
        } else {
          newOutput.oper_district_name = '';
          newOutput.oper_district_code = '';
          newInput.区县名称 = '';
          newInput.区县编码 = '';
        }
      } else {
        newOutput.oper_city_name = '';
        newOutput.oper_city_code = '';
        newOutput.oper_district_name = '';
        newOutput.oper_district_code = '';
        newInput.地市名称 = '';
        newInput.地市编码 = '';
        newInput.区县名称 = '';
        newInput.区县编码 = '';
      }

      newResults[rowIndex] = {
        ...result,
        input: newInput,
        output: newOutput,
      };

      newModifiedRows.add(rowIndex);
    });

    setModifiedRows(newModifiedRows);
    onResultsChange(newResults);

    setIsBatchEditMode(false);
    setBatchProvince('');
    setBatchCity('');
    setBatchDistrict('');
  }, [selectedRows, batchProvince, batchCity, batchDistrict, getOperProvinceCode, getOperCityCode, getOperDistrictCode, modifiedRows, results, onResultsChange]);

  /**
   * 处理筛选变化
   */
  const handleFilterChange = (type: 'confidence' | 'province' | 'city', value: string) => {
    if (type === 'confidence') {
      setFilterConfidence(value);
    } else if (type === 'province') {
      setFilterProvince(value);
      setFilterCity('all');
    } else if (type === 'city') {
      setFilterCity(value);
    }
    setCurrentPage(1);
  };

  /**
   * 处理搜索变化
   */
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  /**
   * 重置所有筛选
   */
  const handleResetFilters = () => {
    setFilterConfidence('all');
    setFilterProvince('all');
    setFilterCity('all');
    setSearchQuery('');
    setCurrentPage(1);
  };

  /**
   * 检查是否有筛选条件
   */
  const hasActiveFilters = filterConfidence !== 'all' || filterProvince !== 'all' || filterCity !== 'all' || searchQuery.trim() !== '';

  /**
   * 导出结果为 Excel
   */
  const handleExport = useCallback(async (exportType: 'all' | 'filtered' | 'selected' = 'all') => {
    let dataToExport: AddressMatchResult[] = [];
    
    if (exportType === 'selected' && selectedRows.size > 0) {
      // 导出选中的数据
      dataToExport = Array.from(selectedRows)
        .map(index => results[index])
        .filter(Boolean);
    } else if (exportType === 'filtered') {
      // 导出筛选后的数据
      dataToExport = filteredResults;
    } else {
      // 导出全部数据
      dataToExport = results;
    }

    if (dataToExport.length === 0) {
      alert(`没有可导出的数据${exportType === 'selected' ? '（请先选择数据）' : ''}`);
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
        body: JSON.stringify({ results: dataToExport }),
      });

      if (!response.ok) {
        throw new Error('导出失败');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const exportTypeName = exportType === 'selected' ? '选中' : exportType === 'filtered' ? '筛选后' : '全部';
      a.download = `address-mapping-result-${exportTypeName}-${Date.now()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      alert(err instanceof Error ? err.message : '导出失败');
    }
  }, [results, filteredResults, selectedRows, modifiedRows]);

  /**
   * 获取匹配状态徽章
   */
  const getMatchStatusBadge = (confidence: string) => {
    const normalized = normalizeConfidence(confidence);
    if (normalized === 'high') {
      return <Badge className="bg-green-500 text-xs">精准匹配</Badge>;
    } else if (normalized === 'low') {
      return <Badge className="bg-orange-500 text-xs">低置信度</Badge>;
    } else {
      return <Badge variant="destructive" className="text-xs">未匹配</Badge>;
    }
  };

  /**
   * 获取地址匹配的样式类名
   */
  const getAddressMatchClassName = (junboName: string, operName: string): string => {
    if (junboName && operName && junboName.trim() === operName.trim()) {
      return 'bg-green-50';
    } else if (operName) {
      return 'bg-orange-50';
    }
    return 'bg-red-50';
  };

  /**
   * 匹配状态映射
   */
  const confidenceMap: Record<string, string> = {
    '精准匹配': 'high',
    '低置信度': 'low',
    '未匹配': 'none',
  };

  const confidenceReverseMap: Record<string, string> = {
    'high': '精准匹配',
    'low': '低置信度',
    'none': '未匹配',
  };

  /**
   * 当省份变化时，检查城市筛选是否有效
   */
  useEffect(() => {
    if (filterCity !== 'all' && filterProvince !== 'all') {
      const cityExists = uniqueCities.includes(filterCity);
      if (!cityExists) {
        setFilterCity('all');
      }
    }
  }, [filterProvince, uniqueCities, filterCity]);

  return (
    <div className="flex flex-col h-full bg-white">
      {/* 固定顶部：标题和筛选区域 */}
      <div className="flex-shrink-0 border-b border-gray-200 bg-white">
        <div className="p-2 space-y-2">
          {/* 标题和导出按钮 */}
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-900">转换结果</h2>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handleExport('all')}
                className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700 transition-colors"
                title="导出全部数据"
              >
                <Download className="w-3 h-3" />
                导出全部
              </button>
              {filteredResults.length !== results.length && (
                <button
                  onClick={() => handleExport('filtered')}
                  className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-700 bg-green-50 border border-green-300 rounded hover:bg-green-100 transition-colors"
                >
                  <Download className="w-3 h-3" />
                  导出筛选
                </button>
              )}
            </div>
          </div>
          
          {/* 紧凑的筛选控件 - 单行布局 */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <Filter className="w-3 h-3 text-blue-600" />
              {hasActiveFilters && (
                <span className="px-1.5 py-0.5 text-xs font-medium bg-blue-500 text-white rounded whitespace-nowrap">
                  已筛选
                </span>
              )}
              {hasActiveFilters && (
                <button
                  onClick={handleResetFilters}
                  className="flex items-center justify-center w-5 h-5 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-all"
                  title="清空筛选"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            
            <div className="relative flex-shrink-0" style={{ width: '180px' }}>
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
              <Input
                type="text"
                placeholder="搜索地址..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-7 h-7 text-xs w-full"
              />
            </div>

            <div className="flex-shrink-0">
              <SearchableSelect
                value={filterConfidence === 'all' ? '' : (confidenceReverseMap[filterConfidence] || '')}
                onValueChange={(value) => {
                  const mappedValue = value ? confidenceMap[value] || value : 'all';
                  handleFilterChange('confidence', mappedValue);
                }}
                options={['精准匹配', '低置信度', '未匹配']}
                placeholder="匹配状态"
                className="w-[110px] h-7 text-xs"
              />
            </div>

            <div className="flex-shrink-0">
              <SearchableSelect
                value={filterProvince === 'all' ? '' : filterProvince}
                onValueChange={(value) => handleFilterChange('province', value || 'all')}
                options={uniqueProvinces}
                placeholder="Junbo省份"
                className="w-[130px] h-7 text-xs"
              />
            </div>

            <div className="flex-shrink-0">
              <SearchableSelect
                value={filterCity === 'all' ? '' : filterCity}
                onValueChange={(value) => handleFilterChange('city', value || 'all')}
                options={uniqueCities}
                placeholder="Junbo地市"
                disabled={filterProvince === 'all'}
                className="w-[130px] h-7 text-xs"
              />
            </div>

            {/* 统计信息和批量操作 */}
            <div className="flex items-center gap-2 ml-auto flex-shrink-0">
              <span className="text-xs text-gray-600 whitespace-nowrap">
                <span className="font-semibold text-gray-900">{filteredResults.length}</span>/{results.length}
              </span>
              <button
                onClick={() => setIsSelectMode(!isSelectMode)}
                className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-700 bg-white border border-blue-300 rounded hover:bg-blue-50 transition-colors whitespace-nowrap"
              >
                {isSelectMode ? (
                  <>
                    <CheckSquare className="w-3 h-3" />
                    退出
                  </>
                ) : (
                  <>
                    <Square className="w-3 h-3" />
                    选择
                  </>
                )}
              </button>
              {isSelectMode && selectedRows.size > 0 && (
                <>
                  <span className="text-xs text-gray-600 whitespace-nowrap">
                    已选<span className="font-semibold text-blue-700 ml-0.5">{selectedRows.size}</span>
                  </span>
                  <button
                    onClick={handleSelectAll}
                    className="text-xs text-blue-600 hover:text-blue-700 underline whitespace-nowrap"
                  >
                    {selectedRows.size === paginatedResults.length ? '取消' : '全选'}
                  </button>
                  <button
                    onClick={() => setIsBatchEditMode(!isBatchEditMode)}
                    className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-orange-700 bg-orange-50 border border-orange-300 rounded hover:bg-orange-100 transition-colors whitespace-nowrap"
                  >
                    {isBatchEditMode ? '取消' : '批量'}
                  </button>
                  <button
                    onClick={() => handleExport('selected')}
                    className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors whitespace-nowrap"
                  >
                    <Download className="w-3 h-3" />
                    导出
                  </button>
                </>
              )}
            </div>
          </div>

          {/* 批量修改面板 */}
          {isBatchEditMode && selectedRows.size > 0 && (
            <div className="p-2 bg-orange-50 border border-orange-200 rounded">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-gray-800 whitespace-nowrap">
                  批量修改 {selectedRows.size} 项:
                </span>
                <SearchableSelect
                  value={batchProvince}
                  onValueChange={(value) => {
                    setBatchProvince(value);
                    setBatchCity('');
                    setBatchDistrict('');
                  }}
                  options={operProvinceList}
                  placeholder="省份"
                  className="w-[100px] h-7 text-xs"
                />
                <SearchableSelect
                  value={batchCity}
                  onValueChange={(value) => {
                    setBatchCity(value);
                    setBatchDistrict('');
                  }}
                  options={batchProvince ? getOperCitiesByProvince(batchProvince) : []}
                  placeholder={batchProvince ? "城市" : "先选省份"}
                  disabled={!batchProvince}
                  className="w-[100px] h-7 text-xs"
                />
                <SearchableSelect
                  value={batchDistrict}
                  onValueChange={setBatchDistrict}
                  options={batchProvince && batchCity ? getOperDistrictsByCity(batchProvince, batchCity) : []}
                  placeholder={batchProvince && batchCity ? "区县" : "先选城市"}
                  disabled={!batchProvince || !batchCity}
                  className="w-[100px] h-7 text-xs"
                />
                <button
                  onClick={handleBatchEdit}
                  disabled={!batchProvince}
                  className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-white bg-orange-600 rounded hover:bg-orange-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  <CheckCircle2 className="w-3 h-3" />
                  应用
                </button>
                <button
                  onClick={() => {
                    setIsBatchEditMode(false);
                    setBatchProvince('');
                    setBatchCity('');
                    setBatchDistrict('');
                  }}
                  className="px-2 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                >
                  取消
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 可滚动的表格区域 */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-auto">
          <div className="min-w-full">
            <table className="w-full text-xs text-left text-gray-700 border-collapse">
              <thead className="sticky top-0 z-10 bg-gray-100 text-xs text-gray-700 uppercase">
                <tr>
                  {isSelectMode && (
                    <th className="px-2 py-2 w-10 border-b border-gray-300">
                      <button
                        onClick={handleSelectAll}
                        className="flex items-center justify-center"
                        title={selectedRows.size === paginatedResults.length ? '取消全选' : '全选当前页'}
                      >
                        {selectedRows.size === paginatedResults.length ? (
                          <CheckSquare className="w-3.5 h-3.5 text-blue-600" />
                        ) : (
                          <Square className="w-3.5 h-3.5 text-gray-400" />
                        )}
                      </button>
                    </th>
                  )}
                  <th className="px-2 py-2 w-12 border-b border-gray-300">序号</th>
                  <th className="px-2 py-2 min-w-[100px] border-b border-gray-300">Junbo 省份</th>
                  <th className="px-2 py-2 min-w-[120px] border-b border-gray-300">局方省份</th>
                  <th className="px-2 py-2 min-w-[100px] border-b border-gray-300">Junbo 地市</th>
                  <th className="px-2 py-2 min-w-[120px] border-b border-gray-300">局方地市</th>
                  <th className="px-2 py-2 min-w-[100px] border-b border-gray-300">Junbo 区县</th>
                  <th className="px-2 py-2 min-w-[120px] border-b border-gray-300">局方区县</th>
                  <th className="px-2 py-2 w-20 border-b border-gray-300">匹配状态</th>
                </tr>
              </thead>
              <tbody>
                {paginatedResults.length === 0 ? (
                  <tr>
                    <td colSpan={isSelectMode ? 9 : 8} className="px-4 py-8 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <Filter className="w-8 h-8 text-gray-300 mb-2" />
                        <p className="text-xs text-gray-500 font-medium mb-1">没有找到匹配的数据</p>
                        <p className="text-xs text-gray-400">
                          {hasActiveFilters 
                            ? '请尝试调整筛选条件或搜索关键词'
                            : '暂无数据'}
                        </p>
                        {hasActiveFilters && (
                          <button
                            onClick={handleResetFilters}
                            className="mt-3 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 transition-colors"
                          >
                            清空所有筛选条件
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedResults.map((result, index) => {
                    const globalIndex = (currentPage - 1) * itemsPerPage + index + 1;
                    const filteredIndex = (currentPage - 1) * itemsPerPage + index;
                    const actualRowIndex = filteredIndex < filteredResults.length 
                      ? results.findIndex(r => r === filteredResults[filteredIndex])
                      : -1;
                    
                    const isModified = actualRowIndex >= 0 && modifiedRows.has(actualRowIndex);
                    const currentProvince = result.output.oper_province_name || '';
                    const currentCity = result.output.oper_city_name || '';
                    const currentDistrict = result.output.oper_district_name || '';
                    
                    const availableCities = currentProvince ? getOperCitiesByProvince(currentProvince) : [];
                    const availableDistricts = currentProvince && currentCity ? getOperDistrictsByCity(currentProvince, currentCity) : [];

                    const isSelected = actualRowIndex >= 0 && selectedRows.has(actualRowIndex);
                    
                    return (
                      <tr 
                        key={`${currentPage}-${globalIndex}-${result.output.junbo_province_name}-${result.output.junbo_city_name}-${result.output.junbo_district_name}`} 
                        className={`border-b hover:bg-gray-50 ${isModified ? 'bg-yellow-50' : ''} ${isSelected ? 'bg-blue-50' : ''}`}
                      >
                        {isSelectMode && (
                          <td className="px-2 py-2">
                            <button
                              onClick={() => handleSelectRow(actualRowIndex)}
                              className="flex items-center justify-center"
                            >
                              {isSelected ? (
                                <CheckSquare className="w-3.5 h-3.5 text-blue-600" />
                              ) : (
                                <Square className="w-3.5 h-3.5 text-gray-400" />
                              )}
                            </button>
                          </td>
                        )}
                        <td className="px-2 py-2">{globalIndex}</td>
                        <td className={`px-2 py-2 ${getAddressMatchClassName(result.output.junbo_province_name || '', currentProvince)}`}>
                          {result.output.junbo_province_name || '-'}
                        </td>
                        
                        <td className={`px-2 py-2 ${getAddressMatchClassName(result.output.junbo_province_name || '', currentProvince)}`}>
                          <SearchableSelect
                            value={currentProvince}
                            onValueChange={(value) => handleAddressChange(actualRowIndex, 'province', value)}
                            options={operProvinceList}
                            placeholder="选择省份"
                            className="w-full h-7 text-xs"
                          />
                        </td>
                        
                        <td className={`px-2 py-2 ${getAddressMatchClassName(result.output.junbo_city_name || '', currentCity)}`}>
                          {result.output.junbo_city_name || '-'}
                        </td>
                        
                        <td className={`px-2 py-2 ${getAddressMatchClassName(result.output.junbo_city_name || '', currentCity)}`}>
                          <SearchableSelect
                            value={currentCity}
                            onValueChange={(value) => handleAddressChange(actualRowIndex, 'city', value)}
                            options={availableCities}
                            placeholder={currentProvince ? "选择城市" : "请先选择省份"}
                            disabled={!currentProvince}
                            className="w-full h-7 text-xs"
                          />
                        </td>
                        
                        <td className={`px-2 py-2 ${getAddressMatchClassName(result.output.junbo_district_name || '', currentDistrict)}`}>
                          {result.output.junbo_district_name || '-'}
                        </td>
                        
                        <td className={`px-2 py-2 ${getAddressMatchClassName(result.output.junbo_district_name || '', currentDistrict)}`}>
                          <SearchableSelect
                            value={currentDistrict}
                            onValueChange={(value) => handleAddressChange(actualRowIndex, 'district', value)}
                            options={availableDistricts}
                            placeholder={currentProvince && currentCity ? "选择区县" : "请先选择城市"}
                            disabled={!currentProvince || !currentCity}
                            className="w-full h-7 text-xs"
                          />
                        </td>
                        
                        <td className="px-2 py-2">{getMatchStatusBadge(result.output.confidence)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 固定底部：分页控件和统计信息 */}
        <div className="flex-shrink-0 flex items-center justify-between px-3 py-2 border-t border-gray-200 bg-white">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              {filteredResults.length > 0 ? (
                <div className="text-xs text-gray-600">
                  {totalPages > 1 ? (
                    <>显示第 {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filteredResults.length)} 条，共 {filteredResults.length} 条</>
                  ) : (
                    <>共 {filteredResults.length} 条</>
                  )}
                </div>
              ) : (
                <div className="text-xs text-gray-600">暂无数据</div>
              )}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-600 whitespace-nowrap">每页</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => handlePageSizeChange(e.target.value)}
                  className="px-2 py-0.5 text-xs border border-gray-300 rounded bg-white hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors cursor-pointer"
                >
                  {PAGE_SIZE_OPTIONS.map(size => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
                <span className="text-xs text-gray-600 whitespace-nowrap">条</span>
              </div>
            </div>
            {(() => {
              const matchedCount = results.filter(r => normalizeConfidence(r.output.confidence) !== 'none').length;
              const highConfidenceCount = results.filter(r => normalizeConfidence(r.output.confidence) === 'high').length;
              const lowConfidenceCount = results.filter(r => normalizeConfidence(r.output.confidence) === 'low').length;
              const unmatchedCount = results.filter(r => normalizeConfidence(r.output.confidence) === 'none').length;
              const matchRate = results.length > 0 ? ((matchedCount / results.length) * 100).toFixed(1) : '0';
              
              return (
                <div className="flex items-center gap-3 text-xs flex-wrap">
                  <span className="text-gray-600">
                    匹配率: <span className="font-semibold text-blue-600">{matchRate}%</span> ({matchedCount}/{results.length})
                  </span>
                  <span className="text-gray-600">
                    精准匹配: <span className="font-semibold text-green-600">{highConfidenceCount}</span>
                    <span className="text-gray-500"> ({results.length > 0 ? ((highConfidenceCount / results.length) * 100).toFixed(1) : '0'}%)</span>
                  </span>
                  <span className="text-gray-600">
                    低置信度: <span className="font-semibold text-orange-600">{lowConfidenceCount}</span>
                    <span className="text-gray-500"> ({results.length > 0 ? ((lowConfidenceCount / results.length) * 100).toFixed(1) : '0'}%)</span>
                  </span>
                  <span className="text-gray-600">
                    未匹配: <span className="font-semibold text-red-600">{unmatchedCount}</span>
                    <span className="text-gray-500"> ({results.length > 0 ? ((unmatchedCount / results.length) * 100).toFixed(1) : '0'}%)</span>
                  </span>
                </div>
              );
            })()}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
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
                      className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
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
                className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                下一页
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

