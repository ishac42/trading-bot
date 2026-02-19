# Future Features

Ideas and enhancements to revisit in future sprints.

---

## Bot Activity Log

**Problem**: When risk management blocks a trade (max daily loss exceeded, max concurrent positions reached, insufficient capital, position size limit), no trade is created — the buy is silently prevented. These events are logged to the server console but invisible in the UI.

**Feature**: A per-bot activity log that records:
- Blocked trades with the reason (e.g., "BUY AAPL blocked: daily loss limit exceeded")
- Skipped cycles (outside trading window, market closed, bot paused)
- Errors and retries

**Value**: Answers the question "why didn't my bot trade?" without digging through server logs.

---
