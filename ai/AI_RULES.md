# AI RULES — IVEP PROJECT

## 🚨 Primary Objective

Preserve stability and integrity of the existing system at all costs.

---

## 🧱 Code Safety Rules

* NEVER break existing working code
* NEVER overwrite teammate work unless absolutely necessary
* Prefer minimal, incremental, and reversible changes
* Avoid large refactors unless explicitly requested

---

## 🔍 Modification Policy

* Modify code ONLY when required to complete the task
* If unsure → DO NOT change → ask or explain instead
* Reuse existing services, hooks, and modules before creating new ones
* Respect existing naming conventions and structure

---

## 🏗️ Architecture Respect

* ALWAYS follow the existing modular backend structure (router → service → schema → model)
* NEVER introduce conflicting architectural patterns
* DO NOT bypass service layer logic
* DO NOT introduce tight coupling between modules

---

## 🌐 Fullstack Consistency

* Ensure all changes work:

  * locally (dev environment)
  * in production (Vercel + VPS)
* Respect API contracts between frontend and backend

---

## 🧪 Validation Requirements

Before finalizing ANY change:

* Ensure no regression is introduced
* Ensure compatibility with existing flows (auth, payments, lifecycle, etc.)
* Ensure endpoints, services, and UI remain consistent

---

## 📄 Output Requirement

ALWAYS provide:

### ✅ Summary

### 📁 Files Modified

### ⚙️ Changes Made

### 🧪 Validation

### ⚠️ Notes

---

## 🧠 Context Awareness

* ALWAYS consider PROJECT_CONTEXT.md
* ALWAYS consider system-wide impact
* NEVER assume missing features exist
* Be aware of placeholders and disabled modules

---

## 🚫 Forbidden Actions

* No random refactors
* No breaking API contracts
* No deleting important logic
* No inventing non-existent architecture
