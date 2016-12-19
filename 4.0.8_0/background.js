'use strict';
var Wiz_Context = {
    token : '',     //token初始值不能设置为null，会造成xmlrpc无法解析，返回错误
    tab : null,
    user_id : null,
    queryTime: 0,  // 当前轮询次数
    cookies: null,
    myWizEmail: '',
    openAPIUrl: ''
};

Wiz_Context.queryTimeArray = Wiz.Constant.Service.QUERY_TIME_ARRAY;

function onConnectListener(port) {
    //console.log('-------onConnectListener----')
    //console.log(port)
    var name = port.name;
    if (!name) {
        return;
    }
    switch (name) {
        case 'login':
            port.onMessage.addListener(portLogin);
            break;
        case 'retryClip':
            retryClip(port);
            break;
        case 'requestTag':
            // token不能为空否则会造成
            //console.log(Wiz_Context.token);
            wiz_requestTag(port);
            break;
        case 'requestCategory':
            // token不能为空否则会造成
            //console.log(Wiz_Context.token);
            wiz_requestCategory(port);
            break;
        case 'requestCategoryForce':
            // token不能为空否则会造成
            //console.log(Wiz_Context.token);
            wiz_requestCategory(port);
            break;
        case 'saveDocument':
            port.onMessage.addListener(function (info) {
                //console.log(info);
                if (!info ) {
                    return;
                }
                if (info.isNative === true) {
                    //调用本地客户单保存，不需要进行登录
                    saveToNative(info);
                } else {
                    if (!info.title|| !info.params) {
                        return;
                    }
                    //登录成功后保存
                    saveToServer(info);
                }
            });
            break;
        case 'checkLogin':
            port.onMessage.addListener(function (msg) {
                if (Wiz_Context.token !== null) {
                    getTab(wizRequestPreview);
                    port.postMessage(true);
                } else {
                    port.postMessage(false);
                }
            });
            break;
        case 'initRequest':
            //页面初始化请求，需要返回是否已登录、是否可获取文章、是否可获取选择信息
            //TODO 返回是否可获取文章、是否可获取选择信息
            var hasNative = hasNativeClient(),
                info = {
                    token : Wiz_Context.token,
                    hasNative : hasNative
                };
            getTab(wizRequestPreview);
            port.postMessage(info);
            break;
        case 'onkeydown':
            port.onMessage.addListener(function (msg) {
                if (!Wiz_Context.token) {
                    return false;
                } else {
                    var direction = msg.direction;
                    getTab(bindKeyDownHandler, direction);
                }
            });
            break;
        case 'popupClosed':
            port.onDisconnect.addListener(function () {
                getTab(hideContentVeil);
            });
//            console.log("popupClosed msg received!");
            break;
        case 'preview':
            port.onMessage.addListener(function (msg) {
                if (!msg) {
                    return;
                }
                getTab(wizRequestPreview, msg);
            });
            break;
        case 'requestToken':
            if (Wiz_Context.token) {
                port.postMessage(Wiz_Context.token);
            }
            break;
        case 'logout':
            Wiz_Context.token = null;
            break;
    }
}

function portLogin(loginParam, port) {
    portLoginAjax(loginParam, port);
}


function retryClip(port) {
    //不自动增加cookie时间
    port.onMessage.addListener(function (msg) {
        if (msg && msg.title && msg.params) {
            saveToServer(msg);
        }
    });
}

/**
 * 通过cookie自动登录
 * @param  {[type]} cookie [cookie中保存到用户信息]
 * @param  {[type]} params [文档信息，如果不为空，登录成功后，调用自动保存]
 */
function wiz_loginByCookies(cookie, params, callback) {
    var loginParam = {};
    if (cookie && cookie.value) {
        loginParam = getloginParam(cookie);
    } else {
        return false;
    }
    portLoginAjax(loginParam, null, params, callback);
}

function getloginParam(cookie) {
    var info = cookie.value,
//        split_count = info.indexOf('*md5'),
        loginParam = {};
    loginParam.client_type = Wiz.Constant.LOGIN_PARAMS.CLIENT_TYPE;
    loginParam.api_version = Wiz.Constant.LOGIN_PARAMS.API_VERSION;
//    loginParam.user_id = info.substring(0, split_count);
//    loginParam.password = info.substring(split_count + 1);
    loginParam.cookie_str = info;
    return loginParam;
}


