/**
 * 下载模板 Excel 文件 Node Function
 * @author sgz
 * @since 2025-01-29
 */

import { generateTemplateExcel } from '../../lib/excel';

/**
 * GET /api/template - 下载模板文件
 */
export async function onRequestGet() {
  try {
    const buffer = generateTemplateExcel();

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="address-template.xlsx"',
      },
    });
  } catch (error) {
    console.error('模板生成失败:', error);
    return new Response(
      JSON.stringify({ success: false, error: '模板生成失败' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      }
    );
  }
}

