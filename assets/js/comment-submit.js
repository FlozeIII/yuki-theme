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
   * 把新评论贴到列表里，**贴到它该在的那一层**。
   *
   * 该挂在谁下面由服务端算好（`data.parent`，0 表示最外面那一层）——「深于两层的回复
   * 压到第二层」那条规则只有服务端一处，这里不重新判一遍：各判一遍迟早会判岔，
   * 而判岔的时候两边看起来都对。
   *
   * 返回贴进去的那一个节点（后面要拿它做滚动与重新挂事件）。
   */
  function insert(html, parentId) {
    if (!html) {
      return null;
    }

    var holder = null;

    if (parentId) {
      var parent = document.getElementById('comment-' + parentId);

      if (parent) {
        holder = parent.querySelector(':scope > ul.children');

        if (!holder) {
          holder = document.createElement('ul');
          holder.className = 'children';
          parent.appendChild(holder);
          // 有回复的那条在服务端渲染时会多一枚 parent 类，这里补上，
          // 免得同一条评论在「刚回复完」与「刷新之后」长得不一样
          parent.classList.add('parent');
        }
      }
    }

    if (!holder) {
      holder = section.querySelector('.yuki-comment-list');

      if (!holder) {
        holder = document.createElement('ul');
        holder.className = 'yuki-comment-list';

        var anchor = document.getElementById('respond') || form;
        anchor.parentNode.insertBefore(holder, anchor);
      }
    }

    holder.insertAdjacentHTML('beforeend', html);

    /*
     * 新贴进来的那一段里也有「回复」入口。**不用自己去给它挂事件**：核心的 comment-reply
     * 在 document.body 上装了一个 MutationObserver（childList + subtree），新加的节点它会
     * 自己认出来并绑上（comment-reply.js 的 observeChanges()／handleChanges()，那句注释
     * 写着「comments loaded late」就是这件事）。
     *
     * 这里曾经手动调过一次 `window.addComment.init(inserted)`——理由是「新来的它不认得」，
     * 那句是错的。而且每调一次它都会把取消链接与表单的键盘处理再绑一层（那两处不按 context
     * 过滤），白攒听众。
     */
    return holder.lastElementChild;
  }

  /**
   * 新评论不在视野里才把它带进视野，已经在视野里就什么都不做。
   *
   * 用最小距离（`block: 'nearest'`）。**别照搬没脚本那条路的跳转**：原生会滚是因为整页
   * 重载之后人已经不知道滚到哪儿了，那是重载的补偿，不是设计意图。
   */
  function reveal(element) {
    if (!element) {
      return;
    }

    var box = element.getBoundingClientRect();
    var height = window.innerHeight || document.documentElement.clientHeight;

    if (box.top >= 0 && box.bottom <= height) {
      return;
    }

    element.scrollIntoView({ block: 'nearest' });
  }

  /**
   * 告诉核心的 comment-reply「这次回复结束了」——让它自己把表单搬回原处、把父评论清掉。
   *
   * 它没有对外开一个 `cancelReply()`，取消就是那个取消链接上的点击处理（锚点的默认行为
   * 已经被它拦掉了，所以点它不会跳走）。**没装上那个脚本时不能点**：那时没人拦默认行为，
   * 点一下会整页跳走——宁可不回位，也不要为这点事重载。
   */
  function endReply() {
    var parent = form.querySelector('[name="comment_parent"]');

    // 本来就不在回复状态，没有要收的东西
    if (!parent || !parent.value || '0' === parent.value) {
      return;
    }

    /*
     * 表单被搬进评论里的时候，回位交给核心：它搬的时候在页尾留了一个占位元素，取消链接上
     * 的点击处理认得它，会把自己搬回去、把父评论清掉、把标题还原。
     */
    if (window.addComment && window.addComment.moveForm && form.closest('li[id^="comment-"]')) {
      var cancel = document.getElementById('cancel-comment-reply-link');

      if (cancel) {
        cancel.click();
        return;
      }
    }

    /*
     * 没搬过的时候，核心那套取消**没有落点**——它要的占位元素根本不存在，点取消链接也不会有
     * 反应。这条路上「这次回复结束了」只剩一件事，而它是必须做的：**把父评论清掉**。
     *
     * 什么时候会走到这儿：从 `?replytocom=N` 进来。那是核心给没脚本的人留的那条路（回复入口
     * 的 href 就是它），父评论由服务端填好、表单仍在页尾，核心的 comment-reply 从头到尾没参与。
     * 不清的话，下一条评论会**悄悄又变成一条回复**，而页面上一点异样都看不出来。
     *
     * 代价说清楚：标题会停在「回复 X」。原生那条路是靠跳转回评论页把它带走的，这里没有跳转。
     * 那是纯外观，而且只在「从 ?replytocom 进来」这一种情形里出现，不值得为它去改核心的标题节点。
     */
    parent.value = '0';
  }

  /** 落定之后的收尾。 */
  function accept(data) {
    say('');
    var inserted = insert(data.html, data.parent || 0);
    // 先补列表再补标题：标题要插在列表前面，而列表可能刚由上一行建出来
    paintHeading(data.heading);
    paintNotice(data.notice || '');

    // 输入框清空，作者名与邮箱留着：它们靠 cookie 记住，两条路一致
    if (textarea) {
      textarea.value = '';
    }

    endReply();

    /*
     * 滚不滚，要**等布局落定之后**再决定。
     *
     * 上面两件事都改动页面高度：贴进来一条评论、把表单从评论里搬回页尾。位置变了，
     * 浏览器还会在下一帧做一次滚动锚定的补偿——当场量出来的位置，等补偿完就不作数了。
     * 量早了的后果是实打实的：这一件实际踩过——回复被判定成「本来就看得见」于是不滚，
     * 而表单搬回页尾之后它已经在视野外面了。
     *
     * 两帧：第一帧让布局与锚定落下来，第二帧再量、再滚。
     */
    var afterLayout = function (fn) {
      if (!window.requestAnimationFrame) {
        fn();
        return;
      }

      window.requestAnimationFrame(function () {
        window.requestAnimationFrame(fn);
      });
    };

    afterLayout(function () {
      reveal(inserted);
    });
  }

  form.addEventListener('submit', function (event) {
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
