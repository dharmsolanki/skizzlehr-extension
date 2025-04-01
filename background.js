chrome.action.onClicked.addListener((tab) => {
    chrome.scripting.insertCSS({
      target: { tabId: tab.id },
      files: ["bootstrap.min.css"], // Ensure the CSS file exists
    });
  
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["bootstrap.bundle.min.js", "script.js"], // Ensure the JS file exists
    });
  });
  