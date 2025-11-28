/**
 * 文件上传和地址匹配 API
 * @author sgz
 * @since 2025-01-29
 */

import { NextRequest, NextResponse } from 'next/server';
import { readExcel, writeExcel } from '@/lib/excel';
import { AddressMatcher, loadAddressData } from '@/lib/address-matcher';
import type { ApiResponse, AddressMatchResult } from '@/lib/types';

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
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '未找到上传文件' },
        { status: 400 }
      );
    }

    // 验证文件类型
    if (!file.name.match(/\.(xlsx?|xlsm)$/i)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '文件格式不正确，请上传 Excel 文件（.xls, .xlsx, .xlsm）' },
        { status: 400 }
      );
    }

    // 读取 Excel 文件
    const inputData = await readExcel(file);

    if (inputData.length === 0) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Excel 文件中没有找到有效数据' },
        { status: 400 }
      );
    }

    // 获取地址匹配器
    const matcher = await getMatcher();

    // 批量匹配地址
    const results: AddressMatchResult[] = matcher.batchMatch(inputData);

    // 返回匹配结果和原始输入数据（用于构建下拉选项）
    return NextResponse.json<ApiResponse<{
      results: AddressMatchResult[];
      originalInputs: typeof inputData;
    }>>({
      success: true,
      data: {
        results,
        originalInputs: inputData,
      },
      message: `成功处理 ${results.length} 条地址数据`,
    });
  } catch (error) {
    console.error('API 处理失败:', error);
    return NextResponse.json<ApiResponse>(
      { 
        success: false, 
        error: error instanceof Error ? error.message : '服务器内部错误' 
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/upload - 获取健康检查
 */
export async function GET() {
  return NextResponse.json<ApiResponse>({
    success: true,
    message: '地址映射 API 运行正常',
  });
}

