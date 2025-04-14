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
      chrome.storage.local.get(['blockRequest'], (data) => {
        // リクエストブロックが有効な場合のみ更新
        if (data.blockRequest) {
          // リクエストブロックルールを更新
          enableBlockRequest(changes.targetDomain.newValue);
          enableBlockPostRequest(changes.targetDomain.newValue);
        }
      });
    } else if (changes.blockRequest) {
      if (changes.blockRequest.newValue) {
        // ローカルストレージから対象ドメインを取得
        chrome.storage.local.get(['targetDomain'], (data) => {
          // リクエストブロック有効化
          enableBlockRequest(data.targetDomain);
        });
      } else {
        disableBlockRequest();
      }
    } else if (changes.postAlert) {
      if (changes.postAlert.newValue) {
        // ローカルストレージから対象ドメインを取得
        chrome.storage.local.get(['targetDomain'], (data) => {
          // POSTブロック有効化
          enableBlockPostRequest(data.targetDomain);
        });
      } else {
        disableBlockPostRequest();
      }
    }
  }
});

// リクエストブロック有効化処理
async function enableBlockRequest(targetDomain: string[]) {
  // リクエストブロックルールを削除
  const oldRules = await chrome.declarativeNetRequest.getDynamicRules();
  const oldRuleIds = oldRules
      .filter(rule => rule.condition.requestMethods == undefined)
      .map(rule => rule.id);

  // 既存の最大IDを取得（既存のルールがなければ 0 を設定）
  const maxId = oldRules.length > 0 ? Math.max(...oldRules.map(rule => rule.id)) : 0;

  // 新ルール作成
  const newRules: chrome.declarativeNetRequest.Rule[] = [];
  targetDomain.forEach((d: string, index: number) => {
    const target = d.replace("^", "*://").replace("$", "/*");
    newRules.push({
      id: maxId + index + 1,
      action: { type: chrome.declarativeNetRequest.RuleActionType.BLOCK },
      condition: {
        urlFilter: target,
        resourceTypes: [
          chrome.declarativeNetRequest.ResourceType.MAIN_FRAME,
          chrome.declarativeNetRequest.ResourceType.SUB_FRAME,
          chrome.declarativeNetRequest.ResourceType.STYLESHEET,
          chrome.declarativeNetRequest.ResourceType.SCRIPT,
          chrome.declarativeNetRequest.ResourceType.IMAGE,
          chrome.declarativeNetRequest.ResourceType.FONT,
          chrome.declarativeNetRequest.ResourceType.OBJECT,
          chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST,
          chrome.declarativeNetRequest.ResourceType.PING,
          chrome.declarativeNetRequest.ResourceType.CSP_REPORT,
          chrome.declarativeNetRequest.ResourceType.MEDIA,
          chrome.declarativeNetRequest.ResourceType.WEBSOCKET,
          chrome.declarativeNetRequest.ResourceType.OTHER
        ]
      },
      priority: maxId + index + 1 + 1000      // POSTブロックの優先度を下げるために1000を加算
    });
  });
  chrome.declarativeNetRequest.updateDynamicRules({
    addRules: newRules,
    removeRuleIds: oldRuleIds  // 古いルールがあれば削除
  });
  console.log(newRules);
};

// リクエストブロック無効化処理
async function disableBlockRequest() {
  // リクエストブロックルールを削除
  const oldRules = await chrome.declarativeNetRequest.getDynamicRules();
  const oldRuleIds = oldRules
      .filter(rule => rule.condition.requestMethods == undefined)
      .map(rule => rule.id);

  chrome.declarativeNetRequest.updateDynamicRules({
    addRules: [],
    removeRuleIds: oldRuleIds  // 古いルールがあれば削除
  });
};

