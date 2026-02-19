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

## Profile & Account Settings

**Problem**: Users currently have minimal control over their account. There's no way to manage personal details, update preferences, or customize the experience beyond basic functionality.

**Feature**: A dedicated Profile & Account Settings page that includes:
- **Personal Info**: Edit display name, avatar/profile picture, email address, and timezone
- **Security**: Change password, enable/disable two-factor authentication, view active sessions, and manage connected devices
- **Notifications**: Configure email/push notification preferences for trade executions, bot alerts, daily summaries, and risk threshold warnings
- **Trading Preferences**: Set default paper/live mode, preferred currency display, default position sizing, and risk tolerance level
- **API Keys**: Manage brokerage API keys (add, revoke, rotate) with clear status indicators
- **Data & Privacy**: Export account data, download trade history as CSV, and account deletion option
- **Appearance**: Theme selection (light/dark/system), dashboard layout preferences, and chart default settings

**Value**: Gives users full ownership of their account experience, improves trust through transparency and security controls, and reduces support requests for basic account management tasks.

---

## Google Account Login (OAuth)

**Problem**: Users must create and remember a separate username/password for the platform, adding friction to sign-up and increasing the risk of abandoned registrations.

**Feature**: "Sign in with Google" OAuth integration:
- One-click sign-up and login via Google accounts
- Automatic profile population (name, email, avatar) from Google profile data
- Link/unlink Google account from existing accounts
- Maintain traditional email/password login as a fallback option
- Support for multiple OAuth providers in the future (GitHub, Apple, etc.)

**Implementation Considerations**:
- Use OAuth 2.0 / OpenID Connect flow
- Store only the Google `sub` (subject identifier) — never store Google passwords or tokens long-term
- Handle edge cases: Google account already linked to another user, email conflicts with existing accounts
- Add a provider field to the user model to track authentication method

**Value**: Reduces sign-up friction, improves conversion rates, and leverages Google's security infrastructure for authentication.

---