function portLoginAjax(loginParam, port, params, callback) {
    var loginError = function (err) {
        try {
            if (port) {
                port.postMessage(err);
            }
        } catch (error) {
            console.log('portLoginAjax callError Error: ' + error);
        }
    };
    var loginSuccess = function (responseJSON) {
        try {
            if (responseJSON.code != '200') {
                if (port) {
                    port.postMessage({code: responseJSON.code});
                }
                //cookie登录失败(更改密码)，清除cookie和localStorage
                Wiz.Cookie.removeCookies(Wiz.Constant.Default.COOKIE_URL, Wiz.Constant.Default.COOKIE_CERT);
                localStorage.clear();
                return;
            }
            //console.log(responseJSON);
            Wiz_Context.token = responseJSON.token;
            Wiz_Context.kbGuid = responseJSON.kb_guid;
            Wiz_Context.myWizEmail = responseJSON.mywiz_email;
            if (params) {
                saveToServer(params);
            }
            if (port) {
                port.postMessage({
                    code: responseJSON.code,
                    cookieStr: responseJSON.cookie_str
                });
                getTab(wizRequestPreview);
                if (callback) {
                    callback(port);
                }
            }
        } catch (error) {
            console.log('portLoginAjax callSuccess Error: ' + error);
        }
        //只要登录成功就自动保持在线
        //服务端会一直保持该token对象在内存中
        //用户量大的时候，会导致服务端压力过大
        //TODO 以后token有效期延长时，可以使用该方法
        // if (!Wiz_Context.process) {
        //  Wiz_Context.process = setInterval(refreshToken, Wiz_Context.refresh_token_delay_ms);
        // }
    };
    //缓存userid
    Wiz_Context.user_id = loginParam.user_id;
    var openapiUrl = getOpenApiUrl();
    $.ajax({
        type: 'POST',
        url: openapiUrl + '/login',
        data: loginParam,
        success : loginSuccess,
        error : loginError
    });
    // xmlrpc(Wiz_Context.xmlUrl, 'accounts.clientLogin', [loginParam], loginSuccess, loginError);
}

function wiz_requestTag(port) {
    var tagStr = getLocalTag();

    //必须校验token，否则会传入null进去，代码不健壮会造成死循环
    if (port) {
        //本地如果为获取到文件夹信息，则获取服务端的文件夹信息
        // console.log('wiz_requestTag tagStr: ' + tagStr);
        //目前不需要 刷新 功能
        //if (tagStr && port.name != 'requestTagForce') {
        if (tagStr) {
            port.postMessage(tagStr);
        } else {
            //已经登录的，直接调用获取目录信息
            if (Wiz_Context.token) {
                wiz_portRequestTagAjax(port);
            } else {
                if (Wiz_Context.cookies) {
                    var loginParam = getloginParam(Wiz_Context.cookies);
                    portLoginAjax(loginParam, port, null, wiz_portRequestTagAjax);
                }
            }
        }
    }
}

function wiz_requestCategory(port) {
    var nativeCategoryStr = getNativeCagetory(Wiz_Context.user_id),
        localCategoryStr = getLocalCategory(),
        categoryStr = (nativeCategoryStr) ? (nativeCategoryStr) : (localCategoryStr);

    //必须校验token，否则会传入null进去，代码不健壮会造成死循环
    if (port) {
        //本地如果为获取到文件夹信息，则获取服务端的文件夹信息
        // console.log('wiz_requestCategory categoryStr: ' + categoryStr);
        if (categoryStr && port.name != 'requestCategoryForce') {
            port.postMessage(categoryStr);
        } else {
            //已经登录的，直接调用获取目录信息
            if (Wiz_Context.token) {
                wiz_portRequestCategoryAjax(port);
            } else {
                if (Wiz_Context.cookies) {
                    var loginParam = getloginParam(Wiz_Context.cookies);
                    portLoginAjax(loginParam, port, null, wiz_portRequestCategoryAjax);
                }
            }
        }
    }
}