// POSTブロック有効化処理
async function enableBlockPostRequest(targetDomain: string[]) {
  // POSTブロックルールを削除
  const oldRules = await chrome.declarativeNetRequest.getDynamicRules();
  const oldRuleIds = oldRules
      .filter(rule => rule.condition.requestMethods != undefined && rule.condition.requestMethods.includes(chrome.declarativeNetRequest.RequestMethod.POST))
      .map(rule => rule.id);

  // 既存の最大IDを取得（既存のルールがなければ 0 を設定）
  const maxId = oldRules.length > 0 ? Math.max(...oldRules.map(rule => rule.id)) : 0;

  // 新ルール作成
  const newRules: chrome.declarativeNetRequest.Rule[] = [];
  targetDomain.forEach((d: string, index: number) => {
    const target = d.replace("^", "*://").replace("$", "/*");
    newRules.push({
      id: maxId + index + 1,
      action: { type: chrome.declarativeNetRequest.RuleActionType.BLOCK },
      condition: {
        urlFilter: target,
        requestMethods: [chrome.declarativeNetRequest.RequestMethod.POST],
        resourceTypes: [
          chrome.declarativeNetRequest.ResourceType.MAIN_FRAME,
          chrome.declarativeNetRequest.ResourceType.SUB_FRAME,
          chrome.declarativeNetRequest.ResourceType.STYLESHEET,
          chrome.declarativeNetRequest.ResourceType.SCRIPT,
          chrome.declarativeNetRequest.ResourceType.IMAGE,
          chrome.declarativeNetRequest.ResourceType.FONT,
          chrome.declarativeNetRequest.ResourceType.OBJECT,
          chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST,
          chrome.declarativeNetRequest.ResourceType.PING,
          chrome.declarativeNetRequest.ResourceType.CSP_REPORT,
          chrome.declarativeNetRequest.ResourceType.MEDIA,
          chrome.declarativeNetRequest.ResourceType.WEBSOCKET,
          chrome.declarativeNetRequest.ResourceType.OTHER
        ]
      },
      priority: maxId + index + 1
    });
  });
  chrome.declarativeNetRequest.updateDynamicRules({
    addRules: newRules,
    removeRuleIds: oldRuleIds  // 古いルールがあれば削除
  });
  console.log(newRules);
}

// POSTブロック無効化処理
async function disableBlockPostRequest() {
  // POSTブロックルールを削除
  const oldRules = await chrome.declarativeNetRequest.getDynamicRules();
  const oldRuleIds = oldRules
      .filter(rule => rule.condition.requestMethods != undefined && rule.condition.requestMethods.includes(chrome.declarativeNetRequest.RequestMethod.POST))
      .map(rule => rule.id);

  chrome.declarativeNetRequest.updateDynamicRules({
    addRules: [],
    removeRuleIds: oldRuleIds  // 古いルールがあれば削除
  });
}

// リクエストブロック／POSTブロック時の処理
chrome.webRequest.onErrorOccurred.addListener(
  (details) => {
    // ドメイン判定
    var targetDomainRegExp: RegExp[] = [];
    chrome.storage.local.get(null, data => {
      const targetDomain: string[] = data.targetDomain == undefined ? [] : data.targetDomain;
      const blockRequest: boolean = data.blockRequest == undefined || typeof(data.blockRequest) !== 'boolean' ? false : data.blockRequest;
      const postAlert: boolean = data.postAlert == undefined || typeof(data.postAlert) !== 'boolean' ? false : data.postAlert;

      if (targetDomain == null || targetDomain.length == 0) return;
      targetDomain.forEach(d => {
        targetDomainRegExp.push(new RegExp(d));
      });
      // 対象ドメイン以外は処理しない
      const uri = new URL(details.url);
      const isTargetDomain = targetDomainRegExp.some(r => r.test(uri.hostname));
      if (!isTargetDomain) return;

      // エラー判定
      if (details.error !== 'net::ERR_BLOCKED_BY_CLIENT') return;

      console.log(details);

      // POSTかつPOSTブロックが有効な場合
      if (details.method === 'POST' && !blockRequest && postAlert) {
        // ポップアップを開きメッセージを送信
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
          chrome.action.openPopup()
          .then(() => {
            setTimeout(() => {
              chrome.runtime.sendMessage({ action: 'openPopup:blockPostRequest' }).catch(() => {});
            }, 300); // 少し遅延させてポップアップが開かれるのを待つ
          })
          .catch(() => {});
        });
      } else {
        // ポップアップを開きメッセージを送信
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
          chrome.action.openPopup()
          .then(() => {
            setTimeout(() => {
              chrome.runtime.sendMessage({ action: 'openPopup:blockRequest' }).catch(() => {});
            }, 300); // 少し遅延させてポップアップが開かれるのを待つ
          })
          .catch(() => {});
        });
      }
    });

  },
  { urls: ['<all_urls>'] }
);

