# 🎾 Tennis Drive Web Admin: Testing Guide

This guide ensures 100% functional parity with the Mobile Admin suite. Follow these steps to verify the implementation.

## 1. Global Oversight Tools

### 📊 Dashboard & Inbox
- **In-App Navigation**: Start at `/admin`.
- **Verify**: 
  - Recent activity feed shows live Firestore updates (joins, payments).
  - "Pending Registrations" section allows one-click approval/rejection.
  - Approve a player and verify they move to the "Approved Roster" in the tournament detail.

### 👥 Club Player Directory
- **Path**: `/admin/players`
- **Verify**: 
  - Search for players by name or email.
  - Open a player profile and adjust points (positive or negative).
  - Verify "Recalculate Rankings" updates player XP globally across the club.

### 💳 Financial Console
- **Path**: `/admin/payments`
- **Verify**: 
  - Lifetime revenue calculates only `completed` transactions.
  - Revert a transaction and verify the player's status returns to `unpaid`.

### 📢 Notification Center
- **Path**: `/admin/notifications`
- **Verify**: 
  - **Broadcast**: Send a global message. (Simulated in web, would trigger Expo Push).
  - **Direct**: Search for a specific user and send a targeted message.
  - **Preview**: Check the iPhone mockup for correct content rendering.

---

## 2. Tournament Lifecycle Management

### 🏗️ Setup & Configuration
- **Edit Suite**: Navigate to a tournament, click the **Edit** (pencil) icon. Update dates or entry fees and save.
- **Scoring Overrides**: Click **Scoring Configuration**. Change "Points for Win" for this specific event and verify it doesn't affect other tournaments.

### 🎾 Participant Management
- **Manual Entry**: Add a "Guest" player without an account.
- **Payment Desk**: Record a cash payment for a player. Verify they appear as "Paid" in the roster.
- **Wildcard**: Toggle "WC" status and verify the badge appears.

### ⚔️ Match Center (Parity Highlight)
- **Group Stage**: 
  - Generate groups and matches.
  - Enter scores and verify standings update in the **Standings** tab.
  - Finalize a group and verify qualified players are calculated.
- **Draw Generation**: 
  - Generate the Main Draw (Knockout).
  - Verify the bracket builds correctly from group qualifiers.
- **PDF Export**: Click **Export PDF**. Verify the layout is cleaned up (no sidebars) and fits 1 page.

---

## 3. Developer & Debug Tools
- **Roster Generator**: In the tournament players page, use the **Test Suite** icon (Users) to generate 10+ random players for a category.
- **Cleanup**: Use the **Trash** icon in the tournament header to delete all test data and reset the bracket for a clean slate.

---

## 🛠️ Verification Build
To ensure no regressions, run:
```bash
cd web_app
npm run build
```
The build should complete with `✓ built in X.Xs` and no TypeScript errors.
