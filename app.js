'use strict';

// Replace site copy in index.html. Demo data stays local to this browser.
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let toastTimer;
function toast(message) {
  const box = $('.toast');
  box.textContent = message;
  box.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { box.hidden = true; }, 3500);
}
async function copyText(value) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(value);
  } else {
    const area = document.createElement('textarea');
    area.value = value;
    area.setAttribute('aria-label', '待复制内容');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    (dialog.open ? dialog : document.body).append(area);
    area.select();
    const copied = document.execCommand('copy');
    area.remove();
    if (!copied) throw new Error('Clipboard unavailable');
  }
}
async function copyWithFeedback(button, value) {
  const original = button.textContent;
  button.disabled = true;
  button.textContent = '正在复制…';
  try { await copyText(value); toast('内容已复制。'); }
  catch { toast('复制未完成。请选中文本后手动复制。'); }
  finally { button.disabled = false; button.textContent = original; button.focus(); }
}

// Full height mobile navigation, with a keyboard focus loop.
const menu = $('#mobile-menu');
const menuToggle = $('.menu-toggle');
function setMenu(open) {
  menuToggle.setAttribute('aria-expanded', String(open));
  menuToggle.setAttribute('aria-label', open ? '关闭导航菜单' : '打开导航菜单');
  document.body.classList.toggle('menu-open', open);
  menu.hidden = !open;
  menu.inert = !open;
  $('#main').inert = open;
  $('.site-footer').inert = open;
  if (open) {
    $$('.mobile-menu nav a').forEach((link, index) => link.style.transitionDelay = `${Math.min(index * 60, 400)}ms`);
    requestAnimationFrame(() => requestAnimationFrame(() => menu.classList.add('is-open')));
  } else { menu.classList.remove('is-open'); }
}
menuToggle.addEventListener('click', () => setMenu(menuToggle.getAttribute('aria-expanded') !== 'true'));
$('.floating-nav .brand').addEventListener('click', () => { if (!menu.hidden) setMenu(false); });
$$('a', menu).forEach(link => link.addEventListener('click', () => {
  const target = $(link.getAttribute('href'));
  setMenu(false);
  if (target) { target.setAttribute('tabindex', '-1'); target.focus({preventScroll:true}); }
}));
document.addEventListener('keydown', event => {
  if (menu.hidden) return;
  if (event.key === 'Escape') { setMenu(false); menuToggle.focus(); }
  if (event.key === 'Tab') {
    const focusable = [...$$('a,button', $('.floating-nav')).filter(el => el.offsetParent !== null), ...$$('a', menu)];
    const first = focusable[0], last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
});
matchMedia('(min-width: 481px)').addEventListener('change', event => { if (event.matches) setMenu(false); });

// One-time reveals. The page remains visible if JavaScript is unavailable.
if ('IntersectionObserver' in window) {
  const revealObserver = new IntersectionObserver(entries => entries.forEach(entry => {
    if (entry.isIntersecting) { entry.target.classList.add('is-revealed'); revealObserver.unobserve(entry.target); }
  }), {threshold:.08});
  $$('.section-heading,.project,.about-grid,.toolbox,.process-grid,.notes-list,.faq-intro,.faq-list,.closing-section').forEach(el => {
    if (!reducedMotion) { el.classList.add('reveal-ready'); revealObserver.observe(el); }
  });
  const words = $$('.tagline span');
  const wordObserver = new IntersectionObserver(entries => {
    entries.filter(entry => entry.isIntersecting).forEach(entry => {
      const index = words.indexOf(entry.target);
      setTimeout(() => entry.target.classList.add('is-lit'), reducedMotion ? 0 : index * 130);
      wordObserver.unobserve(entry.target);
    });
  }, {rootMargin:'0px 0px -16% 0px', threshold:.8});
  words.forEach(word => wordObserver.observe(word));
  const sectionObserver = new IntersectionObserver(entries => entries.forEach(entry => {
    if (entry.isIntersecting) {
      $$('.nav-link').forEach(link => {
        if (link.dataset.section === entry.target.id) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    }
  }), {rootMargin:'-10% 0px -65% 0px', threshold:0});
  ['home','work','about','notes'].forEach(id => sectionObserver.observe(document.getElementById(id)));
} else { $$('.tagline span').forEach(word => word.classList.add('is-lit')); }

const dialog = $('#content-dialog');
let returnFocus;
function openContent(eyebrow, content) {
  if (!menu.hidden) setMenu(false);
  returnFocus = document.activeElement;
  $('#dialog-eyebrow').textContent = eyebrow;
  $('#dialog-content').innerHTML = content;
  dialog.showModal();
  document.body.classList.add('modal-open');
  dialog.scrollTop = 0;
  $('.close-dialog').focus();
}
$('.close-dialog').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => {
  if (event.target !== dialog) return;
  const rect = dialog.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
});
dialog.addEventListener('close', () => { document.body.classList.remove('modal-open'); returnFocus?.focus(); });
const heading = (title, text) => `<div class="dialog-heading"><h2 id="dialog-title">${title}</h2><p>${text}</p></div>`;

const taskStorageKey = 'developer-notes.focus.v1';
const initialTasks = () => [
  {id:'sample-1',text:'明确今天最重要的事',done:true},
  {id:'sample-2',text:'做出一个可用的原型',done:false},
  {id:'sample-3',text:'留一点时间散步',done:false}
];
let tasks;
let storageAvailable = true;
try {
  const raw = localStorage.getItem(taskStorageKey);
  if (raw === null) tasks = initialTasks();
  else {
    const saved = JSON.parse(raw);
    if (!Array.isArray(saved) || !saved.every(item => typeof item.id === 'string' && typeof item.text === 'string' && typeof item.done === 'boolean')) throw new Error('Invalid saved tasks');
    tasks = saved.slice(0,100);
  }
} catch { tasks = initialTasks(); storageAvailable = false; }
let taskFilter = 'all';
function saveTasks() {
  try { localStorage.setItem(taskStorageKey, JSON.stringify(tasks)); storageAvailable = true; }
  catch { storageAvailable = false; }
}
function renderTasks() {
  const visible = tasks.filter(task => taskFilter === 'all' || (taskFilter === 'done' ? task.done : !task.done));
  const list = $('#task-list');
  list.innerHTML = visible.length ? visible.map(task => `<li class="task-item"><label class="task-label"><input type="checkbox" data-task="${escapeHTML(task.id)}" ${task.done ? 'checked' : ''}><span>${escapeHTML(task.text)}</span></label><button class="task-delete" data-delete="${escapeHTML(task.id)}" aria-label="删除待办：${escapeHTML(task.text)}">×</button></li>`).join('') : `<li class="empty-state"><span class="empty-symbol" aria-hidden="true">✳</span><h3>${taskFilter === 'done' ? '完成一件小事，就从这里开始。' : taskFilter === 'active' ? '这一刻，可以松一口气。' : '给今天，留一个小目标。'}</h3><p>${taskFilter === 'active' ? '当前没有进行中的待办。' : '在上方添加待办，开始你的专注清单。'}</p></li>`;
  $('#task-count').textContent = `${tasks.filter(task => !task.done).length} 项待办 · ${storageAvailable ? '仅保存在本机' : '浏览器存储不可用，仅保留本次会话'}`;
  $$('[data-task]',list).forEach(input => input.addEventListener('change', () => {
    const id = input.dataset.task;
    const task = tasks.find(item => item.id === id);
    task.done = input.checked;
    saveTasks(); renderTasks();
    const replacement = $$('[data-task]').find(el => el.dataset.task === id);
    (replacement || $(`[data-filter="${taskFilter}"]`)).focus();
  }));
  $$('[data-delete]',list).forEach(button => button.addEventListener('click', () => {
    tasks = tasks.filter(item => item.id !== button.dataset.delete);
    saveTasks(); renderTasks(); $('#task-input').focus();
  }));
}
function openFocus() {
  taskFilter = 'all';
  openContent('PROJECT 01 / INTERACTIVE DEMO', heading('Focus · 专注清单','一个完整的小工具。添加、完成或删除待办，刷新后仍保留在本机。') + `<div class="demo-area"><div class="demo-toolbar"><span class="demo-brand">focus<span class="orange-dot">.</span></span><span class="demo-meta">少做一点，做好一点。</span></div><form id="task-form" novalidate><label class="field-help" for="task-input">添加今天想完成的事</label><div class="input-row"><input id="task-input" class="text-input" maxlength="100" autocomplete="off" placeholder="一个小目标，就很好" aria-describedby="task-error"><button class="button button-primary" type="submit">添加 ↗</button></div><p id="task-error" class="form-error" role="alert" hidden></p></form><div class="filter-row" role="group" aria-label="筛选待办"><button class="filter-button" data-filter="all" aria-pressed="true">全部</button><button class="filter-button" data-filter="active" aria-pressed="false">进行中</button><button class="filter-button" data-filter="done" aria-pressed="false">已完成</button></div><ul class="task-list" id="task-list" aria-label="专注清单"></ul><div class="demo-bottom"><span id="task-count" role="status"></span><button id="clear-tasks" class="text-button">清空清单</button></div></div>`);
  renderTasks();
  $('#task-form').addEventListener('submit', event => {
    event.preventDefault();
    const input = $('#task-input'), error = $('#task-error');
    if (!input.value.trim() || tasks.length >= 100) { error.textContent = tasks.length >= 100 ? '最多保留 100 项。请先删除一些待办。' : '请先写下一个想完成的小目标。'; error.hidden = false; input.setAttribute('aria-invalid','true'); input.focus(); return; }
    error.hidden = true; input.removeAttribute('aria-invalid');
    tasks.push({id:`task-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,text:input.value.trim(),done:false});
    saveTasks(); input.value = ''; taskFilter = 'all';
    $$('[data-filter]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.filter === taskFilter)));
    renderTasks(); input.focus();
  });
  $$('[data-filter]').forEach(button => button.addEventListener('click', () => {
    taskFilter = button.dataset.filter;
    $$('[data-filter]').forEach(item => item.setAttribute('aria-pressed',String(item === button)));
    renderTasks();
  }));
  $('#clear-tasks').addEventListener('click', () => { tasks = []; saveTasks(); renderTasks(); toast('专注清单已清空。'); });
}

const palettes = [
  {name:'雨后的森林',english:'Forest after rain',colors:['#304C43','#98AA87','#D6D9BD','#F4F0DF']},
  {name:'傍晚的陶土',english:'Clay in the evening',colors:['#663F35','#B77960','#D9B498','#F3E9DB']},
  {name:'安静的海岸',english:'A quiet coast',colors:['#304B5A','#7C9CA5','#C1D3D0','#F1F3E8']}
];
let paletteIndex = 0;
function renderPalette() {
  const palette = palettes[paletteIndex];
  $('#palette-subtitle').textContent = palette.english;
  $('#palette-swatches').innerHTML = palette.colors.map(color => {
    const rgb = color.match(/\w{2}/g).map(hex => parseInt(hex,16));
    const contrast = (.2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2]) < 150 ? '#ffffff' : '#252b27';
    return `<button style="--swatch:${color};--contrast:${contrast}" data-color="${color}" aria-label="复制颜色 ${color}">${color}</button>`;
  }).join('');
  $$('[data-color]').forEach(button => button.addEventListener('click', () => copyWithFeedback(button,button.dataset.color)));
}
function openPalette() {
  paletteIndex = 0;
  openContent('PROJECT 02 / INTERACTIVE DEMO', heading('Palette · 配色实验室','选择一种氛围，点击色块复制色值，或一次复制整组 CSS 变量。') + `<div class="demo-area"><div class="demo-toolbar"><span class="demo-brand">a palette with feeling<span class="orange-dot">.</span></span></div><div class="filter-row" role="group" aria-label="选择配色">${palettes.map((palette,index) => `<button class="filter-button" data-palette="${index}" aria-pressed="${index === 0}">${palette.name}</button>`).join('')}</div><div class="live-palette" id="palette-swatches"></div><div class="palette-actions"><span id="palette-subtitle"></span><button id="copy-palette" class="button button-primary">复制 CSS 变量 ↗</button></div></div>`);
  renderPalette();
  $$('[data-palette]').forEach(button => button.addEventListener('click', () => {
    paletteIndex = Number(button.dataset.palette);
    $$('[data-palette]').forEach(item => item.setAttribute('aria-pressed',String(item === button)));
    renderPalette();
  }));
  $('#copy-palette').addEventListener('click', event => copyWithFeedback(event.currentTarget, `:root {\n${palettes[paletteIndex].colors.map((color,index) => `  --palette-${index+1}: ${color};`).join('\n')}\n}`));
}

const snippets = [
  {title:'去除数组中的重复值',language:'JavaScript',code:'const unique = items => [...new Set(items)];\n\nunique([1, 2, 2, 3]); // [1, 2, 3]'},
  {title:'为标题生成更均衡的换行',language:'CSS',code:'h1, h2, h3 {\n  text-wrap: balance;\n}\n\np {\n  text-wrap: pretty;\n}'},
  {title:'在视口内显示一次',language:'JavaScript',code:"const observer = new IntersectionObserver(entries => {\n  entries.forEach(entry => {\n    if (!entry.isIntersecting) return;\n    entry.target.classList.add('visible');\n    observer.unobserve(entry.target);\n  });\n});"},
  {title:'尊重减少动态效果的偏好',language:'CSS',code:'@media (prefers-reduced-motion: reduce) {\n  .reveal {\n    transform: none;\n    transition-property: opacity;\n  }\n}'}
];
let snippetFilter = 'all';
function renderSnippets() {
  const query = $('#snippet-input').value.trim().toLowerCase();
  const found = snippets.map((snippet,index) => ({...snippet,index})).filter(snippet => (snippetFilter === 'all' || snippet.language === snippetFilter) && `${snippet.title} ${snippet.language} ${snippet.code}`.toLowerCase().includes(query));
  $('#snippet-count').textContent = `${found.length} 个片段`;
  $('#snippet-results').innerHTML = found.length ? found.map(snippet => `<article class="snippet-result"><div class="snippet-result-header"><h3>${snippet.title}</h3><button class="copy-code" data-snippet="${snippet.index}" aria-label="复制代码：${snippet.title}">复制</button></div><pre><code>${escapeHTML(snippet.code)}</code></pre></article>`).join('') : `<div class="empty-state"><span class="empty-symbol" aria-hidden="true">{ }</span><h3>还没有匹配的片段。</h3><p>试试“数组”“标题”，或者切换语言筛选。</p></div>`;
  $$('[data-snippet]').forEach(button => button.addEventListener('click', () => copyWithFeedback(button,snippets[Number(button.dataset.snippet)].code)));
}
function openSnippet() {
  snippetFilter = 'all';
  openContent('PROJECT 03 / INTERACTIVE DEMO', heading('Snippet · 代码片段','把值得复用的小片段收在一起。搜索关键词，找到下一行灵感。') + `<div class="demo-area"><label for="snippet-input" class="field-help">搜索标题、代码或语言</label><input id="snippet-input" class="text-input" type="search" autocomplete="off" placeholder="试试搜索：数组、标题、CSS"><div class="filter-row" role="group" aria-label="筛选代码语言"><button class="filter-button" data-language="all" aria-pressed="true">全部</button><button class="filter-button" data-language="JavaScript" aria-pressed="false">JavaScript</button><button class="filter-button" data-language="CSS" aria-pressed="false">CSS</button></div><div id="snippet-results" class="snippet-results"></div><div class="demo-bottom"><span id="snippet-count" role="status"></span><span>示范片段 · 公开通用代码</span></div></div>`);
  renderSnippets();
  $('#snippet-input').addEventListener('input',renderSnippets);
  $$('[data-language]').forEach(button => button.addEventListener('click', () => {
    snippetFilter = button.dataset.language;
    $$('[data-language]').forEach(item => item.setAttribute('aria-pressed',String(item === button)));
    renderSnippets();
  }));
}
$$('[data-project]').forEach(button => button.addEventListener('click', () => ({focus:openFocus,palette:openPalette,snippet:openSnippet}[button.dataset.project])()));

const notes = {
  details:{title:'一个按钮，为什么值得多想一会儿？',category:'界面与体验',sections:[
    ['点击之后，要有回应','一个按钮连接着用户的意图和系统的动作。按下以后，如果界面毫无变化，人就会开始猜：刚才点到了吗？是不是还要再点一次？清楚的反馈让这次操作有了确定的结果。'],
    ['失败也是体验的一部分','成功状态只是一半。输入为空、网络不可用、权限被拒绝，都会发生。好的提示说明哪里出了问题，也说明接下来可以做什么。把这些状态提前做出来，往往比换一个更醒目的颜色更有用。'],
    ['让不同的操作方式都走得通','有的人用鼠标，有的人用键盘。一个可见的焦点、一段准确的按钮文字、一次合理的焦点返回，能让同一个功能被更多人顺畅使用。细节不是装饰，而是通向功能的路。']
  ],callout:'设计一个按钮，其实是在设计一次有开始、有过程、有结果的交流。'},
  small:{title:'先做一个小而完整的东西',category:'开发与方法',sections:[
    ['把第一版缩小','一个想法刚出现时，总能顺手写出很长的功能列表。但第一版最有价值的问题通常只有一个：它能不能解决那个最初的问题？先去掉暂时不需要的部分，才能更快得到答案。'],
    ['小，不等于只做成功路径','一份待办清单可以很小，但仍然需要添加、完成、删除和空状态。这些操作连起来，才是一段完整体验。完整让别人可以理解它，也让反馈落在实际使用上。'],
    ['让下一步来自使用','一旦有人开始使用，新的问题会自然浮现。哪些步骤重复了，哪些表达不清楚，哪些功能根本没有被需要。让这些事实决定下一步，比继续想象一个庞大的最终版本更踏实。']
  ],callout:'第一版的目标，是让想法第一次与真实使用见面。'},
  code:{title:'写给下一位读代码的人',category:'代码与思考',sections:[
    ['名字先说清楚','读代码时，最先看到的往往是名字。一个准确的变量名、一段意图明确的函数签名，可以省掉很多来回查找。让名字说明正在处理的业务，而不只是说明数据的形状。'],
    ['让边界看得见','哪些输入是允许的，状态在哪里改变，失败会如何返回。这些边界明确以后，修改就不再依赖猜测。简单直接的逻辑，常常比聪明的技巧更容易维护。'],
    ['留下原因','代码通常能说明做了什么，注释更适合说明为什么。记录一个看起来不直观的约束，或者一个有意保留的取舍，会让后来的人少走弯路。那个人，也可能就是过一阵子的自己。']
  ],callout:'可读性，是留给未来协作者的一点余地。'}
};
$$('[data-note]').forEach(button => button.addEventListener('click', () => {
  const note = notes[button.dataset.note];
  openContent(`DEVELOPER NOTES / ${note.category}`,heading(note.title,'示范短文 · 用来展示个人网站的阅读体验') + `<article class="article-body">${note.sections.map(section => `<h3>${section[0]}</h3><p>${section[1]}</p>`).join('')}<aside class="article-callout"><p>${note.callout}</p></aside><p class="content-note">这是为本原型撰写的示范内容，不代表站长的既有文章。</p></article>`);
}));

function openContact() {
  openContent('START A CONVERSATION / LOCAL DRAFT', heading('让下一个想法，有个开始。','写下你想聊的事，先生成一份可以复制的联系草稿。') + `<form id="contact-form" class="contact-form" novalidate><div class="form-field"><label for="contact-name">怎么称呼你</label><input id="contact-name" name="name" class="text-input" maxlength="80" autocomplete="name" required aria-describedby="name-error"><p id="name-error" class="form-error" role="alert" hidden></p></div><div class="form-field"><label for="contact-email">你的邮箱</label><input id="contact-email" name="email" class="text-input" type="email" maxlength="254" autocomplete="email" required aria-describedby="email-error"><p id="email-error" class="form-error" role="alert" hidden></p></div><div class="form-field"><label for="contact-message">想聊些什么</label><textarea id="contact-message" name="message" class="text-input" maxlength="2000" required aria-describedby="message-error" placeholder="一个想法、一个问题，或一段想一起完成的旅程。"></textarea><p id="message-error" class="form-error" role="alert" hidden></p></div><p class="form-disclaimer">这是设计示范：内容只在本页生成，不会发送或保存。站长尚未配置公开联系地址。</p><button class="button button-primary" type="submit">生成联系草稿 ↗</button><div id="draft-loading" class="loading-skeleton" aria-label="正在生成草稿" hidden><span></span><span></span><span></span></div><div id="draft-output" class="draft-output" aria-live="polite" hidden></div></form>`);
  let draftTimer;
  dialog.addEventListener('close', () => clearTimeout(draftTimer), {once:true});
  $('#contact-form').addEventListener('submit', event => {
    event.preventDefault();
    const fields = [
      {id:'contact-name',error:'name-error',valid:value => Boolean(value.trim()),message:'请填写一个称呼。'},
      {id:'contact-email',error:'email-error',valid:value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()),message:'请填写完整的邮箱，例如 name@example.com。'},
      {id:'contact-message',error:'message-error',valid:value => Boolean(value.trim()),message:'请简单写下想聊的事。'}
    ];
    let firstInvalid;
    fields.forEach(field => {
      const input = $(`#${field.id}`), error = $(`#${field.error}`), valid = field.valid(input.value);
      error.hidden = valid;
      error.textContent = valid ? '' : field.message;
      if (valid) input.removeAttribute('aria-invalid');
      else { input.setAttribute('aria-invalid','true'); firstInvalid ||= input; }
    });
    if (firstInvalid) { firstInvalid.focus(); return; }
    const form = event.currentTarget, button = $('button[type=submit]',form), output = $('#draft-output');
    const draft = `主题：关于一个想法的交流\n\n你好，我是${$('#contact-name').value.trim()}。\n\n${$('#contact-message').value.trim()}\n\n我的联系邮箱：${$('#contact-email').value.trim()}`;
    button.disabled = true; button.textContent = '正在整理草稿…';
    form.setAttribute('aria-busy','true'); $('#draft-loading').hidden = false; output.hidden = true;
    draftTimer = setTimeout(() => {
      if (!dialog.open) return;
      $('#draft-loading').hidden = true; form.removeAttribute('aria-busy');
      button.disabled = false; button.textContent = '重新生成草稿 ↗';
      output.hidden = false;
      output.innerHTML = `<h3>草稿已生成，尚未发送。</h3><p class="field-help">复制后，可以通过你选择的渠道发送。当前页面未配置收件人。</p><pre>${escapeHTML(draft)}</pre><button class="button button-primary" type="button" id="copy-draft">复制联系草稿 ↗</button>`;
      $('#copy-draft').addEventListener('click', event => copyWithFeedback(event.currentTarget,draft));
      output.scrollIntoView({behavior:reducedMotion ? 'instant' : 'smooth',block:'nearest'});
    },500);
  });
}
$$('.contact-trigger').forEach(button => button.addEventListener('click',openContact));
