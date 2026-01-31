import './style.css'

interface Emperor {
  name: string;
  stamina: number;
  happiness: number;
  health: number;
  money: number;
  year: number;
  month: number;
  day: number;
}

interface Concubine {
  id: number;
  name: string;
  rank: string;
  beauty: number;
  favor: number;
  description: string;
  dynasty: string;
  closeness: number;
  health: number;
  age: number;
  personality: string;
  avatar_url: string;
  current_cycle_day: number;
  is_pregnant: boolean;
  children_count: number;
  is_historical: boolean;
}

interface Child {
  id: number;
  mother_id: number;
  mother_name: string;
  name: string;
  gender: string;
  status: string;
  birth_year: number;
  birth_month: number;
  birth_day: number;
}

class App {
  private emperor: Emperor = { name: '皇上', stamina: 100, happiness: 100, health: 100, money: 10000, year: 1, month: 1, day: 1 };
  private concubines: Concubine[] = [];
  private children: Child[] = [];
  private settings: any[] = [];
  private dynasties: string[] = []; // 朝代列表

  // 视图状态管理
  private currentView: 'Zichen' | 'Rites' | 'Interaction' = 'Zichen';
  private interactingTargetId: number | null = null; // 当前正在交互的对象ID

  constructor() {
    this.init();
  }

  async init() {
    await this.fetchData();
    this.render();
  }

  async fetchData() {
    try {
      const [empRes, conRes, childRes, setRes, dynRes] = await Promise.all([
        fetch('http://localhost:3001/api/emperor'),
        fetch('http://localhost:3001/api/concubines'),
        fetch('http://localhost:3001/api/children'),
        fetch('http://localhost:3001/api/settings'),
        fetch('http://localhost:3001/api/dynasties')
      ]);
      this.emperor = await empRes.json();
      this.concubines = await conRes.json();
      this.children = await childRes.json();
      this.settings = await setRes.json();
      this.dynasties = await dynRes.json();
    } catch (err) {
      console.error('获取数据失败:', err);
    }
  }

  getSetting(id: string, defaultValue: number = 0) {
    const s = this.settings.find(x => x.id === id);
    return s ? s.value : defaultValue;
  }

  // 主渲染入口：每次状态改变都重新绘制整个 #app
  render() {
    const app = document.querySelector('#app');
    if (!app) return;

    // 根据当前视图决定渲染什么
    // 如果是交互模式，隐藏侧边栏，全屏沉浸
    if (this.currentView === 'Interaction') {
      app.innerHTML = this.renderInteractionScene();
      this.bindInteractionEvents(); // 绑定交互界面的特有事件
    } else {
      // 常规界面：侧边栏 + 主内容区
      app.innerHTML = `
            <aside class="sidebar">
                <div class="logo">【大清】皇帝模拟器</div>
                <div class="nav-item ${this.currentView === 'Zichen' ? 'active' : ''}" data-view="Zichen">紫宸殿 (后宫)</div>
                <div class="nav-item ${this.currentView === 'Rites' ? 'active' : ''}" data-view="Rites">礼部 (选秀)</div>
                <div class="nav-item" id="settingsNavItem">⚙️ 宫廷设置</div>
                <div class="nav-item" id="manualSelectNavItem">📜 敕令选妃</div>
                <div class="nav-item" style="margin-top: auto; border-top: 1px solid rgba(255,255,255,0.1);">
                    <a href="/admin.html" target="_blank" style="color: inherit; text-decoration: none;">⚙️ 管理后台</a>
                </div>
            </aside>
            
            <main class="main-viewport">
                <header class="status-header">
                    <div class="stat-item">
                        <span class="stat-label">大婚第 ${this.emperor.year} 年 ${this.emperor.month} 月 ${this.emperor.day} 日</span>
                        <span class="stat-value" style="color: #fbbf24;">${this.emperor.name}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">体力</span>
                        <div class="stat-value">
                            <div class="progress-bar">
                                <div class="progress-fill" style="width: ${this.emperor.stamina}%; background: #22c55e;"></div>
                            </div>
                            ${this.emperor.stamina}
                        </div>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">子嗣</span>
                        <div class="stat-value" style="color: #60a5fa;">👶 ${this.children.length}</div>
                    </div>
                    <div class="stat-item">
                        <button class="action-btn" id="nextDayBtn" style="padding: 5px 15px; font-size: 0.8rem;">
                            下一日 (+${this.getSetting('stamina_gain_rest', 20)}) ➔
                        </button>
                    </div>
                </header>

                <div class="content-area">
                    ${this.renderMainContent()}
                </div>
            </main>
      `;
      this.bindGlobalEvents(); // 绑定常规界面的事件
    }
  }

