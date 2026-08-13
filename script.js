const STORAGE_KEY = 'derek-dev-articles-v1';
const categoryNames = { design: '開發實戰', technology: '雲端架構', life: '系統維運' };
const seedArticles = [
  { id: 'docker-1', title: 'Docker Compose：從開發環境走向穩定部署', category: 'life', date: '2026-08-10', minutes: 8, summary: '整理容器健康檢查、網路隔離、持久化資料與環境變數的實務配置。', content: '容器化的價值不只是「在我的電腦上能跑」，而是建立一致且可重現的執行環境。\n\n本文從 Compose 結構開始，逐步處理 healthcheck、volume、network 與 secrets。' },
  { id: 'api-1', title: '設計一套不讓前端痛苦的 REST API', category: 'design', date: '2026-07-25', minutes: 7, summary: '從資源命名、狀態碼到錯誤格式，建立一致且容易維護的 API 合約。', content: '好的 API 應該具有可預測性。相同類型的操作使用一致的路徑、回應結構與錯誤格式。\n\n先定義合約，再進行實作，可以大幅降低前後端整合成本。' },
  { id: 'cloud-1', title: '雲端成本突然暴增？從監控指標找到根因', category: 'technology', date: '2026-07-08', minutes: 10, summary: '一套從帳單異常、資源標籤到流量指標的系統化排查流程。', content: '成本異常通常不是單一服務造成。先依服務與標籤拆解帳單，再對照部署紀錄和流量指標。\n\n最後建立預算告警，讓問題在月底帳單出現以前就被看見。' },
  { id: 'git-1', title: 'Git Commit 寫得好，除錯時間少一半', category: 'design', date: '2026-06-18', minutes: 5, summary: '可搜尋、可回溯、能說明意圖的提交紀錄，是團隊最低成本的技術文件。', content: '一個 commit 應該只處理一個清楚的目的，並說明為什麼需要這個改動。\n\n當 production 出現問題時，乾淨的歷史能讓 bisect 與 rollback 更安全。' }
];

let articles = loadArticles();
let activeCategory = 'all';
const body = document.body;
const search = document.querySelector('#search');
const articleGrid = document.querySelector('.article-grid');
const managerList = document.querySelector('#manager-list');
const noResults = document.querySelector('.no-results');
const managerEmpty = document.querySelector('#manager-empty');
const editor = document.querySelector('#article-dialog');
const articleForm = document.querySelector('#article-form');
const contentEditor = document.querySelector('#article-content');
const editorPreview = document.querySelector('#editor-preview');

