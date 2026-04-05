## Verification Protocol — Mandatory Before Saying "Done"

> This section is not optional. Every fix must pass ALL checks before reporting completion.
> If any check fails or cannot be verified, say so explicitly — never assume it works.

---

### Step 1 — Before writing any code: read first

Before touching a single file, you MUST:
1. Read the file(s) that contain the bug
2. Read every file that IMPORTS or USES the affected function/component
3. Read the relevant route handler (backend) OR page component (frontend) end-to-end
4. Check if there is an existing test for this behavior

Only after reading all of the above, describe the root cause in one sentence.
If you cannot state the root cause clearly, STOP and ask me.

---

### Step 2 — After writing code: self-review checklist

Run through this list mentally on every change. Answer each one out loud before saying "done":

#### Python / FastAPI backend
- [ ] Does the changed function still use `async/await` correctly?
- [ ] Are all Motor DB calls awaited?
- [ ] Does the Pydantic model match what the frontend expects (field names, types)?
- [ ] Are MongoDB `_id` fields converted to `str`?
- [ ] Does the fix work if the request comes from the Vercel production domain (not localhost)?
- [ ] If a file upload: does it go to R2, not local disk?
- [ ] If a new env variable is needed: did I list it for the user to add to `.env`?
- [ ] Would `uvicorn main:app` start without import errors after this change?

#### TypeScript / Next.js frontend
- [ ] Would `npm run build` pass with no TypeScript errors?
- [ ] Is the component a Server Component or Client Component? Does it match what's needed?
- [ ] Are API calls using the centralized service layer (not raw fetch in components)?
- [ ] Are environment variables using `NEXT_PUBLIC_` prefix correctly?
- [ ] Does the fix work when `NEXT_PUBLIC_API_URL` points to the Hetzner production URL?
- [ ] Are there any `any` types introduced that weren't already there?

#### Both
- [ ] Did this change affect any shared utility, hook, or base class? If yes, list all callers.
- [ ] Is the fix backward compatible? Would existing API consumers still work?
- [ ] Does the fix handle the error case, not just the happy path?
- [ ] Would this break if the user has an expired JWT token?

---

### Step 3 — Tell me exactly what to test

After every fix, you must give me a concrete testing checklist:

```
To verify this fix works:
1. Run: [exact command]
2. Go to: [exact URL or UI path]
3. Do: [exact action]
4. Expect: [exact result]
5. Also check: [related thing that could have broken]
```

Never say "it should work now." Always give me the steps to confirm it myself.

---

### Step 4 — Flag production vs local differences

If the fix behaves differently between local and production, say so explicitly:

```
⚠️ Local vs Production difference:
- Local: [behavior]
- Production (Vercel/Hetzner): [behavior]
- Reason: [why they differ — e.g. env var, CORS, nginx config]
- What you need to do on the server: [exact steps]
```

Common differences to always check:
- CORS origins (localhost vs Vercel URL)
- File size limits (nginx has a default 1MB limit — PDF uploads need `client_max_body_size`)
- WebSocket paths (nginx must proxy_pass WSS correctly)
- Environment variables (a missing NEXT_PUBLIC_ var = silent undefined in production)
- MongoDB connection pooling (behaves differently under concurrent production traffic)

---

### Step 5 — If the build would fail, say so

If you are not certain the build passes, say:

> "I cannot verify this compiles without running it. Here is what you should check:
> - Run `npm run build` and look for [specific error]
> - Run `python -m py_compile [file]` to check for syntax errors"

Never say a fix is complete if you have not verified the syntax is valid.

---

## How to give me a good task description (saves both our time)

The quality of your fix depends on the quality of my task description.
When you give me a task, include:

1. **Where exactly**: file path + function name or component name
2. **What you see**: the exact error message (copy-paste it)
3. **When it happens**: what action triggers it (e.g. "when visitor clicks send meeting request")
4. **What you expect**: what should happen instead
5. **Environment**: does it fail locally, in production, or both?

Bad task: "fix the meeting button"
Good task: "In frontend/components/meetings/MeetingCard.tsx, the approve/reject buttons
appear for visitors. They should only appear for the enterprise role. The visitor should
only see a status badge and a 'Join' button when status === 'accepted' and time has come."

The more specific you are, the less I have to guess, and the fewer iterations we need.

---

## Errors I have made before — do not repeat

<!-- Update this list after every session where a fix was wrong -->

- Assumed `client_max_body_size` was set in nginx — it was not, causing 413 on PDF upload
- Fixed WebSocket on frontend but forgot nginx needs `proxy_set_header Upgrade $http_upgrade`
- Used synchronous PyMongo method instead of Motor async in a route handler
- Returned MongoDB ObjectId directly in response instead of converting to string
- Added a frontend env variable without `NEXT_PUBLIC_` prefix — was undefined in browser
- Fixed meeting status logic for sender instead of receiver (roles were swapped)