  // 渲染主内容区的子视图
  renderMainContent() {
    switch (this.currentView) {
      case 'Zichen':
        return `<div class="concubine-grid">${this.concubines.map(c => this.renderConcubineCard(c)).join('')}</div>`;
      case 'Rites':
        const dynastyOptions = this.dynasties.map(d => `<option value="${d}">${d}</option>`).join('');
        return `
            <div class="rites-ceremony glass-panel" style="text-align: center; padding: 100px 20px;">
                <h1 style="color: #fbbf24; font-size: 3rem; margin-bottom: 20px;">礼部大选</h1>
                <p style="font-size: 1.2rem; color: #ccc; margin-bottom: 30px;">三年一度选秀日，请陛下决策。</p>
                
                <!-- 朝代筛选器 -->
                <div style="margin: 30px 0;">
                  <label style="color: #fbbf24; font-size: 1.3rem; margin-right: 15px;">筛选朝代：</label>
                  <select id="dynasty-selector" style="padding: 10px 20px; background: #1e293b; color: #fbbf24; border: 2px solid #fbbf24; border-radius: 8px; font-size: 1.1rem; cursor: pointer; min-width: 150px;">
                    <option value="全部">全部朝代</option>
                    ${dynastyOptions}
                  </select>
                </div>
                
                <button class="action-btn" id="selectionBtn" style="margin-top: 30px; padding: 15px 40px; font-size: 1.2rem;">开启选秀</button>
            </div>
        `;
      default: return '';
    }
  }

  // 渲染单个妃子卡片
  renderConcubineCard(c: Concubine) {
    const cycleStatus = this.getCycleStatus(c.current_cycle_day, !!c.is_pregnant);
    return `
            <div class="concubine-card glass-panel fade-in ${c.is_historical ? 'historical' : ''}" data-id="${c.id}">
                <div class="dynasty-badge">${c.dynasty || '未知'}</div>
                <img src="${c.avatar_url || 'https://api.dicebear.com/7.x/adventurer/svg?seed=' + c.name}" class="concubine-image">
                <div class="concubine-info">
                    <div class="rank-badge">${c.rank}</div>
                    <div class="name">${c.name} <span style="font-size: 0.8rem; opacity: 0.7;">(${c.age}岁)</span></div>
                    <div class="cycle-indicator ${cycleStatus.class}">${cycleStatus.label}</div>
                    <div class="stats-mini">
                        <span>容貌: ${c.beauty}</span>
                        <span>亲密: ${c.favor}</span>
                        <span>子嗣: ${c.children_count}</span>
                    </div>
                </div>
            </div>
        `;
  }

  getCycleStatus(day: number, isPregnant: boolean = false) {
    if (isPregnant) return { label: '身怀龙种', class: 'cycle-success' };
    if (day <= 5) return { label: '月事期间', class: 'cycle-danger' };
    if (day >= 13 && day <= 17) return { label: '排卵期间', class: 'cycle-success' };
    return { label: '正常时期', class: 'cycle-normal' };
  }

  // =================================================================================
  //  交互视图逻辑 (New Interaction Scene)
  // =================================================================================

