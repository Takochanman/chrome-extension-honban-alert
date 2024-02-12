function polling() {
  // console.log("polling");
  setTimeout(polling, 1000 * 30);
}

polling();

chrome.storage.local.get({targetDomain: null}, (data) => {
  console.log(data)
  if (data.targetDomain == null || data.targetDomain.length == 0) {
    fetch(chrome.runtime.getURL("setting.json"))
      .then(res => res.json())
      .then(data => {
        console.log(data)
        chrome.storage.local.set({targetDomain: data.targetDomain});
        chrome.storage.local.set({dispBanner: data.dispBanner == undefined || typeof(data.dispBanner) === 'boolean' ? true : data.dispBanner});
        chrome.storage.local.set({postAlert: data.postAlert == undefined || typeof(data.postAlert) === 'boolean' ? true : data.postAlert});
      })
  }
});

chrome.runtime.onMessage.addListener((req) => {
  if (req.target === 'changeBadge:background') {
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      chrome.action.setBadgeText({ text: req.badgeText, tabId: tabs[0].id });
      chrome.action.setBadgeTextColor({color: 'white'})
      chrome.action.setBadgeBackgroundColor({ color: "red", tabId: tabs[0].id });
    })
  }
})

