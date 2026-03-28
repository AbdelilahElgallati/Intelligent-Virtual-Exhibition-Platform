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

```

---

# Task 1 — Cross-Day Time Slot Logic
```

## TASK: Fix Cross-Day Time Slot Overlap

### Rules

- Read CLAUDE.md before starting
- Do NOT touch any logic outside the scheduler
- List files you will modify before writing any code

### Context

In the organizer schedule system, a session can span midnight
(e.g., 22:00 → 01:30). The next day currently allows selecting
the already-occupied time (00:00 → 01:30), causing conflicts.

### Root Problem

Cross-day slots are not being detected or blocked on the following day.

### What To Fix

1. Detect cross-day slots: when end time < start time
2. When detected, compute the overflow:
   - Day 1 range: start → 23:59 (already occupied)
   - Day 2 range: 00:00 → end (must be blocked)
3. Persist the Day 2 block in the database
4. Backend: reject any new slot that overlaps with a blocked range
5. Frontend: mark blocked ranges as unselectable in the UI

### Constraints

- Do NOT modify any other scheduling logic
- Maintain timezone consistency (use UTC internally)
- Existing cross-day slots in the database must still work

### Deliverables

- Backend: cross-day detection + block persistence + validation
- Frontend: UI enforcement of blocked ranges
- 3 unit tests: normal slot / cross-day slot / overlap rejection
- Brief report: files modified + logic explained

```

---

# Task 2 — Invalid Time Slot Creation
```

## TASK: Restrict Time Slots to Their Correct Day

### Rules

- Read CLAUDE.md before starting
- List files you will modify before writing any code

### Context

When editing Day 1's schedule, organizers can accidentally
add a slot like 02:00 → 04:00 which logically belongs to Day 2.

### Root Problem

No validation checks whether the start time belongs to the day being edited.

### What To Fix

1. Frontend: before submitting, validate that start time
   belongs to the selected day — show a clear error if not
2. Backend: same validation on the API side — reject with
   a descriptive error message
3. Apply to: organizer UI, event request creation flow

### Important — Do NOT Break This

- Valid cross-day slots (e.g., 22:00 → 01:30) must still work
- A slot is valid if it STARTS on the current day, even if it ends the next day
- Only reject slots that START on a different day than selected

### Deliverables

- Frontend validation + error message
- Backend validation + error response
- 3 test cases: valid slot / invalid start day / valid cross-day slot
- Brief report: files modified + validation logic

```

---

# Task 3 — UI/UX Improvements (Event Schedule)
```

## TASK: Improve Event Schedule UI/UX (Organizer Panel)

### Rules

- Read CLAUDE.md before starting
- Do NOT change any data logic or API calls
- Only touch styling and UI rendering — no business logic
- Follow the existing design system (reuse existing colors and components)
- List components you will modify before starting

### What To Improve

1. Time slot cards:

   - Better spacing and padding
   - Visual distinction between:
     * Normal slot (default style)
     * Cross-day slot (subtle accent color or badge)
     * Blocked/unavailable slot (muted/disabled style)
2. Interactions:

   - Add hover states on slots
   - Add tooltip on cross-day slots explaining the overlap
   - Add tooltip on blocked slots explaining why they are unavailable
3. Conflict indicators:

   - Highlight conflicting slots in red or with a warning icon
   - Show a clear visual separator at midnight for cross-day transitions
4. Responsiveness:

   - Verify layout works on mobile, tablet, and desktop

### Constraints

- Keep all existing functionality working
- No new dependencies unless absolutely necessary

### Deliverables

- Refactored UI components (list which ones)
- Before/after summary of visual changes

```

---

# Task 4 — Analytics Export Fix
```

## TASK: Fix Analytics Data Export

### Rules

- Read CLAUDE.md before starting
- Do NOT touch any analytics display logic
- Only fix the export feature
- List files you will investigate before changing anything

### Context

The export button on the analytics page does nothing or fails silently.

### Investigation Steps (do these first, report findings before fixing)

1. Frontend:

   - Is the button wired to a handler?
   - Is the API call being made? (check network tab behavior)
   - Is the response being processed into a file download?
2. Backend:

   - Does the export endpoint exist?
   - Does it return the correct headers?
     (Content-Disposition: attachment; filename=...)
   - Does it return valid CSV or Excel data?

### What To Fix

- Wire frontend button → API call → file download correctly
- Ensure backend returns proper file with correct headers
- Add error handling: show a user-facing error if export fails

### Constraints

- Do NOT modify any other analytics logic
- Support CSV format minimum (Excel is a bonus)

### Deliverables

- Working export that downloads a real file
- Error state handling in UI
- Brief report: root cause + files modified

```

---

# Task 5 — Slug-Based URLs
```

## TASK: Implement SEO-Friendly Slug URLs

### Rules

- Read CLAUDE.md before starting
- This touches routing globally — be EXTRA careful
- List every file you plan to modify before writing any code
- Do NOT remove _id from any internal logic, API payloads, or state

### Architecture (follow exactly)

- _id → used internally for all DB queries and API logic
- slug → used only in browser URLs and navigation links
- Never expose _id in the browser URL