function getLocalTag() {
    var localTagStr = localStorage[Wiz.Constant.Default.COOKIE_TAG],
        storedTimeStr = localStorage[Wiz.Constant.Default.COOKIE_TAG_TIME],
        storedTime = Date.parse(storedTimeStr),
        nowTime = new Date(),
        isOverTime = ((nowTime - storedTime) / 1000 >= Wiz.Constant.Default.TAG_EXPIRE_SEC);//是否过期
    if (isOverTime || !localTagStr || localTagStr.length < 1) {
        return "";
    } else {
        return localTagStr;
    }
}
function getLocalCategory() {
    var localCategoryStr = localStorage[Wiz.Constant.Default.COOKIE_CATEGORY],
        storedTimeStr = localStorage[Wiz.Constant.Default.COOKIE_CATEGORY_TIME],
        storedTime = Date.parse(storedTimeStr),
        nowTime = new Date(),
        isOverTime = ((nowTime - storedTime) / 1000 >= Wiz.Constant.Default.CATEGORY_EXPIRE_SEC);//是否过期
    if (isOverTime || !localCategoryStr || localCategoryStr.length < 1) {
        return "";
    } else {
        return localCategoryStr;
    }
}

//把服务端获取到的目录信息存放在localStorage中
//如果存放到cookie中，则会造成cookie过大，无法通过nginx
//保存时，需要记录当前保存的时间，下次取出的时候进行比较
//如果超出默认的时间，则自动清空，重新获取
function setLocalCategory(value) {
    var storedTime = (new Date()).toString();
    localStorage[Wiz.Constant.Default.COOKIE_CATEGORY] = value;
    localStorage[Wiz.Constant.Default.COOKIE_CATEGORY_TIME] = storedTime;
}
function setLocalTag(value) {
    var storedTime = (new Date()).toString();
    localStorage[Wiz.Constant.Default.COOKIE_TAG] = value;
    localStorage[Wiz.Constant.Default.COOKIE_CATEGORY_TIME] = storedTime;
}
function getNativeCagetory(userid) {
    var client = getNativeClient(),
        categoryStr = null;
    if (client) {
        try {
            categoryStr = client.GetAllFolders(userid);
        } catch (err) {
        }
    }
    return categoryStr;
}

function wiz_portRequestCategoryAjax(port) {
    var params = {
        client_type : Wiz.Constant.LOGIN_PARAMS.CLIENT_TYPE,
        api_version : Wiz.Constant.LOGIN_PARAMS.API_VERSION,
        token : Wiz_Context.token,
        kb_guid: Wiz_Context.kbGuid
    };
    var callbackSuccess = function (responseJSON) {
        try {
            // token失效, 重新登录
            if (responseJSON.code == 301) {
                wiz_background_autoLogin(null, function() {
                    wiz_portRequestCategoryAjax(port);
                });
            }
            //console.log('wiz_portRequestCategoryAjax callbackSuccess');
            var categoryList = responseJSON.list;
            var categoryStr = getCategoryStrFromList(categoryList);
            setLocalCategory(categoryStr);
            if (port) {
                port.postMessage(categoryStr);
            }
        } catch (err) {
            console.log('wiz_portRequestCategoryAjax callbackSuccess Error: ' + err);
        }
    };
    var callbackError = function (response) {
        console.log('wiz_portRequestCategoryAjax callbackError');
        try {
            if (port) {
                //失败后，应该自动重新获取
                // port.postMessage(false); 这样会导致显示错误，目录显示为als
            }
        } catch (err) {
            console.log('wiz_portRequestCategoryAjax callError Error: ' + err);
        }
    };
    var openapiUrl = getOpenApiUrl();
    $.ajax({
        type : 'GET',
        url : openapiUrl + '/category/all',
        data : params,
        success : callbackSuccess,
        error : callbackError
    });
}
function wiz_portRequestTagAjax(port) {
    var params = {
        client_type : Wiz.Constant.LOGIN_PARAMS.CLIENT_TYPE,
        api_version : Wiz.Constant.LOGIN_PARAMS.API_VERSION,
        token : Wiz_Context.token,
        kb_guid: Wiz_Context.kbGuid
    };
    var callbackSuccess = function (responseJSON) {
        try {
            // token失效, 重新登录
            if (responseJSON.code == 301) {
                wiz_background_autoLogin(null, function() {
                    wiz_portRequestTagAjax(port);
                });
            }
            //console.log('wiz_portRequestTagAjax callbackSuccess');
            var tagList = responseJSON.list;
            var tagStr = getTagStrFromList(tagList);
            setLocalTag(tagStr);
            if (port) {
                port.postMessage(tagStr);
            }
        } catch (err) {
            console.log('wiz_portRequestTagAjax callbackSuccess Error: ' + err);
        }
    };
    var callbackError = function (response) {
        console.log('wiz_portRequestTagAjax callbackError');
        try {
            if (port) {
                //失败后，应该自动重新获取
                // port.postMessage(false); 这样会导致显示错误，目录显示为als
            }
        } catch (err) {
            console.log('wiz_portRequestTagAjax callError Error: ' + err);
        }
    };
    var openapiUrl = getOpenApiUrl();
    $.ajax({
        type : 'GET',
        url : openapiUrl + '/tag/all',
        data : params,
        success : callbackSuccess,
        error : callbackError
    });
}

