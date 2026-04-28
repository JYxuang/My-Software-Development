/**
 * Gemini 工具箱 - 悬浮工具面板
 * 功能：Markdown转换、去除回车等实用工具
 * 修复：
 * 1. 注入 Trusted Types 策略，完美绕过 Google CSP 限制
 * 2. 支持硬换行，修复 Markdown 与 LaTeX 公式下划线导致的全局斜体冲突
 * 3. 修复 Word 公式尾部虚线框问题（\sum 等符号后追加 {}）
 * 4. 修复粘贴到 Word 后段落换行消失问题（添加内联样式）
 * 5. 字体保护：强制非公式部分使用正常字体，公式内使用斜体
 */

(function() {
  'use strict';

  // ========== 核心修复：Trusted Types 安全策略 ==========
  let fgpPolicy = null;
  if (window.trustedTypes && window.trustedTypes.createPolicy) {
    try {
      fgpPolicy = window.trustedTypes.createPolicy('fgp-toolbox-policy', {
        createHTML: (string) => string
      });
    } catch (e) {
      console.warn('[Gemini 工具箱] TrustedTypes 策略创建失败', e);
    }
  }

  function safeHTML(str) {
    return fgpPolicy ? fgpPolicy.createHTML(str) : str;
  }

  // ========== 工具箱状态 ==========
  let toolboxContainer = null;
  let shadowRoot = null;
  let isOpen = false;
  let isSkillsOpen = false;
  let isBindingPro = true;
  let fgpSkills = [];
  let isDragging = false;

  // ========== 缓存：用于导出的 MathML 版本 HTML ==========
  let cachedMathMLHtml = '';

  // ========== 创建悬浮球 + 工具箱 ==========
  function initToolbox() {
    if (toolboxContainer) return;
    toolboxContainer = document.createElement('div');
    toolboxContainer.id = 'fgp-toolbox-root';
    shadowRoot = toolboxContainer.attachShadow({ mode: 'closed' });

    const style = document.createElement('style');
    style.textContent = getStyles();
    shadowRoot.appendChild(style);

    const floatGroup = document.createElement('div');
    floatGroup.className = 'fgp-float-group';

    const floatBall = document.createElement('div');
    floatBall.className = 'fgp-float-ball';
    floatBall.innerHTML = safeHTML(getFloatBallIcon());
    floatBall.title = 'Gemini 工具箱';
    floatBall.addEventListener('click', (e) => { if (!isDragging) togglePanel(); });
    floatGroup.appendChild(floatBall);

    const skillsBall = document.createElement('div');
    skillsBall.className = 'fgp-float-ball';
    skillsBall.innerHTML = safeHTML(getSkillsIcon());
    skillsBall.title = '技能配置文本';
    skillsBall.addEventListener('click', (e) => { if (!isDragging) toggleSkillsPanel(); });
    floatGroup.appendChild(skillsBall);

    makeDraggable(floatGroup);
    shadowRoot.appendChild(floatGroup);

    const panel = document.createElement('div');
    panel.className = 'fgp-panel';
    panel.innerHTML = safeHTML(getPanelHTML());
    shadowRoot.appendChild(panel);

    const skillsPanel = document.createElement('div');
    skillsPanel.className = 'fgp-panel fgp-skills-panel';
    skillsPanel.innerHTML = safeHTML(getSkillsPanelHTML());
    shadowRoot.appendChild(skillsPanel);

    document.body.appendChild(toolboxContainer);
    bindEvents();
    renderSkillsList();
  }

  // ========== 样式定义 ==========
  function getStyles() {
    return `
      .fgp-float-group { position: fixed; right: 20px; bottom: 100px; z-index: 2147483647; display: flex; flex-direction: column; gap: 12px; cursor: grab; user-select: none; }
      .fgp-float-group:active { cursor: grabbing; }
      .fgp-float-ball { width: 50px; height: 50px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4); transition: transform 0.2s; }
      .fgp-float-ball:hover { transform: scale(1.1); box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6); }
      .fgp-float-ball svg { width: 24px; height: 24px; fill: white; }
      .fgp-panel { position: fixed; right: 80px;  right: 20px; bottom: 160px; width: 420px; max-height: 520px; background: #fff; border-radius: 16px; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15); display: none; flex-direction: column; overflow: hidden; z-index: 2147483646; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
      .fgp-panel.open { display: flex; }
      .fgp-panel-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
      .fgp-panel-title { font-size: 16px; font-weight: 600; }
      .fgp-panel-close { background: none; border: none; color: white; cursor: pointer; padding: 4px; opacity: 0.8; transition: opacity 0.2s; }
      .fgp-panel-close:hover { opacity: 1; }
      .fgp-panel-close svg { width: 20px; height: 20px; }
      .fgp-tabs { display: flex; background: #f8fafc; border-bottom: 1px solid #e2e8f0; }
      .fgp-tab { flex: 1; padding: 12px 16px; background: none; border: none; cursor: pointer; font-size: 14px; color: #64748b; transition: all 0.2s; position: relative; }
      .fgp-tab:hover { color: #667eea; background: #f1f5f9; }
      .fgp-tab.active { color: #667eea; font-weight: 500; }
      .fgp-tab.active::after { content: ''; position: absolute; bottom: 0; left: 20%; right: 20%; height: 2px; background: #667eea; border-radius: 1px; }
      .fgp-tab-content { display: none; padding: 16px; flex: 1; overflow-y: auto; }
      .fgp-tab-content.active { display: flex; flex-direction: column; }
      .fgp-tool-section { display: flex; flex-direction: column; gap: 12px; }
      .fgp-tool-label { font-size: 13px; font-weight: 500; color: #475569; }
      .fgp-textarea { width: 100%; min-height: 120px; padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px; line-height: 1.5; resize: vertical; font-family: inherit; box-sizing: border-box; transition: border-color 0.2s; }
      .fgp-textarea:focus { outline: none; border-color: #667eea; box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1); }
      .fgp-textarea::placeholder { color: #94a3b8; }
      .fgp-btn-group { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; }
      .fgp-btn { padding: 10px 20px; border: none; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.2s; }
      .fgp-btn-primary { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
      .fgp-btn-primary:hover { box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4); transform: translateY(-1px); }
      .fgp-btn-secondary { background: #f1f5f9; color: #475569; }
      .fgp-btn-secondary:hover { background: #e2e8f0; }
      .fgp-btn-success { background: #10b981; color: white; }
      .fgp-btn-success:hover { background: #059669; }
      .fgp-tip { font-size: 12px; color: #94a3b8; text-align: center; margin-top: 8px; }
      .fgp-success-msg { position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background: #10b981; color: white; padding: 12px 24px; border-radius: 8px; font-size: 14px; z-index: 2147483647; animation: fgp-fadeIn 0.3s ease; }
      @keyframes fgp-fadeIn { from { opacity: 0; transform: translateX(-50%) translateY(-10px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
      .fgp-preview-title { font-size: 13px; font-weight: 500; color: #475569; display: flex; align-items: center; gap: 8px; }
      .fgp-preview-box { min-height: 120px; padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; background: #fafbfc; overflow-y: auto; font-size: 14px; line-height: 1.6; }
      .fgp-preview-box h1, .fgp-preview-box h2, .fgp-preview-box h3 { margin: 0.5em 0; }
      .fgp-preview-box p { margin: 0.5em 0; }
      .fgp-preview-box code { background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-family: 'Consolas', monospace; }
    `;
  }


  function getSkillsIcon() { return `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 2L3 7l9 5 9-5-9-5zM2 17l10 5 10-5M2 12l10 5 10-5" fill="none" stroke="white" stroke-width="2" stroke-linejoin="round"/></svg>`; }

  function getSkillsPanelHTML() {
    return `
      <div class="fgp-panel-header" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%);">
        <span class="fgp-panel-title">Skills 技能库</span>
        <button class="fgp-panel-close" id="fgp-skills-close" title="关闭"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
      </div>
      <div style="padding: 16px; flex: 1; overflow-y: auto; display: flex; flex-direction: column;">
        <div id="fgp-skills-list" style="flex: 1; overflow-y: auto; min-height: 150px; border-bottom: 1px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 12px;">
           <span style="color: #94a3b8; font-size: 13px;">暂无技能，请在下方添加</span>
        </div>
        <div class="fgp-skill-add-area">
          <textarea class="fgp-textarea" id="fgp-skill-input" placeholder="输入你想保存的技能或 Prompt..." style="min-height: 60px;"></textarea>
          <button class="fgp-btn fgp-btn-success" id="fgp-skill-add" style="width: 100%;">添加到技能库</button>
        </div>
      </div>
    `;
  }

  function makeDraggable(el) {
    let startY = 0, startX = 0, initialBottom = 100, initialRight = 20;
    
    el.addEventListener('mousedown', dragMouseDown);

    function dragMouseDown(e) {
      if (e.target.tagName.toLowerCase() === 'svg' || e.target.tagName.toLowerCase() === 'path') return;
      e.preventDefault();
      startX = e.clientX;
      startY = e.clientY;
      const rect = el.getBoundingClientRect();
      initialRight = window.innerWidth - rect.right;
      initialBottom = window.innerHeight - rect.bottom;
      
      document.onmouseup = closeDragElement;
      document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
      e.preventDefault();
      isDragging = true;
      let pos1X = startX - e.clientX;
      let pos1Y = startY - e.clientY;
      
      let newRight = initialRight + pos1X;
      let newBottom = initialBottom + pos1Y;
      
      if (newRight < 0) newRight = 0;
      if (newBottom < 0) newBottom = 0;
      
      el.style.right = newRight + "px";
      el.style.bottom = newBottom + "px";
    }

    function closeDragElement() {
      document.onmouseup = null;
      document.onmousemove = null;
      setTimeout(() => { isDragging = false; }, 50);
    }
  }

  function toggleSkillsPanel() {
    isSkillsOpen = !isSkillsOpen;
    const panel = shadowRoot.querySelector('.fgp-skills-panel');
    if (isSkillsOpen) {
      panel.classList.add('open');
      closePanel(); // close the other panel
    } else {
      panel.classList.remove('open');
    }
  }

  // ========== 悬浮球图标 ==========
  function getFloatBallIcon() {
    return `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.49.49 0 00-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 00-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.49.49 0 00-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>`;
  }

  // ========== 面板 HTML ==========
  function getPanelHTML() {
    return `
      <div class="fgp-panel-header">
        <span class="fgp-panel-title">Gemini 工具箱</span>
        <div style="display: flex; align-items: center; gap: 12px;">
          <label style="display: flex; align-items: center; gap: 4px; font-size: 12px; cursor: pointer; user-select: none;">
            <input type="checkbox" id="fgp-binding-toggle" ${isBindingPro ? 'checked' : ''} style="cursor: pointer;">
            Pro 绑定
          </label>
          <button class="fgp-panel-close" title="关闭"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
        </div>
      </div>
      <div class="fgp-tabs">
        <button class="fgp-tab active" data-tab="markdown">Markdown 转换</button>
        <button class="fgp-tab" data-tab="newline">去除回车</button>
        <button class="fgp-tab" data-tab="img2pdf">图片转 PDF</button>
      </div>
      <div class="fgp-tab-content active" data-content="markdown">
        <div class="fgp-tool-section">
          <label class="fgp-tool-label">输入 Markdown（含公式）</label>
          <textarea class="fgp-textarea" id="fgp-md-input" placeholder="粘贴 Gemini 输出的 Markdown 文本，支持 LaTeX 公式：$E=mc^2$ 或 $$...$$"></textarea>
          <div class="fgp-btn-group">
            <button class="fgp-btn fgp-btn-primary" id="fgp-md-convert">转换预览</button>
            <button class="fgp-btn fgp-btn-success" id="fgp-md-copy">复制到剪贴板</button>
            <button class="fgp-btn fgp-btn-secondary" id="fgp-md-export">导出Word</button>
          </div>
          <label class="fgp-preview-title">预览效果</label>
          <div class="fgp-preview-box" id="fgp-md-preview">
            <span style="color: #94a3b8">转换后的内容将显示在这里...</span>
          </div>
          <p class="fgp-tip">复制后可直接粘贴到 Word，公式会被识别为原生公式</p>
        </div>
      </div>
      <div class="fgp-tab-content" data-content="newline">
        <div class="fgp-tool-section">
          <label class="fgp-tool-label">原始文本（含多余换行）</label>
          <textarea class="fgp-textarea" id="fgp-nl-input" placeholder="粘贴从 PDF 复制的文本..."></textarea>
          <div class="fgp-btn-group">
            <button class="fgp-btn fgp-btn-primary" id="fgp-nl-convert">去除回车</button>
            <button class="fgp-btn fgp-btn-secondary" id="fgp-nl-copy">复制结果</button>
          </div>
          <label class="fgp-tool-label">处理后文本</label>
          <textarea class="fgp-textarea" id="fgp-nl-output" placeholder="处理后的文本将显示在这里..." readonly></textarea>
          <p class="fgp-tip">自动去除多行连续换行符，智能保留中英段落连续</p>
        </div>
      </div>
      <div class="fgp-tab-content" data-content="img2pdf">
        <div class="fgp-tool-section">
          <label class="fgp-tool-label">选择图片批量转 PDF</label>
          <div style="border: 2px dashed #e2e8f0; border-radius: 8px; padding: 20px; text-align: center; cursor: pointer; transition: all 0.2s;" id="fgp-img-dropzone">
            <input type="file" id="fgp-img-upload" multiple accept="image/*" style="display: none;">
            <svg style="width: 32px; height: 32px; color: #94a3b8; margin: 0 auto 8px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
            <div style="color: #64748b; font-size: 14px; font-weight: 500;">点击或拖拽图片到这里</div>
            <div style="color: #94a3b8; font-size: 12px; margin-top: 4px;">支持按顺序批量选择图片组合生成为 PDF</div>
          </div>
          <div id="fgp-img-preview-container" style="display: flex; gap: 8px; overflow-x: auto; padding: 8px 0; min-height: 80px;">
          </div>
          <div class="fgp-btn-group" style="margin-top: 8px;">
            <button class="fgp-btn fgp-btn-primary" id="fgp-img-clear" style="background: #ef4444; color: white; display: none;">清空列表</button>
            <button class="fgp-btn fgp-btn-success" id="fgp-img-export" style="width: 100%;">批量导出为 PDF</button>
          </div>
        </div>
      </div>
    `;
  }

  function bindEvents() {
    shadowRoot.querySelector('.fgp-panel-close').addEventListener('click', closePanel);

    const toggleCheckbox = shadowRoot.getElementById('fgp-binding-toggle');
    if (toggleCheckbox) {
      toggleCheckbox.addEventListener('change', (e) => {
        isBindingPro = e.target.checked;
        chrome.storage.local.set({ fgp_binding_pro_enabled: isBindingPro }, () => {
          showSuccess(isBindingPro ? 'Pro 绑定已开启 (刷新页面生效)' : 'Pro 绑定已关闭 (刷新页面生效)');
          if (window.location.hostname === 'gemini.google.com') setTimeout(() => window.location.reload(), 1500);
        });
      });
    }

    shadowRoot.getElementById('fgp-skills-close').addEventListener('click', () => { isSkillsOpen = false; shadowRoot.querySelector('.fgp-skills-panel').classList.remove('open'); });
    shadowRoot.getElementById('fgp-skill-add').addEventListener('click', addSkill);

    shadowRoot.querySelectorAll('.fgp-tab').forEach(tab => { tab.addEventListener('click', () => switchTab(tab.dataset.tab)); });
    shadowRoot.getElementById('fgp-md-convert').addEventListener('click', convertMarkdown);
    shadowRoot.getElementById('fgp-md-copy').addEventListener('click', copyToClipboard);
    shadowRoot.getElementById('fgp-md-export').addEventListener('click', exportToWord);
    shadowRoot.getElementById('fgp-nl-convert').addEventListener('click', removeNewlines);
    shadowRoot.getElementById('fgp-nl-copy').addEventListener('click', copyNewlineResult);
    
    const imgDropzone = shadowRoot.getElementById('fgp-img-dropzone');
    const imgUpload = shadowRoot.getElementById('fgp-img-upload');
    const imgClear = shadowRoot.getElementById('fgp-img-clear');
    const imgExport = shadowRoot.getElementById('fgp-img-export');

    imgDropzone.addEventListener('click', () => imgUpload.click());
    imgDropzone.addEventListener('dragover', (e) => { e.preventDefault(); imgDropzone.style.borderColor = '#667eea'; });
    imgDropzone.addEventListener('dragleave', () => { imgDropzone.style.borderColor = '#e2e8f0'; });
    imgDropzone.addEventListener('drop', (e) => { 
        e.preventDefault(); 
        imgDropzone.style.borderColor = '#e2e8f0'; 
        handleImageUpload(e.dataTransfer.files); 
    });
    imgUpload.addEventListener('change', (e) => handleImageUpload(e.target.files));
    imgClear.addEventListener('click', clearImages);
    imgExport.addEventListener('click', exportToPdf);
  }

  function togglePanel() {
    isOpen = !isOpen;
    if (isOpen) { shadowRoot.querySelector('.fgp-panel').classList.add('open'); if(isSkillsOpen) toggleSkillsPanel(); } else { shadowRoot.querySelector('.fgp-panel').classList.remove('open'); }
  }

  function closePanel() {
    isOpen = false;
    shadowRoot.querySelector('.fgp-panel').classList.remove('open');
  }

  function switchTab(tabName) {
    shadowRoot.querySelectorAll('.fgp-tab').forEach(tab => tab.classList.toggle('active', tab.dataset.tab === tabName));
    shadowRoot.querySelectorAll('.fgp-tab-content').forEach(content => content.classList.toggle('active', content.dataset.content === tabName));
  }

  function removeNewlines() {
    const input = shadowRoot.getElementById('fgp-nl-input');
    const output = shadowRoot.getElementById('fgp-nl-output');
    if (!input.value.trim()) return showSuccess('请先输入文本');
    
    let text = input.value;
    text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    text = text.replace(/([a-zA-Z0-9.,;:!?\)\]\}])[\n]+([a-zA-Z0-9(\[\{])/g, '$1 $2');
    text = text.replace(/\n+/g, '');
    
    output.value = text;
    showSuccess('转换完成！多行回车已彻底去除');
  }

  function copyNewlineResult() {
    const text = shadowRoot.getElementById('fgp-nl-output').value;
    if (!text.trim()) return showSuccess('没有可复制的内容');
    navigator.clipboard.writeText(text).then(() => showSuccess('已复制到剪贴板！'));
  }

  // ========== 核心逻辑增强：Markdown 转换 ==========
  function convertMarkdown() {
    const input = shadowRoot.getElementById('fgp-md-input');
    const preview = shadowRoot.getElementById('fgp-md-preview');
    let mdText = input.value;
    if (!mdText.trim()) return showSuccess('请先输入 Markdown 文本');

    if (typeof marked !== 'undefined') {
      // 0. 修复 Word 公式尾部虚线框问题：使用 \vphantom{x}（隐形占位符）
      // 在 \sum、\prod、\int 等符号后面（紧邻 $ 或 $$ 时）插入 \vphantom{x}
      // 这样 KaTeX 会渲染出 <mphantom> 标签，Word 识别后隐藏虚线框
      mdText = mdText.replace(/(\\sum(?:_[^{}\s]+|_\{[^}]+\})?(?:\^[^{}\s]+|\^\{[^}]+\})?)\s*(?=\$\$?)/g, '$1 \\vphantom{x}');
      mdText = mdText.replace(/(\\prod(?:_[^{}\s]+|_\{[^}]+\})?(?:\^[^{}\s]+|\^\{[^}]+\})?)\s*(?=\$\$?)/g, '$1 \\vphantom{x}');
      mdText = mdText.replace(/(\\int(?:_[^{}\s]+|_\{[^}]+\})?(?:\^[^{}\s]+|\^\{[^}]+\})?)\s*(?=\$\$?)/g, '$1 \\vphantom{x}');
      mdText = mdText.replace(/(\\oint(?:_[^{}\s]+|_\{[^}]+\})?(?:\^[^{}\s]+|\^\{[^}]+\})?)\s*(?=\$\$?)/g, '$1 \\vphantom{x}');
      mdText = mdText.replace(/(\\bigcap(?:_[^{}\s]+|_\{[^}]+\})?(?:\^[^{}\s]+|\^\{[^}]+\})?)\s*(?=\$\$?)/g, '$1 \\vphantom{x}');
      mdText = mdText.replace(/(\\bigcup(?:_[^{}\s]+|_\{[^}]+\})?(?:\^[^{}\s]+|\^\{[^}]+\})?)\s*(?=\$\$?)/g, '$1 \\vphantom{x}');

      // 1. 【调包计】提取并保护所有的 LaTeX 公式，防止被误认为是斜体
      let mathBlocks = [];
      // 匹配 $$...$$ 块 和 $...$ 块
      let safeText = mdText.replace(/(\$\$[\s\S]*?\$\$|\$[^\n$]*?\$)/g, (match) => {
        mathBlocks.push(match);
        return `@@@MATH_BLOCK_${mathBlocks.length - 1}@@@`;
      });

      // 2. 开启 breaks: true，让单个换行生效（实现和 Gemini 一致的回车）
      const htmlFromMarked = marked.parse(safeText, { breaks: true });

      // 3. 把公式原封不动地替换回来
      let finalHtml = htmlFromMarked.replace(/@@@MATH_BLOCK_(\d+)@@@/g, (match, index) => {
        return mathBlocks[index];
      });

      preview.innerHTML = safeHTML(finalHtml);

      // 4. 交给 KaTeX 渲染
      if (typeof renderMathInElement !== 'undefined') {
        renderMathInElement(preview, {
          delimiters: [
            {left: '$$', right: '$$', display: true},
            {left: '$', right: '$', display: false},
            {left: '\\[', right: '\\]', display: true},
            {left: '\\(', right: '\\)', display: false}
          ],
          throwOnError: false,
          // 忽略中文等 Unicode 字符在数学模式中的警告
          strict: false
        });

        // 5. 【关键】渲染完成后立即缓存 MathML 版本
        // 从 preview DOM 中提取纯净 MathML，移除 CSS 渲染层
        cacheMathMLVersion(preview);
      }
    } else {
      preview.innerHTML = safeHTML('<p style="color: #dc2626;">Markdown 库未加载，请刷新页面重试</p>');
    }
  }

  // ========== 从渲染后的 DOM 中提取并缓存 MathML 版本 ==========
  function cacheMathMLVersion(previewElement) {
    // 克隆整个预览区域
    const clone = previewElement.cloneNode(true);

    // 处理所有 KaTeX 公式元素，提取 MathML
    const katexElements = clone.querySelectorAll('.katex');
    katexElements.forEach(katexEl => {
      // 找到 MathML 部分
      const mathmlSpan = katexEl.querySelector('.katex-mathml');
      if (mathmlSpan) {
        // 获取 MathML 内容
        const mathml = mathmlSpan.innerHTML;
        // 创建一个新 span 只包含 MathML
        const newSpan = document.createElement('span');
        newSpan.className = 'fgp-mathml';
        newSpan.innerHTML = mathml;
        // 替换原来的 .katex 元素
        katexEl.parentNode.replaceChild(newSpan, katexEl);
      }
    });

    // 缓存处理后的 HTML
    cachedMathMLHtml = clone.innerHTML;
    console.log('[Gemini 工具箱] MathML 版本已缓存');
  }

  // ========== 优化复制到 Word 的样式（使用缓存的 MathML 版本）==========
  async function copyToClipboard() {
    // 使用缓存的 MathML 版本
    let html = cachedMathMLHtml;
    if (!html || html.includes('将显示在这里')) {
      // 如果没有缓存，尝试从预览区获取（回退）
      const preview = shadowRoot.getElementById('fgp-md-preview');
      html = preview.innerHTML;
      if (!html || html.includes('将显示在这里') || html.includes('库未加载')) {
        return showSuccess('请先转换内容');
      }
    }

    try {
      // 添加内联样式
      html = html.replace(/<p>/g, '<p style="margin-top: 0; margin-bottom: 14pt; line-height: 1.6;">');
      html = html.replace(/<br\s*\/?>/g, '<br style="clear: both;">');
      html = html.replace(/<ul>/g, '<ul style="margin-top: 0; margin-bottom: 14pt; padding-left: 20pt;">');
      html = html.replace(/<ol>/g, '<ol style="margin-top: 0; margin-bottom: 14pt; padding-left: 20pt;">');
      html = html.replace(/<li>/g, '<li style="margin-bottom: 6pt;">');
      html = html.replace(/<h1>/g, '<h1 style="font-size: 18pt; font-weight: bold; margin-top: 12pt; margin-bottom: 6pt; font-style: normal;">');
      html = html.replace(/<h2>/g, '<h2 style="font-size: 16pt; font-weight: bold; margin-top: 10pt; margin-bottom: 6pt; font-style: normal;">');
      html = html.replace(/<h3>/g, '<h3 style="font-size: 14pt; font-weight: bold; margin-top: 8pt; margin-bottom: 4pt; font-style: normal;">');

      // 构建专门用于复制到 Word 的 HTML（包含 MathML 命名空间）及 utf-8 补充声明（防止 win10/WPS 乱码）
      const wordFriendlyHTML = `<html><head><meta http-equiv="Content-Type" content="text/html; charset=utf-8"></head><body><!--StartFragment-->
        <div xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" style="font-family: 'Microsoft YaHei', SimSun, Arial, sans-serif; font-size: 11pt; color: #333333; line-height: 1.75;">
          ${html}
        </div>
      <!--EndFragment--></body></html>`;

      const blob = new Blob([wordFriendlyHTML], { type: 'text/html' });
      const clipboardItem = new ClipboardItem({ 'text/html': blob });
      await navigator.clipboard.write([clipboardItem]);
      showSuccess('已复制(MathML版)！可粘贴到 Word');
    } catch (err) {
      console.error('[Gemini 工具箱] 复制失败:', err);
      const preview = shadowRoot.getElementById('fgp-md-preview');
      await navigator.clipboard.writeText(preview.innerText);
      showSuccess('已复制纯文本');
    }
  }

  // ========== 导出为 Word 文件（使用缓存的 MathML 版本）==========
  function exportToWord() {
    // 使用缓存的 MathML 版本
    let html = cachedMathMLHtml;
    if (!html || html.includes('将显示在这里')) {
      // 如果没有缓存，尝试从预览区获取（回退）
      const preview = shadowRoot.getElementById('fgp-md-preview');
      html = preview.innerHTML;
      if (!html || html.includes('将显示在这里') || html.includes('库未加载')) {
        return showSuccess('请先转换内容');
      }
    }

    // 获取当前时间作为文件名
    const now = new Date();
    const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    const filename = `Gemini_Document_${timestamp}.doc`;

    // 构建完整的 Word 兼容 HTML 文档（包含 MathML 命名空间）
    const wordDocument = `
<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <!--[if gte mso 9]>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>100</w:Zoom>
      <w:DoNotOptimizeForBrowser/>
    </w:WordDocument>
  </xml>
  <![endif]-->
  <style>
    @page { size: A4; margin: 2.54cm; }
    body { font-family: 'Microsoft YaHei', SimSun, Arial, sans-serif; font-size: 11pt; line-height: 1.75; color: #333333; }
    p { margin-top: 0; margin-bottom: 14pt; line-height: 1.6; }
    h1 { font-size: 18pt; font-weight: bold; margin-top: 12pt; margin-bottom: 6pt; font-style: normal; }
    h2 { font-size: 16pt; font-weight: bold; margin-top: 10pt; margin-bottom: 6pt; font-style: normal; }
    h3 { font-size: 14pt; font-weight: bold; margin-top: 8pt; margin-bottom: 4pt; font-style: normal; }
    ul { margin-top: 0; margin-bottom: 14pt; padding-left: 20pt; }
    ol { margin-top: 0; margin-bottom: 14pt; padding-left: 20pt; }
    li { margin-bottom: 6pt; }
    code { font-family: Consolas, monospace; background: #f0f0f0; padding: 2px 4px; }
    pre { background: #f8f8f8; padding: 10pt; margin: 14pt 0; }
    blockquote { border-left: 3pt solid #666; padding-left: 10pt; margin: 14pt 0; color: #555; }
    /* MathML 公式样式 */
    math { font-style: italic; font-family: 'Times New Roman', serif; }
    .fgp-mathml { display: inline; }
  
      .fgp-skills-panel { bottom: 100px; }
      .fgp-skill-item { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-bottom: 8px; cursor: pointer; transition: all 0.2s; display: flex; justify-content: space-between; align-items: center; }
      .fgp-skill-item:hover { border-color: #667eea; background: #f1f5f9; }
      .fgp-skill-text { font-size: 13px; color: #475569; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; flex: 1; margin-right: 8px; }
      .fgp-skill-del { background: none; border: none; color: #ef4444; cursor: pointer; padding: 4px; border-radius: 4px; }
      .fgp-skill-del:hover { background: #fee2e2; }
      .fgp-skill-add-area { display: flex; gap: 8px; margin-top: 12px; flex-direction: column; }
    </style>
</head>
<body>
${html}
</body>
</html>`;

    // 创建 Blob 并下载（使用 UTF-8 BOM 确保编码正确）
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), wordDocument], { type: 'application/msword;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showSuccess('Word 文件已下载(MathML版)！');
  }

  
  function renderSkillsList() {
    const list = shadowRoot.getElementById('fgp-skills-list');
    if (!list) return;
    list.innerHTML = '';
    if (fgpSkills.length === 0) {
      list.innerHTML = '<span style="color: #94a3b8; font-size: 13px;">暂无技能，请在下方添加</span>';
      return;
    }
    
    fgpSkills.forEach((skill, index) => {
      const item = document.createElement('div');
      item.className = 'fgp-skill-item';
      
      const text = document.createElement('div');
      text.className = 'fgp-skill-text';
      text.textContent = skill;
      text.title = skill;
      text.onclick = () => {
        navigator.clipboard.writeText(skill).then(() => showSuccess('技能已复制到剪贴板！'));
      };
      
      const delBtn = document.createElement('button');
      delBtn.className = 'fgp-skill-del';
      delBtn.title = '删除';
      delBtn.innerHTML = '<svg viewBox="0 0 24 24" style="width:16px;height:16px;" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>';
      delBtn.onclick = (e) => {
        e.stopPropagation();
        fgpSkills.splice(index, 1);
        saveSkills();
        renderSkillsList();
      };
      
      item.appendChild(text);
      item.appendChild(delBtn);
      list.appendChild(item);
    });
  }

  function addSkill() {
    const input = shadowRoot.getElementById('fgp-skill-input');
    const text = input.value.trim();
    if (!text) return showSuccess('请输入技能内容');
    fgpSkills.unshift(text);
    saveSkills();
    renderSkillsList();
    input.value = '';
    showSuccess('添加成功！');
  }

  function saveSkills() {
    chrome.storage.local.set({ fgp_skills: fgpSkills });
  }

  function showSuccess(message) {
    const existing = shadowRoot.querySelector('.fgp-success-msg');
    if (existing) existing.remove();
    const msg = document.createElement('div');
    msg.className = 'fgp-success-msg';
    msg.textContent = message;
    shadowRoot.appendChild(msg);
    setTimeout(() => msg.remove(), 3000);
  }

  // ========== 新增：图片转 PDF 功能逻辑 ==========
  let selectedImages = [];

  function handleImageUpload(files) {
    Array.from(files).forEach(file => {
      if (file.type.startsWith('image/')) {
        selectedImages.push(file);
      }
    });
    renderImagePreview();
  }

  function clearImages() {
    selectedImages = [];
    shadowRoot.getElementById('fgp-img-upload').value = '';
    renderImagePreview();
  }

  function renderImagePreview() {
    const container = shadowRoot.getElementById('fgp-img-preview-container');
    const clearBtn = shadowRoot.getElementById('fgp-img-clear');
    container.innerHTML = '';
    if (selectedImages.length > 0) {
      clearBtn.style.display = 'block';
      let objUrls = [];
      selectedImages.forEach((img, index) => {
        const url = URL.createObjectURL(img);
        objUrls.push(url);
        const imgEl = document.createElement('img');
        imgEl.src = safeHTML(url);
        imgEl.style.height = '60px';
        imgEl.style.width = '60px';
        imgEl.style.objectFit = 'cover';
        imgEl.style.borderRadius = '4px';
        imgEl.style.border = '1px solid #cbd5e1';
        container.appendChild(imgEl);
      });
      // 释放多余内存
      setTimeout(() => { objUrls.forEach(url => URL.revokeObjectURL(url)); }, 5000);
    } else {
      clearBtn.style.display = 'none';
    }
  }

  async function exportToPdf() {
    if (selectedImages.length === 0) return showSuccess('请先选择图片');
    if (typeof window.jspdf === 'undefined') {
      return showSuccess('PDF 库未加载，请刷新页面重试');
    }

    showSuccess('正在为您生成 PDF，请稍候...');
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();

    for (let i = 0; i < selectedImages.length; i++) {
      const file = selectedImages[i];
      const imgData = await readFileAsDataURL(file);
      const imgProps = await getImageProperties(imgData);
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      if (i > 0) pdf.addPage();
      pdf.addImage(imgData, imgProps.type, 0, 0, pdfWidth, pdfHeight);
    }
    
    const now = new Date();
    const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    pdf.save(`Gemini_Images_PDF_${timestamp}.pdf`);
    showSuccess('PDF 导出成功，已发起下载！');
  }

  function readFileAsDataURL(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.readAsDataURL(file);
    });
  }

  function getImageProperties(dataUrl) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const typeMatch = dataUrl.match(/data:image\/(.*);base64/);
        let type = 'JPEG';
        if (typeMatch && typeMatch[1]) {
          if (typeMatch[1] === 'png') type = 'PNG';
          else if (typeMatch[1] === 'webp') type = 'WEBP';
        }
        resolve({ width: img.width, height: img.height, type: type });
      };
      img.src = dataUrl;
    });
  }

  function init() {
    chrome.storage.local.get({ fgp_binding_pro_enabled: true, fgp_skills: [] }, (res) => {
      isBindingPro = res.fgp_binding_pro_enabled;
      fgpSkills = res.fgp_skills;
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initToolbox);
      } else {
        setTimeout(initToolbox, 1000);
      }
    });
  }
  init();
})();