-- Cloudflare D1 数据库结构
-- 此文件用于初始化 D1 数据库

-- 皇上状态表
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
);

-- 全局设置表
CREATE TABLE IF NOT EXISTS settings (
    id TEXT PRIMARY KEY,
    value REAL NOT NULL,
    label TEXT,
    unit TEXT
);

-- 历史名妃池 (基础卡池)
CREATE TABLE IF NOT EXISTS historical_pool (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    avatar_url TEXT,
    personality TEXT,
    description TEXT,
    dynasty TEXT,
    base_age INTEGER DEFAULT 16,
    beauty INTEGER DEFAULT 50
);

-- 活跃妃子表
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
);

-- 子嗣表
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
);

-- 创建索引以提升查询性能
CREATE INDEX IF NOT EXISTS idx_concubines_cold_palace ON concubines(is_in_cold_palace);
CREATE INDEX IF NOT EXISTS idx_concubines_pregnant ON concubines(is_pregnant);
CREATE INDEX IF NOT EXISTS idx_historical_pool_dynasty ON historical_pool(dynasty);
CREATE INDEX IF NOT EXISTS idx_children_mother ON children(mother_id);
