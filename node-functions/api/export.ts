/**
 * 导出 Excel 文件 Node Function
 * @author sgz
 * @since 2025-01-29
 */

import { writeExcel } from '../../lib/excel';
import type { ApiResponse, OutputAddressData } from '../../lib/types';
import type { EventContext } from '../types';

/**
 * POST /api/export - 导出匹配结果为 Excel
 */
export async function onRequestPost(context: EventContext) {
  try {
    const { request } = context;
    const body = await request.json();
    const { results } = body;

    if (!results || !Array.isArray(results)) {
      const errorResponse: ApiResponse = {
        success: false,
        error: '无效的导出数据',
      };
      return new Response(JSON.stringify(errorResponse), {
        status: 400,
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      });
    }

    // 提取输出数据
    const outputData: OutputAddressData[] = results.map(
      (item: any) => item.output
    );

    // 生成 Excel 文件
    const buffer = writeExcel(outputData, 'address-mapping-result');

    // 返回文件（将 Buffer 转换为 Uint8Array）
    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="address-mapping-result-${Date.now()}.xlsx"`,
      },
    });
  } catch (error) {
    console.error('导出失败:', error);
    const errorResponse: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : '导出失败',
    };
    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    });
  }
}

