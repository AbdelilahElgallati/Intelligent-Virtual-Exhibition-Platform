# Claude Code Rules — Intelligent Virtual Exhibition Platform

## Stack

- Frontend: Next.js (TypeScript)
- Backend: FastAPI (Python)
- Database: MongoDB
- Real-time Video: Daily.co (WebRTC)

## CRITICAL Rules

- Fix ONLY what is explicitly asked
- Do NOT refactor working code
- Do NOT rename existing variables, functions, or endpoints
- Do NOT change API response structure unless required by the task
- Do NOT modify authentication or payment logic
- Make the MINIMAL change that solves the problem
- If a fix requires touching more than 3 files, STOP and ask first

## Before Every Change

- List files you plan to modify
- Explain what you will change and why
- Wait for confirmation before proceeding

## Code Quality

- Production-grade code only
- No temporary fixes or hacks
- Maintain backward compatibility at all times
- Every fix must work in both local and production environments

