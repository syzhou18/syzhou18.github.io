const STORAGE_KEY = 'shiguang-articles-v1';
const categoryNames = { design: '設計思考', technology: '科技觀察', life: '生活練習' };
const seedArticles = [
  { id: 'design-1', title: '好設計不是把東西變漂亮，而是讓人不必想太多', category: 'design', date: '2026-07-28', minutes: 5, summary: '從一張菜單到一個網站，真正貼心的設計，都在默默減少選擇的阻力。', content: '設計的價值不只在視覺，而在於讓資訊變得清楚，讓每一個選擇自然發生。\n\n當使用者不需要停下來猜測下一步，設計就已經完成了它最重要的工作。' },
  { id: 'ai-1', title: '和 AI 一起工作之後，我更在意「問對問題」', category: 'technology', date: '2026-07-14', minutes: 8, summary: '工具越聰明，人的判斷就越重要。三個讓協作更有效的小練習。', content: 'AI 可以很快地給出答案，但問題的方向仍然由人決定。\n\n先說清楚目標、限制和判斷標準，通常比堆疊更多指令更有效。' },
  { id: 'life-1', title: '沒有清單的台南週末：在巷弄裡練習迷路', category: 'life', date: '2026-06-30', minutes: 7, summary: '關掉地圖，跟著樹影與咖啡香轉彎，城市會用另一種方式自我介紹。', content: '旅行不一定需要把景點逐一完成。\n\n放慢速度之後，一扇老窗、一碗冰和午後的光，也會成為記憶裡最清楚的段落。' },
  { id: 'design-2', title: '字體有聲音：中文排版裡的節奏與呼吸', category: 'design', date: '2026-06-16', minutes: 6, summary: '同一句話，換一種字體、行距與留白，就能說出完全不同的語氣。', content: '排版不是把字放進格子，而是安排閱讀時的速度。\n\n適當的行距讓眼睛休息，留白則讓重要的句子被真正看見。' }
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
const reader = document.querySelector('#reader-dialog');
const articleForm = document.querySelector('#article-form');

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
    const card = document.createElement('article'); card.className = 'article-card';
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
  editor.showModal();
}

document.querySelector('#add-article').addEventListener('click', () => openEditor());
document.querySelectorAll('.dialog-close, .cancel-edit').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
document.querySelector('.reader-close').addEventListener('click', () => reader.close());
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
  const button = event.target.closest('.read-button'); if (!button) return;
  const article = articles.find(item => item.id === button.dataset.id); if (!article) return;
  document.querySelector('#reader-category').textContent = categoryNames[article.category];
  document.querySelector('#reader-title').textContent = article.title;
  document.querySelector('#reader-meta').innerHTML = `<span>${formatDate(article.date)}</span><span>${article.minutes} 分鐘閱讀</span>`;
  document.querySelector('#reader-content').textContent = article.content;
  reader.showModal();
});

document.querySelectorAll('.filter').forEach(button => button.addEventListener('click', () => { document.querySelectorAll('.filter').forEach(item => item.classList.remove('active')); button.classList.add('active'); activeCategory = button.dataset.filter; renderArticles(); }));
search.addEventListener('input', renderArticles);

const themeToggle = document.querySelector('.theme-toggle');
const themeColor = document.querySelector('meta[name="theme-color"]');
function setTheme(dark) { body.classList.toggle('dark', dark); themeToggle.setAttribute('aria-label', dark ? '切換淺色模式' : '切換深色模式'); themeColor.content = dark ? '#18201c' : '#f4f0e8'; }
const savedTheme = localStorage.getItem('blog-theme'); setTheme(savedTheme ? savedTheme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches);
themeToggle.addEventListener('click', () => { const dark = !body.classList.contains('dark'); setTheme(dark); localStorage.setItem('blog-theme', dark ? 'dark' : 'light'); });
document.querySelector('.subscribe-form').addEventListener('submit', event => { event.preventDefault(); const form = event.currentTarget; form.querySelector('.form-message').textContent = `謝謝你！下一封筆記會寄到 ${form.querySelector('input').value}`; form.querySelector('button').textContent = '已訂閱'; form.querySelector('button').disabled = true; });

const pageTitles = { home: '拾光筆記｜設計、科技與日常', articles: '所有文章｜拾光筆記', manager: '文章管理｜拾光筆記' };
function showPage(route, shouldScroll = true) {
  const page = pageTitles[route] ? route : 'home';
  document.querySelectorAll('[data-page]').forEach(section => { section.hidden = section.dataset.page !== page; });
  document.querySelectorAll('nav .route-link').forEach(link => {
    const active = link.dataset.route === page;
    link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
  });
  document.title = pageTitles[page];
  if (shouldScroll) window.scrollTo({ top: 0, behavior: 'smooth' });
}

function routeFromHash() { return location.hash.slice(1).split('?')[0] || 'home'; }
window.addEventListener('hashchange', () => showPage(routeFromHash()));
document.querySelectorAll('.route-link').forEach(link => link.addEventListener('click', () => {
  if (routeFromHash() === link.dataset.route) showPage(link.dataset.route);
}));

renderArticles(); renderManager(); showPage(routeFromHash(), false);