function escapeHtml(value) { return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char])); }
function inlineMarkdown(value) {
  const code = [];
  let html = escapeHtml(value).replace(/`([^`]+)`/g, (_, text) => { code.push(`<code>${text}</code>`); return `\u0000${code.length - 1}\u0000`; });
  html = html
    .replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g, '<img src="$2" alt="$1" loading="lazy">')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/~~([^~]+)~~/g, '<del>$1</del>')
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
  return html.replace(/\u0000(\d+)\u0000/g, (_, index) => code[Number(index)]);
}
function markdownToHtml(markdown) {
  const lines = markdown.replace(/\r/g, '').split('\n');
  let html = '', paragraph = [], listType = '';
  const flushParagraph = () => { if (paragraph.length) { html += `<p>${paragraph.map(inlineMarkdown).join('<br>')}</p>`; paragraph = []; } };
  const closeList = () => { if (listType) { html += `</${listType}>`; listType = ''; } };
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.startsWith('```')) {
      flushParagraph(); closeList(); const language = line.slice(3).trim(); const code = [];
      i += 1; while (i < lines.length && !lines[i].startsWith('```')) { code.push(lines[i]); i += 1; }
      html += `<pre><code${language ? ` class="language-${escapeHtml(language)}"` : ''}>${escapeHtml(code.join('\n'))}</code></pre>`; continue;
    }
    const tableNext = i + 1 < lines.length && /^\s*\|?\s*:?-{3,}/.test(lines[i + 1]);
    if (line.includes('|') && tableNext) {
      flushParagraph(); closeList(); const headers = line.replace(/^\||\|$/g, '').split('|'); i += 2; const rows = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) { rows.push(lines[i].replace(/^\||\|$/g, '').split('|')); i += 1; } i -= 1;
      html += `<table><thead><tr>${headers.map(cell => `<th>${inlineMarkdown(cell.trim())}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${inlineMarkdown(cell.trim())}</td>`).join('')}</tr>`).join('')}</tbody></table>`; continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.+)/);
    if (heading) { flushParagraph(); closeList(); const level = heading[1].length; html += `<h${level}>${inlineMarkdown(heading[2])}</h${level}>`; continue; }
    if (/^---+$/.test(line.trim())) { flushParagraph(); closeList(); html += '<hr>'; continue; }
    if (line.startsWith('> ')) { flushParagraph(); closeList(); html += `<blockquote>${inlineMarkdown(line.slice(2))}</blockquote>`; continue; }
    const task = line.match(/^\s*- \[([ xX])\]\s+(.+)/);
    const bullet = line.match(/^\s*[-*]\s+(.+)/);
    const ordered = line.match(/^\s*\d+\.\s+(.+)/);
    if (task || bullet || ordered) {
      flushParagraph(); const nextType = ordered ? 'ol' : 'ul'; if (listType !== nextType) { closeList(); html += `<${nextType}>`; listType = nextType; }
      if (task) html += `<li class="task-item"><input type="checkbox" disabled ${task[1].trim() ? 'checked' : ''}> ${inlineMarkdown(task[2])}</li>`;
      else html += `<li>${inlineMarkdown((bullet || ordered)[1])}</li>`; continue;
    }
    closeList(); if (!line.trim()) flushParagraph(); else paragraph.push(line);
  }
  flushParagraph(); closeList(); return html;
}

function updateEditorPreview() {
  editorPreview.innerHTML = markdownToHtml(contentEditor.value);
  document.querySelector('#editor-count').textContent = `${contentEditor.value.replace(/\s/g, '').length} 字`;
}
function replaceSelection(before, after = before, placeholder = '文字') {
  const start = contentEditor.selectionStart, end = contentEditor.selectionEnd;
  const selected = contentEditor.value.slice(start, end) || placeholder;
  contentEditor.setRangeText(`${before}${selected}${after}`, start, end, 'select'); contentEditor.focus(); updateEditorPreview();
}
function prefixLines(prefix) {
  const start = contentEditor.value.lastIndexOf('\n', contentEditor.selectionStart - 1) + 1;
  const endBreak = contentEditor.value.indexOf('\n', contentEditor.selectionEnd); const end = endBreak < 0 ? contentEditor.value.length : endBreak;
  const selected = contentEditor.value.slice(start, end).split('\n').map((line, index) => prefix === '1. ' ? `${index + 1}. ${line}` : `${prefix}${line}`).join('\n');
  contentEditor.setRangeText(selected, start, end, 'end'); contentEditor.focus(); updateEditorPreview();
}

function loadArticles() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || seedArticles; }
  catch { return seedArticles; }
}
function saveArticles() { localStorage.setItem(STORAGE_KEY, JSON.stringify(articles)); }
function formatDate(date) { return date.replaceAll('-', '.'); }
function createId() { return window.crypto?.randomUUID?.() || `article-${Date.now()}`; }
function makeButton(label, className, id) {
  const button = document.createElement('button');
  button.type = 'button'; button.textContent = label; button.className = className; button.dataset.id = id;
  return button;
}

function renderArticles() {
  const term = search.value.trim().toLowerCase();
  const visible = articles.filter(article => (activeCategory === 'all' || article.category === activeCategory) && (!term || `${article.title} ${article.summary} ${article.content}`.toLowerCase().includes(term)));
  articleGrid.replaceChildren();
  visible.forEach((article, index) => {
    const card = document.createElement('article'); card.className = 'article-card'; card.dataset.id = article.id; card.tabIndex = 0; card.setAttribute('aria-label', `閱讀：${article.title}`);
    const number = document.createElement('div'); number.className = 'card-number'; number.textContent = String(index + 1).padStart(2, '0');
    const content = document.createElement('div'); content.className = 'card-body';
    const category = document.createElement('p'); category.className = 'category'; category.textContent = categoryNames[article.category];
    const title = document.createElement('h3'); title.textContent = article.title;
    const summary = document.createElement('p'); summary.textContent = article.summary;
    const meta = document.createElement('div'); meta.className = 'article-meta'; meta.innerHTML = `<span>${formatDate(article.date)}</span><span>${article.minutes} 分鐘</span>`;
    const read = makeButton('↗', 'read-button', article.id); read.setAttribute('aria-label', `閱讀：${article.title}`);
    content.append(category, title, summary, meta); card.append(number, content, read); articleGrid.append(card);
  });
  noResults.hidden = visible.length > 0;
}

function renderManager() {
  managerList.replaceChildren();
  [...articles].sort((a, b) => b.date.localeCompare(a.date)).forEach(article => {
    const row = document.createElement('div'); row.className = 'manager-item';
    const info = document.createElement('div'); const title = document.createElement('h3'); title.textContent = article.title;
    const meta = document.createElement('p'); meta.textContent = `${categoryNames[article.category]} · ${formatDate(article.date)} · ${article.minutes} 分鐘`;
    const actions = document.createElement('div'); actions.className = 'manager-actions';
    actions.append(makeButton('編輯', 'edit-button', article.id), makeButton('刪除', 'delete-button', article.id));
    info.append(title, meta); row.append(info, actions); managerList.append(row);
  });
  managerEmpty.hidden = articles.length > 0;
}

function openEditor(article = null) {
  articleForm.reset();
  document.querySelector('#dialog-title').textContent = article ? '編輯文章' : '新增文章';
  document.querySelector('#article-id').value = article?.id || '';
  document.querySelector('#article-title').value = article?.title || '';
  document.querySelector('#article-category').value = article?.category || 'design';
  document.querySelector('#article-date').value = article?.date || new Date().toISOString().slice(0, 10);
  document.querySelector('#article-minutes').value = article?.minutes || 5;
  document.querySelector('#article-summary').value = article?.summary || '';
  document.querySelector('#article-content').value = article?.content || '';
  contentEditor.hidden = false; editorPreview.hidden = true; document.querySelector('.preview-toggle').classList.remove('active'); updateEditorPreview();
  editor.showModal();
}

document.querySelector('.editor-toolbar').addEventListener('click', event => {
  const button = event.target.closest('button'); if (!button) return;
  if (button.dataset.wrap) replaceSelection(button.dataset.wrap);
  if (button.dataset.line) prefixLines(button.dataset.line);
  if (button.dataset.action === 'undo' || button.dataset.action === 'redo') { contentEditor.focus(); document.execCommand(button.dataset.action); updateEditorPreview(); }
  if (button.dataset.action === 'link') { const url = prompt('連結網址（https://…）'); if (url) replaceSelection('[', `](${url})`, '連結文字'); }
  if (button.dataset.action === 'image') { const url = prompt('圖片網址（https://…）'); if (url) replaceSelection('![', `](${url})`, '圖片說明'); }
  if (button.dataset.action === 'table') replaceSelection('\n| 欄位一 | 欄位二 |\n| --- | --- |\n| 內容一 | 內容二 |\n', '', '');
  if (button.dataset.action === 'rule') replaceSelection('\n---\n', '', '');
  if (button.dataset.action === 'preview') { const showing = editorPreview.hidden; updateEditorPreview(); editorPreview.hidden = !showing; contentEditor.hidden = showing; button.classList.toggle('active', showing); button.innerHTML = showing ? '✎ 編輯' : '◫ 預覽'; }
});
contentEditor.addEventListener('input', updateEditorPreview);
contentEditor.addEventListener('keydown', event => { if (event.key === 'Tab') { event.preventDefault(); contentEditor.setRangeText('  ', contentEditor.selectionStart, contentEditor.selectionEnd, 'end'); updateEditorPreview(); } });

document.querySelector('#add-article').addEventListener('click', () => openEditor());
document.querySelectorAll('.dialog-close, .cancel-edit').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); }));

articleForm.addEventListener('submit', event => {
  event.preventDefault();
  const id = document.querySelector('#article-id').value || createId();
  const article = { id, title: document.querySelector('#article-title').value.trim(), category: document.querySelector('#article-category').value, date: document.querySelector('#article-date').value, minutes: Number(document.querySelector('#article-minutes').value), summary: document.querySelector('#article-summary').value.trim(), content: document.querySelector('#article-content').value.trim() };
  const index = articles.findIndex(item => item.id === id);
  if (index >= 0) articles[index] = article; else articles.unshift(article);
  saveArticles(); renderArticles(); renderManager(); editor.close();
});

managerList.addEventListener('click', event => {
  const button = event.target.closest('button'); if (!button) return;
  const article = articles.find(item => item.id === button.dataset.id); if (!article) return;
  if (button.classList.contains('edit-button')) openEditor(article);
  if (button.classList.contains('delete-button') && confirm(`確定要刪除「${article.title}」嗎？`)) { articles = articles.filter(item => item.id !== article.id); saveArticles(); renderArticles(); renderManager(); }
});

articleGrid.addEventListener('click', event => {
  const card = event.target.closest('.article-card'); if (!card) return;
  location.hash = `article/${encodeURIComponent(card.dataset.id)}`;
});
articleGrid.addEventListener('keydown', event => {
  if ((event.key === 'Enter' || event.key === ' ') && event.target.classList.contains('article-card')) { event.preventDefault(); location.hash = `article/${encodeURIComponent(event.target.dataset.id)}`; }
});

document.querySelectorAll('.filter').forEach(button => button.addEventListener('click', () => { document.querySelectorAll('.filter').forEach(item => item.classList.remove('active')); button.classList.add('active'); activeCategory = button.dataset.filter; renderArticles(); }));
search.addEventListener('input', renderArticles);

const themeToggle = document.querySelector('.theme-toggle');
const themeColor = document.querySelector('meta[name="theme-color"]');
function setTheme(dark) { body.classList.toggle('dark', dark); themeToggle.setAttribute('aria-label', dark ? '切換淺色模式' : '切換深色模式'); themeColor.content = dark ? '#18201c' : '#f4f0e8'; }
const savedTheme = localStorage.getItem('blog-theme'); setTheme(savedTheme ? savedTheme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches);
themeToggle.addEventListener('click', () => { const dark = !body.classList.contains('dark'); setTheme(dark); localStorage.setItem('blog-theme', dark ? 'dark' : 'light'); });
document.querySelector('.subscribe-form').addEventListener('submit', event => { event.preventDefault(); const form = event.currentTarget; form.querySelector('.form-message').textContent = `訂閱成功！下一則技術更新會寄到 ${form.querySelector('input').value}`; form.querySelector('button').textContent = '已訂閱'; form.querySelector('button').disabled = true; });

const pageTitles = { home: 'Derek.dev｜IT Engineer Notes', articles: '技術文章｜Derek.dev', manager: '文章管理｜Derek.dev', article: '文章｜Derek.dev' };
function renderArticlePage(id) {
  const article = articles.find(item => item.id === id);
  if (!article) return false;
  document.querySelector('#reader-category').textContent = categoryNames[article.category];
  document.querySelector('#reader-title').textContent = article.title;
  document.querySelector('#reader-summary').textContent = article.summary;
  document.querySelector('#reader-meta').innerHTML = `<span>${formatDate(article.date)}</span><span>${article.minutes} 分鐘閱讀</span><span>BY DEREK</span>`;
  document.querySelector('#reader-content').innerHTML = markdownToHtml(article.content);
  document.title = `${article.title}｜Derek.dev`;
  return true;
}
function showPage(route, shouldScroll = true) {
  const [routeName, encodedId] = route.split('/');
  let page = pageTitles[routeName] ? routeName : 'home';
  if (page === 'article' && !renderArticlePage(decodeURIComponent(encodedId || ''))) page = 'articles';
  document.querySelectorAll('[data-page]').forEach(section => { section.hidden = section.dataset.page !== page; });
  document.querySelectorAll('nav .route-link').forEach(link => {
    const active = link.dataset.route === page;
    link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
  });
  if (page !== 'article') document.title = pageTitles[page];
  if (shouldScroll) window.scrollTo({ top: 0, behavior: 'smooth' });
}

function routeFromHash() { return location.hash.slice(1).split('?')[0] || 'home'; }
window.addEventListener('hashchange', () => showPage(routeFromHash()));
document.querySelectorAll('.route-link').forEach(link => link.addEventListener('click', () => {
  if (routeFromHash() === link.dataset.route) showPage(link.dataset.route);
}));

renderArticles(); renderManager(); showPage(routeFromHash(), false);
