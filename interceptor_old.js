/**
 * Force Gemini Pro - Guard Plugin
 *
 * "视觉护栏 + 提交拦截" 方案
 *
 * 核心原理：
 * 1. 检测页面右上角当前选中的模型（Fast 或 Pro）
 * 2. 如果是 Fast，给输入框添加红色视觉警告
 * 3. 拦截回车键发送，如果用户在 Fast 模式按回车，弹窗拦截
 * 4. 强制用户手动切换到 Pro 才能发送
 *
 * 这种方法不篡改网页逻辑，只在 UI 表面加一层安检
 * Google 的反作弊系统检测不到，永远不会失效
 */

(function() {
  'use strict';

  console.log('[Force Gemini Pro] Guard Plugin loaded');

  // === 状态变量 ===
  let isFastMode = true;  // 默认假设是 Fast，检测后再修正
  let inputElement = null;
  let sendButton = null;
  let modelSelector = null;

  // === DOM 元素引用 ===
  let warningStyles = null;
  let blockModal = null;

  // === 样式定义 ===
  const STYLES = `
    /* 红色警告样式 - Fast 模式 */
    .force-gemini-pro-warning {
      outline: 3px solid #ef4444 !important;
      outline-offset: 2px !important;
      animation: forceGeminiProPulse 1.5s infinite !important;
    }

    @keyframes forceGeminiProPulse {
      0%, 100% { outline-color: #ef4444; }
      50% { outline-color: #f87171; }
    }

    /* 绿色安全样式 - Pro 模式 */
    .force-gemini-pro-safe {
      outline: 3px solid #22c55e !important;
      outline-offset: 2px !important;
    }

    /* 专业提示文字 */
    .force-gemini-pro-badge {
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
      transition: all 0.3s ease !important;
    }

    .force-gemini-pro-badge.warning {
      background: linear-gradient(135deg, #fee2e2, #fecaca) !important;
      color: #991b1b !important;
      border: 1px solid #ef4444 !important;
    }

    .force-gemini-pro-badge.safe {
      background: linear-gradient(135deg, #dcfce7, #bbf7d0) !important;
      color: #166534 !important;
      border: 1px solid #22c55e !important;
    }

    /* 拦截弹窗 */
    .force-gemini-pro-modal-overlay {
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

    .force-gemini-pro-modal {
      background: white !important;
      border-radius: 16px !important;
      padding: 24px !important;
      max-width: 420px !important;
      width: 90% !important;
      box-shadow: 0 20px 40px rgba(0,0,0,0.3) !important;
      text-align: center !important;
      font-family: system-ui, -apple-system, sans-serif !important;
      animation: forceGeminiProModalIn 0.3s ease !important;
    }

    @keyframes forceGeminiProModalIn {
      from {
        opacity: 0;
        transform: scale(0.9) translateY(20px);
      }
      to {
        opacity: 1;
        transform: scale(1) translateY(0);
      }
    }

    .force-gemini-pro-modal h3 {
      margin: 0 0 12px 0 !important;
      font-size: 20px !important;
      color: #1f2937 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      gap: 8px !important;
    }

    .force-gemini-pro-modal p {
      margin: 0 0 20px 0 !important;
      color: #6b7280 !important;
      font-size: 15px !important;
      line-height: 1.5 !important;
    }

    .force-gemini-pro-modal-buttons {
      display: flex !important;
      gap: 12px !important;
      justify-content: center !important;
    }

    .force-gemini-pro-btn {
      padding: 12px 24px !important;
      border-radius: 10px !important;
      font-size: 15px !important;
      font-weight: 600 !important;
      cursor: pointer !important;
      border: none !important;
      transition: all 0.2s ease !important;
    }

    .force-gemini-pro-btn-primary {
      background: linear-gradient(135deg, #3b82f6, #2563eb) !important;
      color: white !important;
    }

    .force-gemini-pro-btn-primary:hover {
      transform: translateY(-2px) !important;
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4) !important;
    }

    .force-gemini-pro-btn-secondary {
      background: #f3f4f6 !important;
      color: #374151 !important;
    }

    .force-gemini-pro-btn-secondary:hover {
      background: #e5e7eb !important;
    }

    .force-gemini-pro-warning-icon {
      font-size: 48px !important;
      margin-bottom: 8px !important;
    }
  `;

  // === 注入样式 ===
  function injectStyles() {
    if (warningStyles) return;
    warningStyles = document.createElement('style');
    warningStyles.textContent = STYLES;
    document.head.appendChild(warningStyles);
  }

  // === 查找输入框 ===
  function findInputElement() {
    // Gemini 的输入框可能的 selectors
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

    // 备选：查找包含特定文本区域的父容器内的 textarea
    const textareas = document.querySelectorAll('textarea');
    for (const textarea of textareas) {
      if (textarea.offsetHeight > 80 && textarea.offsetWidth > 200) {
        return textarea;
      }
    }

    return null;
  }

  // === 查找模型选择器 ===
  function findModelSelector() {
    // 查找显示当前模型的元素
    const selectors = [
      '[aria-label*="model"]',
      '[aria-label*="Model"]',
      '[aria-label*="fast"]',
      '[aria-label*="Fast"]',
      '[aria-label*="pro"]',
      '[aria-label*="Pro"]',
      '.model-selector',
      '[data-testid*="model"]',
      'button[class*="model"]',
      'div[class*="model"]',
      'span[class*="model"]'
    ];

    for (const selector of selectors) {
      const els = document.querySelectorAll(selector);
      for (const el of els) {
        if (el.textContent.includes('Fast') || el.textContent.includes('Pro')) {
          return el;
        }
      }
    }

    // 更宽泛地查找包含 "Fast" 或 "1.5" 的按钮
    const allButtons = document.querySelectorAll('button, div[role="button"], div[role="combobox"]');
    for (const btn of allButtons) {
      if (btn.textContent.includes('Fast') || btn.textContent.includes('Pro')) {
        return btn;
      }
    }

    // 查找右下角可能显示模型版本的地方
    const modelHints = document.querySelectorAll('span, div');
    for (const el of modelHints) {
      if (el.textContent.trim() === 'Fast' || el.textContent.trim().includes('Fast model') || el.textContent.includes('1.5') && el.textContent.includes('Pro')) {
        return el;
      }
    }

    return null;
  }

  // === 检测当前模型状态 ===
  function detectCurrentModel() {
    // 方法1：直接查找包含 "Fast" 或 "Pro" 文本的元素
    const allElements = document.querySelectorAll('*');

    for (const el of allElements) {
      // 检查是否是模型选择器（通常在右上角）
      if (el.tagName === 'BUTTON' || el.getAttribute('role') === 'button' || el.getAttribute('role') === 'combobox') {
        const text = el.textContent.trim();
        if (text === 'Fast' || text.includes('Fast model')) {
          return 'fast';
        }
        if (text === 'Pro' || text.includes('1.5 Pro')) {
          return 'pro';
        }
      }
    }

    // 方法2：检查输入框上方的模型指示器
    const headerElements = document.querySelectorAll('[class*="header"], [class*="model"], [class*="status"]');
    for (const el of headerElements) {
      const text = el.textContent;
      if (text.includes('Fast') && !text.includes('Ultra')) {
        return 'fast';
      }
      if (text.includes('Pro') && !text.includes('1.0')) {
        return 'pro';
      }
    }

    // 默认返回 Fast（新对话通常默认 Fast）
    return 'fast';
  }

  // === 查找发送按钮 ===
  function findSendButton() {
    const selectors = [
      'button[aria-label*="Send"]',
      'button[aria-label*="send"]',
      'button[data-testid*="send"]',
      '[class*="send-button"]',
      'svg[class*="send-icon"]',
      'button[type="submit"]'
    ];

    for (const selector of selectors) {
      const btn = document.querySelector(selector);
      if (btn) {
        // 向上寻找按钮元素
        let current = btn;
        for (let i = 0; i < 3; i++) {
          if (current.tagName === 'BUTTON') return current;
          current = current.parentElement;
          if (!current) break;
        }
        // 如果找到的是 svg 或 icon，找到其父级按钮
        if (btn.closest('button')) {
          return btn.closest('button');
        }
      }
    }

    // 查找包含发送图标的按钮
    const allButtons = document.querySelectorAll('button');
    for (const btn of allButtons) {
      if (btn.querySelector('svg') && btn.offsetWidth < 60 && btn.offsetHeight < 60) {
        return btn;
      }
    }

    return null;
  }

  // === 更新视觉状态 ===
  function updateVisualState() {
    const input = findInputElement();

    if (!input) {
      setTimeout(updateVisualState, 500);
      return;
    }

    // 移除旧类名
    input.classList.remove('force-gemini-pro-warning', 'force-gemini-pro-safe');

    if (isFastMode) {
      input.classList.add('force-gemini-pro-warning');
      updateBadge('warning');
    } else {
      input.classList.add('force-gemini-pro-safe');
      updateBadge('safe');
    }
  }

  // === 更新右下角提示 ===
  let badgeElement = null;

  function updateBadge(state) {
    if (!badgeElement) {
      badgeElement = document.createElement('div');
      badgeElement.className = 'force-gemini-pro-badge';
      document.body.appendChild(badgeElement);
    }

    if (state === 'warning') {
      badgeElement.className = 'force-gemini-pro-badge warning';
      badgeElement.innerHTML = '⚠️ 当前为 Fast 模型<br><small>建议切换至 Pro 获得更好体验</small>';
    } else {
      badgeElement.className = 'force-gemini-pro-badge safe';
      badgeElement.innerHTML = '✓ 当前为 Pro 模型';
    }
  }

  // === 显示拦截弹窗 ===
  function showBlockModal() {
    if (blockModal) return;

    blockModal = document.createElement('div');
    blockModal.className = 'force-gemini-pro-modal-overlay';
    blockModal.innerHTML = `
      <div class="force-gemini-pro-modal">
        <div class="force-gemini-pro-warning-icon">⚠️</div>
        <h3>❌ 发送已被拦截</h3>
        <p>您当前使用的是 <strong style="color:#dc2626">Fast 模型</strong>，<br>回答质量可能不符合您的预期。</p>
        <p><strong>请先切换到 Pro 模型</strong>，然后再发送问题。</p>
        <div class="force-gemini-pro-modal-buttons">
          <button class="force-gemini-pro-btn force-gemini-pro-btn-secondary" id="force-gemini-pro-ignore">
            仍要使用 Fast
          </button>
          <button class="force-gemini-pro-btn force-gemini-pro-btn-primary" id="force-gemini-pro-switch">
            去切换 Pro
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(blockModal);

    // 绑定按钮事件
    document.getElementById('force-gemini-pro-ignore').addEventListener('click', () => {
      closeBlockModal();
      // 给用户一次忽略机会（3秒后重新启用拦截）
      setTimeout(() => getInputElement().addEventListener('keydown', handleKeyDown), 3000);
    });

    document.getElementById('force-gemini-pro-switch').addEventListener('click', () => {
      closeBlockModal();
      // 提示用户去点击切换
      alert('请手动点击页面右上角的模型选择器，切换到 Pro 后再发送。');
    });

    // 点击遮罩关闭（可选 - 但保留以允许用户取消）
    blockModal.addEventListener('click', (e) => {
      if (e.target === blockModal) {
        closeBlockModal();
        getInputElement().addEventListener('keydown', handleKeyDown);
      }
    });
  }

  function closeBlockModal() {
    if (blockModal) {
      blockModal.remove();
      blockModal = null;
    }
  }

  // === 获取输入框（带重试） ===
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
    // 只拦截回车键（Enter）
    if (e.key === 'Enter' && !e.shiftKey) {
      // 重新检测当前模型状态
      const currentModel = detectCurrentModel();

      if (currentModel === 'fast') {
        e.preventDefault();
        e.stopPropagation();

        // 显示拦截弹窗
        showBlockModal();

        console.log('[Force Gemini Pro] ⛔ 已拦截 Fast 模式下的发送请求');
      }
    }
  }

  // === 监听输入框重新出现 ===
  function setupInputObserver() {
    const observer = new MutationObserver(() => {
      const input = findInputElement();

      if (input && input !== inputElement) {
        inputElement = input;

        // 检测并应用状态
        const modelState = detectCurrentModel();
        if (modelState !== (isFastMode ? 'fast' : 'pro')) {
          isFastMode = (modelState === 'fast');
        }

        updateVisualState();
        input.addEventListener('keydown', handleKeyDown);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // === 检测模型选择器变化 ===
  function setupModelSelectorObserver() {
    const observer = new MutationObserver(() => {
      const newModel = detectCurrentModel();
      const wasFast = isFastMode;
      isFastMode = (newModel === 'fast');

      if (wasFast !== isFastMode) {
        console.log(`[Force Gemini Pro] 模型状态变化: ${wasFast ? 'Fast' : 'Pro'} → ${isFastMode ? 'Fast' : 'Pro'}`);
        updateVisualState();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      characterDataOldValue: true
    });
  }

  // === 主动检测模型变化（轮询） ===
  function pollForModelChange() {
    const input = findInputElement();

    if (input) {
      const currentModel = detectCurrentModel();
      isFastMode = (currentModel === 'fast');

      updateVisualState();
    }

    // 每2秒重新检测（包含防抖）
    setTimeout(() => {
      pollForModelChange();
    }, 2000);
  }

  // === 初始化 ===
  function init() {
    console.log('[Force Gemini Pro] 正在初始化...');

    // 注入样式
    injectStyles();

    // 查找并绑定输入框
    const input = findInputElement();
    if (input) {
      inputElement = input;
      input.addEventListener('keydown', handleKeyDown);
      console.log('[Force Gemini Pro] ✓ 输入框已绑定');
    }

    // 初次检测模型状态
    setTimeout(() => {
      const model = detectCurrentModel();
      isFastMode = (model === 'fast');
      console.log(`[Force Gemini Pro] 当前模型: ${isFastMode ? 'Fast' : 'Pro'}`);

      updateVisualState();

      // 开启轮询检测
      pollForModelChange();
    }, 1000);

    // 设置观察者
    setupInputObserver();
    setupModelSelectorObserver();

    console.log('[Force Gemini Pro] ✓ 视觉护栏已激活');
  }

  // 延迟启动，确保页面加载完成
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 500);
  }
})();