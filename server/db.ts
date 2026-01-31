import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'data', 'huangdi.db');
const db = new Database(dbPath);

// 初始化数据库表
export function initDB() {
    // 皇上状态表
    db.exec(`
        CREATE TABLE IF NOT EXISTS emperor (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT DEFAULT '皇上',
            stamina INTEGER DEFAULT 100,
            happiness INTEGER DEFAULT 100,
            health INTEGER DEFAULT 100,
            money INTEGER DEFAULT 10000,
            year INTEGER DEFAULT 1,
            month INTEGER DEFAULT 1,
            day INTEGER DEFAULT 1
        )
    `);

    // 全局设置表
    db.exec(`
        CREATE TABLE IF NOT EXISTS settings (
            id TEXT PRIMARY KEY,
            value REAL NOT NULL,
            label TEXT,
            unit TEXT
        )
    `);

    // 初始化默认设置
    const defaultSettings = [
        { id: 'historical_chance', value: 0.3, label: '选秀出现名妃概率', unit: '%' },
        { id: 'preg_chance_normal', value: 0.05, label: '普通期怀孕概率', unit: '%' },
        { id: 'preg_chance_ovulation', value: 0.35, label: '排卵期怀孕概率', unit: '%' },
        { id: 'preg_chance_menstruation', value: 0.01, label: '经期怀孕概率', unit: '%' },
        { id: 'stamina_cost_favored', value: 20, label: '临幸体力消耗', unit: '点' },
        { id: 'stamina_gain_rest', value: 20, label: '体力恢复数值', unit: '点' }
    ];

    const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (id, value, label, unit) VALUES (?, ?, ?, ?)');
    for (const s of defaultSettings) {
        insertSetting.run(s.id, s.value, s.label, s.unit);
    }

    // 历史名妃池 (基础卡池)
    db.exec(`
        CREATE TABLE IF NOT EXISTS historical_pool (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            avatar_url TEXT,
            personality TEXT,
            description TEXT,
            dynasty TEXT,
            base_age INTEGER DEFAULT 16,
            beauty INTEGER DEFAULT 50
        )
    `);

    // 活跃妃子表
    db.exec(`
        CREATE TABLE IF NOT EXISTS concubines (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            rank TEXT DEFAULT '选侍',
            beauty INTEGER DEFAULT 50,
            favor INTEGER DEFAULT 0,
            description TEXT,
            dynasty TEXT,
            closeness INTEGER DEFAULT 0,
            health INTEGER DEFAULT 100,
            age INTEGER DEFAULT 16,
            personality TEXT,
            avatar_url TEXT,
            is_historical BOOLEAN DEFAULT 0,
            pool_id INTEGER,
            current_cycle_day INTEGER DEFAULT 1,
            cycle_length INTEGER DEFAULT 28,
            is_pregnant BOOLEAN DEFAULT 0,
            pregnancy_days INTEGER DEFAULT 0,
            is_in_cold_palace BOOLEAN DEFAULT 0,
            children_count INTEGER DEFAULT 0
        )
    `);

    // 子嗣表
    db.exec(`
        CREATE TABLE IF NOT EXISTS children (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            mother_id INTEGER,
            name TEXT NOT NULL,
            gender TEXT,
            birth_year INTEGER,
            birth_month INTEGER,
            birth_day INTEGER,
            status TEXT DEFAULT '皇子/公主',
            FOREIGN KEY (mother_id) REFERENCES concubines(id)
        )
    `);

    // 检查是否已有初始数据，没有则初始化
    const empCount = db.prepare('SELECT count(*) as count FROM emperor').get() as { count: number };
    if (empCount.count === 0) {
        db.prepare('INSERT INTO emperor (name) VALUES (?)').run('崇祯');
    }

    const poolCount = db.prepare('SELECT count(*) as count FROM historical_pool').get() as { count: number };
    if (poolCount.count === 0) {
        // ... (rest of the logic remains correctly inside the function)

        // 预设 50 名纯正历史佳丽进入卡池
        const initialPool = [
            // --- 汉唐盛世 (15) ---
            { name: '西施', beauty: 99, personality: '温婉', avatar: '', dynasty: '春秋', description: '春秋末期越国人，中国古代四大美女之首，“沉鱼”之誉。' },
            { name: '王昭君', beauty: 98, personality: '优雅', avatar: '', dynasty: '西汉', description: '西汉和亲名妃，以一人之身维护汉匈边境半个世纪的和平，“落雁”之誉。' },
            { name: '貂蝉', beauty: 98, personality: '灵巧', avatar: '', dynasty: '三国', description: '三国时期奇女子，以连环计周旋于董卓与吕布之间，“闭月”之誉。' },
            { name: '杨玉环', beauty: 99, personality: '活泼', avatar: '', dynasty: '唐朝', description: '唐开元盛世名妃，通晓音律，姿质丰艳，“羞花”之誉。' },
            { name: '赵飞燕', beauty: 97, personality: '轻盈', avatar: '', dynasty: '西汉', description: '汉成帝皇后，以身轻如燕、能在掌上起舞而闻名。' },
            { name: '卫子夫', beauty: 94, personality: '谦逊', avatar: '', dynasty: '西汉', description: '汉武帝皇后，出身卑微却凭借贤德主理后宫三十余年。' },
            { name: '李夫人', beauty: 98, personality: '清冷', avatar: '', dynasty: '西汉', description: '汉武帝宠妃，其兄李延年曾咏“一顾倾人城，再顾倾人国”。' },
            { name: '班婕妤', beauty: 92, personality: '知性', avatar: '', dynasty: '西汉', description: '汉成帝妃子，才华横溢，其《团扇歌》流传千古。' },
            { name: '阴丽华', beauty: 96, personality: '端庄', avatar: '', dynasty: '东汉', description: '光武帝刘秀皇后，“仕宦当作执金吾，娶妻当得阴丽华”。' },
            { name: '伏寿', beauty: 90, personality: '坚毅', avatar: '', dynasty: '东汉', description: '汉献帝皇后，在曹操权倾天下时仍试图维护汉朝尊严的悲剧女子。' },
            { name: '甄宓', beauty: 98, personality: '忧郁', avatar: '', dynasty: '三国', description: '三国才女，文昭甄皇后，甄氏之美，名动天下，《洛神赋》女主角。' },
            { name: '大乔', beauty: 95, personality: '文静', avatar: '', dynasty: '三国', description: '江东二乔之长，孙策之妻，清丽脱俗。' },
            { name: '小乔', beauty: 95, personality: '活泼', avatar: '', dynasty: '三国', description: '江东二乔之次，周瑜之妻，貌若天仙。' },
            { name: '孙尚香', beauty: 93, personality: '豪迈', avatar: '', dynasty: '三国', description: '刘备之妻，孙权之妹，佩刀而行，巾帼不让须眉。' },
            { name: '上官婉儿', beauty: 94, personality: '聪颖', avatar: '', dynasty: '唐朝', description: '武则天近臣，一代巾帼才女，唐朝著名女诗人及政治人物。' },
            // --- 晋宋风流 (15) ---
            { name: '谢道韫', beauty: 91, personality: '雅致', avatar: '', dynasty: '东晋', description: '东晋著名女诗人，出身名门谢氏，以“咏絮才”闻名于世。' },
            { name: '李清照', beauty: 89, personality: '书卷', avatar: '', dynasty: '宋朝', description: '宋代著名女词人，千古第一才女，婉约词派宗师。' },
            { name: '朱淑真', beauty: 88, personality: '幽婉', avatar: '', dynasty: '宋朝', description: '宋代女词人，词风哀婉缠绵，与李清照齐名。' },
            { name: '唐婉', beauty: 90, personality: '深情', avatar: '', dynasty: '宋朝', description: '陆游原配妻子，不仅才情横溢，与陆游的凄美爱情更流传千古。' },
            { name: '花蕊夫人', beauty: 97, personality: '高傲', avatar: '', dynasty: '五代', description: '后蜀孟昶妃子，以才貌双全著称，曾作《述国亡诗》。' },
            { name: '班昭', beauty: 89, personality: '守节', avatar: '', dynasty: '东汉', description: '东汉史学家，著有《女诫》，是中国第一位女历史学家。' },
            { name: '管道升', beauty: 88, personality: '端淑', avatar: '', dynasty: '元朝', description: '元代著名女画家、诗人，赵孟頫之妻。' },
            { name: '苏小小', beauty: 96, personality: '浪漫', avatar: '', dynasty: '南北朝', description: '南齐钱塘名姬，才华横溢，被后世文人视为灵魂知音。' },
            { name: '李师师', beauty: 97, personality: '迷人', avatar: '', dynasty: '北宋', description: '北宋名姬，不仅倾倒宋徽宗，亦与燕青等江湖豪客有缘。' },
            { name: '梁红玉', beauty: 92, personality: '英气', avatar: '', dynasty: '南宋', description: '抗金英雄韩世忠之妻，擂鼓抗金，名震天下。' },
            { name: '虞姬', beauty: 99, personality: '忠贞', avatar: '', dynasty: '秦末', description: '西楚霸王项羽宠姬，“霸王别姬”的传说凄美动人。' },
            { name: '褒姒', beauty: 98, personality: '清冷', avatar: '', dynasty: '西周', description: '周幽王王后，因从未露笑而引发“烽火戏诸侯”的千古荒唐事。' },
            { name: '妲己', beauty: 100, personality: '妖冶', avatar: '', dynasty: '商朝', description: '商纣王妃，传说容颜足以动摇社稷。' },
            { name: '卓文君', beauty: 94, personality: '果敢', avatar: '', dynasty: '西汉', description: '汉代才女，为爱奔走私奔，当垆卖酒，性情勇敢。' },
            { name: '蔡文姬', beauty: 93, personality: '悲悯', avatar: '', dynasty: '东汉', description: '东汉末年女文学家，亲历动乱，其《胡笳十八拍》感人至深。' },
            // --- 秦淮八艳 & 明清名媛 (20) ---
            { name: '陈圆圆', beauty: 99, personality: '凄美', avatar: '', dynasty: '明清', description: '秦淮八艳之一，貌若天仙，吴三桂为其“冲冠一怒为红颜”。' },
            { name: '柳如是', beauty: 96, personality: '豪迈', avatar: '', dynasty: '明清', description: '秦淮八艳之首，不仅才艺冠绝，更具强烈的家国民族气节。' },
            { name: '董小宛', beauty: 95, personality: '温顺', avatar: '', dynasty: '明清', description: '秦淮八艳之一，性格恬静，不仅擅长琴棋书画，更精于烹饪。' },
            { name: '李香君', beauty: 94, personality: '坚贞', avatar: '', dynasty: '明清', description: '秦淮八艳之一，血染桃花扇，其高尚人格被后世传颂。' },
            { name: '顾横波', beauty: 93, personality: '庄重', avatar: '', dynasty: '明清', description: '秦淮八艳之一，号称“庄重嫺雅”，善画兰花。' },
            { name: '寇白门', beauty: 92, personality: '侠义', avatar: '', dynasty: '明清', description: '秦淮八艳之一，风姿绰约，性格刚强如侠女。' },
            { name: '卞玉京', beauty: 91, personality: '清高', avatar: '', dynasty: '明清', description: '秦淮八艳之一，擅画兰石，晚年遁入空门。' },
            { name: '马湘兰', beauty: 89, personality: '淡雅', avatar: '', dynasty: '明清', description: '秦淮八艳之一，秉性旷达，擅长画兰。' },
            { name: '鱼玄机', beauty: 93, personality: '叛逆', avatar: '', dynasty: '唐朝', description: '唐代女诗人，性聪慧有才思，行事风格独特。' },
            { name: '薛涛', beauty: 92, personality: '浪漫', avatar: '', dynasty: '唐朝', description: '唐代著名女诗人，创制“薛涛笺”，与当时才俊多有酬唱。' },
            { name: '董其昌女', beauty: 85, personality: '文静', avatar: '', dynasty: '明朝', description: '明代宗师之女，自幼耳濡目染，工于丹青。' },
            { name: '郭女王', beauty: 90, personality: '机敏', avatar: '', dynasty: '三国', description: '魏文帝曹丕之后，智计过人，助曹丕夺嫡。' },
            { name: '步练师', beauty: 93, personality: '平和', avatar: '', dynasty: '三国', description: '吴大帝孙权宠妃，性格宽和，不妒不嫌。' },
            { name: '孙鲁班', beauty: 88, personality: '权谋', avatar: '', dynasty: '三国', description: '孙权长女，权欲极强，干预东吴政治多年。' },
            { name: '孙鲁育', beauty: 89, personality: '良善', avatar: '', dynasty: '三国', description: '孙权之女，在东吴残酷的宫廷斗争中命运悲惨。' },
            { name: '蔡珏', beauty: 87, personality: '端淑', avatar: '', dynasty: '清朝', description: '明清江南名媛，家族显赫，书画大家。' },
            { name: '文成公主', beauty: 91, personality: '博大', avatar: '', dynasty: '唐朝', description: '唐朝宗室女，远嫁吐蕃，开启了汉藏文化交流的辉煌。' },
            { name: '李季兰', beauty: 90, personality: '风流', avatar: '', dynasty: '唐朝', description: '唐代女诗人，才华惊艳，被称为代宗朝“俊杰”。' },
            { name: '公孙大娘', beauty: 95, personality: '英武', avatar: '', dynasty: '唐朝', description: '唐代第一舞者，以剑器舞闻名，杜甫曾为其作长诗。' },
            { name: '邓绥', beauty: 91, personality: '理智', avatar: '', dynasty: '东汉', description: '东汉著名女政治家，和熹皇后，掌权期间海内崇平。' },
            // --- 现代组 (20) ---
            { name: '杨幂', beauty: 94, personality: '灵动', avatar: '', dynasty: '现代', description: '中国著名女演员，以北京女孩的直爽和极高的商业价值著称。' },
            { name: '赵丽颖', beauty: 93, personality: '坚韧', avatar: '', dynasty: '现代', description: '实力派女演员，从平凡出身到收视女王，展现了极强的毅力。' },
            { name: '刘亦菲', beauty: 98, personality: '仙气', avatar: '', dynasty: '现代', description: '被誉为“神仙姐姐”，容颜清丽脱俗，极具东方韵味。' },
            { name: '迪丽热巴', beauty: 96, personality: '活泼', avatar: '', dynasty: '现代', description: '新疆美女代表，五官深邃，在影视端都极具影响力。' },
            { name: '周冬雨', beauty: 89, personality: '灵气', avatar: '', dynasty: '现代', description: '三金影后，演技细腻，以古灵精怪的荧幕形象深入人心。' },
            { name: '杨紫', beauty: 91, personality: '亲和', avatar: '', dynasty: '现代', description: '国民度极高的演技派，性格开朗，被亲切地称为“邻家妹妹”。' },
            { name: '倪妮', beauty: 95, personality: '高级', avatar: '', dynasty: '现代', description: '气质女神，镜头感极强，无论是影视还是时尚圈都独树一帜。' },
            { name: '唐嫣', beauty: 92, personality: '甜美', avatar: '', dynasty: '现代', description: '以标志性的笑容著称，曾塑造多个深入人心的荧幕形象。' },
            { name: '刘诗诗', beauty: 94, personality: '淡雅', avatar: '', dynasty: '现代', description: '学芭蕾出身的恬静女神，气质如兰，举手投足间尽显儒雅。' },
            { name: '古力娜扎', beauty: 96, personality: '冷艳', avatar: '', dynasty: '现代', description: '异域风情美女，硬照水平出众，极具辨识度。' },
            { name: '景甜', beauty: 94, personality: '富贵', avatar: '', dynasty: '现代', description: '人间富贵花，长相雍容大方，近年凭借演技收获大量好评。' },
            { name: '张天爱', beauty: 93, personality: '英气', avatar: '', dynasty: '现代', description: '凭借英气十足的古装形象走红，兼具柔美与刚坚。' },
            { name: '李沁', beauty: 92, personality: '清冷', avatar: '', dynasty: '现代', description: '昆曲出身的冷感美女，长项气质独特，演技扎实。' },
            { name: '谭松韵', beauty: 90, personality: '可爱', avatar: '', dynasty: '现代', description: '逆龄女神，总是给人积极阳光的感觉，极具观众缘。' },
            { name: '毛晓彤', beauty: 91, personality: '灵巧', avatar: '', dynasty: '现代', description: '不仅舞技出众，更以甜美的外表和坚强的性格赢得喜爱。' },
            { name: '宋茜', beauty: 92, personality: '干练', avatar: '', dynasty: '现代', description: '唱跳演全方位艺人，性格独立坚强，散发着都市女性的魅力。' },
            { name: '关晓彤', beauty: 91, personality: '直率', avatar: '', dynasty: '现代', description: '国民闺女，由于出身艺术世家，自幼便展现了过人的才艺。' },
            { name: '金晨', beauty: 93, personality: '明媚', avatar: '', dynasty: '现代', description: '舞蹈功底深厚，性格爽朗，舞台表现力极佳。' },
            { name: '周也', beauty: 92, personality: '疏离', avatar: '', dynasty: '现代', description: '新生代冷脸美女代表，气质独特，被认为具有极高的电影感。' },
            { name: '张婧仪', beauty: 91, personality: '倔强', avatar: '', dynasty: '现代', description: '长相大气具有故事感，眉宇间透着一股不服输的倔强。' }
        ];

        const insertPool = db.prepare(`
            INSERT INTO historical_pool (name, beauty, personality, avatar_url, dynasty, description) 
            VALUES (?, ?, ?, ?, ?, ?)
        `);

        for (const c of initialPool) {
            insertPool.run(c.name, c.beauty, c.personality, c.avatar, c.dynasty, c.description);
        }
    }


    const conCount = db.prepare('SELECT count(*) as count FROM concubines').get() as { count: number };
    if (conCount.count === 0) {
        // 初始从名妃池中选出 6 位入宫
        const pool = db.prepare('SELECT * FROM historical_pool LIMIT 6').all() as any[];
        const insertCon = db.prepare(`
            INSERT INTO concubines (name, beauty, personality, avatar_url, is_historical, pool_id, current_cycle_day, cycle_length, description, dynasty) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const p of pool) {
            insertCon.run(p.name, p.beauty, p.personality, p.avatar_url, 1, p.id, Math.floor(Math.random() * 28) + 1, 28, p.description, p.dynasty);
        }
    }
}

export default db;
