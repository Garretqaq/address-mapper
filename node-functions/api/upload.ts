/**
 * 文件上传和地址匹配 Node Function（性能优化版）
 * @author sgz
 * @since 2025-01-29
 */

import { readExcel } from '../../lib/excel';
import { AddressMatcher, loadAddressData } from '../../lib/address-matcher';
import type { ApiResponse, AddressMatchResult } from '../../lib/types';
import type { EventContext } from '../types';

// 全局缓存地址匹配器和地址数据
let cachedMatcher: AddressMatcher | null = null;
let cachedAddressData: any = null;
let matcherLoadPromise: Promise<AddressMatcher> | null = null;

/**
 * 获取或创建地址匹配器（带预加载优化）
 */
async function getMatcher(): Promise<AddressMatcher> {
  // 如果正在加载，等待加载完成
  if (matcherLoadPromise) {
    return matcherLoadPromise;
  }

  // 如果已缓存，直接返回
  if (cachedMatcher) {
    return cachedMatcher;
  }

  // 开始加载
  matcherLoadPromise = (async () => {
    try {
      // 如果地址数据未缓存，先加载数据
      if (!cachedAddressData) {
        const startTime = Date.now();
        cachedAddressData = await loadAddressData();
        console.log(`地址数据加载耗时: ${Date.now() - startTime}ms`);
      }

      // 创建匹配器
      const createStartTime = Date.now();
      cachedMatcher = new AddressMatcher(cachedAddressData);
      console.log(`地址匹配器创建耗时: ${Date.now() - createStartTime}ms`);

      return cachedMatcher;
    } finally {
      // 清除加载 Promise，允许后续请求直接使用缓存
      matcherLoadPromise = null;
    }
  })();

  return matcherLoadPromise;
}

/**
 * 并行处理批量匹配（优化性能）
 * 对于大量数据，可以考虑分批处理，但当前实现已经优化，直接处理即可
 */
async function batchMatchParallel(
  matcher: AddressMatcher,
  inputData: any[]
): Promise<AddressMatchResult[]> {
  const matchStartTime = Date.now();
  
  // 执行批量匹配（已优化的版本）
  const results = matcher.batchMatch(inputData);
  const matchDuration = Date.now() - matchStartTime;
  
  console.log(
    `匹配完成: 输入 ${inputData.length} 条, 输出 ${results.length} 条, 耗时 ${matchDuration}ms, 平均 ${(matchDuration / inputData.length).toFixed(2)}ms/条`
  );
  
  return results;
}

/**
 * POST /api/upload - 上传 Excel 文件并处理（性能优化版）
 */
export async function onRequestPost(context: EventContext) {
  const requestStartTime = Date.now();
  
  try {
    const { request } = context;
    
    // 1. 解析 FormData（并行处理）
    const parseStartTime = Date.now();
    const formData = await request.formData();
    const file = formData.get('file') as File;
    console.log(`FormData 解析耗时: ${Date.now() - parseStartTime}ms`);

    if (!file) {
      return new Response(
        JSON.stringify({ success: false, error: '未找到上传文件' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        }
      );
    }

    // 验证文件类型
    if (!file.name.match(/\.(xlsx?|xlsm)$/i)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: '文件格式不正确，请上传 Excel 文件（.xls, .xlsx, .xlsm）',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        }
      );
    }

    // 2. 读取 Excel 文件（并行处理）
    const excelStartTime = Date.now();
    const inputData = await readExcel(file);
    console.log(`Excel 读取耗时: ${Date.now() - excelStartTime}ms, 数据量: ${inputData.length} 条`);

    if (inputData.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Excel 文件中没有找到有效数据',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        }
      );
    }

    // 3. 获取地址匹配器（使用缓存）
    const matcherStartTime = Date.now();
    const matcher = await getMatcher();
    console.log(`匹配器获取耗时: ${Date.now() - matcherStartTime}ms`);

    // 4. 批量匹配地址（优化处理）
    const results = await batchMatchParallel(matcher, inputData);

    // 5. 构建响应
    const response: ApiResponse<{
      results: AddressMatchResult[];
      originalInputs: typeof inputData;
      performance?: {
        totalTime: number;
        excelReadTime: number;
        matchTime: number;
      };
    }> = {
      success: true,
      data: {
        results,
        originalInputs: inputData,
      },
      message: `成功处理 ${results.length} 条地址数据`,
    };

    const totalTime = Date.now() - requestStartTime;
    console.log(`请求总耗时: ${totalTime}ms`);

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    });
  } catch (error) {
    const totalTime = Date.now() - requestStartTime;
    console.error(`API 处理失败 (耗时 ${totalTime}ms):`, error);
    
    const errorResponse: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : '服务器内部错误',
    };
    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    });
  }
}

/**
 * GET /api/upload - 获取健康检查
 */
export async function onRequestGet() {
  const response: ApiResponse = {
    success: true,
    message: '地址映射 API 运行正常',
  };
  return new Response(JSON.stringify(response), {
    status: 200,
    headers: { 'Content-Type': 'application/json; charset=UTF-8' },
  });
}

