# ORBITER · 地球軌道巡航

駕駛太空船繞著低多邊形地球飛行：收集藍色能量晶體維持能量，閃避隕石、太空垃圾與流星。
使用 Three.js 製作，不需要建置流程，程式與美術全部原創（模型為程式產生，音效為 WebAudio 即時合成）。

## 執行

```bash
node server.mjs
```

開啟 http://localhost:5178/ （需要 Node 18 以上，不需安裝套件）。
任何靜態伺服器也能執行，只有 DEV 工具的「寫入 src/layout.js」需要 `server.mjs`。

## 部署（Cloudflare Workers）

Cloudflare 後台連結此 repo，組建命令留空、部署命令 `npx wrangler deploy`。
設定在 `wrangler.jsonc`（根目錄當靜態網站上傳），`.assetsignore` 列出不公開的檔案。

## 玩法

- **巡航模式**：閃避障礙、收集能量
- **戰鬥模式**：按住滑鼠或空白鍵發射雷射擊碎隕石（觸控裝置自動開火）
- 操作：滑鼠 / 手指 / 方向鍵，`P` 或 `Esc` 暫停
- 能量會持續消耗，受擊扣能量，歸零即墜入大氣層
- 每繞地球 1/4 圈升一級（速度提升），繞完一整圈補充能量
- 綠色護盾道具：短時間無敵

## DEV 微調工具

按 `D` 開關（或網址加 `?dev` 顯示左下角齒輪按鈕）。

- 滑桿 / 顏色選擇器即時調整相機、地球、太空船、太陽、月球、特效、HUD 的位置、大小與顏色
- 直接用滑鼠拖曳 3D 物件與 HUD 元件，滾輪縮放（HUD：滾輪調字級、Shift + 滾輪調縮放）
- PC / Tablet / Mobile 三組版面分開調整，可在桌機上模擬手機與平板比例
- 狀態觸發：升級、繞完一圈、受擊、護盾、生成各種物件、墜毀、結算畫面
- 調整值會暫存在瀏覽器，按「💾 匯出 JSON」複製全部數值，或按「📝 寫入 src/layout.js」直接存回原始碼

## 檔案結構

| 檔案 | 說明 |
| --- | --- |
| `src/layout.js` | 版面（LAYOUTS）、玩法參數（GAME）、配色（THEME） |
| `src/main.js` | 主迴圈、輸入、遊戲狀態機 |
| `src/world.js` | 地球、雲層、大氣、星空、太陽、月球 |
| `src/ship.js` | 太空船模型 |
| `src/entities.js` | 能量晶體、隕石、太空垃圾、流星、護盾、雷射 |
| `src/particles.js` | 粒子系統 |
| `src/hud.js` | HUD 與畫面 |
| `src/audio.js` | 合成音效 |
| `src/devtools.js` | DEV 微調工具 |
| `server.mjs` | 本機開發伺服器 |
