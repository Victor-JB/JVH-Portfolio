# QC Photos App — Session & Storage Flow

## Purpose
This document explains how a capture session moves through the app, how/where data is stored, and the standard “happy-path” operator workflow. It’s intended for onboarding and day-to-day reference.

---

# Session Flow (End-to-End)

## 1) App boot & setup
- App initializes the finite-state machine (FSM) and enters `INIT`.
- Camera starts, global listeners are wired, HUD and Debug HUD mount.
- App advances to the resume prompt.

## 2) Resume prompt (draft handling)
- App checks local storage for a previous draft.
- If one exists, the operator can:
  - **Resume**: Load draft and continue.
  - **Skip**: Remove the draft and start fresh.
- The app enforces **one draft at a time** (new session purges others).

## 3) Waiting for barcode
- App listens for a barcode scan.
- Valid order number → fetch Sales Order (SO) details from the ERP (items, customer, etc.).
- Invalid scan → brief error; stays ready for another scan.

## 4) SharePoint preflight (read-only)
- Before creating a local session, the app **peeks** at SharePoint:
  - Checks if the order folder exists.
  - If it does, checks whether it already has photos.
- Outcomes:
  - **No photos**: Proceed normally.
  - **Photos found**: Operator is shown a short summary (count, timestamps) and chooses:
    - **Append**: Continue (eventual upload will add to that folder).
    - **Cancel**: Abort this start and return to scanning.

## 5) Session initialization (in-memory + local)
- App builds a new session object containing:
  - `orderNo`, full SO, normalized `items[]` (each with `photos: []`, `checks: {}`).
  - `logs[]`, timestamps (`createdAt`, `updatedAt`).
- Emits `session:init` and **persists immediately** to local storage; subsequent writes are **debounced**.
- HUD renders order header/items and transitions to `READY`.

## 6) Operator interaction (photos & checklist)
- **Photos**: Shutter capture → blob frame is added to the current item’s `photos[]` in IndexedDB; session persists via localstorage; thumbnails/counts update.
- **Checklist**: Checking a QC box merges into the item’s `checks{}`; session persists; HUD updates.
- **Logs**: Structured entries are appended and persisted; later sent to the server as formatted text lines.

## 7) Uploading (operator taps “Done”)
- FSM enters `UPLOADING`; modal shows progress.
- Steps:
  1) **Logs**: Formatted and POSTed; if offline/failing, queued for retry.
  2) **Ensure folders**: Backend ensures/creates customer + order folders on SharePoint.
  3) **Photos**: Backend uploads each photo (small files via simple PUT; large via Graph upload session). Safe parallelism is used.
- On success:
  - Local draft is removed; in-memory session cleared.
  - HUD resets; FSM reports `UPLOAD_OK`.
- On failure:
  - Error is shown; FSM reports `UPLOAD_FAIL`; the local draft remains for retry.

---

# Storage Model (What Lives Where)

## In memory (live session)
- `orderNo`, SO, `items[]` with `photos[]` (blob) and `checks{}`, `logs[]`, timestamps.

## Local storage (resume & single-draft control)
- `qc:session:<orderNo>` → serialized session snapshot.
- `qc:session:index` → small map `{ [orderNo]: updatedAt }` used to:
  - Offer resume,
  - Enforce one-draft-only,
  - Sort drafts by last update time.

## Backend
- **Logs**: Text lines received by the logging endpoint (includes device/app version/time).
- **Photos**: Stored in SharePoint under `…/<Customer>/<OrderNo>/…` (backend ensures/creates folders; uploads in parallel when safe).

---

# Operator “Happy Path” (Quick Steps)

1) **Scan** a Sales Order barcode.  
2) App fetches SO and **peeks** at SharePoint (read-only).  
3) If existing photos are found, choose **Append** or **Cancel**.  
4) App **initializes** the session and persists it locally.  
5) **Capture photos** and **check QC items** — everything saves continuously.  
6) Tap **Done** to **upload**: logs → ensure folders → photos.  
7) On success, the draft is **cleared** and the app returns to scan-ready.
