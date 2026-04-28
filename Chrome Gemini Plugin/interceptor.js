/**
 * Force Gemini Pro - Guard Plugin
 *
 * "视觉护栏 + 提交拦截" 方案
 *
 * 支持两种模式：
 * - warning: 警告模式（可选择忽略）
 * - strict: 强制 Pro 模式（必须切换到 Pro 才能发送）
 */

(function() {
  'use strict';

  console.log('[Force Gemini Pro] Guard Plugin loaded');

  // === 配置管理 ===
  const STORAGE_KEY = 'forceGeminiProSettings';
  let currentSettings = {
    mode: 'warning'  // 默认警告模式
  };

  // 样式定义
  const STYLES = `
    /* Fast模式输入框警告样式 */
    .fgp-warning {
      outline: 3px solid #ef4444 !important;
      outline-offset: 2px !important;
      animation: fgpPulse 1.5s infinite !important;
    }

    @keyframes fgpPulse {
      0%, 100% { outline-color: #ef4444; }
      50% { outline-color: #f87171; }
    }

    /* Pro模式安全样式 */
    .fgp-safe {
      outline: 3px solid #22c55e !important;
      outline-offset: 2px !important;
    }

    /* 状态徽章 */
    .fgp-badge {
      position: fixed !important;
      bottom: 20px !important;
      right: 20px !important;
      padding: 8px 16px !important;
      border-radius: 8px !important;
      font-family: system-ui, -apple-system, sans-serif !important;
      font-size: 14px !important;
      font-weight: 600 !important;
      z-index: 999999 !important;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important;
    }

    .fgp-badge.warning {
      background: linear-gradient(135deg, #fee2e2, #fecaca) !important;
      color: #991b1b !important;
      border: 1px solid #ef4444 !important;
    }

    .fgp-badge.safe {
      background: linear-gradient(135deg, #dcfce7, #bbf7d0) !important;
      color: #166534 !important;
      border: 1px solid #22c55e !important;
    }

    /* 拦截弹窗 */
    .fgp-modal-overlay {
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      right: 0 !important;
      bottom: 0 !important;
      background: rgba(0, 0, 0, 0.6) !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      z-index: 9999999 !important;
      backdrop-filter: blur(4px) !important;
    }

    .fgp-modal {
      background: white !important;
      border-radius: 16px !important;
      padding: 24px !important;
      max-width: 420px !important;
      width: 90% !important;
      box-shadow: 0 20px 40px rgba(0,0,0,0.3) !important;
      text-align: center !important;
      font-family: system-ui, -apple-system, sans-serif !important;
    }

    .fgp-modal h3 {
      margin: 0 0 12px !important;
      font-size: 20px !important;
      color: #1f2937 !important;
    }

    .fgp-modal p {
      margin: 0 0 20px !important;
      color: #6b7280 !important;
      font-size: 15px !important;
      line-height: 1.5 !important;
    }

    .fgp-modal-buttons {
      display: flex !important;
      gap: 12px !important;
      justify-content: center !important;
    }

    .fgp-btn {
      padding: 12px 24px !important;
      border-radius: 10px !important;
      font-size: 15px !important;
      font-weight: 600 !important;
      cursor: pointer !important;
      border: none !important;
    }

    .fgp-btn-primary {
      background: linear-gradient(135deg, #3b82f6, #2563eb) !important;
      color: white !important;
    }

    .fgp-btn-secondary {
      background: #f3f4f6 !important;
      color: #374151 !important;
    }

    /* 红色窗口模式（Strict 模式） */
    .fgp-red-overlay {
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      right: 0 !important;
      bottom: 0 !important;
      background: rgba(220, 38, 38, 0.15) !important;
      pointer-events: none !important;
      z-index: 999998 !important;
      animation: fgpRedPulse 2s infinite !important;
      border: 4px solid #dc2626 !important;
    }

    @keyframes fgpRedPulse {
      0%, 100% { opacity: 0.8; }
      50% { opacity: 1; }
    }

    /* 强制切换提示 */
    .fgp-strict-alert {
      position: fixed !important;
      top: 20px !important;
      left: 50% !important;
      transform: translateX(-50%) !important;
      background: linear-gradient(135deg, #dc2626, #b91c1c) !important;
      color: white !important;
      padding: 16px 28px !important;
      border-radius: 12px !important;
      font-family: system-ui, -apple-system, sans-serif !important;
      font-size: 16px !important;
      font-weight: 600 !important;
      z-index: 9999999 !important;
      box-shadow: 0 8px 24px rgba(220, 38, 38, 0.4) !important;
      display: flex !important;
      align-items: center !important;
      gap: 12px !important;
    }

    .fgp-strict-alert-icon {
      font-size: 24px !important;
    }

    .fgp-switch-btn {
      position: fixed !important;
      top: 80px !important;
      right: 20px !important;
      padding: 12px 20px !important;
      background: linear-gradient(135deg, #22c55e, #16a34a) !important;
      color: white !important;
      border: none !important;
      border-radius: 10px !important;
      font-size: 14px !important;
      font-weight: 600 !important;
      cursor: pointer !important;
      z-index: 9999999 !important;
      box-shadow: 0 4px 12px rgba(34, 197, 94, 0.4) !important;
    }
  `;

  // === 变量 ===
  let isFastMode = true;
  let inputElement = null;
  let styleElement = null;
  let redOverlay = null;
  let blockModal = null;
  let strictAlert = null;
  let switchButton = null;
  let badgeElement = null;
  let modelObserver = null;
  let warningIgnored = false; // Warning 模式：用户是否选择忽略

  // === 立即加载设置（同步） ===
  function loadSettingsSync() {
    try {
      // 优先使用 localStorage（同步，立即生效）
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          try {
            currentSettings = JSON.parse(stored);
            console.log('[Force Gemini Pro] LocalStorage 设置已加载:', currentSettings.mode);
          } catch (e) {
            console.log('[Force Gemini Pro] 解析设置失败，使用默认 warning');
          }
        } else {
          console.log('[Force Gemini Pro] 未找到已保存设置，使用默认 warning');
        }
      }
      // 如果 chrome.storage 可用，也尝试加载（异步，可能覆盖 localStorage）
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.get({ mode: 'warning' }, (settings) => {
          if (settings && settings.mode) {
            currentSettings = settings;
            console.log('[Force Gemini Pro] Chrome存储设置同步完成:', currentSettings.mode);
          }
        });
      }
    } catch (e) {
      console.error('[Force Gemini Pro] 加载设置出错:', e);
    }
  }

  // 从 storage 加载设置
  function loadSettings() {
    loadSettingsSync();
  }

  // 监听设置变化
  function setupSettingsListener() {
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
        chrome.runtime.onMessage.addListener((message) => {
          if (message.type === 'settingsChanged') {
            currentSettings = message.settings;
            console.log('[Force Gemini Pro] 设置已更新:', currentSettings.mode);
            // 重新应用状态
            const model = detectCurrentModel();
            isFastMode = (model === 'fast');
            updateVisualState();
          }
        });
      }
    } catch (e) {}
  }

  // === 注入样式 ===
  function injectStyles() {
    if (styleElement) return;
    styleElement = document.createElement('style');
    styleElement.textContent = STYLES;
    document.head.appendChild(styleElement);
  }

  // === 红色窗口效果（Strict 模式） ===
  function enableRedWindow() {
    if (redOverlay) return;
    redOverlay = document.createElement('div');
    redOverlay.className = 'fgp-red-overlay';
    document.body.appendChild(redOverlay);
  }

  function disableRedWindow() {
    if (redOverlay) {
      redOverlay.remove();
      redOverlay = null;
    }
  }

  // === 查找输入框 ===
  function findInputElement() {
    const selectors = [
      '[role="textbox"]',
      'textarea[placeholder*="Enter a prompt"]',
      'textarea[placeholder*="输入"]',
      '.ql-editor',
      'div[contenteditable="true"]',
      'textarea',
      'input[type="text"]'
    ];

    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el && el.offsetParent !== null) {
        return el;
      }
    }

    const textareas = document.querySelectorAll('textarea');
    for (const textarea of textareas) {
      if (textarea.offsetHeight > 80 && textarea.offsetWidth > 200) {
        return textarea;
      }
    }

    return null;
  }

  // === 查找模型选择器并模拟点击 ===
  function findAndClickModelSelector() {
    const allElements = document.querySelectorAll('*');

    // 查找 Pro 选项
    for (const el of allElements) {
      const text = el.textContent.trim();
      if ((text === 'Pro' || text.includes('1.5 Pro')) && el.click) {
        console.log('[Force Gemini Pro] 找到 Pro 选项，尝试点击');
        el.click();
        return true;
      }
    }

    // 查找模型切换按钮
    for (const el of allElements) {
      if (el.tagName === 'BUTTON' || el.getAttribute('role') === 'button') {
        const text = el.textContent.trim();
        if (text === 'Pro' || text === 'Fast' || text.includes('1.5')) {
          el.click();
          return true;
        }
      }
    }

    return false;
  }

  // === 检测当前模型 ===
  function detectCurrentModel() {
    const allElements = document.querySelectorAll('*');

    for (const el of allElements) {
      if (el.tagName === 'BUTTON' || el.getAttribute('role') === 'button' || el.getAttribute('role') === 'combobox') {
        const text = el.textContent.trim();
        if (text === 'Fast' || text.includes('Fast model')) return 'fast';
        if (text === 'Pro' || text.includes('1.5 Pro')) return 'pro';
      }
    }

    return 'fast';
  }

  // === 更新徽章 ===
  function updateBadge(state) {
    if (!badgeElement) {
      badgeElement = document.createElement('div');
      document.body.appendChild(badgeElement);
    }

    badgeElement.className = 'fgp-badge ' + state;
    badgeElement.textContent = '';

    if (state === 'warning') {
      badgeElement.appendChild(document.createTextNode('! 当前为 Fast 模型'));
      badgeElement.appendChild(document.createElement('br'));

      const smallEl = document.createElement('small');
      smallEl.style.fontWeight = '400';
      smallEl.textContent = '点击右下角按钮快速切换';
      badgeElement.appendChild(smallEl);
    } else {
      badgeElement.textContent = '√ 当前为 Pro 模型';
    }

    // 点击徽章切换模型
    badgeElement.onclick = () => {
      if (isFastMode) {
        findAndClickModelSelector();
      }
    };
    badgeElement.style.cursor = 'pointer';
  }

  // === 切换按钮 ===
  function updateSwitchButton() {
    if (switchButton) {
      switchButton.remove();
      switchButton = null;
    }

    if (isFastMode && currentSettings.mode === 'strict') {
      switchButton = document.createElement('button');
      switchButton.className = 'fgp-switch-btn';
      switchButton.textContent = '→ 切换到 Pro';
      switchButton.onclick = () => {
        findAndClickModelSelector();
      };
      document.body.appendChild(switchButton);
    }
  }

  // === 更新视觉状态 ===
  function updateVisualState() {
    const input = findInputElement();
    if (!input) return;

    input.classList.remove('fgp-warning', 'fgp-safe');

    if (isFastMode) {
      input.classList.add('fgp-warning');
      updateBadge('warning');
      updateSwitchButton();

      if (currentSettings.mode === 'strict') {
        enableRedWindow();
      } else {
        disableRedWindow();
      }
    } else {
      input.classList.add('fgp-safe');
      updateBadge('safe');
      disableRedWindow();
    }
  }

  // === 显示拦截弹窗（Warning 模式） ===
  function showBlockModal() {
    if (blockModal) return;

    // 创建遮罩层
    blockModal = document.createElement('div');
    blockModal.className = 'fgp-modal-overlay';

    // 创建弹窗容器
    const modal = document.createElement('div');
    modal.className = 'fgp-modal';

    // 标题
    const title = document.createElement('h3');
    title.textContent = '! 发送已被拦截';

    // 描述段落1
    const p1 = document.createElement('p');
    const strong1 = document.createElement('strong');
    strong1.style.color = '#dc2626';
    strong1.textContent = 'Fast 模型';
    p1.appendChild(document.createTextNode('您当前使用的是 '));
    p1.appendChild(strong1);
    p1.appendChild(document.createTextNode('，回答质量可能不符合预期。'));

    // 描述段落2
    const p2 = document.createElement('p');
    const strong2 = document.createElement('strong');
    strong2.textContent = '请先切换到 Pro 模型';
    p2.appendChild(strong2);
    p2.appendChild(document.createTextNode('，然后再发送。'));

    // 按钮容器
    const buttons = document.createElement('div');
    buttons.className = 'fgp-modal-buttons';

    // 仍要使用 Fast 按钮
    const ignoreBtn = document.createElement('button');
    ignoreBtn.className = 'fgp-btn fgp-btn-secondary';
    ignoreBtn.textContent = '仍要使用 Fast';
    ignoreBtn.id = 'fgp-ignore';
    ignoreBtn.addEventListener('click', () => {
      closeBlockModal();
      warningIgnored = true; // 用户选择忽略警告
      console.log('[Force Gemini Pro] 用户选择忽略警告，允许发送');
    });

    // 去切换 Pro 按钮
    const switchBtn = document.createElement('button');
    switchBtn.className = 'fgp-btn fgp-btn-primary';
    switchBtn.textContent = '去切换 Pro';
    switchBtn.id = 'fgp-switch';
    switchBtn.addEventListener('click', () => {
      closeBlockModal();
      findAndClickModelSelector();
    });

    buttons.appendChild(ignoreBtn);
    buttons.appendChild(switchBtn);

    modal.appendChild(title);
    modal.appendChild(p1);
    modal.appendChild(p2);
    modal.appendChild(buttons);
    blockModal.appendChild(modal);

    document.body.appendChild(blockModal);
  }

  function closeBlockModal() {
    if (blockModal) {
      blockModal.remove();
      blockModal = null;
    }
  }

  // === 显示 Strict 模式提示 ===
  function showStrictAlert() {
    if (strictAlert) return;

    strictAlert = document.createElement('div');
    strictAlert.className = 'fgp-strict-alert';

    // 图标
    const icon = document.createElement('span');
    icon.className = 'fgp-strict-alert-icon';
    icon.textContent = '!';

    // 文字
    const text = document.createElement('span');
    text.textContent = '强制 Pro 模式：必须切换到 Pro 才能发送';

    strictAlert.appendChild(icon);
    strictAlert.appendChild(text);
    document.body.appendChild(strictAlert);

    // 显示自动切换按钮
    const autoSwitch = document.createElement('button');
    autoSwitch.className = 'fgp-switch-btn';
    autoSwitch.textContent = '立即切换到 Pro →';
    autoSwitch.style.top = '90px';
    autoSwitch.onclick = () => {
      findAndClickModelSelector();
      if (strictAlert) strictAlert.remove();
      autoSwitch.remove();
    };
    document.body.appendChild(autoSwitch);

    setTimeout(() => {
      if (strictAlert) {
        strictAlert.remove();
        strictAlert = null;
      }
      if (autoSwitch && autoSwitch.parentNode) {
        autoSwitch.remove();
      }
    }, 6000);
  }

  function getInputElement() {
    if (inputElement) return inputElement;
    const input = findInputElement();
    if (input) {
      inputElement = input;
      return inputElement;
    }
    return null;
  }

  // === 键盘事件处理 ===
  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      const currentModel = detectCurrentModel();
      isFastMode = (currentModel === 'fast');

      if (isFastMode) {
        // 检查 Warning 模式是否已选择忽略
        if (currentSettings.mode === 'warning' && warningIgnored) {
          // 警告模式并且用户选择忽略，允许发送
          console.log('[Force Gemini Pro] Warning 模式：用户选择忽略，允许发送');
          return;
        }

        // 拦截发送
        e.preventDefault();
        e.stopPropagation();

        if (currentSettings.mode === 'strict') {
          // Strict 模式：强制拦截
          closeBlockModal();
          showStrictAlert();
          console.log('[Force Gemini Pro] Strict 模式：已拦截 Fast 发送');
        } else {
          // Warning 模式：询问用户
          showBlockModal();
          console.log('[Force Gemini Pro] Warning 模式：已拦截，询问用户');
        }
      }
    }
  }

  // === 轮询检测 ===
  function pollForModelChange() {
    const input = findInputElement();
    if (input) {
      const model = detectCurrentModel();
      const wasFast = isFastMode;
      isFastMode = (model === 'fast');

      if (wasFast !== isFastMode) {
        console.log('[Force Gemini Pro] 模型变化: ' + (wasFast ? 'Fast' : 'Pro') + ' → ' + (isFastMode ? 'Fast' : 'Pro'));
        updateVisualState();
        // 模型变化时重置忽略状态
        if (!isFastMode) {
          warningIgnored = false;
        }
      }
    }

    if (document.body) {
      setTimeout(pollForModelChange, 2000);
    }
  }

  // === 设置模型变化监听 ===
  function setupModelObserver() {
    if (typeof MutationObserver !== 'undefined' && !modelObserver) {
      modelObserver = new MutationObserver(() => {
        const input = findInputElement();
        if (input && input !== inputElement) {
          inputElement = input;
          const model = detectCurrentModel();
          isFastMode = (model === 'fast');
          updateVisualState();
          input.addEventListener('keydown', handleKeyDown);
        }
      });

      modelObserver.observe(document.body, {
        childList: true,
        subtree: true
      });
    }
  }

  // === 初始化 ===
  function init() {
    console.log('[Force Gemini Pro] 正在初始化...');

    injectStyles();
    loadSettings();

    const input = findInputElement();
    if (input) {
      inputElement = input;
      input.addEventListener('keydown', handleKeyDown);
      console.log('[Force Gemini Pro] 输入框已绑定');
    }

    setTimeout(() => {
      const model = detectCurrentModel();
      isFastMode = (model === 'fast');
      console.log('[Force Gemini Pro] 当前模型: ' + (isFastMode ? 'Fast' : 'Pro'));
      console.log('[Force Gemini Pro] 当前模式: ' + currentSettings.mode);

      updateVisualState();
      pollForModelChange();
    }, 1500);

    setupModelObserver();
    setupSettingsListener();

    console.log('[Force Gemini Pro] 视觉护栏已激活');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 500);
  }
})();