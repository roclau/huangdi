/**
 * Cloudflare Workers 后端
 * 替代原 Express 服务器，提供相同的 API 接口
 */

export interface Env {
    DB: D1Database;
}

// CORS 头部配置
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

// 处理 CORS 预检请求
function handleOptions() {
    return new Response(null, { headers: corsHeaders });
}

// 创建 JSON 响应
function jsonResponse(data: any, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
        },
    });
}

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url);
        const path = url.pathname;
        const method = request.method;

        // 处理 CORS 预检
        if (method === 'OPTIONS') {
            return handleOptions();
        }

        try {
            // ==================== 皇帝相关 ====================
            if (path === '/api/emperor' && method === 'GET') {
                const emperor = await env.DB.prepare('SELECT * FROM emperor LIMIT 1').first();
                return jsonResponse(emperor || {});
            }

            // ==================== 妃子相关 ====================
            if (path === '/api/concubines' && method === 'GET') {
                const { results } = await env.DB.prepare(
                    'SELECT * FROM concubines WHERE is_in_cold_palace = 0 ORDER BY favor DESC'
                ).all();
                return jsonResponse(results);
            }

            // ==================== 子嗣相关 ====================
            if (path === '/api/children' && method === 'GET') {
                const { results } = await env.DB.prepare(`
          SELECT c.*, con.name as mother_name 
          FROM children c 
          LEFT JOIN concubines con ON c.mother_id = con.id
        `).all();
                return jsonResponse(results);
            }

            // ==================== 设置相关 ====================
            if (path === '/api/settings' && method === 'GET') {
                const { results } = await env.DB.prepare('SELECT * FROM settings').all();
                return jsonResponse(results);
            }

            if (path === '/api/settings' && method === 'POST') {
                const { id, value } = await request.json() as any;
                await env.DB.prepare('UPDATE settings SET value = ? WHERE id = ?').bind(value, id).run();
                return jsonResponse({ success: true });
            }

            // ==================== 朝代列表 ====================
            if (path === '/api/dynasties' && method === 'GET') {
                const { results } = await env.DB.prepare(
                    'SELECT DISTINCT dynasty FROM historical_pool WHERE dynasty IS NOT NULL ORDER BY dynasty'
                ).all();
                return jsonResponse(results.map((r: any) => r.dynasty));
            }

            // ==================== 选秀相关 ====================
            if (path === '/api/selection/candidates' && method === 'GET') {
                const dynasty = url.searchParams.get('dynasty');
                return await handleSelectionCandidates(env.DB, dynasty);
            }

            if (path === '/api/selection/batch-join' && method === 'POST') {
                const { candidates } = await request.json() as any;
                return await handleBatchJoin(env.DB, candidates);
            }

            if (path === '/api/selection/manual' && method === 'POST') {
                const { name } = await request.json() as any;
                return await handleManualSelection(env.DB, name);
            }

            // ==================== 游戏逻辑 ====================
            if (path === '/api/game/next-day' && method === 'POST') {
                return await handleNextDay(env.DB);
            }

            // ==================== 临幸相关 ====================
            if (path === '/api/favored' && method === 'POST') {
                const body = await request.json() as any;
                return await handleFavored(env.DB, body);
            }

            // ==================== 冷宫 ====================
            if (path.startsWith('/api/concubines/') && method === 'DELETE') {
                const id = path.split('/').pop();
                await env.DB.prepare('UPDATE concubines SET is_in_cold_palace = 1 WHERE id = ?').bind(id).run();
                return jsonResponse({ success: true, message: '已将其打入冷宫，从此萧郎是路人。' });
            }

            // ==================== 管理后台 ====================
            if (path === '/api/admin/pool' && method === 'GET') {
                const dynasty = url.searchParams.get('dynasty');
                const name = url.searchParams.get('name');

                let sql = 'SELECT * FROM historical_pool';
                const conditions: string[] = [];
                const params: any[] = [];

                if (name) {
                    conditions.push('name LIKE ?');
                    params.push(`%${name}%`);
                }
                if (dynasty) {
                    conditions.push('dynasty = ?');
                    params.push(dynasty);
                }

                if (conditions.length > 0) {
                    sql += ' WHERE ' + conditions.join(' AND ');
                }
                sql += ' ORDER BY id DESC';

                const { results } = await env.DB.prepare(sql).bind(...params).all();
                return jsonResponse(results);
            }

            if (path === '/api/admin/pool' && method === 'POST') {
                const { id, name, beauty, personality, avatar_url, description, base_age, dynasty } = await request.json() as any;

                if (id) {
                    await env.DB.prepare(`
            UPDATE historical_pool 
            SET name = ?, beauty = ?, personality = ?, avatar_url = ?, description = ?, base_age = ?, dynasty = ?
            WHERE id = ?
          `).bind(name, beauty, personality, avatar_url, description, base_age || 16, dynasty, id).run();
                } else {
                    await env.DB.prepare(`
            INSERT INTO historical_pool (name, beauty, personality, avatar_url, description, base_age, dynasty)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).bind(name, beauty, personality, avatar_url, description, base_age || 16, dynasty).run();
                }

                return jsonResponse({ success: true });
            }

            if (path.startsWith('/api/admin/pool/') && method === 'DELETE') {
                const id = path.split('/').pop();
                await env.DB.prepare('DELETE FROM historical_pool WHERE id = ?').bind(id).run();
                return jsonResponse({ success: true });
            }

            // 404
            return jsonResponse({ error: 'Not Found' }, 404);

        } catch (error: any) {
            console.error('Worker Error:', error);
            return jsonResponse({ error: error.message || 'Internal Server Error' }, 500);
        }
    },
};

// ==================== 辅助函数 ====================

async function handleSelectionCandidates(db: D1Database, dynasty: string | null) {
    const candidates: any[] = [];
    const pickedNames = new Set<string>();

    // 获取历史名妃概率
    const historicalChance = await db.prepare('SELECT value FROM settings WHERE id = ?').bind('historical_chance').first() as any;
    const hChance = historicalChance?.value || 0.3;

    // 如果指定了朝代，优先从该朝代抽取
    if (dynasty && dynasty !== '全部') {
        const { results } = await db.prepare(`
      SELECT *, COALESCE(base_age, 16) as age FROM historical_pool 
      WHERE dynasty = ?
      AND name NOT IN (SELECT name FROM concubines WHERE is_in_cold_palace = 0)
      ORDER BY RANDOM()
    `).bind(dynasty).all();

        for (const one of results) {
            if (pickedNames.size >= 10) break;
            if (pickedNames.has(one.name)) continue;

            (one as any).is_historical = 1;
            (one as any).pool_id = one.id;
            pickedNames.add(one.name);
            candidates.push(one);
        }
    }

    // 填补剩余位置
    for (let i = 0; pickedNames.size < 10 && i < 50; i++) {
        let one: any = null;

        if (dynasty && dynasty !== '全部') {
            // 朝代模式：用随机角色填补
            one = generateRandomConcubine();
            if (pickedNames.has(one.name)) continue;
        } else {
            // 全部模式：按概率抽取
            if (Math.random() < hChance) {
                const pickedNamesArray = Array.from(pickedNames);
                const placeholders = pickedNamesArray.map(() => '?').join(',');
                const query = `
          SELECT *, COALESCE(base_age, 16) as age FROM historical_pool 
          WHERE name NOT IN (SELECT name FROM concubines WHERE is_in_cold_palace = 0)
          ${pickedNamesArray.length > 0 ? `AND name NOT IN (${placeholders})` : ''}
          ORDER BY RANDOM() LIMIT 1
        `;

                one = await db.prepare(query).bind(...pickedNamesArray).first();
                if (one) {
                    (one as any).is_historical = 1;
                    (one as any).pool_id = one.id;
                }
            }

            if (!one) {
                one = generateRandomConcubine();
                if (pickedNames.has(one.name)) continue;
            } else {
                if (pickedNames.has(one.name)) continue;
            }
        }

        pickedNames.add(one.name);
        candidates.push(one);
    }

    return jsonResponse(candidates);
}

function generateRandomConcubine() {
    const lastNames = ['赵', '钱', '孙', '李', '周', '吴', '郑', '王', '冯', '陈', '楚', '卫', '蒋', '沈', '韩', '杨'];
    const firstNames = ['婉儿', '灵儿', '巧儿', '梦儿', '雪儿', '如意', '春晓', '紫萱', '白曼', '静雅'];
    const personalities = ['活泼', '内敛', '温柔', '高冷', '娇媚', '端庄'];

    const randomPersonality = personalities[Math.floor(Math.random() * personalities.length)];
    const descriptions: Record<string, string[]> = {
        '活泼': ['语速极快且爱笑，总是能给严肃的深宫带来活力。'],
        '内敛': ['总是低头摆弄衣角，声音如蚊呐，却有着一颗坚韧的心。'],
        '温柔': ['眼神如一潭深水，举手投足间尽显母仪天下的温婉风范。'],
        '高冷': ['不假辞色，如高岭之花般令人不敢直视。'],
        '娇媚': ['行走间香风阵阵，眼神勾魂夺魄，举止间风情万种。'],
        '端庄': ['坐立行走皆合法度，处事从容淡定，大有主位之姿。']
    };

    return {
        name: lastNames[Math.floor(Math.random() * lastNames.length)] + firstNames[Math.floor(Math.random() * firstNames.length)],
        beauty: Math.floor(Math.random() * 40) + 55,
        personality: randomPersonality,
        description: descriptions[randomPersonality][0],
        avatar_url: '',
        is_historical: 0,
        pool_id: null,
        dynasty: '随机',
        age: Math.floor(Math.random() * 5) + 16
    };
}

async function handleBatchJoin(db: D1Database, candidates: any[]) {
    if (!candidates || candidates.length === 0 || candidates.length > 3) {
        return jsonResponse({ error: '请选择 1-3 名佳丽入宫' }, 400);
    }

    for (const c of candidates) {
        await db.prepare(`
      INSERT INTO concubines (name, beauty, personality, avatar_url, is_historical, pool_id, current_cycle_day, description, dynasty, age)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
            c.name, c.beauty, c.personality, c.avatar_url, c.is_historical, c.pool_id,
            Math.floor(Math.random() * 28) + 1, c.description, c.dynasty, c.age
        ).run();
    }

    return jsonResponse({ success: true, message: `已将 ${candidates.length} 名佳丽纳入后宫。` });
}

async function handleManualSelection(db: D1Database, name: string) {
    if (!name) return jsonResponse({ error: '必须输入姓名' }, 400);

    const exists = await db.prepare('SELECT id FROM concubines WHERE name = ? AND is_in_cold_palace = 0').bind(name).first();
    if (exists) {
        return jsonResponse({ error: `佳人 ${name} 已在后宫之中。` }, 400);
    }

    const template = await db.prepare('SELECT * FROM historical_pool WHERE name = ?').bind(name).first();
    if (!template) {
        return jsonResponse({ error: `名册中寻不到名为 ${name} 的佳人，请确认姓名无误。` }, 400);
    }

    await db.prepare(`
    INSERT INTO concubines (name, beauty, personality, avatar_url, is_historical, pool_id, current_cycle_day, description, dynasty)
    VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?)
  `).bind(
        template.name, template.beauty, template.personality, template.avatar_url,
        template.id, Math.floor(Math.random() * 28) + 1, template.description, template.dynasty
    ).run();

    return jsonResponse({ success: true, concubine: template });
}

async function handleNextDay(db: D1Database) {
    const emperor = await db.prepare('SELECT * FROM emperor LIMIT 1').first() as any;
    const staminaGain = await db.prepare('SELECT value FROM settings WHERE id = ?').bind('stamina_gain_rest').first() as any;

    let { day, month, year } = emperor;
    day++;
    if (day > 30) {
        day = 1;
        month++;
        if (month > 12) {
            month = 1;
            year++;
        }
    }

    await db.prepare('UPDATE emperor SET day = ?, month = ?, year = ?, stamina = MIN(100, stamina + ?)').bind(
        day, month, year, staminaGain?.value || 20
    ).run();

    await db.prepare('UPDATE concubines SET current_cycle_day = (current_cycle_day % cycle_length) + 1').run();

    // 处理孕期
    const { results: pregnantConcubines } = await db.prepare('SELECT * FROM concubines WHERE is_pregnant = 1').all();
    for (const con of pregnantConcubines) {
        const newPregDays = (con as any).pregnancy_days + 1;
        if (newPregDays >= 30) {
            const gender = Math.random() > 0.5 ? '皇子' : '公主';
            const childName = `${gender}-${Math.floor(Math.random() * 1000)}`;

            await db.prepare(`
        INSERT INTO children (mother_id, name, gender, birth_year, birth_month, birth_day)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(con.id, childName, gender, year, month, day).run();

            await db.prepare(`
        UPDATE concubines 
        SET is_pregnant = 0, pregnancy_days = 0, children_count = children_count + 1
        WHERE id = ?
      `).bind(con.id).run();
        } else {
            await db.prepare('UPDATE concubines SET pregnancy_days = ? WHERE id = ?').bind(newPregDays, con.id).run();
        }
    }

    return jsonResponse({ success: true, newDate: { year, month, day } });
}

async function handleFavored(db: D1Database, body: any) {
    const { concubineId, step, action, location } = body;

    const emperor = await db.prepare('SELECT * FROM emperor LIMIT 1').first() as any;
    const concubine = await db.prepare('SELECT * FROM concubines WHERE id = ?').bind(concubineId).first() as any;

    if (!concubine) return jsonResponse({ error: '找不到该妃子' }, 400);

    const settings = await db.prepare('SELECT * FROM settings').all();
    const getSetting = (id: string) => (settings.results as any[]).find(s => s.id === id)?.value || 0;

    let currentStage: string = 'normal';
    if (concubine.is_pregnant) {
        currentStage = 'pregnant';
    } else if (concubine.current_cycle_day <= 5) {
        currentStage = 'menstruation';
    } else if (concubine.current_cycle_day >= 13 && concubine.current_cycle_day <= 17) {
        currentStage = 'ovulation';
    }

    // 注意：完整的交互文本需要从 server/data/interactions.ts 移植
    // 这里仅提供框架，实际部署时需要完整导入

    if (step === 'init') {
        const staminaCost = getSetting('stamina_cost_favored') || 20;
        if (emperor.stamina < staminaCost) {
            return jsonResponse({ error: `体力不足，召见需消耗 ${staminaCost} 点体力` }, 400);
        }

        await db.prepare('UPDATE emperor SET stamina = stamina - ?').bind(staminaCost).run();

        // 简化版文本，实际应从 interactions.ts 导入
        const text = `${concubine.name}恭迎陛下圣驾...`;
        return jsonResponse({ step: 'foreplay', text, currentStage });
    }

    if (step === 'action') {
        if ((currentStage === 'menstruation' || currentStage === 'pregnant') && action === 'penetration') {
            return jsonResponse({ error: '当前身体状况不适合进行此动作' }, 400);
        }
        const text = `${concubine.name}正在为陛下服务...`;
        return jsonResponse({ step: 'action_desc', text });
    }

    if (step === 'finish') {
        if (location === 'inside' && (currentStage === 'menstruation' || currentStage === 'pregnant')) {
            return jsonResponse({ error: '此时身子不便，不可灌入体内' }, 400);
        }

        const text = `${concubine.name}承受了陛下的恩泽...`;
        let pregnancyTriggered = false;

        if (location === 'inside' && !concubine.is_pregnant) {
            let pregChance = getSetting('preg_chance_normal');
            if (currentStage === 'ovulation') pregChance = getSetting('preg_chance_ovulation');

            if (Math.random() < pregChance) {
                await db.prepare('UPDATE concubines SET is_pregnant = 1, pregnancy_days = 0 WHERE id = ?').bind(concubineId).run();
                pregnancyTriggered = true;
            }
        }

        await db.prepare('UPDATE concubines SET favor = favor + 5, closeness = closeness + 3 WHERE id = ?').bind(concubineId).run();
        return jsonResponse({ step: 'finish_desc', text, pregnancyTriggered });
    }

    return jsonResponse({ error: '无效的交互步骤' }, 400);
}
