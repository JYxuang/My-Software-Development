// Force Gemini Pro - Options Page

// 默认配置
const DEFAULT_SETTINGS = {
  mode: 'warning'  // 'warning' | 'strict'
};

// 存储键名
const STORAGE_KEY = 'forceGeminiProSettings';

// 保存设置到存储
function saveToStorage(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    console.log('[Force Gemini Pro] 设置已保存:', settings);
    return true;
  } catch (e) {
    console.error('[Force Gemini Pro] 保存失败:', e);
    return false;
  }
}

// 从存储加载设置
function loadFromStorage() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch (e) {
    console.error('[Force Gemini Pro] 读取设置失败:', e);
  }
  return DEFAULT_SETTINGS;
}

// 应用设置到 UI
function applySettings(settings) {
  const mode = settings.mode || 'warning';
  console.log('[Force Gemini Pro] 应用设置:', mode);

  // 更新单选按钮
  document.querySelectorAll('input[name="mode"]').forEach(radio => {
    radio.checked = radio.value === mode;
  });

  // 更新选项卡选中状态
  document.getElementById('option-warning').classList.toggle('selected', mode === 'warning');
  document.getElementById('option-strict').classList.toggle('selected', mode === 'strict');
}

// 显示状态消息
function showStatus(message) {
  const status = document.getElementById('status');
  status.textContent = message;
  status.className = 'status success';
  setTimeout(() => {
    status.className = 'status';
  }, 3000);
}

// 保存设置
function saveSettings() {
  const selectedMode = document.querySelector('input[name="mode"]:checked');
  if (!selectedMode) {
    showStatus('❌ 请选择一个模式');
    return;
  }

  const settings = { mode: selectedMode.value };

  if (saveToStorage(settings)) {
    showStatus('✅ 设置已保存！重新加载 Gemini 页面后生效。');
  } else {
    showStatus('❌ 保存失败');
  }
}

// UI 事件绑定
document.addEventListener('DOMContentLoaded', () => {
  // 加载并应用设置
  const settings = loadFromStorage();
  applySettings(settings);

  // 选项卡点击效果 - 同时更新 radio 状态
  document.querySelectorAll('.option').forEach(option => {
    option.addEventListener('click', () => {
      const input = option.querySelector('input[type="radio"]');
      input.checked = true;

      // 更新选中样式
      document.querySelectorAll('.option').forEach(opt => {
        opt.classList.remove('selected');
      });
      option.classList.add('selected');
    });
  });

  // 保存按钮点击事件
  document.getElementById('saveBtn').addEventListener('click', saveSettings);
});