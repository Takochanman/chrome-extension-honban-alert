// Constants
const POLLING_INTERVAL_MS = 30 * 1000; // 30 seconds
const POPUP_OPEN_DELAY_MS = 300;
const PRIORITY_OFFSET = 1000; // Offset for request block priority

const ALL_RESOURCE_TYPES = [
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
  chrome.declarativeNetRequest.ResourceType.OTHER,
] as chrome.declarativeNetRequest.ResourceType[];

const DEFAULT_SETTINGS = {
  dispBanner: true,
  blockRequest: true,
  postAlert: true,
};

function polling() {
  setTimeout(polling, POLLING_INTERVAL_MS);
}

polling();

// ローカルストレージ初期化処理
chrome.storage.local.get({ targetDomain: null }, (data) => {
  console.log(data);
  if (data.targetDomain == null || data.targetDomain.length === 0) {
    fetch(chrome.runtime.getURL("setting.json"))
      .then((res) => res.json())
      .then((settingsData) => {
        const settings = {
          targetDomain: settingsData.targetDomain,
          dispBanner:
            typeof settingsData.dispBanner === "boolean"
              ? settingsData.dispBanner
              : DEFAULT_SETTINGS.dispBanner,
          blockRequest:
            typeof settingsData.blockRequest === "boolean"
              ? settingsData.blockRequest
              : DEFAULT_SETTINGS.blockRequest,
          postAlert:
            typeof settingsData.postAlert === "boolean"
              ? settingsData.postAlert
              : DEFAULT_SETTINGS.postAlert,
        };
        chrome.storage.local.set(settings);
      });
  }
});

// アイコンバッジ変更処理
chrome.runtime.onMessage.addListener((req) => {
  if (req.target === "changeBadge:background") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.action.setBadgeText({ text: req.badgeText, tabId: tabs[0].id });
        chrome.action.setBadgeTextColor({ color: "white" });
        chrome.action.setBadgeBackgroundColor({
          color: "red",
          tabId: tabs[0].id,
        });
      }
    });
  }
});

