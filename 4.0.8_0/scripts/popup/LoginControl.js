/* global PopupView: false ztreeControl:false*/
'use strict';

var ztreeControl = new ZtreeController();
function LoginControl() {

    var isAutoLogin = false;
    var errValidator = $('#div_error_validator');
    var user_id = $('#user_id');
    var password = $('#password');
    var keep_password = $('#keep_password');
    //add click listener and enter to login button
    $('#login_button').on('click', loginSubmit);
    $('.wiz_login').on('keydown', 'input, button', function(e) {
        if (e.which === 13) {
            loginSubmit();
        }
    });

    /**
     * 使用cookie自动登录
     * @param  {object} cookie 登录的cookie对象
     */
    function autoLogin(cookie) {
        isAutoLogin = true;
        $('#waiting').show();

        var info = cookie.value;
        var loginParam = {
            client_type: Wiz.Constant.LOGIN_PARAMS.CLIENT_TYPE,
            api_version: Wiz.Constant.LOGIN_PARAMS.API_VERSION,
            cookieStr: info
        };
        login(loginParam);
    }

    function login(loginParam) {
        var port = chrome.extension.connect({
            name : 'login'
        });
        port.postMessage(loginParam);
        port.onMessage.addListener(function(res) {
            var code = res.code;
            var msg, cert;
            if (code === '200') {
                localStorage.clear();

                cert = res.cookieStr;
                //cookie保存时间  (秒)
                var expiredays;
                if (keep_password.prop('checked')) {
                    expiredays = Wiz.Constant.Default.COOKIE_EXPIRE_SEC;
                }
                PopupView.hideLogoffDiv();
                localStorage[Wiz.Constant.Default.COOKIE_USER] = loginParam.user_id;

                if (!isAutoLogin) {
                    //自动登陆不需要再次设置token
                    Wiz.Cookie.setCookies(Wiz.Constant.Default.COOKIE_URL, Wiz.Constant.Default.COOKIE_CERT, cert, expiredays);
                }
            }
            else {
                if (!!code) {
                    msg = chrome.i18n.getMessage('err_' + code);
                } else {
                    msg = res;
                }
                PopupView.showLoginError(msg);
            }
        });
    }

    function doLogin() {
        var loginingMsg = chrome.i18n.getMessage('logining');
        PopupView.showWaiting(loginingMsg);

        var loginParam = {
            client_type: Wiz.Constant.LOGIN_PARAMS.CLIENT_TYPE,
            api_version: Wiz.Constant.LOGIN_PARAMS.API_VERSION,
            user_id: user_id.val(),
            password: 'md5.' + hex_md5(password.val())
        };
        login(loginParam);
    }

    /**
     * 点击登陆按钮触发事件
     */
    function loginSubmit() {
        if (checkEmail() && checkPassword()) {
            doLogin();
        }
    }

    function checkEmail() {
        errValidator.html('');
        var email = user_id.val();
        var valid = verifyEmail(email);
        if (!valid) {
            errValidator.html(chrome.i18n.getMessage('userid_error')).show(100);
        }
        return valid;

    }

    function verifyEmail(str_email) {
        return !!(str_email && str_email.trim().length > 1);

    }

    function checkPassword() {
        errValidator.html('');
        var passwordVal = password.val();
        if (passwordVal.trim().length < 1) {
            errValidator.html(chrome.i18n.getMessage('password_error')).show(100);
            return false;
        }
        return true;

    }

    function initCreateAccountLink() {
        $('#create_acount').html(chrome.i18n.getMessage('create_account_link')).bind('click', function(evt) {
            window.open(Wiz.Constant.Default.REGISTER_URL);
        });
    }
    this.initCreateAccountLink = initCreateAccountLink;
    this.autoLogin = autoLogin;
}