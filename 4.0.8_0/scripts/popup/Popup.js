// 'use strict';
window.onload = function () {

    function getChromeVersion() {
        var raw = navigator.userAgent.match(/Chrom(e|ium)\/([0-9]+)\./);

        return raw ? parseInt(raw[2], 10) : false;
    }

    function showByCookies(cookies) {
        if (cookies) {
            var port = chrome.extension.connect({
                name: 'initRequest'
            });
            port.onMessage.addListener(function (msg) {
                //2012-10-10
                // if (msg.login == false) {
                //  loginControl.autoLogin(cookies);
                // } else {
                $('#wiz_login').hide();
                // }
                clipPageControl.setNativeStatus(msg.hasNative);
            });

        } else {
            PopupView.showLogin();
            // 写在HTML中？
            loginControl.initCreateAccountLink();
        }
    }


    function wizPopupInitialize() {
        Wiz.Cookie.getCookies(Wiz.Constant.Default.COOKIE_URL, Wiz.Constant.Default.COOKIE_CERT, showByCookies, true);
        // tabLoadedListener();
    }

    // TODO: 放入PopupView中
    function initPopupPage() {
        $('#waiting-label').html(chrome.i18n.getMessage('popup_wating'));

        //login page
        $('#user_id').attr("placeholder", chrome.i18n.getMessage('user_id_tip'));
        $('#password').attr("placeholder", chrome.i18n.getMessage('password_tip'));
        $('#keep_password_tip').html(chrome.i18n.getMessage('keep_password_tip'));
        $('#login_button').html(chrome.i18n.getMessage('login_msg'));

        //note info page
        $('#note_title_tip').html(chrome.i18n.getMessage('note_title_tip'));
        $('#category_tip').html(chrome.i18n.getMessage('category_tip'));
        $('#refresh_category_btn').html(chrome.i18n.getMessage('refresh'));

        //tag info
        $('#tag-name').html(chrome.i18n.getMessage('tag_tip'));

        //submit type
        $('#article').html(chrome.i18n.getMessage('article_save'));
        $('#fullPage').html(chrome.i18n.getMessage('fullpage_save'));
        $('#selection').html(chrome.i18n.getMessage('select_save'));
        $('#url').html(chrome.i18n.getMessage('url_save'));
        $('#native').html(chrome.i18n.getMessage('save_more'));

        //comment area
        $('#comment_tip').html(chrome.i18n.getMessage('comment_tip'));
        $('#comment-info').attr('placeholder', chrome.i18n.getMessage('add_comment'));

        $('#save_to_server').html(chrome.i18n.getMessage('save_to_server'));
        //Chrome v45 开始不支持 NPAPI
        var v = getChromeVersion();
        if (!isNaN(v) && v >= 45) {
            //$('#save_to_server').parent().trigger('click');
            $('#save_to_native').parent().remove();
            $('#native').parent().remove();
        } else {
            $('#save_to_native').html(chrome.i18n.getMessage('save_to_native'));
        }


        //默认文件夹
        $('#category_info').html('/' + chrome.i18n.getMessage('MyNotes') + '/').attr('location', '/My Notes/');
        $('.header_logo').on('click', function (evt) {
            window.open(Wiz.Constant.Default.WEBCLIENT_URL);
        });
    }

    initPopupPage();
    var clipPageControl = new ClipPageControl();
    var loginControl = new LoginControl();

    //保证popup页面和preview页面同时关闭
    chrome.extension.connect({
        name: 'popupClosed'
    });

    wizPopupInitialize();
};