function getCategoryStrFromList(categoryList) {
    var length = categoryList.length;
    var categoryStr = '';
    for (var i=0; i<length; i++) {
        if (i === 0) {
            categoryStr = categoryList[i].location;
        } else {
            categoryStr = categoryStr + '*' + categoryList[i].location;
        }
    }
    return categoryStr;
}
function getTagStrFromList(tagList) {
    var length = tagList.length;
    var tagStr = '';
    for (var i=0; i<length; i++) {
        if (i === 0) {
            tagStr = tagList[i].tag_name;
        } else {
            tagStr += ',' + tagList[i].tag_name;
        }
    }
    return tagStr;
}

/**
 *获取当前页面的tab信息 
 */
function getTab(callback, params) {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    Wiz_Context.tab = tabs[0];
    callback(tabs[0], params);
});
}

function hideContentVeil(tab) {
    Wiz.Browser.sendRequest(tab.id, {
        name : 'preview',
        op : 'clear'
    });
}

function bindKeyDownHandler(tab, direction) {
    Wiz.Browser.sendRequest(tab.id, {
        name : 'preview',
        op : 'keydown',
        opCmd : direction
    });
}

function wizPostDocument(docInfo) {
    //整理数据
    var regexp = /%20/g,
        title = docInfo.title,
        category = docInfo.category,
        comment = docInfo.comment,
        body = docInfo.params;
          
    if (comment && comment.trim() !== '') {
        body = comment + '<hr>' + body;
    }
    var docGuid = genGuid();
    var requestParam = {
        client_type : 'webclip_chrome',
        api_version : 3,
        document_title: title,
        document_category: category,
        document_body: body,
        document_guid: docGuid,
        token: Wiz_Context.token,
        kb_guid: Wiz_Context.kbGuid,
        temp: true
    };
    
    if (!category) {
        category = '/My Notes/';
    }
    // var requestData = 'title=' + encodeURIComponent(title).replace(regexp,  '+') + '&token_guid=' + encodeURIComponent(Wiz_Context.token).replace(regexp,  '+')
    //                  + '&body=' + encodeURIComponent(body).replace(regexp,  '+') + '&category=' + encodeURIComponent(category).replace(regexp,  '+');

    var createData = 'temp=true&api_version=3&client_type=webclip_chrome&token=' + getReplaceStr(Wiz_Context.token) +
        '&kb_guid=' + getReplaceStr(Wiz_Context.kbGuid) + '&document_guid=' + getReplaceStr(docGuid);


    var updateData = 'api_version=3&client_type=webclip_chrome&token=' + getReplaceStr(Wiz_Context.token) +
        '&kb_guid=' + getReplaceStr(Wiz_Context.kbGuid) + '&document_guid=' + getReplaceStr(docGuid) +
        '&document_body=' + getReplaceStr(body) + '&document_category=' + getReplaceStr(category) + '&document_title=' +
        title + '&document_url=' + getReplaceStr(docInfo.url);
    //发送给当前tab消息，显示剪辑结果                 
    Wiz.Browser.sendRequest(Wiz_Context.tab.id, {name: 'sync', info: docInfo});
    
    var callbackSuccess = function (response) {
        try {
            var json = response;
            //需要类型转换
            if (json.code != 200) {
                console.error('sendError : ' + json.message);
                docInfo.errorMsg = json.message;
                
                Wiz.Browser.sendRequest(Wiz_Context.tab.id, {name: 'error', info: docInfo});
                return;
            }
            //console.log('success : create Document');
            var openapiUrl = getOpenApiUrl();
            $.ajax({
                type : 'PUT',
                url : openapiUrl + '/document/data',
                data : updateData,
                success : function(data) {
                    if (data.code != 200) {
                        console.error('update error : ' + data.message);
                        docInfo.errorMsg = data.message;
                        Wiz.Browser.sendRequest(Wiz_Context.tab.id, {name: 'error', info: docInfo});
                        return;
                    }
                    //console.log('success: update Document');
                    Wiz.Browser.sendRequest(Wiz_Context.tab.id, {name: 'saved', info: docInfo});
                },
                error : callbackError
            });
            
        } catch (err) {
            console.log('wizPostDocument callbackSuccess Error: ' + err);
        }
    };
    
    var callbackError = function (response) {
        //TODO 使用闭包，自动重试3次，如果3次均失败，再提示用户
        //需要重构
        try {
            var errorJSON = response;
            docInfo.errorMsg = errorJSON.message;

            Wiz.Browser.sendRequest(Wiz_Context.tab.id, {name: 'error', info: docInfo});

            console.error('callback error : ' + errorJSON.message);
        } catch (err) {
            console.log('wizPostDocument callbackError Error: ' + err);
        }
    };
    //console.log('post document info');
    //console.log(requestParam);
    var openapiUrl = getOpenApiUrl();
    // 创建新的空文档
    $.ajax({
        type : 'POST',
        url : openapiUrl + '/document/data',
        data : createData,
        success : callbackSuccess,
        error : callbackError
    });
}

