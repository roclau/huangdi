import express from 'express';
import cors from 'cors';
import { initDB } from './db';
import db from './db';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// 初始化数据库
initDB();

// 获取皇上状态
app.get('/api/emperor', (req, res) => {
    const emperor = db.prepare('SELECT * FROM emperor LIMIT 1').get();
    res.json(emperor);
});

// 获取妃子列表
app.get('/api/concubines', (req, res) => {
    const concubines = db.prepare('SELECT * FROM concubines WHERE is_in_cold_palace = 0').all();
    res.json(concubines);
});

// 获取子女列表
app.get('/api/children', (req, res) => {
    const children = db.prepare(`
        SELECT children.*, concubines.name as mother_name 
        FROM children 
        LEFT JOIN concubines ON children.mother_id = concubines.id
    `).all();
    res.json(children);
});

// --- 全局设置 (Settings) ---
app.get('/api/settings', (req, res) => {
    const settings = db.prepare('SELECT * FROM settings').all();
    res.json(settings);
});

app.post('/api/settings', (req, res) => {
    const { id, value } = req.body;
    db.prepare('UPDATE settings SET value = ? WHERE id = ?').run(value, id);
    res.json({ success: true });
});


// --- 历史名妃池管理 (Admin) ---
// 获取卡池列表 (支持搜索和筛选)
app.get('/api/admin/pool', (req, res) => {
    const { name, dynasty } = req.query;
    let sql = 'SELECT * FROM historical_pool';
    const params: any[] = [];

    const conditions = [];
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
    const pool = db.prepare(sql).all(...params);
    res.json(pool);
});

// 获取所有朝代列表
app.get('/api/dynasties', (req, res) => {
    const dynasties = db.prepare('SELECT DISTINCT dynasty FROM historical_pool WHERE dynasty IS NOT NULL ORDER BY dynasty').all() as any[];
    res.json(dynasties.map(d => d.dynasty));
});

