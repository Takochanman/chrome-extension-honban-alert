function polling() {
  setTimeout(polling, 1000 * 30);
}

polling();

// ローカルストレージ初期化処理
chrome.storage.local.get({targetDomain: null}, (data) => {
  console.log(data)
  if (data.targetDomain == null || data.targetDomain.length == 0) {
    fetch(chrome.runtime.getURL("setting.json"))
      .then(res => res.json())
      .then(data => {
        chrome.storage.local.set({targetDomain: data.targetDomain});
        chrome.storage.local.set({dispBanner: data.dispBanner == undefined || typeof(data.dispBanner) !== 'boolean' ? true : data.dispBanner});
        chrome.storage.local.set({blockRequest: data.blockRequest == undefined || typeof(data.blockRequest) !== 'boolean' ? true : data.blockRequest});
        chrome.storage.local.set({postAlert: data.postAlert == undefined || typeof(data.postAlert) !== 'boolean' ? true : data.postAlert});
      })
  }
});

// アイコンバッジ変更処理
chrome.runtime.onMessage.addListener((req) => {
  if (req.target === 'changeBadge:background') {
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      chrome.action.setBadgeText({ text: req.badgeText, tabId: tabs[0].id });
      chrome.action.setBadgeTextColor({color: 'white'})
      chrome.action.setBadgeBackgroundColor({ color: "red", tabId: tabs[0].id });
    })
  }
});

// ローカルストレージ変更時の処理
chrome.storage.onChanged.addListener(async (changes, namespace) => {
  if (namespace === 'local') {
    if (changes.targetDomain) {
      // リクエストブロックルールを更新
      enableBlockRequest(changes.targetDomain.newValue);
    } else if (changes.blockRequest) {
      if (changes.blockRequest.newValue) {
        // ローカルストレージから対象ドメインを取得
        chrome.storage.local.get(['targetDomain'], (data) => {
          enableBlockRequest(data.targetDomain);
        });
      } else {
        disableBlockRequest();
      }
    }
  }
});

// リクエストブロック有効化処理
async function enableBlockRequest(targetDomain: string[]) {
  // リクエストブロックルールを削除
  const oldRules = await chrome.declarativeNetRequest.getDynamicRules();
  const oldRuleIds = oldRules.map(rule => rule.id);
  // 新ルール作成
  const newRules: chrome.declarativeNetRequest.Rule[] = [];
  targetDomain.forEach((d: string) => {
    const target = d.replace("^", "*://").replace("$", "/*");
    newRules.push({
      id: newRules.length + 1,
      action: { type: chrome.declarativeNetRequest.RuleActionType.BLOCK },
      condition: { urlFilter: target, resourceTypes: [chrome.declarativeNetRequest.ResourceType.MAIN_FRAME] }
    });
  });
  chrome.declarativeNetRequest.updateDynamicRules({
    addRules: newRules,
    removeRuleIds: oldRuleIds  // 古いルールがあれば削除
  });
;}
// リクエストブロック無効化処理
async function disableBlockRequest() {
  // リクエストブロックルールを削除
  const oldRules = await chrome.declarativeNetRequest.getDynamicRules();
  const oldRuleIds = oldRules.map(rule => rule.id);
  chrome.declarativeNetRequest.updateDynamicRules({
    addRules: [],
    removeRuleIds: oldRuleIds  // 古いルールがあれば削除
  });
};

// リクエストブロック時の処理
chrome.webRequest.onErrorOccurred.addListener(
  (details) => {
    if (details.error === 'net::ERR_BLOCKED_BY_CLIENT') {
      chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        chrome.action.openPopup()
        .then(() => {
          setTimeout(() => {
            chrome.runtime.sendMessage({ action: 'openPopup' }).catch(() => {});
          }, 300); // 少し遅延させてポップアップが開かれるのを待つ
        })
        .catch(() => {});
      });
    }
  },
  { urls: ['<all_urls>'] }
);

