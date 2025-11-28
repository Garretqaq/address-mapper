/**
 * 地址映射转换系统 - 类型定义
 * @author sgz
 * @since 2025-01-29
 */

// junbo 地址库结构类型
export interface JunboAddressData {
  [provinceCode: string]: {
    [cityCode: string]: string | {
      [districtCode: string]: string;
    };
  };
}

// 地址索引类型（用于快速查找）
export interface AddressIndex {
  provinces: Map<string, { code: string; name: string }>;
  cities: Map<string, { code: string; name: string; provinceCode: string }>;
  districts: Map<string, { code: string; name: string; provinceCode: string; cityCode: string }>;
}

// 局方 Excel 输入数据结构
export interface OperAddressInput {
  省份名称: string;
  省份编码: string;
  地市名称: string;
  地市编码: string;
  区县名称: string;
  区县编码: string;
}

// junbo 地址信息
export interface JunboAddress {
  provinceCode?: string;
  provinceName?: string;
  cityCode?: string;
  cityName?: string;
  districtCode?: string;
  districtName?: string;
}

// 匹配结果
export interface MatchResult {
  junbo: JunboAddress;
  matchScore: number; // 匹配度 0-1
  matchMethod: 'code' | 'exact' | 'fuzzy' | 'none'; // 匹配方式
  confidence: 'high' | 'medium' | 'low' | 'none'; // 匹配信心
}

// 输出 Excel 数据结构
export interface OutputAddressData {
  junbo_province_name: string;
  oper_province_name: string;
  oper_province_code: string; // 局方省份编码
  junbo_city_name: string;
  oper_city_name: string;
  oper_city_code: string;
  junbo_district_name: string;
  oper_district_name: string;
  oper_district_code: string;
  match_score: number; // 匹配度
  match_method: string; // 匹配方式
  confidence: string; // 匹配信心
}

// 地址匹配结果（包含原始数据和匹配结果）
export interface AddressMatchResult {
  input: OperAddressInput;
  output: OutputAddressData;
  needsConfirmation: boolean; // 是否需要人工确认
}

// API 响应类型
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// 处理进度
export interface ProcessProgress {
  total: number;
  current: number;
  percentage: number;
  status: 'processing' | 'completed' | 'error';
  message?: string;
}

