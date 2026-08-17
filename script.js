const ARTICLE_INDEX_URL = 'articles/index.json';
const categoryNames = { design: '開發實戰', technology: '雲端架構', life: '系統維運' };
let articles = [];
let activeCategory = 'all';
let articleLoadError = '';

const body = document.body;
const search = document.querySelector('#search');
const articleGrid = document.querySelector('.article-grid');
const noResults = document.querySelector('.no-results');

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
}

function inlineMarkdown(value) {
  const code = [];
  let html = escapeHtml(value).replace(/`([^`]+)`/g, (_, text) => {
    code.push(`<code>${text}</code>`);
    return `\u0000${code.length - 1}\u0000`;
  });
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
      flushParagraph(); closeList();
      const language = line.slice(3).trim();
      const code = [];
      i += 1;
      while (i < lines.length && !lines[i].startsWith('```')) { code.push(lines[i]); i += 1; }
      html += `<pre><code${language ? ` class="language-${escapeHtml(language)}"` : ''}>${escapeHtml(code.join('\n'))}</code></pre>`;
      continue;
    }
    const tableNext = i + 1 < lines.length && /^\s*\|?\s*:?-{3,}/.test(lines[i + 1]);
    if (line.includes('|') && tableNext) {
      flushParagraph(); closeList();
      const headers = line.replace(/^\||\|$/g, '').split('|');
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) { rows.push(lines[i].replace(/^\||\|$/g, '').split('|')); i += 1; }
      i -= 1;
      html += `<table><thead><tr>${headers.map(cell => `<th>${inlineMarkdown(cell.trim())}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${inlineMarkdown(cell.trim())}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.+)/);
    if (heading) { flushParagraph(); closeList(); const level = heading[1].length; html += `<h${level}>${inlineMarkdown(heading[2])}</h${level}>`; continue; }
    if (/^---+$/.test(line.trim())) { flushParagraph(); closeList(); html += '<hr>'; continue; }
    if (line.startsWith('> ')) { flushParagraph(); closeList(); html += `<blockquote>${inlineMarkdown(line.slice(2))}</blockquote>`; continue; }
    const task = line.match(/^\s*- \[([ xX])\]\s+(.+)/);
    const bullet = line.match(/^\s*[-*]\s+(.+)/);
    const ordered = line.match(/^\s*\d+\.\s+(.+)/);
    if (task || bullet || ordered) {
      flushParagraph();
      const nextType = ordered ? 'ol' : 'ul';
      if (listType !== nextType) { closeList(); html += `<${nextType}>`; listType = nextType; }
      if (task) html += `<li class="task-item"><input type="checkbox" disabled ${task[1].trim() ? 'checked' : ''}> ${inlineMarkdown(task[2])}</li>`;
      else html += `<li>${inlineMarkdown((bullet || ordered)[1])}</li>`;
      continue;
    }
    closeList();
    if (!line.trim()) flushParagraph(); else paragraph.push(line);
  }
  flushParagraph(); closeList();
  return html;
}

function isValidArticle(article) {
  return article && typeof article.id === 'string' && typeof article.title === 'string' &&
    typeof article.summary === 'string' && typeof article.date === 'string' &&
    Number.isFinite(article.minutes) && categoryNames[article.category] &&
    typeof article.file === 'string' && /^[a-zA-Z0-9._-]+\.md$/.test(article.file);
}

async function loadArticles() {
  const response = await fetch(ARTICLE_INDEX_URL, { cache: 'no-store' });
  if (!response.ok) throw new Error(`文章清單讀取失敗（${response.status}）`);
  const index = await response.json();
  if (!Array.isArray(index)) throw new Error('文章清單格式不正確');
  const metadata = index.filter(isValidArticle);
  return Promise.all(metadata.map(async article => {
    const contentResponse = await fetch(`articles/${encodeURIComponent(article.file)}`, { cache: 'no-store' });
    if (!contentResponse.ok) throw new Error(`無法讀取文章：${article.file}`);
    return { ...article, content: await contentResponse.text() };
  }));
}

