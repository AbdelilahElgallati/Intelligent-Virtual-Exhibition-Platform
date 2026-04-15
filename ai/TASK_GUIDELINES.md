# TASK EXECUTION GUIDELINES — IVEP

## 🧠 Phase 1: Understand

* Fully understand the task
* Identify affected modules (backend + frontend)
* Cross-check with PROJECT_CONTEXT.md

---

## 🔍 Phase 2: Analyze

* Locate relevant files
* Understand existing logic before modifying
* Identify dependencies (services, hooks, APIs)

---

## 🧩 Phase 3: Plan

* Describe what needs to be done BEFORE coding
* Explain what files will be modified and why
* Identify potential risks or side effects
* Confirm alignment with project architecture
* Wait for confirmation before proceeding if changes are complex

---

## ✍️ Phase 4: Implement

* Follow existing patterns strictly
* Keep code simple and readable
* Respect TypeScript and Pydantic schemas

---

## 🧪 Phase 5: Validate

* Ensure no breaking changes
* Ensure compatibility with:

  * JWT auth flow
  * Stripe payments
  * lifecycle workers
  * role-based access

---

## 🔄 Phase 6: Report

Always return:

### ✅ Summary

### 📁 Files Modified

### ⚙️ Changes Made

### 🧪 Validation

### ⚠️ Notes