// 新增或更新名妃
app.post('/api/admin/pool', (req, res) => {
    const { id, name, beauty, personality, avatar_url, description, base_age, dynasty } = req.body;
    if (id) {
        // 更新名妃池
        db.prepare(`
            UPDATE historical_pool 
            SET name = ?, beauty = ?, personality = ?, avatar_url = ?, description = ?, base_age = ?, dynasty = ?
            WHERE id = ?
        `).run(name, beauty, personality, avatar_url, description, base_age, dynasty, id);

        // 同步更新已经入宫的对应名妃
        db.prepare(`
            UPDATE concubines
            SET name = ?, beauty = ?, personality = ?, avatar_url = ?, description = ?, dynasty = ?
            WHERE pool_id = ? AND is_historical = 1
        `).run(name, beauty, personality, avatar_url, description, dynasty, id);
    } else {
        // 新增
        db.prepare(`
            INSERT INTO historical_pool (name, beauty, personality, avatar_url, description, base_age, dynasty)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(name, beauty, personality, avatar_url, description, base_age || 16, dynasty);
    }
    res.json({ success: true });
});

// 删除名妃
app.delete('/api/admin/pool/:id', (req, res) => {
    db.prepare('DELETE FROM historical_pool WHERE id = ?').run(req.params.id);
    res.json({ success: true });
});

// 获取所有可用头像资源
app.get('/api/admin/avatars', (req, res) => {
    const assetsDir = path.join(__dirname, '../public/assets/concubines');
    try {
        if (!fs.existsSync(assetsDir)) {
            return res.json([]);
        }
        const files = fs.readdirSync(assetsDir)
            .filter((file: string) => /\.(png|jpg|jpeg|webp)$/i.test(file));
        res.json(files.map((file: string) => `assets/concubines/${file}`));
    } catch (err) {
        res.status(500).json({ error: '无法读取头像目录' });
    }
});

// 保存裁剪后的头像
app.post('/api/admin/upload-cropped', (req, res) => {
    const { imageData, fileName } = req.body;
    if (!imageData) return res.status(400).json({ error: '缺失图片数据' });

    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, 'base64');

    const saveName = `cropped_${Date.now()}_${fileName || 'avatar.png'}`;
    const savePath = path.join(__dirname, '../public/uploads', saveName);

    try {
        fs.writeFileSync(savePath, buffer);
        res.json({ url: `uploads/${saveName}` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: '保存图片失败' });
    }
});

// --- 游戏核心逻辑 (Game) ---

// 进入下一日 (核心递增逻辑)
app.post('/api/game/next-day', (req, res) => {
    const transaction = db.transaction(() => {
        // 1. 推进日期
        const emp = db.prepare('SELECT * FROM emperor LIMIT 1').get() as any;
        const staminaGain = db.prepare('SELECT value FROM settings WHERE id = ?').get('stamina_gain_rest') as any;

        let { day, month, year } = emp;
        day++;
        if (day > 30) {
            day = 1;
            month++;
            if (month > 12) {
                month = 1;
                year++;
            }
        }
        db.prepare('UPDATE emperor SET day = ?, month = ?, year = ?, stamina = MIN(100, stamina + ?)').run(day, month, year, staminaGain?.value || 20);

        // 2. 推进所有妃子的生理周期
        db.prepare(`
            UPDATE concubines 
            SET current_cycle_day = (current_cycle_day % cycle_length) + 1
        `).run();

        // 3. 推进孕期与生育判定
        const pregnantConcubines = db.prepare('SELECT * FROM concubines WHERE is_pregnant = 1').all() as any[];
        for (const con of pregnantConcubines) {
            const newPregDays = con.pregnancy_days + 1;
            if (newPregDays >= 30) {
                // 生育逻辑
                const gender = Math.random() > 0.5 ? '皇子' : '公主';
                const childName = `${gender}-${Math.floor(Math.random() * 1000)}`; // 临时命名，后续可改进
                db.prepare(`
                    INSERT INTO children (mother_id, name, gender, birth_year, birth_month, birth_day)
                    VALUES (?, ?, ?, ?, ?, ?)
                `).run(con.id, childName, gender, year, month, day);

                db.prepare(`
                    UPDATE concubines 
                    SET is_pregnant = 0, pregnancy_days = 0, children_count = children_count + 1
                    WHERE id = ?
                `).run(con.id);
            } else {
                db.prepare('UPDATE concubines SET pregnancy_days = ? WHERE id = ?').run(newPregDays, con.id);
            }
        }

        return { success: true, newDate: { year, month, day } };
    });

    try {
        const result = transaction();
        res.json(result);
    } catch (err: any) {
        res.status(400).json({ error: err.message });
    }
});

// 打入冷宫 (逻辑软删除)
app.delete('/api/concubines/:id', (req, res) => {
    try {
        const result = db.prepare('UPDATE concubines SET is_in_cold_palace = 1 WHERE id = ?').run(req.params.id);
        if (result.changes === 0) {
            return res.status(404).json({ error: '找不到该佳丽' });
        }
        res.json({ success: true, message: '已将其打入冷宫，从此萧郎是路人。' });
    } catch (err: any) {
        console.error('打入冷宫失败:', err);
        res.status(500).json({ error: '内务府执行出错：' + err.message });
    }
});

import { interactionData, CycleStage } from './data/interactions';

// 临幸妃子 (支持分阶段交互)
app.post('/api/favored', (req, res) => {
    const { concubineId, step, action, location } = req.body;

    const transaction = db.transaction(() => {
        const emperor = db.prepare('SELECT * FROM emperor LIMIT 1').get() as any;
        const concubine = db.prepare('SELECT * FROM concubines WHERE id = ?').get(concubineId) as any;

        if (!concubine) throw new Error('找不到该妃子');

        // 获取设置
        const settings = db.prepare('SELECT * FROM settings').all() as any[];
        const getSetting = (id: string) => settings.find(s => s.id === id)?.value || 0;

        // 计算当前周期阶段 (整合怀孕状态)
        let currentStage: CycleStage = 'normal';
        if (concubine.is_pregnant) {
            currentStage = 'pregnant';
        } else if (concubine.current_cycle_day <= 5) {
            currentStage = 'menstruation';
        } else if (concubine.current_cycle_day >= 13 && concubine.current_cycle_day <= 17) {
            currentStage = 'ovulation';
        }

        // --- 逻辑处理 ---
        if (step === 'init') {
            const staminaCost = getSetting('stamina_cost_favored') || 20;
            if (emperor.stamina < staminaCost) {
                throw new Error(`体力不足，召见需消耗 ${staminaCost} 点体力`);
            }
            // 扣除体力
            db.prepare('UPDATE emperor SET stamina = stamina - ?').run(staminaCost);
            // 随机选一个前戏
            const scripts = interactionData.foreplay[currentStage];
            const text = scripts[Math.floor(Math.random() * scripts.length)].replace(/{name}/g, concubine.name);

            return { step: 'foreplay', text, currentStage };

        } else if (step === 'action') {
            // 动作校验 (排卵期/孕期/经期 限制由前端控制显示，后端做个基本校验)
            if ((currentStage === 'menstruation' || currentStage === 'pregnant') && action === 'penetration') {
                throw new Error('当前身体状况不适合进行此动作');
            }
            const scripts = interactionData.actions[action as keyof typeof interactionData.actions];
            const text = scripts[Math.floor(Math.random() * scripts.length)].replace(/{name}/g, concubine.name);

            return { step: 'action_desc', text };

        } else if (step === 'finish') {
            const scripts = interactionData.ejaculation[location as keyof typeof interactionData.ejaculation];
            if (location === 'inside' && (currentStage === 'menstruation' || currentStage === 'pregnant')) {
                throw new Error('此时身子不便，不可灌入体内');
            }
            const text = scripts[Math.floor(Math.random() * scripts.length)].replace(/{name}/g, concubine.name);

            // 怀孕判定 (只有在里面且没怀孕时)
            let pregnancyTriggered = false;
            if (location === 'inside' && !concubine.is_pregnant) {
                let pregChance = getSetting('preg_chance_normal');
                if (currentStage === 'ovulation') pregChance = getSetting('preg_chance_ovulation');

                if (Math.random() < pregChance) {
                    db.prepare('UPDATE concubines SET is_pregnant = 1, pregnancy_days = 0 WHERE id = ?').run(concubineId);
                    pregnancyTriggered = true;
                }
            }

            // 更新宠爱度
            db.prepare('UPDATE concubines SET favor = favor + 5, closeness = closeness + 3 WHERE id = ?').run(concubineId);

            return { step: 'finish_desc', text, pregnancyTriggered };
        }

        throw new Error('无效的交互步骤');
    });

    try {
        const result = transaction();
        res.json(result);
    } catch (err: any) {
        res.status(400).json({ error: err.message });
    }
});

// 批量获取选秀候选人 (十连抽数据)
app.get('/api/selection/candidates', (req, res) => {
    const candidates = [];
    const { dynasty } = req.query; // 新增：朝代筛选参数
    const historicalChance = db.prepare('SELECT value FROM settings WHERE id = ?').get('historical_chance') as any;
    const hChance = (historicalChance?.value || 0.3);

    const generateRandom = () => {
        const lastNames = ['赵', '钱', '孙', '李', '周', '吴', '郑', '王', '冯', '陈', '楚', '卫', '蒋', '沈', '韩', '杨', '秦', '尤', '许', '何', '吕', '施', '张', '孔', '曹', '严', '华'];
        const firstNames = ['婉儿', '灵儿', '巧儿', '梦儿', '雪儿', '如意', '春晓', '紫萱', '白曼', '静雅', '若兰', '采薇', '青曼', '幼翠', '友卉', '晓露'];
        const personalities = ['活泼', '内敛', '温柔', '高冷', '娇媚', '端庄'];
        const randomPersonality = personalities[Math.floor(Math.random() * personalities.length)];
        const randomDescriptions: { [key: string]: string[] } = {
            '活泼': ['语速极快且爱笑，总是能给严肃的深宫带来活力。', '喜欢鲜艳的衣裳，动作灵动如林间的小鹿。'],
            '内敛': ['总是低头摆弄衣角，声音如蚊呐，却有着一颗坚韧的心。', '不爱张扬，喜欢在深夜研究古籍。'],
            '温柔': ['眼神如一潭深水，举手投足间尽显母仪天下的温婉风范。', '说话慢条斯理，一双柔荑总能抚平人心中的焦躁。'],
            '高冷': ['不假辞色，如高岭之花般令人不敢直视。', '独来独往，性格孤傲，对权势似乎并无眷恋。'],
            '娇媚': ['行走间香风阵阵，眼神勾魂夺魄，举止间风情万种。', '精通音律，声音酥软，最是懂得如何讨人欢心。'],
            '端庄': ['坐立行走皆合法度，处事从容淡定，大有主位之姿。', '容貌大气，心胸宽广，是众妃学习的楷模。']
        };
        const descs = randomDescriptions[randomPersonality] || ['一位不知名的女子。'];

        return {
            name: lastNames[Math.floor(Math.random() * lastNames.length)] + firstNames[Math.floor(Math.random() * firstNames.length)],
            beauty: Math.floor(Math.random() * 40) + 55,
            personality: randomPersonality,
            description: descs[Math.floor(Math.random() * descs.length)],
            avatar_url: '',
            is_historical: 0,
            pool_id: null,
            dynasty: '随机',
            age: Math.floor(Math.random() * 5) + 16
        };
    };

    const pickedNames = new Set<string>();

    // 如果指定了朝代，优先从该朝代的名妃池中抽取
    if (dynasty && dynasty !== '全部') {
        // 先尝试获取该朝代的所有可用名妃
        const dynastyPool = db.prepare(`
            SELECT *, COALESCE(base_age, 16) as age FROM historical_pool 
            WHERE dynasty = ?
            AND name NOT IN (SELECT name FROM concubines WHERE is_in_cold_palace = 0)
            ORDER BY RANDOM()
        `).all(dynasty) as any[];

        // 从朝代池中随机选取（最多10个）
        for (const one of dynastyPool) {
            if (pickedNames.size >= 10) break;
            if (pickedNames.has(one.name)) continue;

            one.is_historical = 1;
            one.pool_id = one.id;
            pickedNames.add(one.name);
            candidates.push(one);
        }
    }

    // 如果没有指定朝代，或者指定朝代的名妃不足10人，则按原逻辑填补
    for (let i = 0; pickedNames.size < 10 && i < 50; i++) {
        let one: any = null;

        // 如果指定了朝代，则只从该朝代抽取；否则按概率抽取
        if (dynasty && dynasty !== '全部') {
            // 朝代模式下，剩余位置用随机角色填补
            one = generateRandom();
            if (pickedNames.has(one.name)) continue;
        } else {
            // 全部模式：按概率抽取名妃或随机生成
            if (Math.random() < hChance) {
                one = db.prepare(`
                    SELECT *, COALESCE(base_age, 16) as age FROM historical_pool 
                    WHERE name NOT IN (SELECT name FROM concubines WHERE is_in_cold_palace = 0)
                    AND name NOT IN (${Array.from(pickedNames).map(n => `'${n}'`).join(',') || "''"})
                    ORDER BY RANDOM() LIMIT 1
                `).get() as any;
                if (one) {
                    one.is_historical = 1;
                    one.pool_id = one.id;
                }
            }

            if (!one) {
                one = generateRandom();
                if (pickedNames.has(one.name)) continue;
            } else {
                if (pickedNames.has(one.name)) continue;
            }
        }

        pickedNames.add(one.name);
        candidates.push(one);
    }

    res.json(candidates);
});

// 批量入宫
app.post('/api/selection/batch-join', (req, res) => {
    const { candidates } = req.body; // 选中的 1-3 人
    if (!candidates || candidates.length === 0 || candidates.length > 3) {
        return res.status(400).json({ error: '请选择 1-3 名佳丽入宫' });
    }

    const transaction = db.transaction(() => {
        for (const c of candidates) {
            db.prepare(`
                INSERT INTO concubines (name, beauty, personality, avatar_url, is_historical, pool_id, current_cycle_day, description, dynasty, age)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                c.name, c.beauty, c.personality, c.avatar_url, c.is_historical, c.pool_id,
                Math.floor(Math.random() * 28) + 1, c.description, c.dynasty, c.age
            );
        }
    });

    try {
        transaction();
        res.json({ success: true, message: `已将 ${candidates.length} 名佳丽纳入后宫。` });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// 随机选秀 (保持单抽逻辑兼容)
app.post('/api/selection/random', (req, res) => {
    const transaction = db.transaction(() => {
        // 从设置中获取名妃概率
        const historicalChance = db.prepare('SELECT value FROM settings WHERE id = ?').get('historical_chance') as any;
        const isHistorical = Math.random() < (historicalChance?.value || 0.3);

        let newConcubine: any = null;

        if (isHistorical) {
            // 从卡池随机选一个尚未入宫的 (且姓名不重复)
            newConcubine = db.prepare(`
                SELECT *, COALESCE(base_age, 16) as age FROM historical_pool 
                WHERE name NOT IN (SELECT name FROM concubines WHERE is_in_cold_palace = 0)
                ORDER BY RANDOM() LIMIT 1
            `).get() as any;

            if (newConcubine) {
                newConcubine.is_historical = 1;
                newConcubine.pool_id = newConcubine.id;
            }
        }

        if (!newConcubine) {
            // 随机生成
            const lastNames = ['赵', '钱', '孙', '李', '周', '吴', '郑', '王', '冯', '陈', '楚', '卫', '蒋', '沈', '韩', '杨'];
            const firstNames = ['婉儿', '灵儿', '巧儿', '梦儿', '雪儿', '如意', '春晓', '紫萱', '白曼', '静雅'];
            const personalities = ['活泼', '内敛', '温柔', '高冷', '娇媚', '端庄'];

            const randomPersonality = personalities[Math.floor(Math.random() * personalities.length)];
            const randomDescriptions: { [key: string]: string[] } = {
                '活泼': ['言谈间总是带着银铃般的笑声，是个闲不住的机灵鬼。', '性格爽朗奔放，喜欢在大自然中追逐风的脚步。'],
                '内敛': ['平日里沉默寡言，羞涩的脸庞总是在你目光扫过时泛起红晕。', '心思细腻，喜欢一个人静静地待在角落里刺绣。'],
                '温柔': ['眼神中透着脉脉温情，举手投足间尽显江南女子的柔婉。', '说话慢条斯理，总能像春风一样抚慰周围人的心。'],
                '高冷': ['气质清冷如孤山雪莲，拒人于千里之外的外表下不知藏着什么。', '很少露出笑容，那双深邃的双目中似乎透着对世事的审视。'],
                '娇媚': ['一颦一笑皆是风情，眼波流转间仿佛能勾人魂魄。', '身段玲珑剔透，说话声音带着几分慵懒的磁性。'],
                '端庄': ['行止进退皆合宫廷礼法，大家闺秀的典范。', '处事冷静从容，那份稳重让人感到莫名的安心。']
            };

            const descs = randomDescriptions[randomPersonality] || ['一位来自远方的女子，初入宫廷，略显青涩。'];

            newConcubine = {
                name: lastNames[Math.floor(Math.random() * lastNames.length)] + firstNames[Math.floor(Math.random() * firstNames.length)],
                beauty: Math.floor(Math.random() * 40) + 55,
                personality: randomPersonality,
                description: descs[Math.floor(Math.random() * descs.length)],
                avatar_url: '',
                is_historical: 0,
                pool_id: null,
                dynasty: '随机',
                age: Math.floor(Math.random() * 5) + 16
            };
        }

        db.prepare(`
            INSERT INTO concubines (name, beauty, personality, avatar_url, is_historical, pool_id, current_cycle_day, description, dynasty, age)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            newConcubine.name,
            newConcubine.beauty,
            newConcubine.personality,
            newConcubine.avatar_url,
            newConcubine.is_historical,
            newConcubine.pool_id,
            Math.floor(Math.random() * 28) + 1,
            newConcubine.description,
            newConcubine.dynasty || '未知',
            newConcubine.age
        );

        return newConcubine;
    });

    try {
        const result = transaction();
        res.json(result);
    } catch (err: any) {
        res.status(400).json({ error: err.message });
    }
});


// 手动选秀 (通过姓名直接指定)
app.post('/api/selection/manual', (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: '必须输入姓名' });

    const transaction = db.transaction(() => {
        // 1. 检查是否已经在正常编制后宫中
        const exists = db.prepare('SELECT id FROM concubines WHERE name = ? AND is_in_cold_palace = 0').get(name);
        if (exists) {
            throw new Error(`佳人 ${name} 已在后宫之中。`);
        }

        // 2. 从名妃池查找
        const template = db.prepare('SELECT * FROM historical_pool WHERE name = ?').get(name) as any;
        if (!template) {
            throw new Error(`名册中寻不到名为 ${name} 的佳人，请确认姓名无误。`);
        }

        // 3. 入宫
        db.prepare(`
            INSERT INTO concubines (name, beauty, personality, avatar_url, is_historical, pool_id, current_cycle_day, description, dynasty)
            VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?)
        `).run(
            template.name,
            template.beauty,
            template.personality,
            template.avatar_url,
            template.id,
            Math.floor(Math.random() * 28) + 1,
            template.description,
            template.dynasty
        );

        return template;
    });

    try {
        const result = transaction();
        res.json({ success: true, concubine: result });
    } catch (err: any) {
        res.status(400).json({ error: err.message });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
