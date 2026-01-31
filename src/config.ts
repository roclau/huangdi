/**
 * API 配置文件
 * 用于统一管理前端 API 地址
 */

// 根据环境自动切换 API 地址
export const API_BASE_URL = import.meta.env.PROD
    ? import.meta.env.VITE_API_URL || 'https://your-worker-name.workers.dev'
    : 'http://localhost:3001';

// 导出完整的 API 路径
export const API = {
    // 皇帝
    emperor: `${API_BASE_URL}/api/emperor`,

    // 妃子
    concubines: `${API_BASE_URL}/api/concubines`,
    deleteConcubine: (id: number) => `${API_BASE_URL}/api/concubines/${id}`,

    // 子嗣
    children: `${API_BASE_URL}/api/children`,

    // 设置
    settings: `${API_BASE_URL}/api/settings`,

    // 朝代
    dynasties: `${API_BASE_URL}/api/dynasties`,

    // 选秀
    selectionCandidates: (dynasty?: string) =>
        dynasty ? `${API_BASE_URL}/api/selection/candidates?dynasty=${encodeURIComponent(dynasty)}`
            : `${API_BASE_URL}/api/selection/candidates`,
    selectionBatchJoin: `${API_BASE_URL}/api/selection/batch-join`,
    selectionManual: `${API_BASE_URL}/api/selection/manual`,

    // 游戏逻辑
    nextDay: `${API_BASE_URL}/api/game/next-day`,
    favored: `${API_BASE_URL}/api/favored`,

    // 管理后台
    adminPool: `${API_BASE_URL}/api/admin/pool`,
    deletePoolItem: (id: number) => `${API_BASE_URL}/api/admin/pool/${id}`,
};

// 使用示例：
// import { API } from './config';
// fetch(API.emperor)
// fetch(API.selectionCandidates('唐'))
