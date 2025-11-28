/**
 * 地址匹配核心逻辑
 * @author sgz
 * @since 2025-01-29
 */

import type {
  JunboAddressData,
  AddressIndex,
  OperAddressInput,
  MatchResult,
  JunboAddress,
  AddressMatchResult,
  OutputAddressData,
} from './types';
import { parseAddressComponents } from './address-parse';

/**
 * 地址匹配器类
 */
export class AddressMatcher {
  private addressData: JunboAddressData;
  private index: AddressIndex;

  constructor(addressData: JunboAddressData) {
    this.addressData = addressData;
    this.index = this.buildIndex(addressData);
  }

  /**
   * 构建地址索引（名称 -> 编码映射）
   */
  private buildIndex(data: JunboAddressData): AddressIndex {
    const provinces = new Map<string, { code: string; name: string }>();
    const cities = new Map<string, { code: string; name: string; provinceCode: string }>();
    const districts = new Map<string, { code: string; name: string; provinceCode: string; cityCode: string }>();

    // 遍历省份
    const provinceData = data['0000'] || {};
    for (const [provinceCode, provinceName] of Object.entries(provinceData)) {
      if (typeof provinceName === 'string') {
        provinces.set(provinceName, { code: provinceCode, name: provinceName });
        
        // 遍历该省份的城市
        const cityData = data[provinceCode] || {};
        for (const [cityCode, cityName] of Object.entries(cityData)) {
          if (typeof cityName === 'string') {
            cities.set(cityName, { code: cityCode, name: cityName, provinceCode });
            
            // 遍历该城市的区县
            const districtData = data[cityCode] || {};
            for (const [districtCode, districtName] of Object.entries(districtData)) {
              if (typeof districtName === 'string') {
                districts.set(districtName, { 
                  code: districtCode, 
                  name: districtName, 
                  provinceCode, 
                  cityCode 
                });
              }
            }
          }
        }
      }
    }

    return { provinces, cities, districts };
  }

  /**
   * 计算 Levenshtein 距离（用于模糊匹配）
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;
    const dp: number[][] = Array(len1 + 1).fill(0).map(() => Array(len2 + 1).fill(0));

    for (let i = 0; i <= len1; i++) dp[i][0] = i;
    for (let j = 0; j <= len2; j++) dp[0][j] = j;

    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = Math.min(
            dp[i - 1][j] + 1,    // 删除
            dp[i][j - 1] + 1,    // 插入
            dp[i - 1][j - 1] + 1 // 替换
          );
        }
      }
    }

    return dp[len1][len2];
  }

  /**
   * 计算字符串相似度（改进版，优先考虑包含关系）
   */
  private similarity(str1: string, str2: string): number {
    if (!str1 || !str2) return 0;
    if (str1 === str2) return 1;

    // 检查包含关系（去除后缀后）
    const normalized1 = this.normalizeName(str1);
    const normalized2 = this.normalizeName(str2);
    
    if (normalized1 === normalized2) return 1;
    if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
      // 如果一个是另一个的子串，给予较高分数
      const minLen = Math.min(normalized1.length, normalized2.length);
      const maxLen = Math.max(normalized1.length, normalized2.length);
      return minLen / maxLen * 0.9; // 包含关系给予0.9倍的基础分数
    }

    const maxLen = Math.max(str1.length, str2.length);
    if (maxLen === 0) return 1;

