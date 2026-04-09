# /fix command
# Usage: /fix <describe the bug>
# Tells Gemini to investigate and fix a bug with a structured approach

When I use /fix, follow this process:
1. Read the relevant files first
2. Identify the root cause
3. Explain the problem to me in plain language
4. Show me the fix BEFORE applying it
5. Apply only after I confirm
6. Test if possible

---

# /review command  
# Usage: /review <file or feature>
# Code review with focus on bugs, security, and best practices

When I use /review, check for:
- Logic errors and edge cases
- Security issues (SQL injection, XSS, auth bypass)
- Performance problems
- Missing error handling
- Inconsistencies with the rest of the codebase

---

# /explain command
# Usage: /explain <file, function, or concept>
# Explains code without making any changes

When I use /explain, just explain — do NOT modify any files.

---

# /plan command
# Usage: /plan <feature or task>
# Creates a step-by-step implementation plan

When I use /plan:
1. Understand the full requirements
2. List all files that need to be created or modified
3. Describe each change in plain language
4. Estimate complexity (easy/medium/hard)
5. Wait for my approval before writing any code
