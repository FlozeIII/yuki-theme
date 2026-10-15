// 评论点赞：点一下走 REST 端点，页面不刷新。
//
// 页面上那份计数与「我点过没有」是**服务端**渲染好的（没有这个脚本它们照样在，
// 只是点不动），这里只负责让它点得动：
//
// - 请求期间禁用按钮，避免同一条被连点两次；
// - 回话之前先按预期画出来，点下去不该毫无反应；
// - 回来后**以服务端的数字为准**——重复点、另一个标签页点过、乐观值算错，
//   本地那点算术都可能不对；
// - 出错就退回点击前的样子：宁可看起来「没点上」，也不要显示一个根本没提交成功的赞。
(function () {
  'use strict';

  var config = window.yukiCommentLikes || {};

  if (!config.endpoint || !window.fetch || !document.querySelector) {
    return;
  }

  function paint(button, liked, count) {
    button.classList.toggle('is-liked', liked);
    button.setAttribute('aria-pressed', liked ? 'true' : 'false');

    var counter = button.querySelector('.yuki-like-count');
    if (counter) {
      // 原样填回去，不做千分位之类的本地化：服务端渲染的也是这个形状，
      // 两边各格式化一次，同一个数字就会有两种长相
      counter.textContent = String(count);
    }
  }

  document.addEventListener('click', function (event) {
    var button = event.target.closest ? event.target.closest('.yuki-like[data-comment-id]') : null;

    if (!button || button.disabled) {
      return;
    }

    var liked = button.getAttribute('aria-pressed') !== 'true';
    var counter = button.querySelector('.yuki-like-count');
    var count = Number(counter ? counter.textContent.replace(/[^0-9]/g, '') : 0);

    button.disabled = true;
    paint(button, liked, liked ? count + 1 : Math.max(0, count - 1));

    fetch(config.endpoint, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        comment_id: Number(button.getAttribute('data-comment-id')),
        liked: liked
      })
    })
      .then(function (response) {
        if (!response.ok) {
          throw new Error('HTTP ' + response.status);
        }
        return response.json();
      })
      .then(function (data) {
        paint(button, !!data.liked, data.count);
      })
      .catch(function () {
        paint(button, !liked, count);
      })
      .then(function () {
        button.disabled = false;
      });
  });
})();
