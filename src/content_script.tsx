import "@webcomponents/custom-elements/custom-elements.min.js";
import $ from "jquery";

// Constants
const SCROLL_THRESHOLD = 60;
const BANNER_TAG_NAME = "extension-honban-alert";

// バナー構成部分
const html = document.querySelector("html")!;
customElements.define(
  BANNER_TAG_NAME,
  class extends HTMLElement {
    constructor() {
      super();

      const shadowRoot = this.attachShadow({ mode: "open" });
      shadowRoot.innerHTML = `
      <style>
        .extension-honban-alert-div {
          all: initial;
          height: 60px
        }
        .extension-honban-alert-inner-div {
          background-color: red;
          position: relative;
          top: 0;
          z-index: 2147483647;
          width: 100%;
        }
        .extension-honban-alert-p {
          text-align: center;
          color: white;
          font-weight: bold;
          font-size: 32px;
          margin: 0;
          padding: 5px;
        }
        .extension-honban-alert-inner-div.scroll {
          position: fixed;
          animation-name: anime;
          animation-duration: 0.3s;
        }
        .extension-honban-alert-inner-div.scroll .extension-honban-alert-p {
          font-size: 12px;
          padding: 2px;
        }
        @keyframes anime {
          0% {
            opacity: 0;
          }
          100% {
            opacity: 1;
          }
        }
      </style>
      <div class="extension-honban-alert-div">
        <div class="extension-honban-alert-inner-div">
          <p class="extension-honban-alert-p">⚠ 本番環境です</p>
        </div>
      </div>
      `;
    }
  }
);

// Helper function: バナー要素を取得
function getBannerElement(): Element | undefined {
  const elements = document.getElementsByTagName(BANNER_TAG_NAME);
  return elements[0];
}

// スクロール時のバナー表示制御
const handleScroll = (e: Event) => {
  const banner = getBannerElement();
  if (!banner) return;

  const scrollTop = document.documentElement.scrollTop;
  const $innerDiv = $(banner.shadowRoot!).find(
    ".extension-honban-alert-inner-div"
  );

  if (scrollTop > SCROLL_THRESHOLD) {
    $innerDiv.addClass("scroll");
  } else {
    $innerDiv.removeClass("scroll");
  }
};

// フォーム送信時のアラート表示
const handleSubmit = (e: SubmitEvent) => {
  const formElement = e.target as HTMLFormElement;
  const method = formElement.method.toUpperCase();

  if (method !== "GET") {
    const continueFlg = window.confirm(
      "本番環境へPOSTリクエストを実行しようとしています。\n続けますか？"
    );
    if (!continueFlg) {
      e.stopPropagation();
      e.preventDefault();
    }
  }
};

// Helper function: イベントリスナーを削除
function removeEventListeners() {
  const banner = getBannerElement();
  if (banner) {
    banner.remove();
  }
  window.removeEventListener("scroll", handleScroll);
  document.querySelector("form")?.removeEventListener("submit", handleSubmit);
}

// Helper function: 対象ドメイン判定
function isTargetDomain(targetDomains: string[]): boolean {
  if (!targetDomains || targetDomains.length === 0) {
    return false;
  }

  const targetDomainRegExps = targetDomains.map((d) => new RegExp(d));
  const uri = new URL(window.location.href);
  return targetDomainRegExps.some((re) => re.test(uri.hostname));
}

// 本番環境アラート表示
const honbanAlertHandler = () => {
  chrome.storage.local.get(null, (data) => {
    const targetDomain: string[] = data.targetDomain ?? [];

    if (isTargetDomain(targetDomain)) {
      console.info(
        "%c[extension-honban-alert]%c %c⚠警告%c %c⚠本番環境を操作中です。操作には十分気をつけてください。%c",
        "color: gray;",
        "",
        "background-color: #FFCC99; padding: 2px; color: red; border-radius: 4px; font-weight: bold;",
        "",
        "font-weight: bold; font-size: 16px",
        ""
      );

      if (data.dispBanner) {
        html.prepend(document.createElement(BANNER_TAG_NAME));
        window.addEventListener("scroll", handleScroll);
      }

      if (data.postAlert) {
        document
          .querySelector("form")
          ?.addEventListener("submit", handleSubmit);
      }

      chrome.runtime.sendMessage({
        target: "changeBadge:background",
        badgeText: "!",
      });
    }
  });
};

honbanAlertHandler();

// メッセージ受信時の処理
chrome.runtime.onMessage.addListener((req, options, sendResponse) => {
  if (req.target === "honbanAlertHandler:contentScript") {
    removeEventListeners();
    chrome.runtime.sendMessage({
      target: "changeBadge:background",
      badgeText: "",
    });
    honbanAlertHandler();
  }
  sendResponse();
  return true;
});