function getReplaceStr(str) {
    var regexp = /%20/g;
    return encodeURIComponent(str).replace(regexp, '+');
}

function genGuid() {
    /**
     * @return {string}
     */
    function S4() {
        return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
    }

    return (S4() + S4() + "-" + S4() + "-" + S4() + "-" + S4() + "-" + S4() + S4() + S4());
}

function wizRequestPreview(tab, op) {
    if (!op) {
        //默认为文章
        op = 'article';
    }
    Wiz.Browser.sendRequest(tab.id, {
        name : 'preview',
        op : op
    }, sendTabRequestCallbackByBrowserAction);
}

/**
 *请求剪辑页面回调函数
 */
function sendTabRequestCallbackByBrowserAction(option) {
    if (!option) {
        //当前页面无法剪辑
        chrome.extension.connect({
            'name' : 'pagePreviewFailure'
        });
    }
}
function sendTabRequestCallbackByContextMenu(option) {
    //要等页面完全加载后，右键点击仍然无返回，提示无法剪辑
    if (!option && Wiz_Context.tab.status === 'complete') {
        var pageClipFailure = chrome.i18n.getMessage('pageClipFailure');
        alert(pageClipFailure);
    }
}

//var authenticationErrorMsg = chrome.i18n.getMessage('AuthenticationFailure');

function isLogin() {
    return !(Wiz_Context.token === null || Wiz_Context.token === "");

}

/**
 * 获取本地客户端信息
 */
function getNativeClient() {
    try {
        var nativeClient = document.getElementById('wiz-local-app'),
            version = nativeClient.Version;
        if (typeof version === 'undefined') {
            return null;
        }
        return nativeClient;
    } catch (err) {
        console.log('background.getNativeClient() Error : ' + err);
        return null;
    }
}

function hasNativeClient() {
    var nativeClient = getNativeClient();
    return (nativeClient !== null);
}

