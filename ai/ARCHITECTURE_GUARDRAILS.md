# ARCHITECTURE GUARDRAILS — IVEP

## Backend Rules

* Use module structure:
  router → service → schema → model
* Business logic MUST stay in service layer
* Routers must remain thin (only request/response handling)
* Do NOT mix concerns across modules

---

## Frontend Rules

* Use existing App Router structure
* Respect route groups: (admin), (enterprise), (organizer)
* Use existing services in `/services/`
* Use hooks when available instead of direct logic duplication

---

## API Rules

* Do NOT break existing endpoints
* Maintain response formats
* Ensure backward compatibility

---

## Data & State

* Respect MongoDB flexible schema design
* Do NOT introduce rigid relational assumptions
* Maintain consistency with existing collections

---

## External Services

* Stripe flows must remain intact
* Daily.co integration must not be broken
* R2 storage must remain primary for production

---

## AI Modules Awareness

* ai_rag, translation, transcripts may be optional
* Handle missing dependencies gracefully

---

## Known Weak Areas (CRITICAL)

* Some frontend services/hooks are placeholders
* Marketplace landing page incomplete
* Subscriptions module disabled

👉 NEVER assume these are fully implemented
