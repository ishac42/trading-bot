# Architecture Documentation Maintenance Guide

## ⚠️ Important: Keep Documentation in Sync

This guide ensures that `ARCHITECTURE.md` and the visual diagrams (`ARCHITECTURE_DIAGRAMS.html` and `SYSTEM_ARCHITECTURE_DIAGRAMS.md`) remain synchronized.

---

## 📋 Sync Requirements

### When Making Changes

**ALWAYS update BOTH**:
1. `Plans/ARCHITECTURE.md` - The master architecture document (source of truth)
2. `Plans/ARCHITECTURE_DIAGRAMS.html` - Visual HTML diagrams
3. `Plans/SYSTEM_ARCHITECTURE_DIAGRAMS.md` - Mermaid markdown diagrams

### Update Checklist

When adding/modifying architecture components, ensure:

- [ ] **Database Schema Changes**
  - Update `ARCHITECTURE.md` → Database Schema section
  - Update `ARCHITECTURE_DIAGRAMS.html` → Diagram #5 (Database Schema Relationships)
  - Update `SYSTEM_ARCHITECTURE_DIAGRAMS.md` → Diagram #5

- [ ] **API Endpoint Changes**
  - Update `ARCHITECTURE.md` → Bot Management API / Trade Management API / etc.
  - Update `ARCHITECTURE_DIAGRAMS.html` → Diagram #2 (Component Interaction Flow)
  - Update `SYSTEM_ARCHITECTURE_DIAGRAMS.md` → Diagram #2

- [ ] **Frontend Component Changes**
  - Update `ARCHITECTURE.md` → Frontend Components section
  - Update `ARCHITECTURE_DIAGRAMS.html` → Diagram #1 (High-Level System Architecture)
  - Update `SYSTEM_ARCHITECTURE_DIAGRAMS.md` → Diagram #1

- [ ] **Technology Stack Changes**
  - Update `ARCHITECTURE.md` → Technology Stack section
  - Update `ARCHITECTURE_DIAGRAMS.html` → Diagram #6 (Technology Stack Layers)
  - Update `SYSTEM_ARCHITECTURE_DIAGRAMS.md` → Diagram #6

- [ ] **Component Communication Changes**
  - Update `ARCHITECTURE.md` → Component Communication section
  - Update `ARCHITECTURE_DIAGRAMS.html` → Diagram #10 (Component Communication Matrix)
  - Update `SYSTEM_ARCHITECTURE_DIAGRAMS.md` → Diagram #10

- [ ] **Data Flow Changes**
  - Update `ARCHITECTURE.md` → Key Data Flows section
  - Update `ARCHITECTURE_DIAGRAMS.html` → Diagram #4 (Data Flow Diagram) and #11 (Key Data Flows)
  - Update `SYSTEM_ARCHITECTURE_DIAGRAMS.md` → Diagrams #4 and #11

- [ ] **Trading Engine Changes**
  - Update `ARCHITECTURE.md` → Trading Engine section
  - Update `ARCHITECTURE_DIAGRAMS.html` → Diagram #3 (Trading Engine Internal Architecture)
  - Update `SYSTEM_ARCHITECTURE_DIAGRAMS.md` → Diagram #3

- [ ] **Deployment Changes**
  - Update `ARCHITECTURE.md` → Infrastructure & Deployment section
  - Update `ARCHITECTURE_DIAGRAMS.html` → Diagram #8 (Deployment Architecture)
  - Update `SYSTEM_ARCHITECTURE_DIAGRAMS.md` → Diagram #8

---

## 🔄 Sync Process

### Step 1: Update ARCHITECTURE.md First
`ARCHITECTURE.md` is the **source of truth**. Always update it first with complete details.

### Step 2: Update Visual Diagrams
After updating `ARCHITECTURE.md`, update the corresponding diagrams:

1. **For HTML diagrams** (`ARCHITECTURE_DIAGRAMS.html`):
   - Find the relevant Mermaid diagram section
   - Update the Mermaid code to match `ARCHITECTURE.md`
   - Test by opening the HTML file in a browser

2. **For Markdown diagrams** (`SYSTEM_ARCHITECTURE_DIAGRAMS.md`):
   - Find the corresponding diagram section
   - Update the Mermaid code to match `ARCHITECTURE.md`
   - Ensure it matches the HTML version