    const distance = this.levenshteinDistance(str1, str2);
    return 1 - distance / maxLen;
  }

  /**
   * 标准化地址名称（去除常见后缀）
   * 注意：执行顺序很重要，先处理长的后缀，再处理短的后缀
   */
  private normalizeName(name: string): string {
    if (!name || typeof name !== 'string') return '';
    
    // 先处理长的复合后缀
    let normalized = name
      .replace(/维吾尔自治区$/, '')
      .replace(/回族自治区$/, '')
      .replace(/壮族自治区$/, '')
      .replace(/藏族自治州$/, '')
      .replace(/彝族自治州$/, '')
      .replace(/苗族侗族自治州$/, '')
      .replace(/特别行政区$/, '')
      .replace(/自治区$/, '')
      .replace(/自治州$/, '')
      .replace(/地区$/, '')
      .replace(/省$/, '')
      .replace(/市$/, '')
      .replace(/区$/, '')
      .replace(/县$/, '')
      .replace(/镇$/, '')
      .trim();
    
    return normalized;
  }

  /**
   * 匹配省份
   */
  private matchProvince(provinceName: string, provinceCode?: string): JunboAddress | null {
    // 1. 尝试编码匹配
    if (provinceCode && this.addressData['0000']?.[provinceCode]) {
      const name = this.addressData['0000'][provinceCode];
      if (typeof name === 'string') {
        return {
          provinceCode,
          provinceName: name,
        };
      }
    }

    // 2. 精确匹配
    const exactMatch = this.index.provinces.get(provinceName);
    if (exactMatch) {
      return {
        provinceCode: exactMatch.code,
        provinceName: exactMatch.name,
      };
    }

    // 3. 模糊匹配
    const normalizedInput = this.normalizeName(provinceName);
    let bestMatch: { code: string; name: string; score: number } | null = null;

    for (const [name, info] of this.index.provinces.entries()) {
      const normalizedName = this.normalizeName(name);
      const score = this.similarity(normalizedInput, normalizedName);
      
      if (score >= 0.8 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { ...info, score };
      }
    }

    if (bestMatch) {
      return {
        provinceCode: bestMatch.code,
        provinceName: bestMatch.name,
      };
    }

    return null;
  }

  /**
   * 匹配城市
   */
  private matchCity(
    cityName: string,
    cityCode?: string,
    provinceCode?: string
  ): JunboAddress | null {
    // 1. 尝试编码匹配
    if (cityCode && provinceCode && this.addressData[provinceCode]?.[cityCode]) {
      const name = this.addressData[provinceCode][cityCode];
      if (typeof name === 'string') {
        return {
          cityCode,
          cityName: name,
        };
      }
    }

    // 2. 精确匹配（限定省份）
    if (provinceCode) {
      for (const [name, info] of this.index.cities.entries()) {
        if (info.provinceCode === provinceCode && name === cityName) {
          return {
            cityCode: info.code,
            cityName: info.name,
          };
        }
      }
    }

    // 3. 模糊匹配（限定省份）
    const normalizedInput = this.normalizeName(cityName);
    let bestMatch: { code: string; name: string; score: number } | null = null;

    for (const [name, info] of this.index.cities.entries()) {
      if (!provinceCode || info.provinceCode === provinceCode) {
        const normalizedName = this.normalizeName(name);
        const score = this.similarity(normalizedInput, normalizedName);
        
        if (score >= 0.8 && (!bestMatch || score > bestMatch.score)) {
          bestMatch = { ...info, score };
        }
      }
    }

    if (bestMatch) {
      return {
        cityCode: bestMatch.code,
        cityName: bestMatch.name,
      };
    }

    return null;
  }

  /**
   * 匹配区县
   */
  private matchDistrict(
    districtName: string,
    districtCode?: string,
    provinceCode?: string,
    cityCode?: string
  ): JunboAddress | null {
    // 1. 尝试编码匹配
    if (districtCode && cityCode && this.addressData[cityCode]?.[districtCode]) {
      const name = this.addressData[cityCode][districtCode];
      if (typeof name === 'string') {
        return {
          districtCode,
          districtName: name,
        };
      }
    }

    // 2. 精确匹配（限定城市）
    if (cityCode) {
      for (const [name, info] of this.index.districts.entries()) {
        if (info.cityCode === cityCode && name === districtName) {
          return {
            districtCode: info.code,
            districtName: info.name,
          };
        }
      }
    }

    // 3. 模糊匹配（限定城市或省份）
    const normalizedInput = this.normalizeName(districtName);
    let bestMatch: { code: string; name: string; score: number } | null = null;

    for (const [name, info] of this.index.districts.entries()) {
      if (
        (!cityCode || info.cityCode === cityCode) &&
        (!provinceCode || info.provinceCode === provinceCode)
      ) {
        const normalizedName = this.normalizeName(name);
        const score = this.similarity(normalizedInput, normalizedName);
        
        if (score >= 0.8 && (!bestMatch || score > bestMatch.score)) {
          bestMatch = { ...info, score };
        }
      }
    }

    if (bestMatch) {
      return {
        districtCode: bestMatch.code,
        districtName: bestMatch.name,
      };
    }

    return null;
  }

  /**
   * 匹配完整地址
   */
  match(input: OperAddressInput): MatchResult {
    let matchScore = 0;
    let matchMethod: MatchResult['matchMethod'] = 'none';
    const junbo: JunboAddress = {};

    // 1. 匹配省份
    const provinceMatch = this.matchProvince(input.省份名称, input.省份编码);
    if (provinceMatch) {
      junbo.provinceCode = provinceMatch.provinceCode;
      junbo.provinceName = provinceMatch.provinceName;
      matchScore += 0.33;
      
      if (input.省份编码 && provinceMatch.provinceCode === input.省份编码) {
        matchMethod = 'code';
      } else if (input.省份名称 === provinceMatch.provinceName) {
        matchMethod = matchMethod === 'none' ? 'exact' : matchMethod;
      } else {
        matchMethod = matchMethod === 'none' ? 'fuzzy' : matchMethod;
      }
    }

    // 2. 匹配城市
    if (junbo.provinceCode) {
      const cityMatch = this.matchCity(
        input.地市名称,
        input.地市编码,
        junbo.provinceCode
      );
      if (cityMatch) {
        junbo.cityCode = cityMatch.cityCode;
        junbo.cityName = cityMatch.cityName;
        matchScore += 0.33;
        
        if (input.地市编码 && cityMatch.cityCode === input.地市编码) {
          matchMethod = matchMethod === 'code' ? 'code' : matchMethod;
        } else if (input.地市名称 === cityMatch.cityName) {
          matchMethod = matchMethod === 'none' ? 'exact' : matchMethod;
        } else {
          matchMethod = matchMethod === 'fuzzy' ? 'fuzzy' : matchMethod;
        }
      }
    }

    // 3. 匹配区县
    if (junbo.cityCode) {
      const districtMatch = this.matchDistrict(
        input.区县名称,
        input.区县编码,
        junbo.provinceCode,
        junbo.cityCode
      );
      if (districtMatch) {
        junbo.districtCode = districtMatch.districtCode;
        junbo.districtName = districtMatch.districtName;
        matchScore += 0.34;
        
        if (input.区县编码 && districtMatch.districtCode === input.区县编码) {
          matchMethod = matchMethod === 'code' ? 'code' : matchMethod;
        } else if (input.区县名称 === districtMatch.districtName) {
          matchMethod = matchMethod === 'none' ? 'exact' : matchMethod;
        } else {
          matchMethod = matchMethod === 'fuzzy' ? 'fuzzy' : matchMethod;
        }
      }
    }

    // 4. 如果匹配失败，尝试使用 zh-address-parse
    if (matchScore < 0.5) {
      const parsed = parseAddressComponents(
        input.省份名称,
        input.地市名称,
        input.区县名称
      );
      
      if (parsed) {
        // 使用解析结果重新匹配
        if (parsed.province) {
          const provinceMatch = this.matchProvince(parsed.province);
          if (provinceMatch && !junbo.provinceCode) {
            junbo.provinceCode = provinceMatch.provinceCode;
            junbo.provinceName = provinceMatch.provinceName;
            matchScore += 0.33;
            matchMethod = 'parse';
          }
        }
        
        if (parsed.city && junbo.provinceCode) {
          const cityMatch = this.matchCity(parsed.city, undefined, junbo.provinceCode);
          if (cityMatch && !junbo.cityCode) {
            junbo.cityCode = cityMatch.cityCode;
            junbo.cityName = cityMatch.cityName;
            matchScore += 0.33;
            matchMethod = 'parse';
          }
        }
        
        if (parsed.area && junbo.cityCode) {
          const districtMatch = this.matchDistrict(
            parsed.area,
            undefined,
            junbo.provinceCode,
            junbo.cityCode
          );
          if (districtMatch && !junbo.districtCode) {
            junbo.districtCode = districtMatch.districtCode;
            junbo.districtName = districtMatch.districtName;
            matchScore += 0.34;
            matchMethod = 'parse';
          }
        }
      }
    }

    // 确定匹配信心
    let confidence: MatchResult['confidence'];
    if (matchScore >= 0.9) {
      confidence = 'high';
    } else if (matchScore >= 0.6) {
      confidence = 'medium';
    } else if (matchScore > 0) {
      confidence = 'low';
    } else {
      confidence = 'none';
    }

    return {
      junbo,
      matchScore,
      matchMethod,
      confidence,
    };
  }

  /**
   * 生成所有骏伯地址条目（省份-城市-区县三级组合）
   */
  private generateAllJunboAddresses(): Array<{
    provinceCode: string;
    provinceName: string;
    cityCode: string;
    cityName: string;
    districtCode: string;
    districtName: string;
  }> {
    const addresses: Array<{
      provinceCode: string;
      provinceName: string;
      cityCode: string;
      cityName: string;
      districtCode: string;
      districtName: string;
    }> = [];

    // 遍历所有省份
    const provinceData = this.addressData['0000'] || {};
    for (const [provinceCode, provinceName] of Object.entries(provinceData)) {
      if (typeof provinceName === 'string') {
        // 遍历该省份的所有城市
        const cityData = this.addressData[provinceCode] || {};
        for (const [cityCode, cityValue] of Object.entries(cityData)) {
          if (typeof cityValue === 'string') {
            const cityName = cityValue;
            // 遍历该城市的所有区县
            const districtData = this.addressData[cityCode] || {};
            for (const [districtCode, districtName] of Object.entries(districtData)) {
              if (typeof districtName === 'string') {
                addresses.push({
                  provinceCode,
                  provinceName,
                  cityCode,
                  cityName,
                  districtCode,
                  districtName,
                });
              }
            }
          }
        }
      }
    }

    return addresses;
  }

  /**
   * 从局方地址中匹配到骏伯地址（反向匹配，优化版）
   */
  private matchOperAddressFromJunbo(
    junboAddress: {
      provinceCode: string;
      provinceName: string;
      cityCode: string;
      cityName: string;
      districtCode: string;
      districtName: string;
    },
    operInputs: OperAddressInput[]
  ): {
    matched: OperAddressInput | null;
    matchScore: number;
    matchMethod: MatchResult['matchMethod'];
    confidence: MatchResult['confidence'];
  } {
    let bestMatch: OperAddressInput | null = null;
    let bestScore = 0;
    let bestMethod: MatchResult['matchMethod'] = 'none';

    // 定义匹配结果类型
    type MatchCandidate = {
      input: OperAddressInput;
      score: number;
      method: MatchResult['matchMethod'];
      districtExactMatch: boolean;
      districtFuzzyMatch: boolean;
    };

    const candidates: MatchCandidate[] = [];

    for (const operInput of operInputs) {
      let score = 0;
      let method: MatchResult['matchMethod'] = 'none';
      let districtExactMatch = false;
      let districtFuzzyMatch = false;

      // 1. 匹配省份
      let provinceMatched = false;
      if (operInput.省份编码 && operInput.省份编码 === junboAddress.provinceCode) {
        score += 0.25; // 降低省份权重，提高区县权重
        method = 'code';
        provinceMatched = true;
      } else if (operInput.省份名称 && operInput.省份名称 === junboAddress.provinceName) {
        score += 0.25;
        method = method === 'none' ? 'exact' : method;
        provinceMatched = true;
      } else if (operInput.省份名称 && junboAddress.provinceName) {
        // 标准化后比较
        const normalizedOper = this.normalizeName(operInput.省份名称);
        const normalizedJunbo = this.normalizeName(junboAddress.provinceName);
        
        // 如果标准化后完全相同，视为精确匹配
        if (normalizedOper && normalizedJunbo && normalizedOper === normalizedJunbo) {
          score += 0.25;
          method = method === 'none' ? 'exact' : method;
          provinceMatched = true;
        } else if (normalizedOper && normalizedJunbo) {
          // 否则使用相似度计算
          const similarity = this.similarity(normalizedOper, normalizedJunbo);
          if (similarity >= 0.7) { // 降低阈值，提高匹配率
            score += 0.25 * similarity;
            method = method === 'none' ? 'fuzzy' : method;
            provinceMatched = true;
          }
        }
      }

      // 2. 匹配城市（只有在省份匹配成功时才继续）
      if (provinceMatched) {
        let cityMatched = false;
        if (operInput.地市编码 && operInput.地市编码 === junboAddress.cityCode) {
          score += 0.25;
          method = method === 'code' ? 'code' : method;
          cityMatched = true;
        } else if (operInput.地市名称 && operInput.地市名称 === junboAddress.cityName) {
          score += 0.25;
          method = method === 'none' ? 'exact' : method;
          cityMatched = true;
        } else if (operInput.地市名称 && junboAddress.cityName) {
          // 标准化后比较
          const normalizedOper = this.normalizeName(operInput.地市名称);
          const normalizedJunbo = this.normalizeName(junboAddress.cityName);
          
          // 如果标准化后完全相同，视为精确匹配
          if (normalizedOper && normalizedJunbo && normalizedOper === normalizedJunbo) {
            score += 0.25;
            method = method === 'none' ? 'exact' : method;
            cityMatched = true;
          } else if (normalizedOper && normalizedJunbo) {
            // 否则使用相似度计算
            const similarity = this.similarity(normalizedOper, normalizedJunbo);
            if (similarity >= 0.7) {
              score += 0.25 * similarity;
              method = method === 'fuzzy' ? 'fuzzy' : method;
              cityMatched = true;
            }
          }
        }

        // 3. 匹配区县（只有在城市匹配成功时才继续）
        if (cityMatched) {
          if (operInput.区县编码 && operInput.区县编码 === junboAddress.districtCode) {
            score += 0.5; // 提高区县权重
            method = method === 'code' ? 'code' : method;
            districtExactMatch = true;
          } else if (operInput.区县名称 && operInput.区县名称 === junboAddress.districtName) {
            score += 0.5; // 区县完全匹配给予最高权重
            method = method === 'none' ? 'exact' : method;
            districtExactMatch = true;
          } else if (operInput.区县名称 && junboAddress.districtName) {
            // 区县级别的模糊匹配需要更高的阈值和更严格的检查
            const normalizedOper = this.normalizeName(operInput.区县名称);
            const normalizedJunbo = this.normalizeName(junboAddress.districtName);
            
            // 如果标准化后完全相同，视为精确匹配
            if (normalizedOper && normalizedJunbo && normalizedOper === normalizedJunbo) {
              score += 0.5;
              method = method === 'none' ? 'exact' : method;
              districtExactMatch = true;
            } else if (normalizedOper && normalizedJunbo) {
              // 检查是否包含关系（去除后缀后）
              const operWithoutSuffix = normalizedOper.replace(/[镇区县]$/, '');
              const junboWithoutSuffix = normalizedJunbo.replace(/[镇区县]$/, '');
              
              if (operWithoutSuffix === junboWithoutSuffix || 
                  (operWithoutSuffix.length > 0 && junboWithoutSuffix.length > 0 &&
                   (operWithoutSuffix.includes(junboWithoutSuffix) || 
                    junboWithoutSuffix.includes(operWithoutSuffix)))) {
                // 如果去除后缀后相同或包含，给予较高分数
                score += 0.5 * 0.95;
                method = method === 'fuzzy' ? 'fuzzy' : method;
                districtFuzzyMatch = true;
              } else {
                // 否则使用相似度计算，但需要更高的阈值（0.85）
                const similarity = this.similarity(normalizedOper, normalizedJunbo);
                if (similarity >= 0.85) {
                  score += 0.5 * similarity;
                  method = method === 'fuzzy' ? 'fuzzy' : method;
                  districtFuzzyMatch = true;
                }
              }
            }
          }
        }
      }

      // 保存候选匹配
      if (score > 0) {
        candidates.push({
          input: operInput,
          score,
          method,
          districtExactMatch,
          districtFuzzyMatch,
        });
      }
    }

    // 优先选择区县完全匹配的候选
    const exactDistrictMatches = candidates.filter(c => c.districtExactMatch);
    if (exactDistrictMatches.length > 0) {
      // 在区县完全匹配的候选中，选择分数最高的
      const best = exactDistrictMatches.reduce((prev, curr) => 
        curr.score > prev.score ? curr : prev
      );
      bestMatch = best.input;
      bestScore = best.score;
      bestMethod = best.method;
    } else {
      // 如果没有完全匹配，选择分数最高的
      if (candidates.length > 0) {
        const best = candidates.reduce((prev, curr) => 
          curr.score > prev.score ? curr : prev
        );
        bestMatch = best.input;
        bestScore = best.score;
        bestMethod = best.method;
      }
    }

    // 确定匹配信心
    let confidence: MatchResult['confidence'];
    if (bestScore >= 0.9) {
      confidence = 'high';
    } else if (bestScore >= 0.6) {
      confidence = 'medium';
    } else if (bestScore > 0) {
      confidence = 'low';
    } else {
      confidence = 'none';
    }

    return {
      matched: bestMatch,
      matchScore: bestScore,
      matchMethod: bestMethod,
      confidence,
    };
  }

  /**
   * 批量匹配地址（以骏伯地址库为主，匹配局方地址）
   */
  batchMatch(operInputs: OperAddressInput[]): AddressMatchResult[] {
    // 生成所有骏伯地址条目
    const allJunboAddresses = this.generateAllJunboAddresses();

    // 对每个骏伯地址，尝试匹配局方地址
    return allJunboAddresses.map((junboAddress) => {
      const matchResult = this.matchOperAddressFromJunbo(junboAddress, operInputs);

      const output: OutputAddressData = {
        junbo_province_name: junboAddress.provinceName,
        oper_province_name: matchResult.matched?.省份名称 || '',
        oper_province_code: matchResult.matched?.省份编码 || '',
        junbo_city_name: junboAddress.cityName,
        oper_city_name: matchResult.matched?.地市名称 || '',
        oper_city_code: matchResult.matched?.地市编码 || '',
        junbo_district_name: junboAddress.districtName,
        oper_district_name: matchResult.matched?.区县名称 || '',
        oper_district_code: matchResult.matched?.区县编码 || '',
        match_score: matchResult.matchScore,
        match_method: matchResult.matchMethod,
        confidence: matchResult.confidence,
      };

      // 构建一个虚拟的 input（用于保持类型一致性）
      const virtualInput: OperAddressInput = {
        省份名称: matchResult.matched?.省份名称 || '',
        省份编码: matchResult.matched?.省份编码 || '',
        地市名称: matchResult.matched?.地市名称 || '',
        地市编码: matchResult.matched?.地市编码 || '',
        区县名称: matchResult.matched?.区县名称 || '',
        区县编码: matchResult.matched?.区县编码 || '',
      };

      return {
        input: virtualInput,
        output,
        needsConfirmation: matchResult.confidence === 'low' || matchResult.confidence === 'none',
      };
    });
  }
}

/**
 * 加载 junbo 地址库
 */
export async function loadAddressData(): Promise<JunboAddressData> {
  // 动态导入地址库数据
  const data = await import('../data/junbo-address.json');
  return data.default as JunboAddressData;
}

