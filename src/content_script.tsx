import "@webcomponents/custom-elements/custom-elements.min.js";
import $ from "jquery";

// バナー構成部分
const html = document.querySelector("html")!;
customElements.define(
  'extension-honban-alert',
  class extends HTMLElement {
    constructor() {
      super();

      const shadowRoot = this.attachShadow({mode: 'open'});
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
      `
    }
  }
)
// html.prepend(document.createElement("extension-honban-alert"));

// $(function () {
//   var header = $("extension-honban-alert");
//   $(window).on("load scroll", function () {
//     var value = $(this).scrollTop();
//     console.log(value);
//     if (!(value == undefined) && (value > 100)) {
//       //スクロールしたら.scroll付与
//       // $header.addClass("scroll");
//       $($(header)[0].shadowRoot!)
//         .find(".extension-honban-alert-div")
//         .addClass("scroll");
//     } else {
//       // $header.removeClass("scroll");
//       $($(header)[0].shadowRoot!)
//         .find(".extension-honban-alert-div")
//         .removeClass("scroll");
//     }
//   });
// });

// スクロール時のバナー表示制御
const target = document.getElementsByTagName("extension-honban-alert");
const handleScroll = (e: Event) => {
  const scrollTop = document.documentElement.scrollTop;
  if (scrollTop > 60) {
    $($(target)[0].shadowRoot!)
      .find(".extension-honban-alert-inner-div")
      .addClass("scroll");
  } else {
    $($(target)[0].shadowRoot!)
      .find(".extension-honban-alert-inner-div")
      .removeClass("scroll");
  }
}
// window.addEventListener('scroll', handleScroll);

// フォーム送信時のアラート表示
const handleSubmit = (e: SubmitEvent) => {
  const formElement = e.target as HTMLFormElement;
  console.log(formElement.method);
  if (!(formElement.method === "get" || formElement.method === "GET")) {
    let continueFlg = window.confirm("本番環境へPOSTリクエストを実行しようとしています。\n続けますか？");
    if (!continueFlg) {
      e.stopPropagation();
      e.preventDefault();
    }
  }
}
// window.addEventListener('submit', handleSubmit);
// document.querySelector('form')?.addEventListener('submit', handleSubmit);

// 本番環境アラート表示
const honbanAlertHandler = () => {
  var targetDomainRegExp: RegExp[] = [];
  chrome.storage.local.get(null, data => {
    const targetDomain: string[] = data.targetDomain == undefined ? [] : data.targetDomain;
    if (targetDomain == null || targetDomain.length == 0) return;
    targetDomain.forEach(d => {
      targetDomainRegExp.push(new RegExp(d));
    });
    const uri = new URL(window.location.href);
    targetDomainRegExp.some(re => {
      if (re.test(uri.hostname)) {
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
          html.prepend(document.createElement("extension-honban-alert"));
          window.addEventListener("scroll", handleScroll);
        }
        if (data.postAlert) {
          document.querySelector("form")?.addEventListener("submit", handleSubmit);
        }
        chrome.runtime.sendMessage({target: 'changeBadge:background', badgeText: "!"})
        return true;
      }
    })
  });
}
honbanAlertHandler();

// メッセージ受信時の処理
chrome.runtime.onMessage.addListener((req, options, sendResponse) => {
  if (req.target ==='honbanAlertHandler:contentScript') {
    var banner = document.getElementsByTagName("extension-honban-alert");
    if (banner[0] != undefined) banner[0].remove();
    window.removeEventListener("scroll", handleScroll);
    document.querySelector("form")?.removeEventListener("submit", handleSubmit);
    chrome.runtime.sendMessage({
      target: "changeBadge:background",
      badgeText: "",
    });
    honbanAlertHandler();
  }
  sendResponse();
  return true;
})