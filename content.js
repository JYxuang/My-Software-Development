// Force Gemini Pro - Content Script
// 将 interceptor.js 注入到页面的主环境中（Main World）
// 这样就能突破 content_script 的隔离限制，拦截网络请求

console.log('[Force Gemini Pro] Content script running');

// 仅在 Gemini 页面注入
if (window.location.hostname === 'gemini.google.com') {
  chrome.storage.local.get({ fgp_binding_pro_enabled: true }, (result) => {
    if (result.fgp_binding_pro_enabled) {
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL('interceptor.js');
      script.async = false;

      // 尽可能早地注入，以拦截早期请求
      (document.head || document.documentElement).appendChild(script);
    }
  });
}