### Step 3: Verify Consistency
Check that:
- [ ] All components mentioned in diagrams exist in `ARCHITECTURE.md`
- [ ] All components in `ARCHITECTURE.md` are represented in diagrams
- [ ] Database schemas match between all three files
- [ ] API endpoints match between all three files
- [ ] Technology stack matches between all three files

---

## 📊 Diagram Mapping Reference

| Diagram # | Title | ARCHITECTURE.md Section |
|-----------|-------|-------------------------|
| 1 | High-Level System Architecture | System Architecture, Core Components |
| 2 | Component Interaction Flow | Bot Management API, Trading Flow |
| 3 | Trading Engine Internal Architecture | Trading Engine |
| 4 | Data Flow Diagram | Component Communication → Key Data Flows |
| 5 | Database Schema Relationships | Database Schema |
| 6 | Technology Stack Layers | Technology Stack |
| 7 | Real-time Data Flow | Component Communication, WebSocket Endpoints |
| 8 | Deployment Architecture | Infrastructure & Deployment |
| 9 | Trading Logic Flow | Trading Logic Flow |
| 10 | Component Communication Matrix | Component Communication → Communication Matrix |
| 11 | Key Data Flows | Component Communication → Key Data Flows |

---

## 🎯 Key Principles

1. **ARCHITECTURE.md is the source of truth** - All details should be there first
2. **Diagrams are visual representations** - They should reflect what's in ARCHITECTURE.md
3. **No contradictions** - If diagrams show something, ARCHITECTURE.md must document it
4. **Complete coverage** - Everything in ARCHITECTURE.md should be represented in diagrams where applicable

---

## 🚨 Common Sync Issues to Watch For

### Issue 1: Missing Database Tables
- **Symptom**: Diagram shows a table that's not in ARCHITECTURE.md
- **Fix**: Add table definition to Database Schema section

### Issue 2: Missing API Endpoints
- **Symptom**: Diagram shows an endpoint that's not documented
- **Fix**: Add endpoint to appropriate API section

### Issue 3: Missing Frontend Pages
- **Symptom**: Diagram shows a page that's not in Frontend Components
- **Fix**: Add page specification to Frontend Components section

### Issue 4: Technology Mismatch
- **Symptom**: Diagram shows different tech than ARCHITECTURE.md
- **Fix**: Update both to match (ARCHITECTURE.md takes precedence)

### Issue 5: Missing Component Relationships
- **Symptom**: Diagram shows communication that's not documented
- **Fix**: Add to Component Communication section

---

## 📝 Instructions for AI Assistants

When updating architecture documentation:

1. **Always check all three files** before making changes
2. **Update ARCHITECTURE.md first** with complete details
3. **Then update both diagram files** to match
4. **Verify consistency** across all three files
5. **Reference this guide** if unsure about what needs updating

**Key Rule**: If a diagram shows something, ARCHITECTURE.md must document it. If ARCHITECTURE.md documents something, relevant diagrams should represent it.

---

## 🔍 Quick Verification Commands

To verify sync, check:

```bash
# Check for database tables mentioned in diagrams
grep -r "POSITIONS\|TRADES\|BOTS" Plans/ARCHITECTURE*.md Plans/ARCHITECTURE*.html

# Check for API endpoints
grep -r "/api/" Plans/ARCHITECTURE*.md Plans/ARCHITECTURE*.html

# Check technology stack
grep -r "FastAPI\|React\|PostgreSQL\|Redis" Plans/ARCHITECTURE*.md Plans/ARCHITECTURE*.html
```

---

## 📅 Last Sync Check

**Date**: 2026-02-15  
**Status**: ✅ All files synchronized  
**Verified By**: Architecture documentation update

---

## 💡 Tips

- **Use the HTML file** (`ARCHITECTURE_DIAGRAMS.html`) to visually verify diagrams render correctly
- **Keep Mermaid syntax consistent** between HTML and Markdown versions
- **Test diagrams** after updates by opening HTML in browser or viewing Markdown in GitHub
- **Document changes** in commit messages when updating architecture

---

**Remember**: `ARCHITECTURE.md` is the master document. Diagrams are visual aids that must reflect its contents accurately.