  // 1. 渲染交互场景的基础骨架（静态部分）
  renderInteractionScene() {
    const concubine = this.concubines.find(c => c.id === this.interactingTargetId);
    if (!concubine) return '<div style="color:white;">数据错误，找不到该嫔妃。</div>';

    return `
      <div id="interaction-scene" style="width: 100vw; height: 100vh; background: #0f172a; display: flex;">
          <!-- 左侧：立绘展示区 -->
          <div style="width: 40%; height: 100%; position: relative; border-right: 1px solid #334155; background: #000; display: flex; align-items: center; justify-content: center;">
              <!-- 调整：object-fit: contain 保持比例，max-height 限制高度 -->
              <img src="${concubine.avatar_url || 'https://api.dicebear.com/7.x/adventurer/svg?seed=' + concubine.name}" 
                   style="max-width: 95%; max-height: 85%; object-fit: contain; filter: drop-shadow(0 0 20px rgba(0,0,0,0.5));">
              
              <div style="position: absolute; top: 20px; left: 20px; z-index: 10;">
                  <button id="sceneBackBtn" style="background: rgba(0,0,0,0.6); color: #fff; border: 1px solid #ffffff33; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
                     ⬅ 返回后宫
                  </button>
              </div>

              <div style="position: absolute; bottom: 0; left: 0; right: 0; padding: 40px; background: linear-gradient(to top, #0f172a, transparent);">
                  <div style="font-size: 2.5rem; font-weight: bold; color: #fbbf24; text-shadow: 0 2px 4px rgba(0,0,0,0.8);">${concubine.name}</div>
                  <div style="font-size: 1.2rem; color: #94a3b8; margin-top: 5px;">${concubine.rank} · ${concubine.dynasty} · ${concubine.age}岁</div>
              </div>
          </div>

          <!-- 右侧：剧情交互区 -->
          <div style="flex: 1; display: flex; flex-direction: column; position: relative; background: #0f172a;">
              <!-- 顶部工具栏：冷宫/赏赐等 -->
              <div style="padding: 15px 30px; border-bottom: 1px solid #334155; display: flex; justify-content: flex-end; gap: 10px;">
                  <button id="btn-cold-palace" class="scene-util-btn" style="color: #fca5a5; border-color: #7f1d1d;">🔴 打入冷宫</button>
              </div>

              <!-- 对话记录/文本展示 -->
              <div id="scene-dialogue-area" style="flex: 1; padding: 60px; overflow-y: auto; display: flex; flex-direction: column; justify-content: center;">
                  <div id="typewriter-target" style="font-size: 1.5rem; line-height: 1.8; color: #f1f5f9; white-space: pre-wrap; min-height: 100px;">
                      <!-- 文字将通过 JS 动态打入这里 -->
                  </div>
              </div>

              <!-- 操作按钮区 -->
              <div id="scene-action-area" style="padding: 40px 60px; background: #1a1f2e; border-top: 1px solid #334155; min-height: 120px; display: flex; gap: 20px; justify-content: center; align-items: center;">
                  <!-- 按钮将通过 JS 动态插入这里 -->
                  <div style="color: #64748b;">正在加载交互数据...</div>
              </div>
          </div>
      </div>
    `;
  }

  // 2. 绑定交互场景的事件，并启动剧情流
  bindInteractionEvents() {
    // 绑定返回按钮
    document.querySelector('#sceneBackBtn')?.addEventListener('click', () => {
      this.interactingTargetId = null;
      this.currentView = 'Zichen';
      this.render(); // 切回主界面
      this.init();   // 刷新数据
    });

    // 绑定功能按钮：冷宫
    document.querySelector('#btn-cold-palace')?.addEventListener('click', async () => {
      const c = this.concubines.find(x => x.id === this.interactingTargetId);
      if (!c) return;

      if (confirm(`【慎重】陛下确定要将 ${c.name} 打入冷宫吗？此操作不可撤销。`)) {
        try {
          await fetch(`http://localhost:3001/api/concubines/${c.id}`, { method: 'DELETE' });
          // 操作成功后直接退回主列表
          this.interactingTargetId = null;
          this.currentView = 'Zichen';
          this.render();
          this.init();
        } catch (e) { alert('操作失败'); }
      }
    });

    // 启动剧情数据获取
    if (this.interactingTargetId) {
      this.startInteractionFlow(this.interactingTargetId);
    }
  }

