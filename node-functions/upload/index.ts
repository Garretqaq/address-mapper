/**
 * 文件上传和地址匹配 Node Function
 * 支持更长的执行时间，适合处理大量数据
 * @author sgz
 * @since 2025-01-29
 */

import { readExcel } from '../../lib/excel';
import { AddressMatcher, loadAddressData } from '../../lib/address-matcher';
import type { ApiResponse, AddressMatchResult } from '../../lib/types';

// 全局缓存地址匹配器
let cachedMatcher: AddressMatcher | null = null;

/**
 * 获取或创建地址匹配器
 */
async function getMatcher(): Promise<AddressMatcher> {
  if (!cachedMatcher) {
    const addressData = await loadAddressData();
    cachedMatcher = new AddressMatcher(addressData);
  }
  return cachedMatcher;
}


/**
 * Node Function 入口
 */
export async function onRequest(context: {
  request: Request;
  env: Record<string, any>;
  params: Record<string, string>;
}) {
  const { request } = context;

  // 处理 OPTIONS 请求（CORS 预检）
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  // 只处理 POST 请求
  if (request.method !== 'POST') {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Method not allowed',
      } as ApiResponse),
      {
        status: 405,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return new Response(
        JSON.stringify({
          success: false,
          error: '未找到上传文件',
        } as ApiResponse),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // 验证文件类型
    if (!file.name.match(/\.(xlsx?|xlsm)$/i)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: '文件格式不正确，请上传 Excel 文件（.xls, .xlsx, .xlsm）',
        } as ApiResponse),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // 读取 Excel 文件
    const inputData = await readExcel(file);

    if (inputData.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Excel 文件中没有找到有效数据',
        } as ApiResponse),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // 获取地址匹配器
    const matcher = await getMatcher();

    // 使用公共的 batchMatch 方法进行批量匹配
    // Node Functions 支持更长的执行时间，可以处理大量数据
    const results: AddressMatchResult[] = matcher.batchMatch(inputData);

    // 返回匹配结果和原始输入数据
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          results,
          originalInputs: inputData,
        },
        message: `成功处理 ${results.length} 条地址数据`,
      } as ApiResponse<{
        results: AddressMatchResult[];
        originalInputs: typeof inputData;
      }>),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (error) {
    console.error('Node Function 处理失败:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : '服务器内部错误',
      } as ApiResponse),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
}

