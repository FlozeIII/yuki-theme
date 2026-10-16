// 评论提交不刷新：点提交之后页面不动，结果就地画出来。
//
// 这是**增强**不是页面本身。表单的 action 照旧指着 WordPress 原生的入口：没有这个脚本，
// 或者这一件还没覆盖到的那条路（回复，见下面 submit 里那段），整页提交照旧发得出评论。
//
// 页面上那几块（待审提示、评论计数）的原话与标记都只有**服务端**一份：端点回话里带的
// 就是列表页上那一份，这里只负责换掉，不另写一句——两边各写一句的话，措辞迟早会不一样，
// 而两边看起来都对。
(function () {
  'use strict';

  var config = window.yukiCommentSubmit || {};

  if (!config.endpoint || !window.fetch || !document.querySelector) {
    return;
  }

  var form = document.getElementById('commentform');
  var section = form && form.closest ? form.closest('.yuki-comments') : null;

  // 评论区不在这一页上（或者印记变了）就什么都不做——半截的接管比不接管更糟
  if (!form || !section) {
    return;
  }

  var textarea = form.querySelector('textarea[name="comment"]');
  var submit = form.querySelector('[type="submit"]');

  /** 提交中那个按钮点不动，免得连点两下发出去两条。 */
  function busy(state) {
    if (submit) {
      submit.disabled = !!state;
    }
  }

  /** 服务端说了话就放出来，没说话就把上一句收掉。 */
  function say(message) {
    var shown = section.querySelector('.yuki-comment-error');

    if (!message) {
      if (shown) {
        shown.remove();
      }
      return;
    }

    if (!shown) {
      shown = document.createElement('p');
      shown.className = 'yuki-comment-error';
      shown.setAttribute('role', 'alert');
      form.parentNode.insertBefore(shown, form);
    }

    // 按纯文本放：那只是服务端回话里的一句话，不该在这里被当成标记解释
    shown.textContent = message;
  }

  /** 待审提示：有就换掉，没有就贴到评论区最上面；服务端说没有了就收掉。 */
  function paintNotice(html) {
    var current = section.querySelector('.yuki-pending-notice');

    if (current) {
      current.remove();
    }

    if (html) {
      section.insertAdjacentHTML('afterbegin', html);
    }
  }

  /** 评论计数：有就换掉，没有就连同列表一起补上（头一条评论就落在这条路上）。 */
  function paintHeading(html) {
    if (!html) {
      return;
    }

    var current = section.querySelector('.yuki-comment-count');

    if (current) {
      current.outerHTML = html;
      return;
    }

    var anchor = section.querySelector('.yuki-comment-list') || document.getElementById('respond');

    if (anchor) {
      anchor.insertAdjacentHTML('beforebegin', html);
    }
  }

  /**
   * 把新评论贴到列表里。
   *
   * 回复的落位是下一件工单的事，这里一律贴到列表末尾——顶层评论本来就该在那儿。
   * 列表还不存在时（这篇文章还没有评论）连列表一起补上，位置与没脚本时一致：表单前面。
   */
  function insert(html) {
    if (!html) {
      return;
    }

    var list = section.querySelector('.yuki-comment-list');

    if (!list) {
      list = document.createElement('ul');
      list.className = 'yuki-comment-list';

      var anchor = document.getElementById('respond') || form;
      anchor.parentNode.insertBefore(list, anchor);
    }

    list.insertAdjacentHTML('beforeend', html);
  }

  /** 落定之后的收尾。 */
  function accept(data) {
    say('');
    insert(data.html);
    // 先补列表再补标题：标题要插在列表前面，而列表可能刚由上一行建出来
    paintHeading(data.heading);
    paintNotice(data.notice || '');

    // 输入框清空，作者名与邮箱留着：它们靠 cookie 记住，两条路一致
    if (textarea) {
      textarea.value = '';
    }
  }

  form.addEventListener('submit', function (event) {
    /*
     * 只接管顶层评论。
     *
     * 回复要落到被回复的那条下面，那是下一件工单的事；在那之前让它照原样整页提交——
     * 今天那条路总是对的，别把它弄差。回复表单是核心的 comment-reply 脚本搬过来的，
     * 所以这里看的是表单里那个隐藏字段，而不是「表单现在在哪儿」。
     */
    var parent = form.querySelector('[name="comment_parent"]');

    if (parent && parent.value && '0' !== parent.value) {
      return;
    }

    event.preventDefault();

    say('');
    busy(true);

    var headers = { 'Content-Type': 'application/x-www-form-urlencoded' };

    // 登录用户那边核心的 REST cookie 认证要一枚 nonce；访客这边它是空的，不发
    if (config.nonce) {
      headers['X-WP-Nonce'] = config.nonce;
    }

    fetch(config.endpoint, {
      method: 'POST',
      credentials: 'same-origin',
      headers: headers,
      // 交上去的就是表单自己那些字段：与原生那条路同一形状，服务端读的也是同一份东西
      body: new URLSearchParams(new FormData(form)).toString()
    })
      .then(function (response) {
        return response.text().then(function (text) {
          var data = {};
          try {
            data = JSON.parse(text);
          } catch (e) {
            data = {};
          }
          return { ok: response.ok, data: data };
        });
      })
      .then(function (result) {
        /*
         * 落定的判据是「回话里有那条评论的标识」，不只是状态码。
         *
         * 状态码好看、回话却不是那一份（中间被别的什么改过、或者被截断）时，
         * 按成功处理会把输入框清空、却什么也没画出来——访客以为自己发出去了，
         * 其实内容连人带字一起没了。宁可当成没发成功：东西还在，他再点一次就是了。
         *
         * 服务端说了话就把话放出来（比如「请填写必填项」），没给就什么也不说。
         */
        var data = result.data || {};

        if (!result.ok || !data.id) {
          say(data.message || '');
          return;
        }

        accept(data);
      })
      .catch(function () {
        // 网络不通：退回提交前的样子
        say('');
      })
      .then(function () {
        busy(false);
      });
  });
})();