### What To Implement

#### 1. Database

- Add slug field to: Event, Organization (and any other routed entities)
- Generate slug from title: lowercase, kebab-case, no special characters
- Ensure uniqueness: append -1, -2 if duplicate exists
- Add index: { slug: { type: String, unique: true, index: true } }

#### 2. Backend

- Accept slug in route: GET /events/:slug
- Internal logic:
  1. findOne({ slug })
  2. Extract _id
  3. Use _id for all further operations
- NEVER replace _id logic inside the system

#### 3. Hybrid Safety (important)

Support both slug and _id in the same route:
  if (isValidObjectId(param)) → findById(param)
  else → findBySlug(param)
This ensures legacy URLs keep working.

#### 4. Frontend

- Use slug in all navigation: router.push(`/events/${event.slug}`)
- Store _id in state when needed (from API response)
- Never show _id in the UI

#### 5. Apply to

- Organizer interface
- Admin interface
- Enterprise interface
- Visitor interface

### Constraints

- Do NOT break any existing routes
- Full backward compatibility required

### Deliverables

- Slug field + generation utility
- Backend route handler with slug→_id mapping
- Hybrid support (slug + _id)
- Updated frontend navigation
- Brief report: files modified + mapping flow

```

---

# Task 6 — Revenue & Currency Fix
```

## TASK: Fix Revenue Calculation and Currency Display

### Rules

- Read CLAUDE.md before starting
- Do NOT touch the payment system
- Do NOT modify transaction creation logic
- List files you will investigate before making changes

### Problems

1. Revenue displays as 0
2. Currency shown is incorrect

### Investigation Steps (report findings before fixing)

1. Trace the data source:

   - Which collection holds revenue data? (transactions / payments / orders?)
   - Is the aggregation query returning data at all?
   - Is the query filtering by wrong field or wrong date range?
2. Check currency:

   - Where is currency stored in the document?
   - Is it being read from the correct field?
   - Is there currency conversion logic? Is it broken?

### What To Fix

- Fix the aggregation query to return correct totals
- Fix currency field mapping to display the right currency
- Handle edge case: no transactions → show 0 correctly (not null/undefined)

### Constraints

- Do NOT affect the payment system in any way
- Do NOT modify transaction creation or processing

### Deliverables

- Correct revenue display
- Correct currency per organization
- Brief report: root cause + query fix explained

```

---

# Task 7 — Partner Tab Fix
```

## TASK: Fix Partner Tab (Enterprise Panel)

### Rules

- Read CLAUDE.md before starting
- Do NOT rewrite the component from scratch
- List files you will investigate before making changes

### Problem

Partner tab is empty even though partner data exists in the database.

### Investigation Steps (report findings before fixing)

1. Backend:

   - Does the partners endpoint return data?
   - Is the relationship between enterprise and partners
     correctly populated? (check .populate() or equivalent)
2. Frontend:

   - Is the API call being made when the tab is opened?
   - Is the response being stored in state correctly?
   - Is the component reading from the right state key?
   - Any console errors?

### What To Fix

- Fix the broken link between backend response and frontend display
- Ensure data loads when tab is first opened (not just on refresh)

### Constraints

- Minimal changes only
- Do not rewrite existing logic unless it is completely broken

### Deliverables

- Working partner tab with data displayed
- Brief report: root cause + files modified

```

---

# Task 8 — Video/Meeting Fix (Daily.co)
```

## TASK: Fix Real-Time Meeting System (Daily.co)

### Rules

- Read CLAUDE.md before starting
- We use Daily.co — do NOT reference LiveKit anywhere
- This is critical infrastructure — be especially careful
- List every file you plan to modify before writing any code
- Fix one sub-problem at a time, confirm before moving to next

### Problems To Fix (in this order)

#### Problem 1 — Time Access Control

Meetings are accessible outside their scheduled time window.

Fix:

- Frontend: check current time against scheduled start/end
  before allowing room entry — show clear message if too early/late
- Backend: validate time window server-side before
  generating Daily.co room token
- Do NOT modify Daily.co room creation logic

#### Problem 2 — Participants Cannot See Each Other (only self-view)

Fix:

- Verify Daily.co participant tracks are being subscribed to correctly
- Ensure remote participant video tracks are attached to video elements
- Check that the call object is subscribing to all participants
  (not just local)
- Reference Daily.co docs pattern for multi-participant rendering

#### Problem 3 — Screen Sharing Not Working

Fix:

- Verify startScreenShare() is being called correctly
- Ensure the screen track is being published and received by other participants
- Handle browser permission errors gracefully with user-facing message

#### Problem 4 — Audio/Video Sync Issues

Fix:

- Check that audio and video tracks are both being published on join
- Verify track subscription for remote participants includes both audio and video
- Add basic logging: log when tracks are published/received

### Constraints

- Do NOT break the existing Daily.co room setup
- Do NOT change room creation or API key configuration
- Keep all fixes compatible with Daily.co current integration

### Deliverables

- All 4 problems fixed
- Console logs added for track events (publish/subscribe/error)
- Brief report per problem: root cause + fix applied + files modified
- Test scenario for each fix
