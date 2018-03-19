/* Momo Bridge v2.0
 * Document: https://fes.wemomo.com/momotouch?action=bridge
 * Syntax compatible with ES5
 *
 * This API is used for momo_webview with app version 5.6+.
 * No guarantee or warranty for any other purpose of usage.
 */

(function(){

    if (window.MomoBridge) { return }

    var BRIDGE_VERSION = '2.1.1'

    var last_modified = 'Modified: 2015-08-12_18:09:48'
    var uniqueId = 1

// Init with window object
    var ua = window.navigator.userAgent
        ,is_webview = /(momo|molive|momoGame)WebView/.test(ua)
        ,is_ios = window.WebViewJavascriptBridge ? true : /iP(ad|hone|od)/.test(ua)
        ,is_android = window.aobj ? true : /android/.test(ua)
        ,is_wp = /Windows Phone/.test(ua)
        ,is_mobile = /Mobile/.test(ua)
        ,is_pc = !is_mobile
        ,is_unknown = (!is_android && !is_ios && !is_wp)
        ,is_hasNet = /netType\/(\d)/.exec(ua)
        ,is_wifi =  !is_webview || !is_hasNet ? false : is_hasNet[1] == '1' ? true : false 
        ,version = /momoWebView\/(\d+)\.(\d+)\.?(\d+)?/.exec(ua) ||  ['', '0', '0']
        ,momo_main_version = parseInt(version[1])
        ,momo_minor_version = parseInt(version[2])
        ,momo_version = version[1] + '.' + version[2] + (version[3]? ('.'+ version[3]):'')
        ,_native_obj = null
        ,debug = 0
        ,query = {}

    try { location.search.substr(1).split("&").forEach(function(item) {(item.split("=")[0] in query) ? query[item.split("=")[0]].push(item.split("=")[1]) : query[item.split("=")[0]] = [item.split("=")[1],]})
    } catch (err) { }

// force loading WebViewBridge
    function loadWebViewBridge() {
        if (window.WebViewJavascriptBridge) { return }
        var messagingIframe
        var sendMessageQueue = []
        var receiveMessageQueue = []
        var messageHandlers = {}

        var CUSTOM_PROTOCOL_SCHEME = 'wvjbscheme'
        var QUEUE_HAS_MESSAGE = '__WVJB_QUEUE_MESSAGE__'

        var responseCallbacks = {}
        var uniqueId = 1

        function _createQueueReadyIframe(doc) {
            messagingIframe = doc.createElement('iframe')
            messagingIframe.style.display = 'none'
            messagingIframe.src = CUSTOM_PROTOCOL_SCHEME + '://' + QUEUE_HAS_MESSAGE
            doc.documentElement.appendChild(messagingIframe)
        }

        function init(messageHandler) {
            if (WebViewJavascriptBridge._messageHandler) { throw new Error('WebViewJavascriptBridge.init called twice') }
            WebViewJavascriptBridge._messageHandler = messageHandler
            var receivedMessages = receiveMessageQueue
            receiveMessageQueue = null
            for (var i=0; i<receivedMessages.length; i++) {
                _dispatchMessageFromObjC(receivedMessages[i])
            }
        }

        function send(data, responseCallback) {
            _doSend({ data:data }, responseCallback)
        }

        function registerHandler(handlerName, handler) {
            messageHandlers[handlerName] = handler
        }

        function callHandler(handlerName, data, responseCallback) {
            _doSend({ handlerName:handlerName, data:data }, responseCallback)
        }

        function _doSend(message, responseCallback) {
            if (responseCallback) {
                var callbackId = 'cb_'+(uniqueId++)+'_'+new Date().getTime()
                responseCallbacks[callbackId] = responseCallback
                message['callbackId'] = callbackId
            }
            sendMessageQueue.push(message)
            messagingIframe.src = CUSTOM_PROTOCOL_SCHEME + '://' + QUEUE_HAS_MESSAGE
        }

        function _fetchQueue() {
            var messageQueueString = JSON.stringify(sendMessageQueue)
            sendMessageQueue = []
            return messageQueueString
        }

        function _dispatchMessageFromObjC(messageJSON) {
            setTimeout(function _timeoutDispatchMessageFromObjC() {
                var message = JSON.parse(messageJSON)
                var messageHandler
                var responseCallback

                if (message.responseId) {
                    responseCallback = responseCallbacks[message.responseId]
                    if (!responseCallback) { return; }
                    responseCallback(message.responseData)
                    delete responseCallbacks[message.responseId]
                } else {
                    if (message.callbackId) {
                        var callbackResponseId = message.callbackId
                        responseCallback = function(responseData) {
                            _doSend({ responseId:callbackResponseId, responseData:responseData })
                        }
                    }

                    var handler = WebViewJavascriptBridge._messageHandler
                    if (message.handlerName) {
                        handler = messageHandlers[message.handlerName]
                    }

                    try {
                        handler(message.data, responseCallback)
                    } catch(exception) {
                        if (typeof console != 'undefined') {
                            console.log("WebViewJavascriptBridge: WARNING: javascript handler threw.", message, exception)
                        }
                    }
                }
            })
        }

        function _handleMessageFromObjC(messageJSON) {
            if (receiveMessageQueue) {
                receiveMessageQueue.push(messageJSON)
            } else {
                _dispatchMessageFromObjC(messageJSON)
            }
        }

        window.WebViewJavascriptBridge = {
            init: init,
            send: send,
            registerHandler: registerHandler,
            messageHandlers: messageHandlers,
            callHandler: callHandler,
            _fetchQueue: _fetchQueue,
            _handleMessageFromObjC: _handleMessageFromObjC
        }

        var doc = document
        _createQueueReadyIframe(doc)
    }

    if (is_android && window.aobj) {
        _native_obj = window.aobj
    } else if (is_ios) {
        if (window.WebViewJavascriptBridge) {
            _native_obj = window.WebViewJavascriptBridge
        } else if ( is_webview ){
            loadWebViewBridge()
            _native_obj = window.WebViewJavascriptBridge
        }
    }

    var MoAdapter = function (obj) {
        var i
        this.name = 'basic'
        this.invoke = function(){ }
        for(i in obj) { this[i] = obj[i] }
        return this
    }

// Platform specific Adapters.
    var NOOP = function(){}

    var iOSAdapter = {
        name: 'ios',
        _NAME: {
            'init': 'handleStateInfo',
            'closeWindow': 'close',
            'callShare': 'showGeneralShare',
        },
        _CB : {
            'readImage': 'momo_btn_controller_setImageSrc',
        },
        _pre: function (){
            this._native_obj.init(function(message){ this.log('ios initial') })
        },
        invoke: function(){
            var args = Array.prototype.slice.apply(arguments)
            try {

                // NOTE: the 'this' is binded to the bridge which is the parent of adpater
                var _adp = this._adapter, __handler, __callback, __cbk

                // When no param is passed, this will be null not undefined.
                if (typeof args[1] == 'undefined') args[1] = '{}'
                args.push(NOOP)

                var _orig = args[0]
                args[0] = _adp._NAME.hasOwnProperty(args[0]) ? _adp._NAME[args[0]] : args[0]

                // XXX: doing things on _obj will change args[1] too if args[1] is object
                var _obj = ( typeof args[1] == 'string' ) ?  JSON.parse(args[1]) : args[1]

                // registe handler for callback
                if (_orig == 'init') {
                    if (_obj.hasOwnProperty('ui_btn') ) {
                        // We should loop through the buttons parameter to
                        // change callback name to handler compatible and
                        // register it.

                        __handler == false
                        for (var i=0; i < _obj.ui_btn.buttons.length; i++)  {
                            if ( _obj.ui_btn.buttons[i].param.callback ) {
                                __callback =  _obj.ui_btn.buttons[i].param.callback

                                this._native_obj.registerHandler(__callback.replace(/\./g, '_'), function(data){
                                    try {
                                        var cbk = eval(__callback)
                                        if (cbk && typeof cbk === 'function'){
                                            cbk.call(null, data)
                                        }
                                    } catch (err) {
                                    }
                                }.bind(this))
                            }
                        }
                    }
                } else if (_orig == 'callShare' || _orig == 'shareOne'){
                    __callback =  _obj.hasOwnProperty('callback') ? _obj.callback : null
                    __handler = __callback.replace(/\./g, '_')
                } else {
                    __callback =  _obj.hasOwnProperty('callback') ? _obj.callback : null
                    __handler = _adp._CB.hasOwnProperty(_orig) ? _adp._CB[_orig] : ''
                    __handler = (__handler == '') ? ('momo_bridge_' + _orig) : __handler
                }

                if (__callback && __handler) {
                    this._native_obj.registerHandler(__handler, function(data){
                        // We evaluate the callback here, as it's defined in json and
                        // write in page. No more security issues, only risk of page crashing.
                        try {
                            var cbk = eval(__callback)
                            if (cbk && typeof cbk === 'function'){
                                if (_orig == 'readImage'){
                                    cbk.call(null, data.id,data.data,data.size,data.type)
                                } else {
                                    cbk.call(null, data)
                                }
                            }
                        } catch (err) {
                        }
                    }.bind(this))
                }

                this._native_obj.callHandler.apply(null, args)

            } catch (err) {
            }
        }
    }

    var AndroidAdapter = {
        name: 'android',
        invoke: function(){
            // XXX: Due to unknow reason, we can not apply inside invoke.
            // maybe coz it is a java object
            var args = Array.prototype.slice.apply(arguments)
            var fn = args.shift()
            if (this._native_obj[fn] && typeof this._native_obj[fn] === 'function' ){
                try {
                    if (args[0] ) {
                        this._native_obj[fn](args[0])
                    } else {
                        this._native_obj[fn]()
                    }
                } catch (err) {
                }
            } else {
            }
        }
    }

    var WpAdapter = {
        name: 'win phone',
        invoke: function(){
            var args = Array.prototype.slice.apply(arguments)
            var fn = args.shift()

            try {
                window.external.notify('{"'+fn+'": '+ args+'}')
            } catch (err) {
            }

        }
    }

    var _Bridge = function (){

        if (_native_obj) {

            this._native_obj = _native_obj
            if (is_ios) { this._adapter = new MoAdapter(iOSAdapter) }
            else if (is_android) { this._adapter = new MoAdapter(AndroidAdapter) }

        } else {

            this._native_obj = null
            if (is_wp) { this._adapter = new MoAdapter(WpAdapter) }
            else { this._adapter = new MoAdapter() }
        }

        if (this._adapter._pre) {
            this._adapter._pre.call(this)
        }

        return this
    }

    _Bridge.prototype= {
        version : BRIDGE_VERSION,
        last_modified : last_modified,
        is_webview : is_webview,
        momo_version : momo_version,
        momo_main_version : momo_main_version,
        momo_minor_version : momo_minor_version,
        is_wifi : is_wifi,
        ua : ua,
        query : query,
        href : window.location.href,
        platform  : is_ios ? 'ios' : is_android ? 'android' : is_wp ? 'win_phone' : 'unknown',
        _callbacks : {},
        init: function(arg){
            // init a clean UI
            this.ready(function(BRG){
                if (arg){
                    BRG.invoke('init', arg)
                } else {
                    // The android MonkeyPatch for share button
                    if (is_android && momo_version == '6.1' ) {
                        BRG.invoke('init', {
                            enable:{ back:0, forward:0, refresh:0, share:0, scrollbar:0, ui_btn:0 },
                            ui_btn:{buttons:[{text:'',action:0}]}
                        })
                    } else if (is_ios) {
                        setTimeout(function(){
                            BRG.invoke('init', {
                                enable:{ back:0, forward:0, refresh:0, share:0, scrollbar:0, ui_btn:0 }
                            })
                        }, 10)
                    } else {
                        BRG.invoke('init', {
                            enable:{ back:0, forward:0, refresh:0, share:0, scrollbar:0, ui_btn:0 }
                        })
                    }
                }
            })
        },
        //  Invoke a function from the adapter
        invoke : function(fn, param, callback){

            var Fn = this._adapter[fn] || null

            // convert to array and remove the first argument as that's the fn string.
            // NOTE: the callback fn is not in the arguments.
            var args = Array.prototype.slice.apply(arguments)


            if ( param ) {
                try {

                    var _obj = (typeof param == 'string' ) ? JSON.parse(param) : param

                    if (callback && typeof callback == 'function' && typeof _obj.callback == 'undefined') {
                        var callbackId = 'cb_'+(uniqueId++)+'_'+new Date().getTime()
                        if (!this._callbacks.hasOwnProperty(fn)) this._callbacks[fn] = {}
                        this._callbacks[fn][callbackId] = callback
                        _obj.callback = 'MomoBridge._callbacks.' + fn + '.' + callbackId
                    }

                    //add 'sdk'
                    if(fn == 'callShare' || fn == 'shareOne' || fn == 'init'){
                        var feed = null;
                        if(_obj.configs && _obj.configs.momo_feed) {
                            feed = _obj.configs.momo_feed;
                        }else if(_obj.app == 'momo_feed'){
                            feed = _obj;
                        }else if(_obj.share && _obj.share.configs && _obj.share.configs.momo_feed){
                            feed = _obj.share.configs.momo_feed;
                        }
                        if (feed && typeof feed.sdk == 'undefined' && !feed.pic && feed.resource) {
                            feed.sdk = 1;
                        }
                    }

                    param =  JSON.stringify(_obj)

                } catch(err) {
                    return
                }
            }

            if (Fn && typeof Fn === 'function' ) {
                args.shift()
                // use setTimeout
                window.setTimeout(function(){  Fn.apply(this, args) }.bind(this))
            } else {
                // Using invoke to execute it's function follow it's pattern.
                // the callback is moved into param
                window.setTimeout(function(){
                    this._adapter.invoke.call(this, fn, param)
                }.bind(this))
            }
        },
        // Get a key from the adapter.
        get : function(key) {
            return this._adapter[key]
        },
        // NOTE: ready with DOM loaded.
        ready : function(fn) {
            if (/complete|loaded|interactive/.test(document.readyState) && document.body) {
                fn.call(null, this)
            } else document.addEventListener('DOMContentLoaded', function(){
                fn.call(null, this)
            }.bind(this), false)
            return this
        },
        fireDocumentEvent : function(type, name, data, origin) {
            var evt;
            if (type == 'bridgeEvent') {
                name = 'be:'+name;
            }

            evt = document.createEvent('Events');
            evt.initEvent(name, false, false);
            evt.name = name;
            if (data) {evt.data = data;}
            if (origin) {evt.origin = origin;}
            document.dispatchEvent(evt);
        },
        compare: function(version){
            var now = momo_version.split('.');
            var tar = version.toString().split('.');
            var len = Math.max(tar.length, now.length);
            try {
                for (var i = 0; i < len; i++) {
                    var l = isFinite(now[i]) && Number(now[i]) || 0,
                        r = isFinite(tar[i]) && Number(tar[i]) || 0;
                    if (l < r) {
                        /* 目标版本低于当前版本 */
                        return - 1;
                    } else if (l > r) {
                        /* 目标版本大于当前版本 */
                        return 1;
                    }
                }
            } catch(e) {
                return - 1;
            }
            /* 相等 */
            return 0;
        }
    }


//  In Page Debugger
    _Bridge.prototype.debug = function(){}

    _Bridge.prototype.set_logger= function(logger){}

// In Page Logger
    _Bridge.prototype.log = function(){}


// For compatibility of newer page in the older client,
// We should add the setImageSrc function there.
    if ((momo_version < 5.6) ){
        if(!window.momo_btn_controller) {
            window.momo_btn_controller = {
                setImageSrc:function(id,data,size,type){
                    if(!data)  { return false }
                    document.getElementById(id).src="data:image/jpeg;base64,"+data
                }
            }
        }
    }

    module.exports = window.mm = window.MomoBridge = new _Bridge()


})()