function formatDate(date) { return date.replaceAll('-', '.'); }

function renderArticles() {
  const term = search.value.trim().toLowerCase();
  const visible = articles
    .filter(article => (activeCategory === 'all' || article.category === activeCategory) && (!term || `${article.title} ${article.summary} ${article.content}`.toLowerCase().includes(term)))
    .sort((a, b) => b.date.localeCompare(a.date));
  articleGrid.replaceChildren();
  visible.forEach((article, index) => {
    const card = document.createElement('article');
    card.className = 'article-card'; card.dataset.id = article.id; card.tabIndex = 0; card.setAttribute('aria-label', `閱讀：${article.title}`);
    const number = document.createElement('div'); number.className = 'card-number'; number.textContent = String(index + 1).padStart(2, '0');
    const content = document.createElement('div'); content.className = 'card-body';
    const category = document.createElement('p'); category.className = 'category'; category.textContent = categoryNames[article.category];
    const title = document.createElement('h3'); title.textContent = article.title;
    const summary = document.createElement('p'); summary.textContent = article.summary;
    const meta = document.createElement('div'); meta.className = 'article-meta'; meta.innerHTML = `<span>${formatDate(article.date)}</span><span>${article.minutes} 分鐘</span>`;
    const read = document.createElement('span'); read.className = 'read-button'; read.textContent = '↗'; read.setAttribute('aria-hidden', 'true');
    content.append(category, title, summary, meta); card.append(number, content, read); articleGrid.append(card);
  });
  noResults.textContent = articleLoadError || (articles.length ? '沒有找到符合的文章，換個關鍵字試試看。' : '目前還沒有文章。');
  noResults.hidden = visible.length > 0;
}

articleGrid.addEventListener('click', event => {
  const card = event.target.closest('.article-card');
  if (card) location.hash = `article/${encodeURIComponent(card.dataset.id)}`;
});
articleGrid.addEventListener('keydown', event => {
  if ((event.key === 'Enter' || event.key === ' ') && event.target.classList.contains('article-card')) {
    event.preventDefault(); location.hash = `article/${encodeURIComponent(event.target.dataset.id)}`;
  }
});
document.querySelectorAll('.filter').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('.filter').forEach(item => item.classList.remove('active'));
  button.classList.add('active'); activeCategory = button.dataset.filter; renderArticles();
}));
search.addEventListener('input', renderArticles);

const themeToggle = document.querySelector('.theme-toggle');
const themeColor = document.querySelector('meta[name="theme-color"]');
function setTheme(dark) { body.classList.toggle('dark', dark); themeToggle.setAttribute('aria-label', dark ? '切換淺色模式' : '切換深色模式'); themeColor.content = dark ? '#18201c' : '#f4f0e8'; }
const savedTheme = localStorage.getItem('blog-theme');
setTheme(savedTheme ? savedTheme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches);
themeToggle.addEventListener('click', () => { const dark = !body.classList.contains('dark'); setTheme(dark); localStorage.setItem('blog-theme', dark ? 'dark' : 'light'); });
document.querySelector('.subscribe-form').addEventListener('submit', event => {
  event.preventDefault();
  const form = event.currentTarget;
  form.querySelector('.form-message').textContent = `訂閱成功！下一則技術更新會寄到 ${form.querySelector('input').value}`;
  form.querySelector('button').textContent = '已訂閱'; form.querySelector('button').disabled = true;
});

const pageTitles = { home: 'Derek.dev｜IT Engineer Notes', articles: '技術文章｜Derek.dev', article: '文章｜Derek.dev' };
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

async function initialize() {
  try { articles = await loadArticles(); }
  catch (error) { console.error(error); articleLoadError = '文章載入失敗，請稍後再試。'; }
  renderArticles(); showPage(routeFromHash(), false);
}
initialize();
