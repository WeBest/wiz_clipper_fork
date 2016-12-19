//// 将选项保存在 chrome.storage 中。
//function save_options() {
//    var color = document.getElementById('color').value;
//    var likesColor = document.getElementById('like').checked;
//    chrome.storage.sync.set({
//        favoriteColor: color,
//        likesColor: likesColor
//    }, function() {
//        // 更新状态，告诉用户选项已保存。
//        var status = document.getElementById('status');
//        status.textContent = '选项已保存。';
//        setTimeout(function() {
//            status.textContent = '';
//        }, 750);
//    });
//}
//
//// 从保存在 chrome.storage 中的首选项恢复选择框和复选框状态。
//function restore_options() {
//    // 使用默认值 color = 'red' 和 likesColor = true 。
//    chrome.storage.sync.get({
//        favoriteColor: 'red',
//        likesColor: true
//    }, function(items) {
//        document.getElementById('color').value = items.favoriteColor;
//        document.getElementById('like').checked = items.likesColor;
//    });
//}
//document.addEventListener('DOMContentLoaded', restore_options);
//document.getElementById('save').addEventListener('click',
//    save_options);


$(function () {

    var saveImage2Server = $('#options-saveImage2Server');
    var defaultOptions = {
        saveImage2Server: true
    };

    function localize() {
        $('head title').html(chrome.i18n.getMessage('options_title'));
        $('#options-title').html(chrome.i18n.getMessage('WizNote'));
        $('.options-name').each(function() {
            $(this).html(chrome.i18n.getMessage('options'));
        });
        $('.options-about').each(function() {
            $(this).html(chrome.i18n.getMessage('about'));
        });
        $('#options-save').html(chrome.i18n.getMessage('save'));
        $('#lable-options-saveImage2Server').html(chrome.i18n.getMessage('save_image_to_server'));
        $('#options-saveImage2Server-tip').html(chrome.i18n.getMessage('save_image_to_server_tip'));
    }

    function restoreOptions(options) {
        chrome.storage.sync.get(options, function(itmes) {
            saveImage2Server[0].checked = itmes.saveImage2Server;
        });
    }

    function initEvent() {
        $('.menu a').click(function (ev) {
            ev.preventDefault();
            var selected = 'selected';

            $('.mainview > *').removeClass(selected);
            $('.menu li').removeClass(selected);
            setTimeout(function () {
                $('.mainview > *:not(.selected)').css('display', 'none');
            }, 100);

            $(ev.currentTarget).parent().addClass(selected);
            var currentView = $($(ev.currentTarget).attr('href'));
            currentView.css('display', 'block');
            setTimeout(function () {
                currentView.addClass(selected);
            }, 0);

            setTimeout(function () {
                $('body')[0].scrollTop = 0;
            }, 200);
        });
        $('.mainview > *:not(.selected)').css('display', 'none');

        //listen the checkbox event of save img to server
        saveImage2Server.on('click', function() {
            var isSaveImage2Server = saveImage2Server[0].checked;
            chrome.storage.sync.set({
                saveImage2Server: isSaveImage2Server
            }, function() {
//                alert('save success');
//                console.log("save success");
            });
        });
    }
    function init() {
        localize();
        initEvent();
        restoreOptions(defaultOptions);
    }
    init();
});