// ローカルストレージ変更時の処理
chrome.storage.onChanged.addListener(async (changes, namespace) => {
  if (namespace === "local") {
    if (changes.targetDomain) {
      chrome.storage.local.get(["blockRequest"], (data) => {
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
        chrome.storage.local.get(["targetDomain"], (data) => {
          // リクエストブロック有効化
          enableBlockRequest(data.targetDomain);
        });
      } else {
        disableBlockRequest();
      }
    } else if (changes.postAlert) {
      if (changes.postAlert.newValue) {
        // ローカルストレージから対象ドメインを取得
        chrome.storage.local.get(["targetDomain"], (data) => {
          // POSTブロック有効化
          enableBlockPostRequest(data.targetDomain);
        });
      } else {
        disableBlockPostRequest();
      }
    }
  }
});

// Helper function: 対象ドメインからURLフィルターに変換
function convertDomainToUrlFilter(domain: string): string {
  return domain.replace(/\^/g, "*://").replace(/\$/g, "/*");
}

// Helper function: 既存ルールから指定条件のルールIDを取得
async function getRuleIdsByFilter(
  filterFn: (rule: chrome.declarativeNetRequest.Rule) => boolean
): Promise<number[]> {
  const rules = await chrome.declarativeNetRequest.getDynamicRules();
  return rules.filter(filterFn).map((rule) => rule.id);
}

// Helper function: 既存ルールの最大IDを取得
async function getMaxRuleId(): Promise<number> {
  const rules = await chrome.declarativeNetRequest.getDynamicRules();
  return rules.length > 0 ? Math.max(...rules.map((rule) => rule.id)) : 0;
}

// Helper function: ルールを更新
async function updateRules(
  addRules: chrome.declarativeNetRequest.Rule[],
  removeRuleIds: number[]
): Promise<void> {
  await chrome.declarativeNetRequest.updateDynamicRules({
    addRules,
    removeRuleIds,
  });
  console.log("Rules updated:", addRules);
}

// リクエストブロック有効化処理
async function enableBlockRequest(targetDomain: string[]) {
  const oldRuleIds = await getRuleIdsByFilter(
    (rule) => rule.condition.requestMethods === undefined
  );
  const maxId = await getMaxRuleId();

  const newRules: chrome.declarativeNetRequest.Rule[] = targetDomain.map(
    (domain, index) => ({
      id: maxId + index + 1,
      action: { type: chrome.declarativeNetRequest.RuleActionType.BLOCK },
      condition: {
        urlFilter: convertDomainToUrlFilter(domain),
        resourceTypes: ALL_RESOURCE_TYPES,
      },
      priority: maxId + index + 1 + PRIORITY_OFFSET, // POSTブロックの優先度を下げるために加算
    })
  );

  await updateRules(newRules, oldRuleIds);
}

// リクエストブロック無効化処理
async function disableBlockRequest() {
  const oldRuleIds = await getRuleIdsByFilter(
    (rule) => rule.condition.requestMethods === undefined
  );
  await updateRules([], oldRuleIds);
}

// POSTブロック有効化処理
async function enableBlockPostRequest(targetDomain: string[]) {
  const oldRuleIds = await getRuleIdsByFilter(
    (rule) =>
      rule.condition.requestMethods?.includes(
        chrome.declarativeNetRequest.RequestMethod.POST
      ) ?? false
  );
  const maxId = await getMaxRuleId();

  const newRules: chrome.declarativeNetRequest.Rule[] = targetDomain.map(
    (domain, index) => ({
      id: maxId + index + 1,
      action: { type: chrome.declarativeNetRequest.RuleActionType.BLOCK },
      condition: {
        urlFilter: convertDomainToUrlFilter(domain),
        requestMethods: [chrome.declarativeNetRequest.RequestMethod.POST],
        resourceTypes: ALL_RESOURCE_TYPES,
      },
      priority: maxId + index + 1,
    })
  );

  await updateRules(newRules, oldRuleIds);
}

// POSTブロック無効化処理
async function disableBlockPostRequest() {
  const oldRuleIds = await getRuleIdsByFilter(
    (rule) =>
      rule.condition.requestMethods?.includes(
        chrome.declarativeNetRequest.RequestMethod.POST
      ) ?? false
  );
  await updateRules([], oldRuleIds);
}

// Helper function: ポップアップを開いてメッセージ送信
function openPopupWithMessage(action: string) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.action
      .openPopup()
      .then(() => {
        setTimeout(() => {
          chrome.runtime.sendMessage({ action }).catch(() => {});
        }, POPUP_OPEN_DELAY_MS);
      })
      .catch(() => {});
  });
}

// Helper function: ドメイン判定
function isTargetDomain(url: string, targetDomains: string[]): boolean {
  if (!targetDomains || targetDomains.length === 0) {
    return false;
  }

  const uri = new URL(url);
  const targetDomainRegExps = targetDomains.map((d) => new RegExp(d));
  return targetDomainRegExps.some((r) => r.test(uri.hostname));
}

// リクエストブロック／POSTブロック時の処理
chrome.webRequest.onErrorOccurred.addListener(
  (details) => {
    chrome.storage.local.get(null, (data) => {
      const targetDomain: string[] = data.targetDomain ?? [];
      const blockRequest: boolean =
        typeof data.blockRequest === "boolean" ? data.blockRequest : false;
      const postAlert: boolean =
        typeof data.postAlert === "boolean" ? data.postAlert : false;

      // 対象ドメイン判定
      if (!isTargetDomain(details.url, targetDomain)) {
        return;
      }

      // エラー判定
      if (details.error !== "net::ERR_BLOCKED_BY_CLIENT") {
        return;
      }

      console.log(details);

      // POSTかつPOSTブロックのみ有効な場合
      if (details.method === "POST" && !blockRequest && postAlert) {
        openPopupWithMessage("openPopup:blockPostRequest");
      } else {
        openPopupWithMessage("openPopup:blockRequest");
      }
    });
  },
  { urls: ["<all_urls>"] }
);
