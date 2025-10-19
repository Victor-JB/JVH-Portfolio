# Security & Redaction Policy

This repository is a **sanitized portfolio** derived from my engineering work completed during my internship at Joulin Vacuum Handling.  
It demonstrates my architectural, backend, and automation contributions, while ensuring that no proprietary or confidential data is exposed.

---

## 🔒 What Has Been Redacted or Replaced
| Category | Example | Sanitization Method |
|-----------|----------|--------------------|
| Company / Customer Names | Real partner or site identifiers | Replaced with X's |
| Microsoft Entra / Graph IDs | `ENTRA_CLIENT_ID`, `GRAPH_DRIVE_ID`, etc. | Replaced with dummy placeholders in `.env.example` |
| File Paths & URLs | SharePoint and Genius ERP endpoints | Replaced with mock URLs or path templates |
| Credentials / Secrets | Tokens, passwords, webhook secrets | Fully removed and ignored via `.gitignore` |
| Logs & Order Numbers | Real orders or timestamps | Replaced with synthetic examples under `logs-example/` |
| Notes & Comments | Mentions of private infrastructure | Redacted or rewritten generically |

---

## 🧪 What Remains Intact
- Full **architecture**, including FastAPI backend, SharePoint Graph integration, logging, and deployment scripts.  
- Original **code structure and comments**, demonstrating real engineering patterns.  
- **Infrastructure tooling**: `Caddyfile`, PowerShell/NSSM automation, and GitHub workflow examples.  
- Example `.env` and `logs/` formats for safe demonstration.

---

## ⚙️ Security Practices
- **TruffleHog** and **pre-commit** scanning are enforced to prevent accidental leaks.  
- `.env` and secret-related files are excluded via `.gitignore`.  
- Sanitization confirmed with manual search for patterns like `TENANT|CLIENT|SECRET|TOKEN|CUSTOMER`.

---

## 🧭 Contact
If you believe something sensitive was unintentionally exposed, please contact **Victor Joulin-Batejat** at `victorjb2015@gmail.com` and I will remove it immediately.
