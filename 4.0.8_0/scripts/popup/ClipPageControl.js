/* global PopupView: false ztreeControl:false */


function ClipPageControl() {
    'use strict';
    var saveType = localStorage[Wiz.Constant.Default.SAVE_TYPE],
        isNative = (saveType && saveType === 'save_to_native') ? true : false,
        _hasNative = null;

    function initClipPageListener() {
        PopupView.hideCreateDiv();
        $('body').bind('keyup', keyDownHandler);
        $('#submit-type').bind('change', changeSubmitTypehandler);
        $('#note_submit').click(noteSubmit);
        $('#refresh_category_btn').click(requestCategoryForce);
        $('#wiz_clip_detail').show(initClipPageInfo);
        $('#comment-info').bind('keyup',function() {
            var obj = $(this);
            if (obj.val().length > 0) {
                obj.addClass('active');
            } else {
                obj.removeClass('active');
            }

        });
        initNativeDiv();
    }

    function initNativeDiv() {
        var isWin = isWinPlatform();
        if (isWin) {
            initSaveType();
        } else {
            $('#save_type_sel').hide();
            $('#native').remove();
        }
    }

    function initSaveType() {
        $('#save_type_sel').bind('change', changeSaveTypehandler);

        if (isNative) {
            $('#save_to_native').parent().trigger('click');
        }

    }

    /**
     * 保存到本地监听事件
     * @param  {[type]} evt [description]
     */
    function changeSaveTypehandler() {
        var type = angular.element(document.getElementById('save_type_sel')).scope().saveType;
        if ('save_to_native' === type && !checkNativeStatus()) {
            return false;
        }
        setSaveType(type);
    }

    function setSaveType(type) {
        if (type === 'save_to_native') {
            isNative = true;
        } else if (type === 'save_to_server') {
            isNative = false;
        }
        localStorage[Wiz.Constant.Default.SAVE_TYPE] = type;
    }

    //监听截取信息事件
    chrome.extension.onConnect.addListener(messageListener);

    function messageListener(port) {
        var name = port.name;
        switch (name) {
        case 'contentVeilShow':
            $('#waiting').hide();
            if ($('#wiz_clip_detail').is(':hidden')) {
                initClipPageListener();
            }
            break;
        case 'pagePreviewFailure':
            exacutePreviewFailure();
            break;
        }
    }

    function requestPreview() {
        var port = chrome.runtime.connect({
                name: 'preview'
            });
        port.postMessage('article');
    }

    function exacutePreviewFailure() {
        chrome.windows.getCurrent(function (win) {
            chrome.tabs.query({ active: true,  windowId: win.id }, function (tabs) {
                var tab = tabs[0];
                if (tab && tab.status === 'complete') {
                    //页面资源已经加载完成，未有preview返回，则提示无法剪辑
                    var pageClipFailure = chrome.i18n.getMessage('pageClipFailure');
                    PopupView.showClipFailure(pageClipFailure);
                } else {
                    //页面加载中，继续执行请求
                    setTimeout(requestPreview, 1000);
                }
            });
        });
    }

    /**
     * 是否windows系统
     * @return {Boolean} [description]
     */
    function isWinPlatform() {
        var platform = window.navigator.platform,
            isMac = (platform.toLowerCase().indexOf('mac') === 0),//(platform === "Mac68K") || (platform === "MacPPC") || (platform === "Macintosh");
            isLinux = (platform.toLowerCase().indexOf('linux') === 0);
        return !(isMac || isLinux);
    }



    /**
     *修改保存的类型
     */

    function changeSubmitTypehandler(evt) {
        var cmd = angular.element(document.getElementById('submit-type')).scope().submitType,
            portName = ('native' === cmd) ? 'save-native' : 'preview',
            port = chrome.runtime.connect({
                name: portName
            });
        if ('native' === cmd) {
            if (!checkNativeStatus()) {
                evt.preventDefault();
                return ;
            }
            noteSubmit();
        } else {
            port.postMessage(cmd);
            //改变页面显示
            PopupView.changeSubmitDisplayByType();
        }
    }


    function initSubmitGroup(clipPageResponse) {
        var submitType = $('#submit-type');
        var clipArticle = clipPageResponse.article,
            clipSelection = clipPageResponse.selection;
        if (clipSelection === true) {
            $('#selection').parent().trigger('click');
            //submitType[0].options[1].selected = true;
        } else if (clipArticle === true) {
            $('#article').parent().trigger('click');
            //submitType[0].options[0].selected = true;
        } else {
            $('#fullPage').parent().trigger('click');
            //submitType[0].options[2].selected = true;
        }

        //用户没有选择时，禁止选择该'保存选择'
        if (clipSelection === false) {
            $('li[data-value=selection]', submitType).addClass('disabled');
            //submitType.find('#selection').attr('disabled', '');
        }

        //用户有选择或者不可以智能提取时，禁止选择'保存文章'
        if (clipArticle === false || clipSelection === true) {
            $('li[data-value=article]', submitType).addClass('disabled');
            //submitType.find('#article').attr('disabled', '');
        }
    }

    /**
     * 加载当前页面的是否能智能截取、是否有选择的信息，并根据该信息显示
     */

    function requestPageStatus() {
//        console.log('requestPageStatus');
        chrome.windows.getCurrent(function (win) {
            chrome.tabs.query({ active: true,  windowId: win.id }, function (tabs) {
                Wiz.Browser.sendRequest(tabs[0].id, {
                    name: 'getInfo'
                }, function (params) {
                    initSubmitGroup(params);
                });
            });
        });
    }

    //初始化剪辑页面信息
    function initClipPageInfo() {
        initLogoutLink();
        requestPageStatus();
        requestTitle();
        initDefaultCategory();
        requestToken();
        requestCategory();
        requestTag();
    }


    function initLogoutLink() {
        var logoutText = chrome.i18n.getMessage('logout');
        $('#header_user').show();
        $('#logout_control').html(logoutText).bind('click', cmdLogout);
    }

    function cmdLogout() {
        Wiz.Cookie.removeCookies(Wiz.Constant.Default.COOKIE_URL, Wiz.Constant.Default.COOKIE_CERT, function () {
            chrome.runtime.connect({
                name: 'logout'
            });
        });
        localStorage.clear();
        window.close();
    }

    /**
     *加载标题
     */

    function requestTitle() {
        chrome.windows.getCurrent(function (win) {
            chrome.tabs.query({ active: true,  windowId: win.id }, function (tabs) {
                var title = tabs[0].title;
                if (!title) {
                    return;
                }
                setTitle(title);
            });
        });
    }

    function setTitle(title) {
        $('#wiz_note_title').val(title);
    }

    /**
     * 加载并显示默认文件夹---上次选择的文件夹
     */

    function initDefaultCategory() {
        var lastCategory = localStorage[Wiz.Constant.Default.COOKIE_LAST_CATEGORY];
        var categoryInfo = $('#category_info');
        if (lastCategory) {
            var array = lastCategory.split('*'),
                displayName = array[0],
                location = array[1];
            categoryInfo.html(displayName).attr('location', location);
        }
        categoryInfo.bind('click', function() {
            PopupView.switchCategoryTreeVisible();
        });
        //console.log('category_info click');
        //categoryInfo.unbind('click');

    }

    /**
     *加载中
     */

    //function changeCategoryLoadingStatus() {
    //    var visible = isCategoryLoading();
    //    if (visible) {
    //        PopupView.hideCategoryLoading();
    //    } else {
    //        var categoryLoadingMsg = chrome.i18n.getMessage('category_loading');
    //        PopupView.showCategoryLoading(categoryLoadingMsg);
    //    }
    //}

    function isCategoryLoading() {
        var visible = $('#category_loading').is(':visible');
        return visible;
    }

    /**
     *对Tag信息进行处理
     */
    function parseWizTag() {
        //var tagString = localStorage[Wiz.Constant.Default.COOKIE_TAG];
        //console.log('parseWizTag : ' + tagString);
    }

    /**
     *对目录信息进行处理
     */
    function parseWizCategory() {
        initZtree();
        var visible = isCategoryLoading();
        if (visible) {
            //用户已经点击展开文件夹树，此时，需要直接显示文件夹树即可
            PopupView.showCategoryTreeFromLoading();
        }
    }

    function initZtree() {
        var categoryString = localStorage[Wiz.Constant.Default.COOKIE_CATEGORY];
        var ztreeJson = ztreeControl.parseDate(categoryString);
        ztreeControl.setNodes(ztreeJson);
        ztreeControl.initTree('ztree');
    }


    /**
     * 加载 Tag 信息
     */
    function requestTag() {
        var port = chrome.runtime.connect({
            name: 'requestTag'
        });
        port.onMessage.addListener(requestTagHandler);
    }
    function requestTagHandler(msg) {
        if (msg && typeof msg === 'string'){
            //console.log(msg);
            localStorage[Wiz.Constant.Default.COOKIE_TAG] = msg;
            parseWizTag();
        }
    }
    /**
     *加载文件夹信息
     */
    function requestCategory() {
        PopupView.showCategoryLoading();
        //本地目录信息错误，向后台请求目录信息
        var port = chrome.runtime.connect({
            name: 'requestCategory'
        });
        port.onMessage.addListener(requestCategoryHandler);
    }
    function requestCategoryForce() {
        PopupView.showCategoryLoading();
        //本地目录信息错误，向后台请求目录信息
        var port = chrome.runtime.connect({
            name: 'requestCategoryForce'
        });
        port.onMessage.addListener(requestCategoryHandler);
    }
    function requestCategoryHandler(msg) {
        if (msg && typeof msg === 'string'){
            //console.log(msg);
            localStorage[Wiz.Constant.Default.COOKIE_CATEGORY] = msg;
            parseWizCategory();
        }
    }


    function requestToken() {
        var port = chrome.runtime.connect({
            name: 'requestToken'
        });
        port.onMessage.addListener(function (token) {
            initUserLink(token);
        });
    }


    function keyDownHandler(evt) {
        var target = evt.target,
            skipTypes = ['input', 'select', 'textarea'],
            skipIndex;
        for (skipIndex = 0; skipIndex < skipTypes.length; skipIndex++) {
            //console.log(evt);
            if (target.nodeName.toLowerCase() == skipTypes[skipIndex]) {
                //console.log(skipTypes[skipIndex]);
                return;
            }
        }
        var keycode = evt.keyCode;
        if (13 == keycode) {
            requestSubmit();
            return;
        }
        var opCmd = getNudgeOp(keycode, evt);
        var info = {
            direction: opCmd
        };
        chrome.runtime.connect({
            name: 'onkeydown'
        }).postMessage(info);
    }

    function getNudgeOp(key, evt) {
        var returnValue = null,
            KEY_ALT = 18,
            KEY_CTRL = 17,
            keyMap = {
                27: 'cancle',
                // up
                38: 'expand',
                // down
                40: 'shrink',
                // left
                37: 'left',
                // right
                39: 'right',
                // alt + up
                56: 'topexpand',
                // alt + down
                58: 'topshrink',
                // ctrl + down
                57: 'bottomexpand',
                // ctrl + up
                55: 'bottomshrink'
            };

        if (keyMap[key]) {
            if (evt && evt.altKey === true) { // 18
                returnValue = keyMap[key + KEY_ALT];
            } else if (evt && evt.ctrlKey === true) { // 17
                returnValue = keyMap[key + KEY_CTRL];
            } else {
                returnValue = keyMap[key];
            }
            return returnValue;
        }
    }

    /**
     * 保存文档处理
     */

    function noteSubmit() {
        requestSubmit();
    }

    function requestSubmit() {
        var type = angular.element(document.getElementById('submit-type')).scope().submitType,
            title = $('#wiz_note_title').val(),
            category = $('#category_info').attr('location'),
            comment = $('#comment-info').val(),
            tag = $('#tag-name').data('tag-name'),
            userid = localStorage[Wiz.Constant.Default.COOKIE_USER],
            info = {
                title: title,
                category: category,
                comment: comment,
                userid : userid,
                tag: tag,
                isNative : isNative
            };
        chrome.windows.getCurrent(function (win) {
            chrome.tabs.query({ active: true,  windowId: win.id }, function (tabs) {
                Wiz.Browser.sendRequest(tabs[0].id, {
                    name: 'preview',
                    op: 'submit',
                    info: info,
                    type: type
                }, function () {
                    window.close();
                });
            });
        });
    }

    function initUserLink(token) {
        var user_id = localStorage[Wiz.Constant.Default.COOKIE_USER];
        $('#login_div').find('.sep').html('|');
        $('#header_username').html(user_id).bind('click', function () {
            window.open(Wiz.Constant.Default.WEBCLIENT_URL + '?token=' + token);
        });
    }

    function checkNativeStatus() {
        if (!hasNativeClient()) {
            var installNotifyMsg = chrome.i18n.getMessage('install_client_notify');
            if (window.confirm(installNotifyMsg)) {
                window.open(Wiz.Constant.Default.UPDATEClient_URL);
            }
        }
        return hasNativeClient();
    }

    function hasNativeClient() {
        return _hasNative;
    }

     
    function setNativeStatus(hasNative) {
        _hasNative = hasNative;
    }

    this.setNativeStatus = setNativeStatus;
}