  // 3. 剧情流程控制机 (核心逻辑)
  async startInteractionFlow(id: number) {
    try {
      // 初始请求 fetch
      const res = await fetch('http://localhost:3001/api/favored', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ concubineId: id, step: 'init' })
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
        return;
      }
      this.processSceneStep(data);
    } catch (e) {
      console.error(e);
      alert('交互请求失败');
    }
  }

  // 4. 处理每一个交互步骤 (Step)
  async processSceneStep(stepData: any) {
    const dialogueEl = document.querySelector('#typewriter-target');
    const actionArea = document.querySelector('#scene-action-area');

    if (!dialogueEl || !actionArea) return; // 容错

    // --- A. 打字机效果播放文本 ---
    actionArea.innerHTML = ''; // 播放时清空按钮，防误触
    await this.runTypewriterEffect(dialogueEl, stepData.text);

    // --- B. 根据 step 类型渲染按钮 ---
    let buttonsHtml = '';

    if (stepData.step === 'foreplay') {
      buttonsHtml = `<button class="action-btn" id="btn-next" style="padding: 15px 40px; font-size: 1.1rem; background:linear-gradient(135deg, #d4af37, #b8860b); color: white; border:none; border-radius:8px; cursor:pointer;">朕知道了</button>`;
    }
    else if (stepData.step === 'action_menu') {
      buttonsHtml = `
            <button class="scene-btn" data-action="oral">幽兰吐息</button>
            <button class="scene-btn" data-action="hand">玉指弄弦</button>
            <button class="scene-btn" data-action="breast">雪峰衔蝉</button>
            <button class="scene-btn" data-action="penetration">翻云覆雨</button>
      `;
    }
    else if (stepData.step === 'action_desc') {
      buttonsHtml = `<button class="action-btn" id="btn-finish" style="padding: 15px 40px; font-size: 1.1rem; background:#991b1b; color: white; border:none; border-radius:8px; cursor:pointer;">兴尽登峰</button>`;
    }
    else if (stepData.step === 'finish_menu') {
      const concubine = this.concubines.find(c => c.id === this.interactingTargetId);
      const canInject = concubine && !(concubine.current_cycle_day <= 5 || concubine.is_pregnant);

      buttonsHtml = `
            <button class="scene-btn" data-loc="face">喷薄面庞</button>
            <button class="scene-btn" data-loc="chest">尽洒冰肌</button>
            ${canInject ? '<button class="scene-btn" data-loc="inside" style="border-color:#991b1b; color:#fca5a5;">贯入体内</button>' : ''}
      `;
    }
    else if (stepData.step === 'finish_desc') {
      // 完结，追加怀孕提示
      if (stepData.pregnancyTriggered) {
        dialogueEl.innerHTML += '<br><br><span style="color:#fbbf24; font-weight:bold;">【系统提示】佳人玉体温存，似乎已有龙种暗结...</span>';
      }
      buttonsHtml = `<button class="action-btn" id="btn-end" style="padding: 15px 40px; font-size: 1.1rem; background:#334155; color: white; border:none; border-radius:8px; cursor:pointer;">起驾回宫</button>`;
    }

    // 渲染按钮
    actionArea.innerHTML = buttonsHtml;

    // --- C. 绑定按钮事件 ---

    // 1. 下一步 (Foreplay -> Action Menu)
    document.querySelector('#btn-next')?.addEventListener('click', () => {
      this.processSceneStep({ ...stepData, step: 'action_menu', text: '陛下想要如何宠幸？' });
    });

    // 2. 执行互动动作 (Action Menu -> Action Result)
    document.querySelectorAll('.scene-btn').forEach(btn => {
      btn.addEventListener('click', async (e: any) => {
        const action = e.target.getAttribute('data-action');
        const loc = e.target.getAttribute('data-loc');

        let payload: any = { concubineId: this.interactingTargetId };

        if (stepData.step === 'action_menu') {
          payload.step = 'action';
          payload.action = action;
        } else if (stepData.step === 'finish_menu') {
          payload.step = 'finish';
          payload.location = loc;
        }

        // 提交请求
        try {
          actionArea.innerHTML = '<div style="color:#64748b;">正在与佳人互动...</div>';
          const res = await fetch('http://localhost:3001/api/favored', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          const nextData = await res.json();
          if (nextData.error) {
            alert(nextData.error);
            this.init();
            return;
          }
          this.processSceneStep(nextData);
        } catch (err) { alert('网络错误'); }
      });
    });

    // 3. 进入高潮 (Action Desc -> Finish Menu)
    document.querySelector('#btn-finish')?.addEventListener('click', () => {
      this.processSceneStep({ ...stepData, step: 'finish_menu', text: '陛下此时龙精虎猛，准备将甘霖赐予何处？' });
    });

    // 4. 结束 (Finish Desc -> End)
    document.querySelector('#btn-end')?.addEventListener('click', () => {
      document.querySelector('#sceneBackBtn')?.dispatchEvent(new Event('click'));
    });
  }

  runTypewriterEffect(element: Element, text: string): Promise<void> {
    return new Promise((resolve) => {
      if (!text) { resolve(); return; }
      element.innerHTML = '';
      let i = 0;
      const speed = 20; // ms

      // 创建跳过层
      const container = document.querySelector('#interaction-scene');
      const skipHint = document.createElement('div');
      skipHint.innerText = '（点击任意处跳过）';
      skipHint.style.cssText = 'position:absolute; bottom:20px; right:20px; color:#475569; font-size:0.8rem; cursor:pointer;';
      container?.appendChild(skipHint);

      let timer: any = null;
      let isSkipped = false;

      const finishCodes = () => {
        if (isSkipped) return;
        isSkipped = true;
        clearInterval(timer);
        element.innerHTML = text.replace(/\n/g, '<br>');
        skipHint.remove();
        container?.removeEventListener('click', finishCodes);
        resolve();
      };

      container?.addEventListener('click', finishCodes);

      timer = setInterval(() => {
        if (i < text.length) {
          element.innerHTML += (text.charAt(i) === '\n' ? '<br>' : text.charAt(i));
          i++;
          // 自动滚动到底部
          const parent = element.parentElement;
          if (parent) parent.scrollTop = parent.scrollHeight;
        } else {
          finishCodes();
        }
      }, speed);
    });
  }


  // =================================================================================
  //  全局事件委托 (常规界面)
  // =================================================================================

  bindGlobalEvents() {
    if ((this as any)._globalEventsBound) return;
    (this as any)._globalEventsBound = true;

    document.querySelector('#app')?.addEventListener('click', (e) => {
      // 只有在非交互模式下才响应这些通用事件（虽然 render 做了 DOM 隔离，但逻辑上做个判断更安全）
      if (this.currentView === 'Interaction') return;

      const target = e.target as HTMLElement;

      // 切换视图导航
      const navItem = target.closest('.nav-item');
      if (navItem) {
        const view = navItem.getAttribute('data-view');
        if (view === 'Zichen' || view === 'Rites') {
          this.currentView = view;
          this.render();
          return;
        }
        if (navItem.id === 'settingsNavItem') { this.handleSettings(); return; }
        if (navItem.id === 'manualSelectNavItem') {
          const name = prompt('请输入要录选的女子姓名：');
          if (name) this.handleManualSelection(name);
          return;
        }
      }

      // 1. 点击妃子卡片 -> 进入交互场景
      const concubineCard = target.closest('.concubine-card');
      if (concubineCard) {
        const id = concubineCard.getAttribute('data-id');
        if (id) {
          this.interactingTargetId = parseInt(id);
          this.currentView = 'Interaction';
          this.render(); // 这一步会触发 renderInteractionScene
        }
        return;
      }

      // 功能按钮
      if (target.closest('#nextDayBtn')) {
        fetch('http://localhost:3001/api/game/next-day', { method: 'POST' }).then(() => this.init());
        return;
      }

      if (target.closest('#selectionBtn')) {
        this.handleSelection();
        return;
      }
    });
  }

  // =================================================================================
  //  其他辅助功能
  // =================================================================================

  async handleSelection() {
    // 从礼部页面获取选择的朝代
    const dynastySelector = document.querySelector('#dynasty-selector') as HTMLSelectElement;
    const selectedDynasty = dynastySelector ? dynastySelector.value : '全部';

    // 简单的全屏 Overlay 选秀，不使用 Modal，直接盖一层
    const overlay = document.createElement('div');
    overlay.className = 'gacha-overlay';

    // 选秀界面不再包含朝代筛选器
    overlay.innerHTML = `
      <div class="gacha-container slide-up">
        <h1 class="gacha-title">礼部选秀 · 佳丽名册${selectedDynasty !== '全部' ? ' (' + selectedDynasty + ')' : ''}</h1>
        
        <div class="gacha-grid" id="gacha-grid"><div class="gacha-loading">正在呈选名册...</div></div>
        
        <div class="gacha-footer">
          <div class="gacha-counter">已选中: <span id="selected-count">0</span> / 3</div>
          <button class="gacha-submit-btn" id="gacha-submit" disabled>录用入宫</button>
          <button class="gacha-close-btn" id="gacha-reroll" style="background: #d97706; margin-right: 10px;">重选</button>
          <button class="gacha-close-btn" id="gacha-close">罢选</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    setTimeout(() => overlay.classList.add('active'), 10);

    let candidates: any[] = [];
    let selectedIndices = new Set<number>();

    // 加载候选人的函数
    const loadCandidates = async () => {
      const grid = overlay.querySelector('#gacha-grid')!;
      grid.innerHTML = '<div class="gacha-loading">正在呈选名册...</div>';

      const url = selectedDynasty === '全部'
        ? 'http://localhost:3001/api/selection/candidates'
        : `http://localhost:3001/api/selection/candidates?dynasty=${encodeURIComponent(selectedDynasty)}`;

      const res = await fetch(url);
      candidates = await res.json();
      selectedIndices.clear();

      renderCandidates();
    };

    // 渲染候选人卡片的函数
    const renderCandidates = () => {
      const grid = overlay.querySelector('#gacha-grid')!;
      grid.innerHTML = '';

      candidates.forEach((c: any, index: number) => {
        // 还原用户要求的缺省图逻辑
        const defaultAvatar = `/assets/placeholders/concubine_${(index % 2) + 1}.png`;
        const avatarSrc = c.avatar_url || defaultAvatar;

        const card = document.createElement('div');
        card.className = 'gacha-card';
        card.innerHTML = `
          <div class="dynasty-badge">${c.dynasty}</div>
          <img class="gacha-card-img" src="${avatarSrc}">
          <div class="gacha-card-info">
            <div class="gacha-card-name">${c.name} (${c.age}岁)</div>
            <div class="gacha-card-stats">容貌: ${c.beauty}</div>
          </div>
        `;
        grid.appendChild(card);
        setTimeout(() => card.classList.add('revealed'), index * 100);

        card.addEventListener('click', () => {
          if (selectedIndices.has(index)) {
            selectedIndices.delete(index);
            card.classList.remove('selected');
          } else if (selectedIndices.size < 3) {
            selectedIndices.add(index);
            card.classList.add('selected');
          }

          overlay.querySelector('#selected-count')!.textContent = selectedIndices.size.toString();
          (overlay.querySelector('#gacha-submit') as HTMLButtonElement).disabled = selectedIndices.size === 0;
        });
      });
    };

    // 初始加载
    await loadCandidates();

    // 重选按钮事件
    overlay.querySelector('#gacha-reroll')?.addEventListener('click', async () => {
      await loadCandidates();
    });

    // 关闭按钮
    overlay.querySelector('#gacha-close')?.addEventListener('click', () => overlay.remove());

    // 提交按钮
    overlay.querySelector('#gacha-submit')?.addEventListener('click', async () => {
      const selected = Array.from(selectedIndices).map(i => candidates[i]);
      await fetch('http://localhost:3001/api/selection/batch-join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidates: selected })
      });
      overlay.remove();
      this.init();
    });
  }

  async handleManualSelection(name: string) {
    const res = await fetch('http://localhost:3001/api/selection/manual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    const data = await res.json();
    if (data.error) return alert(data.error);
    alert(`佳人 ${name} 已入宫。`);
    this.init();
  }

  async handleSettings() {
    const overlay = document.createElement('div');
    overlay.className = 'interaction-overlay';
    // 简易设置弹窗，保留纯 CSS 居中
    overlay.innerHTML = `
      <div style="width: 500px; padding: 30px; background: #1a1f2e; border: 1px solid #d4af37; border-radius: 12px; box-shadow: 0 10px 40px black;">
        <h2 style="color: #fbbf24; margin-bottom: 25px;">宫廷律令</h2>
        <div id="settings-list" style="max-height: 400px; overflow-y: auto;">
          ${this.settings.map(s => `
            <div style="margin-bottom: 15px;">
              <label style="display: block; margin-bottom: 5px; color: #94a3b8;">${s.label}</label>
              <input type="number" step="0.01" value="${s.value}" data-id="${s.id}" class="settings-input" style="width:100%; padding:8px; background:#0f172a; border:1px solid #334155; color:#fff;">
            </div>
          `).join('')}
        </div>
        <div style="margin-top: 20px; display: flex; gap: 10px; justify-content: flex-end;">
          <button id="closeSettings" style="padding: 8px 16px; cursor: pointer;">回宫</button>
          <button id="saveSettings" style="padding: 8px 16px; background: #fbbf24; color: #000; font-weight: bold; cursor: pointer; border: none;">颁布</button>
        </div>
      </div>
    `;
    // 这里使用 flex 居中
    overlay.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.8); display:flex; align-items:center; justify-content:center; z-index:9999;';

    document.body.appendChild(overlay);
    overlay.querySelector('#closeSettings')?.addEventListener('click', () => overlay.remove());
    overlay.querySelector('#saveSettings')?.addEventListener('click', async () => {
      const inputs = overlay.querySelectorAll('.settings-input');
      for (const input of Array.from(inputs)) {
        await fetch('http://localhost:3001/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: input.getAttribute('data-id'), value: parseFloat((input as HTMLInputElement).value) })
        });
      }
      overlay.remove();
      this.init();
    });
  }
}

new App();
