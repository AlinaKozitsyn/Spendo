# Technical Architecture

> The CTO fills this in during the planning phase.
> Update it whenever the system structure changes.

---

## 1. Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| **Frontend** | | |
| **Backend** | | |
| **Database** | | |
| **AI/LLM** | Claude API (Anthropic) | Course requirement |
| **Hosting** | | |

---

## 2. System Architecture

```
[Describe your system here — use a simple diagram]

Example:

  Browser (React)
      │
      ▼
  API Server (Node/Python)
      │
      ├── Claude API (AI features)
      │
      └── Database (data storage)
```

---

## 3. Key Components

### Component 1: {{Name}}
- **Purpose:** _what it does_
- **Location:** `src/...`
- **Depends on:** _other components_

### Component 2: {{Name}}
- **Purpose:** _what it does_
- **Location:** `src/...`
- **Depends on:** _other components_

---

## 4. Data Model

```
[Describe your data structures]

Example:

User
  - id: string
  - name: string
  - email: string

Project
  - id: string
  - title: string
  - owner: User.id
  - created_at: datetime
```

---

## 5. API Endpoints (if applicable)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/...` | |
| POST | `/api/...` | |

---

## 6. Folder Structure

```
src/
├── ...
```

---

## 7. Key Decisions

See `docs/DECISIONS.md` for the full decision log.
