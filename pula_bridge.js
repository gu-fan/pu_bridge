(function(){

    if (window.PupuBridge) { return }

    var BRIDGE_VERSION = '1.0.0'
    var ua = window.navigator.userAgent
        ,is_webview = /PUPUPULA/.test(ua)
        ,is_ios = window.WebViewJavascriptBridge ? true : /iP(ad|hone|od)/.test(ua)

    function loadWebViewBridge(callback) {
            if (window.WebViewJavascriptBridge) { return callback(WebViewJavascriptBridge); }
            if (window.WVJBCallbacks) { return window.WVJBCallbacks.push(callback); }
            window.WVJBCallbacks = [callback];
            var WVJBIframe = document.createElement('iframe');
            WVJBIframe.style.display = 'none';
            WVJBIframe.src = 'https://__bridge_loaded__';
            document.documentElement.appendChild(WVJBIframe);
            setTimeout(function() { document.documentElement.removeChild(WVJBIframe) }, 0)
    }

  window.pp = window.PupuBridge = { 
      is_webview: is_webview,
      is_ios: is_ios,
      ready : function(fn) {
        console.log("ready")
        if (is_ios && is_webview) {
            loadWebViewBridge()
        }
      }
  }
})()