function saveToNative(info) {
    var wizClient = getNativeClient();
    try {
        wizClient.Execute(info.params);
    } catch (err) {
        console.warn('background saveToNative Error : ' + err);
    }
    //console.log('Saved To Native Client');
}

var onButtonClickedCallback = function (notificationId, buttonIndex) {
    var index = notificationId.indexOf('_success');
    if (index != -1) {
        chrome.tabs.create({url: 'http://note.wiz.cn' + '?token='+ Wiz_Context.token +'&kb=' + Wiz_Context.kbGuid+ '&dc='+ notificationId.substring(0, index)}, function(){});
    }
};
chrome.notifications.onButtonClicked.addListener(onButtonClickedCallback);

function saveToServer(info) {
//    console.log('info.title:' + info.title);
    var docGuid = genGuid();
    var coefficient;
    if (Wiz_Context.myWizEmail === '') {
        wiz_background_autoLogin(info);
        return;
    }
    chrome.storage.sync.get({
        saveImage2Server: true
    }, function(items) {
        var SaveResources = +(items.saveImage2Server || true);
//        console.log(SaveResources);
        info.params = "myWiz='"+ Wiz_Context.myWizEmail + "' SaveResources='" + SaveResources + "' document_guid='" + docGuid + "' " + info.params;
        var params = {
            type: 'clipper',
            data: info.params,
            custom_id: docGuid
        };

        //更具剪辑内容大小来设置等待时间
        coefficient = info.params.length /  102400;

        //显示正在剪辑
        chrome.notifications.create(docGuid + '_clipping', {
            type: "basic",
            title: info.title,
            message: chrome.i18n.getMessage('clipResult_clipping'),
            iconUrl: "images/scissors.png"
        }, function(notificationId) {});
        $.ajax({
            type : 'POST',
            url : Wiz.Constant.Default.NOTE_URL + '/api/gather/add',
            data : params,
            success : callbackSuccess,
            error : callbackError
        });
    });


    function callbackSuccess(data, textStatus) {

        if (data.return_code == 200) {
            Wiz_Context.queryTime = 0;
            //发送成功，开始轮询服务器查询状态
            setTimeout(function() {
                querySaveState(data.id, data.custom_id, info.title);
            }, Wiz_Context.queryTimeArray[Wiz_Context.queryTime] * 1000 * coefficient);
        } else {
            // 请求失败
            setTimeout(function() {
                chrome.notifications.clear(docGuid + '_clipping', function(){});
                chrome.notifications.create(docGuid+'_error', {
                    type: "basic",
                    title: info.title,
                    message:chrome.i18n.getMessage('clipResult_error'),
                    iconUrl: "images/warning.png"
                }, function(){});
            }, 5000);
        }
    }
    function callbackError(XMLHttpRequest, textStatus, errorThrown) {
        console.log(errorThrown);
    }
}

function querySaveState(id, docGuid, title) {
    function callbackSuccess(data) {
//        console.log(data);
        if(data.return_code == 200) {
            var message;
            var status = +data.status;
            if ( status >= 0) {
                // 剪辑完成
//                console.log('docGuid:' + docGuid + ' title:' + title + ' message' + chrome.i18n.getMessage('clipResult_success'));
                //清除正在剪辑任务
                if (status === 0 ) {
                    message = chrome.i18n.getMessage('clipResult_success');
                } else if(status == 101) {
                    message = chrome.i18n.getMessage('save_image_to_server_fail');
                }
                chrome.notifications.clear(docGuid + '_clipping', function(){});
                chrome.notifications.create(docGuid+'_success', {
                    type: "basic",
                    title: title,
                    message: message,
                    iconUrl: "images/check.png",
                    buttons: [{ title: chrome.i18n.getMessage('clipResult_webclient'), iconUrl: 'images/wiz-clipper-16.png'}]
                }, function(notificationId) {});
            } else if (data.status == 'doing' || data.status == 'new') {
                // 任务正在队列中
                Wiz_Context.queryTime++;
                setTimeout(function() {
                    querySaveState(id,  docGuid, title);
                }, Wiz_Context.queryTimeArray[Wiz_Context.queryTime] * 1000);
            } else {
                // 剪辑失败
                chrome.notifications.clear(docGuid + '_clipping', function(){});
                chrome.notifications.create(Wiz_Context.kbGuid+'_error', {
                    type: "basic",
                    title: title,
                    message:chrome.i18n.getMessage('clipResult_error'),
                    iconUrl: "images/warning.png"
                }, function(notificationId) {});
            }
        } else {
            console.log('querySaveState error');
        }
    }

    function callbackError() {
        console.log('querySaveState server error');
    }

    if (Wiz_Context.queryTime >= Wiz_Context.queryTimeArray.length) {
        return false;
    }
    var params = {
        id: id,
        custom_id: docGuid
    };
    $.ajax({
        type : 'GET',
        url : Wiz.Constant.Default.NOTE_URL + '/api/gather/status',
        data : params,
        success : callbackSuccess,
        error : callbackError
    });
}

