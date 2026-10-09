# Project Management — Client

Next.js frontend for the Tathkarah Project Tracker. All data comes from
[projectmanagement-backend](https://github.com/almuslimmails/projectmanagement-backend)
— this app has no API routes and no database access of its own.

## Run

```bash
npm install
cp .env.example .env.local    # point NEXT_PUBLIC_TRACKER_API at the backend
npm run dev                   # http://localhost:3000
```

Start the backend first. Sign in with a member's email + password —
auth is a 30-day JWT from the backend (`localStorage` + a presence cookie
that middleware uses to gate pages).

## Features

Workspace dashboard · kanban board · issues (TS/BG/EN/STS codes) ·
comments with @-mentions and attachment quoting · file uploads · milestones ·
epics · gantt · spreadsheet · ACL'd wiki with issue links · chat ·
attendance/clock-in · announcements ticker + manager · AI Foundations docs ·
proctored exam wizard · role-based menus · owner impersonation.
