# Tasks — spec

The Tasks tab shows **one person at a time**, their **daily** and **weekly** tasks side by side, and a **bounty board** of up-for-grabs jobs. New tasks are added from a reusable **task library**.

Code: `src/screens/tasks/` (`Tasks.tsx`, `BountyBoard.tsx`, `AddTaskSheet.tsx`, `useTasks.ts`), helpers in `src/lib/tasks.ts`, types in `src/types.ts`. Live tasks/completions via `src/data/hooks.ts`; templates and bounties still need wiring.

## Screen

- **Header:** "Daniel's tasks" (or "Noah's care"), then the person switcher (Daniel, Shelby, Noah, each showing "N left") and **Add a task**.
- **Hero** in the person's tint:
  - Avatar, greeting, and one progress segment per task.
  - "3 of 7 done today · 1 of 4 this week".
  - Points earned today and the balance, with progress to the next reward (from `REWARDS`).
  - Noah earns no points; his hero says "Baby care · anyone can check these off".
- **Today (daily)** and **This week (weekly)**, side by side:
  - Each list has its own count, progress bar and + button; the + opens the Add sheet with that frequency already chosen.
  - A weekly task has a due pill: "Due Sat", "Due today" in the person's color, or "Late · Mon" in alert red.
  - Claimed bounties sit at the top of the weekly list with a gold border and a *Bounty* tag.
  - Tasks already done when the screen opens sink to the bottom. Tasks finished on screen stay where they are.
- **Bounty board:**
  - Pinned paper tickets show the points and the due day.
  - The button reads *Claim for {person}*. Noah can't claim, so his button reads "Pick a grown-up".
  - Claimed tickets move to the bottom with a "Shelby claimed" stamp in that person's color.

## Add a task

1. **Task:**
   - "Most used" chips (top 6 by `uses`).
   - A combobox over the library, showing the most-used 8, or up to 6 matches while typing.
   - If nothing matches exactly, the last row is **Create "…"**. That opens a name field (max 32 characters) and an icon picker, and the new template is saved to the library when the task is added.
2. **Who's it for:** Daniel, Shelby, Noah, or **Up for grabs**, which creates a bounty instead of a task.
3. **How often:**
   - **Daily** with Repeats on: presets (Every day, Weekdays, Weekends) plus single-day toggles. With Repeats off: *Today* or *Tomorrow*.
   - **Weekly**, due by a day (any day before is fine). With Repeats on: *Every week* or *Every other week*. With Repeats off: *This week only*.
   - Bounties are always weekly, this week only, with a due day.
4. **Points:** steps of 5, from 0 to 100. Hidden for Noah. For bounties it's "Bounty points".

Picking a library task fills in its usual frequency and points; the person can still change them for this one task. The footer sums it up in a plain sentence ("Shelby · Water the garden · every week, by Saturday · 10 pts").

## Data model (Supabase)

```sql
create table task_templates (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (char_length(title) <= 32),
  icon        text not null,                       -- an IconName from Icon.tsx
  points      int  not null default 0 check (points between 0 and 100),
  frequency   text not null check (frequency in ('daily','weekly')),
  uses        int  not null default 0,
  created_by  uuid references members(id),
  created_at  timestamptz default now()
);
-- "Create" is only offered when no exact match exists
create unique index task_templates_title_key on task_templates (lower(title));

create table bounties (
  id           uuid primary key default gen_random_uuid(),
  template_id  uuid not null references task_templates(id),
  points       int not null check (points > 0),
  due_day      int check (due_day between 0 and 6), -- null = any time this week
  week_of      date not null,
  claimed_by   uuid references members(id),
  claimed_at   timestamptz,
  created_by   uuid references members(id)
);

create table tasks (
  id           uuid primary key default gen_random_uuid(),
  template_id  uuid not null references task_templates(id),
  member_id    uuid not null references members(id),
  frequency    text not null check (frequency in ('daily','weekly')),
  -- daily: days int[] (0 = Sun) or once_on date; weekly: every_weeks 1|2 or this week only, plus due_day
  days         int[],
  once_on      date,
  every_weeks  int check (every_weeks in (1,2)),
  week_of      date,                               -- set for "this week only" and claimed bounties
  due_day      int check (due_day between 0 and 6),
  points       int not null default 0,
  bounty_id    uuid references bounties(id),
  archived_at  timestamptz
);

create table task_completions (
  task_id      uuid not null references tasks(id),
  period       date not null,                      -- the day (daily) or the week's Sunday (weekly)
  completed_by uuid references members(id),       -- who tapped it (Noah's care tasks: a parent)
  completed_at timestamptz default now(),
  primary key (task_id, period)
);
```

`Schedule` in `types.ts` is the UI shape of the schedule columns: `days`, `once`, `weekly` (`every` + `dueDay`) or `thisWeek` (`dueDay`).

### Rules

- **Resets:** daily tasks reset at midnight and weekly tasks on Sunday. Nothing is deleted. A completion is keyed by `(task_id, period)`, so a new period simply has no row yet.
- **Every other week:** active when `weeks_since(anchor) % 2 = 0`. Mock anchor: Sunday, Jan 4, 2026 (`lib/tasks.ts`).
- **This week only / claimed bounties:** archive the task once its `week_of` is over.
- **Claiming must be race-safe**, because two people can tap at once:
  `update bounties set claimed_by = $me, claimed_at = now() where id = $id and claimed_by is null returning *`. No row back means someone else already claimed it: show a toast ("Shelby got there first") and refresh. If it succeeds, insert the `tasks` row with `bounty_id`, `week_of` and `due_day`.
- **Points:** completing a task inserts a `points_ledger` row (`delta = tasks.points`, reason = template title). Undoing it inserts the opposite row, and the ledger is never edited. Noah's tasks have 0 points.
- **Library uses:** increment `task_templates.uses` whenever a template is used to add a task. That's what sorts "Most used" and the combobox.
- **Realtime:** subscribe to `tasks`, `task_completions` and `bounties` while the Tasks tab is open, so a claim on the phone shows up on the hub.

## Motion

All one-shot and transform/opacity only (see DESIGN_SYSTEM.md, "Tasks motion"):

- Switching person slides the column in (350ms) and the title rises.
- Cards rise in with a 45ms stagger.
- Completing a task: the check pops, "+10" floats up and fades (1s), today's points pop, and the progress segments fill.
- Claiming a bounty: the ticket lifts and then flies toward the weekly list and fades (820ms). The new card slides in from the right with a small overshoot (500ms).
- The Add sheet slides up (500ms) and library rows fade up in a stagger. Selected days and points pop, and closing drops the sheet and fades it.
- A finished list gets an "all wrapped up" banner that pops in.
