---
name: expense-assistant-mcp
description: "使用 expense-assistant MCP 伺服器操作個人財務系統（記帳、查詢、附件、計算）"
version: 1.0.0
author: 小赫
license: MIT
metadata:
    hermes:
        tags: [MCP, 財務, 記帳, expense-assistant]
---

# Expense Assistant MCP 操作指南

此檔案是 `SOUL.md` 引用的**工具操作手冊**。`SOUL.md` 定義你是誰；本檔案定義你如何使用 Expense Assistant MCP。

使用 `mcp_expense_assistant_*` 工具操作個人財務 SQLite 系統。工具規則以本檔案為準。

---

## 核心規則

- **日期：**所有日期參數使用 ISO 8601 含時區偏移格式；優先用馬來西亞時間 `+08:00`，例如 `2026-04-29T12:00:00+08:00`。UTC `Z` 可接受，但不要為「今天/昨天/本週」做不必要 UTC 換算。
- **計算：**凡涉及加減乘除、稅務、分帳、折扣、報銷，先抽取完整算式並呼叫 `calculate`；不要心算。
- **類別：**永遠從 `list_categories` 的官方列表選擇；不可自創類別。若類別為「其他」，提供 `sub_category`。
- **批量：**多筆新增用 `bulk_add_expenses`；多筆刪除用 `bulk_delete_expenses`。
- **刪除：**任何刪除操作都要先向俊偉確認；刪除費用也會刪除其附件檔案。
- **隱私：**財務資料只在完成任務所需範圍內輸出。

---

## 工具速查

| 工具                   | 用途                       | 何時使用           |
| ---------------------- | -------------------------- | ------------------ |
| `list_categories`      | 取得合法類別               | 類別不確定時先呼叫 |
| `calculate`            | 金額、稅務、分帳、報銷計算 | 任何算術需求       |
| `add_expense`          | 新增單筆消費               | 單筆記帳           |
| `bulk_add_expenses`    | 批量新增消費               | 一次多筆           |
| `get_expense`          | 取得單筆詳情與附件路徑     | 查看記錄/傳送附件  |
| `list_expenses`        | 查詢多筆消費               | 搜尋、篩選、分頁   |
| `update_expense`       | 修改現有消費               | 更正資料           |
| `delete_expense`       | 永久刪除單筆               | 確認後刪除         |
| `bulk_delete_expenses` | 批量永久刪除               | 確認後刪除多筆     |
| `add_attachment`       | 綁定檔案到消費             | 收據/圖片上傳後    |
| `remove_attachment`    | 刪除單一附件               | 只移除附件         |
| `expense_summary`      | 聚合報告                   | 消費統計/趨勢      |

---

## 日期規則

- 新增單筆：若俊偉說今天中午 12 點，傳 `2026-04-29T12:00:00+08:00`。
- 查詢一天：`2026-04-29T00:00:00+08:00` 到 `2026-04-29T23:59:59+08:00`。
- 查詢本週/月/年：用馬來西亞時間的自然邊界組成 `start_date` 與 `end_date`。

---

## 金額計算

`calculate` 只接受乾淨算式，不接受原始自然語言。

規則：

- 一次傳完整算式，節省工具呼叫。
- 百分比先轉乘數：消費稅 6 → `*1.06`。
- 入帳用 `rounded_result`；展示用 `rounded_result_text`。

範例：

```text
俊偉：午餐 11.5加2.3加9 消費稅6
→ calculate(expression="(11.5+2.3+9)*1.06")
→ add_expense(amount=<rounded_result>, category="食物", description="午餐")
```

---

## 常用流程

### 快捷記帳

1. 解析金額；若需要計算，先用 `calculate`。
2. 判斷類別；不確定時先 `list_categories`。
3. 整理簡短描述與必要備註。
4. 組成 `date`（ISO 8601，優先 `+08:00`）。
5. 呼叫 `add_expense`；多筆則呼叫 `bulk_add_expenses`。

### 附件

1. 先建立或確認目標 expense。
2. 呼叫 `add_attachment`，傳入 `expense_id`、Telegram 下載後的絕對 `file_path`、檔名與 MIME type。
3. 若俊偉先傳圖後補文字，等資訊足夠後再串接。

### 查詢與報表

- 問總支出/分類/趨勢：用 `expense_summary`，依問題選 `day`、`week`、`month`、`year`。
- 問明細/搜尋：用 `list_expenses`。
- 回覆使用繁體中文 Markdown，保留必要數字，不展開無關私人資料。

### 修改與刪除

- 更正資料：用 `update_expense`，只傳要修改的欄位。
- 刪除費用或附件：先確認，再用對應刪除工具。

---

## 常見錯誤

```text
錯：自己把「今天」換成 UTC 後傳入，導致日期偏移。
對：直接用馬來西亞日期邊界 +08:00。

錯：自創「餐飲」類別。
對：從 list_categories 選「食物」。

錯：心算稅後金額。
對：calculate(expression="(11.5+2.3+9)*1.06")。

錯：只呼叫 add_attachment，沒有目標 expense。
對：先取得 expense_id，再綁定附件。
```
