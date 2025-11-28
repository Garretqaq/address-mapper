/**
 * 地址解析工具 - 使用 zh-address-parse
 * @author sgz
 * @since 2025-01-29
 */

import addressParse from 'zh-address-parse';

export interface ParsedAddress {
  province?: string;
  city?: string;
  area?: string;
  name?: string;
  phone?: string;
  postalCode?: string;
  detail?: string;
}

/**
 * 解析地址字符串
 * @param addressText 地址文本
 * @returns 解析后的地址对象
 */
export function parseAddress(addressText: string): ParsedAddress | null {
  if (!addressText || typeof addressText !== 'string') {
    return null;
  }

  try {
    const result = addressParse(addressText);
    
    if (!result || typeof result !== 'object') {
      return null;
    }

    return {
      province: result.province || undefined,
      city: result.city || undefined,
      area: result.area || undefined,
      name: result.name || undefined,
      phone: result.phone || undefined,
      postalCode: result.postalCode || undefined,
      detail: result.detail || undefined,
    };
  } catch (error) {
    console.error('地址解析失败:', error);
    return null;
  }
}

/**
 * 尝试从地址文本中提取省市区信息
 * @param provinceName 省份名称
 * @param cityName 城市名称
 * @param districtName 区县名称
 * @returns 解析后的地址对象
 */
export function parseAddressComponents(
  provinceName: string,
  cityName: string,
  districtName: string
): ParsedAddress | null {
  // 组合成完整地址字符串
  const fullAddress = `${provinceName}${cityName}${districtName}`;
  return parseAddress(fullAddress);
}

