/**
 * Excel 读写工具
 * @author sgz
 * @since 2025-01-29
 */

import * as XLSX from 'xlsx';
import type { OperAddressInput, OutputAddressData } from './types';

/**
 * 读取 Excel 文件并解析为局方地址数据
 * @param file File 对象或 Buffer
 * @returns 解析后的地址数据数组
 */
export async function readExcel(file: File | Buffer): Promise<OperAddressInput[]> {
  try {
    let buffer: ArrayBuffer | SharedArrayBuffer;

    if (file instanceof File) {
      buffer = await file.arrayBuffer();
    } else {
      buffer = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
    }
    
    // 确保是 ArrayBuffer
    const arrayBuffer = buffer instanceof ArrayBuffer 
      ? buffer 
      : new Uint8Array(buffer).buffer;

    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    
    // 读取第一个工作表
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    
    // 转换为 JSON
    const jsonData = XLSX.utils.sheet_to_json<any>(worksheet);
    
    // 映射到标准格式
    const result: OperAddressInput[] = jsonData.map((row) => ({
      省份名称: String(row['省份名称'] || row['province_name'] || '').trim(),
      省份编码: String(row['省份编码'] || row['province_code'] || '').trim(),
      地市名称: String(row['地市名称'] || row['city_name'] || '').trim(),
      地市编码: String(row['地市编码'] || row['city_code'] || '').trim(),
      区县名称: String(row['区县名称'] || row['district_name'] || '').trim(),
      区县编码: String(row['区县编码'] || row['district_code'] || '').trim(),
    }));

    return result.filter(item => 
      item.省份名称 || item.省份编码 || 
      item.地市名称 || item.地市编码 || 
      item.区县名称 || item.区县编码
    );
  } catch (error) {
    console.error('Excel 读取失败:', error);
    throw new Error('Excel 文件读取失败，请确保文件格式正确');
  }
}

/**
 * 将输出数据写入 Excel 文件
 * @param data 输出数据数组
 * @param filename 文件名（不含扩展名）
 * @returns Buffer
 */
export function writeExcel(data: OutputAddressData[], filename: string = 'address-mapping'): Buffer {
  try {
    // 创建工作簿
    const workbook = XLSX.utils.book_new();
    
    // 转换数据为工作表格式
    const worksheetData = data.map((item) => ({
      '省份名称(junbo)': item.junbo_province_name,
      '省份名称(局方)': item.oper_province_name,
      '省份编码(局方)': item.oper_province_code,
      '城市名称(junbo)': item.junbo_city_name,
      '城市名称(局方)': item.oper_city_name,
      '城市编码(局方)': item.oper_city_code,
      '区县名称(junbo)': item.junbo_district_name,
      '区县名称(局方)': item.oper_district_name,
      '区县编码(局方)': item.oper_district_code,
      '匹配分数': item.match_score.toFixed(2),
      '匹配方式': translateMatchMethod(item.match_method),
      '匹配信心': translateConfidence(item.confidence),
    }));

    // 创建工作表
    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    
    // 设置列宽
    const colWidths = [
      { wch: 15 }, // 省份名称(junbo)
      { wch: 15 }, // 省份名称(局方)
      { wch: 15 }, // 省份编码(局方)
      { wch: 15 }, // 城市名称(junbo)
      { wch: 15 }, // 城市名称(局方)
      { wch: 15 }, // 城市编码(局方)
      { wch: 15 }, // 区县名称(junbo)
      { wch: 15 }, // 区县名称(局方)
      { wch: 15 }, // 区县编码(局方)
      { wch: 10 }, // 匹配分数
      { wch: 12 }, // 匹配方式
      { wch: 10 }, // 匹配信心
    ];
    worksheet['!cols'] = colWidths;

    // 添加工作表到工作簿
    XLSX.utils.book_append_sheet(workbook, worksheet, '地址映射结果');
    
    // 生成 Buffer
    const excelBuffer = XLSX.write(workbook, { 
      type: 'buffer', 
      bookType: 'xlsx',
      compression: true 
    });
    
    return Buffer.from(excelBuffer);
  } catch (error) {
    console.error('Excel 写入失败:', error);
    throw new Error('Excel 文件生成失败');
  }
}

/**
 * 翻译匹配方式
 */
function translateMatchMethod(method: string): string {
  const translations: Record<string, string> = {
    code: '编码匹配',
    exact: '精确匹配',
    fuzzy: '模糊匹配',
    none: '未匹配',
  };
  return translations[method] || method;
}

/**
 * 翻译匹配信心
 */
function translateConfidence(confidence: string): string {
  const translations: Record<string, string> = {
    high: '高',
    medium: '中',
    low: '低',
    none: '无',
  };
  return translations[confidence] || confidence;
}

/**
 * 验证 Excel 文件格式
 * @param file File 对象
 * @returns 是否为有效的 Excel 文件
 */
export function validateExcelFile(file: File): boolean {
  const validTypes = [
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel.sheet.macroEnabled.12',
  ];
  
  const validExtensions = ['.xls', '.xlsx', '.xlsm'];
  const fileName = file.name.toLowerCase();
  const hasValidExtension = validExtensions.some(ext => fileName.endsWith(ext));
  
  return validTypes.includes(file.type) || hasValidExtension;
}

/**
 * 生成示例 Excel 文件（用于下载模板）
 * @returns Buffer
 */
export function generateTemplateExcel(): Buffer {
  const templateData = [
    {
      '省份名称': '福建省',
      '省份编码': '1001',
      '地市名称': '厦门市',
      '地市编码': '2001',
      '区县名称': '思明区',
      '区县编码': '3007',
    },
    {
      '省份名称': '广东省',
      '省份编码': '1005',
      '地市名称': '深圳市',
      '地市编码': '2057',
      '区县名称': '福田区',
      '区县编码': '3473',
    },
  ];

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(templateData);
  
  // 设置列宽
  worksheet['!cols'] = [
    { wch: 15 },
    { wch: 15 },
    { wch: 15 },
    { wch: 15 },
    { wch: 15 },
    { wch: 15 },
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, '地址数据');
  
  const buffer = XLSX.write(workbook, { 
    type: 'buffer', 
    bookType: 'xlsx' 
  });
  
  return Buffer.from(buffer);
}

