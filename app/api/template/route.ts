/**
 * 下载模板 Excel 文件 API
 * @author sgz
 * @since 2025-11-28
 */

import { NextResponse } from 'next/server';
import { generateTemplateExcel } from '@/lib/excel';

/**
 * GET /api/template - 下载模板文件
 */
export async function GET() {
  try {
    const buffer = generateTemplateExcel();

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="address-template.xlsx"',
      },
    });
  } catch (error) {
    console.error('模板生成失败:', error);
    return NextResponse.json(
      { success: false, error: '模板生成失败' },
      { status: 500 }
    );
  }
}

