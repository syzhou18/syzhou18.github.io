# 文章管理

每篇文章使用獨立的 Markdown 檔案，並在 `index.json` 登記文章資訊。網站部署到 GitHub Pages 後會自動讀取這些檔案。

`index.json` 中每筆資料需要以下欄位：

- `id`：文章網址使用的唯一英文代號
- `title`：文章標題
- `category`：`design`（開發）、`technology`（雲端）或 `life`（維運）
- `date`：日期，格式為 `YYYY-MM-DD`
- `minutes`：閱讀分鐘數，必須是數字
- `summary`：文章摘要
- `file`：同一資料夾內的 Markdown 檔名，只能使用英文字母、數字、句點、底線與連字號

新增文章時，加入 `.md` 檔案、更新 `index.json`，再將兩者提交並推送到 GitHub。
