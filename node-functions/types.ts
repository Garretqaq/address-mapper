/**
 * Node Functions 类型定义
 * @author sgz
 * @since 2025-01-29
 */

/**
 * EdgeOne Node Functions EventContext
 * 参考：https://edgeone.cloud.tencent.com/pages/document/184787642236784640#5b626ca7-c1f5-4058-b448-a88cdc65a0f0
 */
export interface EventContext {
  /** EO-LOG-UUID 代表了 EO 请求的唯一标识符 */
  uuid: string;
  /** 动态路由参数值 */
  params: Record<string, string>;
  /** Pages 环境变量 */
  env: Record<string, string>;
  /** 客户端 IP 地址 */
  clientIp: string;
  /** 服务器信息 */
  server: {
    /** 部署地的区域编码 */
    region: string;
    /** 请求 ID，用于日志跟踪 */
    requestId: string;
  };
  /** 客户端地理位置信息 */
  geo: {
    country?: string;
    region?: string;
    city?: string;
  };
  /** Web Platform Request 对象 */
  request: Request;
}