function wizSaveNativeContextMenuClick(info, tab) {
    Wiz_Context.tab = tab;
//    var wizClient = getNativeClient();
    Wiz.Browser.sendRequest(tab.id, {
        name: 'preview',
        op: 'submit',
        info : { url: tab.url },
        type: 'native'
    }, sendTabRequestCallbackByContextMenu);
}

function wizSavePageContextMenuClick(info, tab) {
    var type = 'fullPage';
    Wiz_Context.tab = tab;

    //判断是否用户手动选择
    if (info.selectionText) {
        type = 'selection';
    }
    if (isLogin()) {
        info.title = tab.title;
        Wiz.Browser.sendRequest(tab.id, {
            name : 'preview',
            op : 'submit',
            info : info,
            type : type
        }, sendTabRequestCallbackByContextMenu);
    } else {    
        var notification = Notification.createNotification(
          'images/wiz-clipper-16.png',
          chrome.i18n.getMessage('extName'),
          chrome.i18n.getMessage("note_login")
        );
        notification.show();
        setTimeout(function(){
                notification.cancel();
            }, 3000);
    }
}

function wiz_initContextMenus() {
    var clipPageContext = chrome.i18n.getMessage('contextMenus_clipPage'),
        allowableUrls = ['http://*/*', 'https://*/*'];
//    var hasNative = getNativeClient();
    
    if (hasNativeClient()) {
        chrome.contextMenus.create({
            'title': clipPageContext,
            'contexts' : ['all'],
            'documentUrlPatterns' : allowableUrls,
            'onclick': wizSaveNativeContextMenuClick
        });
    } else {
        chrome.contextMenus.create({
            'title' : clipPageContext,
            'contexts' : ['all'],
            'documentUrlPatterns' : allowableUrls,
            'onclick' : wizSavePageContextMenuClick
        });
    }
}

function wiz_background_autoLogin(params, callback) {
    Wiz.Cookie.getCookies(Wiz.Constant.Default.COOKIE_URL, Wiz.Constant.Default.COOKIE_CERT, function(cookie, params) {
        wiz_loginByCookies(cookie, params, callback);
    }, true, params);
}

function wiz_background_getCookie() {
    var callback = function (cookies) {
        Wiz_Context.cookies = cookies;
    };
    Wiz.Cookie.getCookies(Wiz.Constant.Default.COOKIE_URL, Wiz.Constant.Default.COOKIE_CERT, callback, true);
}
// 从api.wiz.cn获取openapi地址
function getOpenApiUrl() {
    if (!Wiz_Context.openAPIUrl || Wiz_Context.openAPIUrl.length < 1) {
        $.ajax({
            url: Wiz.Constant.Default.API_URL,
            type: 'GET',
            async: false,
            success: function(data) {
                Wiz_Context.openAPIUrl = data;
            },
            error: function(error) {
                console.log("getOpenApiUrl() error:" + error);
            }
        });
    }
    return Wiz_Context.openAPIUrl;
}

chrome.extension.onConnect.addListener(onConnectListener);
wiz_initContextMenus();
//自动登录
wiz_background_autoLogin();
wiz_background_getCookie();
// 初始化的时候获取一次
getOpenApiUrl();