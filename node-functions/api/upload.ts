/**
 * 文件上传和地址匹配 Node Function
 * @author sgz
 * @since 2025-01-29
 */

import { readExcel } from '../../lib/excel';
import { AddressMatcher, loadAddressData } from '../../lib/address-matcher';
import type { ApiResponse, AddressMatchResult } from '../../lib/types';
import type { EventContext } from '../types';

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
 * POST /api/upload - 上传 Excel 文件并处理
 */
export async function onRequestPost(context: EventContext) {
  try {
    const { request } = context;
    const formData = await request.formData();
    const file = formData.get('file') as File;

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

    // 读取 Excel 文件
    const inputData = await readExcel(file);

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

    // 获取地址匹配器
    const matcher = await getMatcher();

    // 批量匹配地址
    const results: AddressMatchResult[] = matcher.batchMatch(inputData);

    // 返回匹配结果和原始输入数据（用于构建下拉选项）
    const response: ApiResponse<{
      results: AddressMatchResult[];
      originalInputs: typeof inputData;
    }> = {
      success: true,
      data: {
        results,
        originalInputs: inputData,
      },
      message: `成功处理 ${results.length} 条地址数据`,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    });
  } catch (error) {
    console.error('API 处理失败:', error);
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

