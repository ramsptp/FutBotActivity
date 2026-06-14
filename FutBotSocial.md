# FUTBOT SOCIAL - PROJECT TRANSITION DOCUMENT

## Overview

FUTBOT Arena is complete and actively being played by users.

Arena will continue to exist as its own game mode and is considered feature complete for now.

Development focus is shifting toward a new project called FUTBOT Social.

The goal is NOT to merge everything into one large football platform immediately.

The goal is to build a collection of lightweight football social games optimized for Discord Activities.

These games should:

* Be playable in voice channels.
* Support quick sessions.
* Be easy for new users to understand.
* Encourage social interaction.
* Require minimal onboarding.
* Reuse a shared football player database.

Arena remains a separate product pillar.

---

## Product Vision

FUTBOT Social is a football party-game platform.

Core philosophy:

"Football games people can instantly play with friends in Discord."

The focus is:

* Fun over progression
* Social interaction over grinding
* Fast gameplay loops
* Replayability
* Minimal friction

The project should feel closer to:

* playfootball.games
* Jackbox Party Packs
* Discord Activities

than to:

* EA FC Ultimate Team
* Football Manager

---

# Version 1 Scope

Version 1 will contain ONLY three games.

No additional games should be developed until these are playable and tested.

## Game 1 - Guess The Player

Players are shown clues.

Examples:

League: Premier League
Position: Striker
Nationality: England

Users attempt to identify the player.

Possible clue categories:

* League
* Club
* Position
* Nationality
* Age
* Footedness
* Rating
* Goals
* Assists

Gameplay Goals:

* Quick rounds
* Social discussion
* Easy onboarding

---

## Game 2 - Higher or Lower

Users compare football statistics.

Example:

Harry Kane Goals: 36

Next Player:
Erling Haaland

Higher or Lower?

Statistics may include:

* Goals
* Assists
* Average Rating
* Appearances
* Clean Sheets
* Minutes Played

Gameplay Goals:

* Infinite replayability
* Fast rounds
* Simple UI

---

## Game 3 - Football Survivor

Multiplayer elimination game.

Players vote on football questions.

Example:

Who is the better striker?

* Harry Kane
* Victor Osimhen

Users vote.

Minority vote is eliminated.

Game continues until one player remains.

Gameplay Goals:

* Discord-native
* Conversation generation
* Spectator-friendly

---

# Technical Direction

Arena and Social should be separated conceptually.

Do NOT attempt to integrate Arena mechanics into Social at this stage.

Social should have:

* Separate routes
* Separate game logic
* Separate UI flow

Shared systems may include:

* User accounts
* Leaderboards
* Profiles
* Statistics

---

# Database Strategy

Use Supabase.

Do not use local SQLite.

Keep raw datasets locally for backup.

Workflow:

Dataset
→ Data Cleaning Script
→ Supabase
→ Social Games

---

# Initial Database Requirements

Create a simplified player database.

## players

id
name
nationality
position
club
league

Optional fields:

age
goals
assists
appearances
rating

---

# Data Sources

Current candidate dataset:

Kaggle Player Scores Dataset

This dataset will be used primarily for:

* Higher or Lower
* Guess The Player
* Survivor

Historical club data is NOT required for Version 1.

Games requiring career history are postponed.

---

# Deferred Features

Do NOT implement:

* Tiki-Taka-Toe
* Connections
* Career Path
* Draft Battle
* Daily Challenges
* Achievements
* Shared Progression
* Seasonal Systems

These are future milestones.

---

# UI Philosophy

The UI should follow the FUTBOT Activity design language:

* Dark stadium backgrounds
* Purple FUTBOT branding
* Large buttons
* Minimal clutter
* Discord-friendly layouts
* Fast navigation

Every screen should have one primary action.

Avoid dashboard-heavy interfaces.

---

# Immediate Development Tasks

Task 1:
Import player dataset into Supabase.

Task 2:
Create player service layer.

Task 3:
Implement Guess The Player.

Task 4:
Implement Higher or Lower.

Task 5:
Implement Football Survivor.

Task 6:
Conduct testing with existing Arena players.

No additional features should be added before gameplay validation.

---

# Success Criteria

A successful Version 1 is:

* Users can launch FUTBOT Social.
* Users can play Guess The Player.
* Users can play Higher or Lower.
* Users can play Football Survivor.
* Existing Arena players actively use at least one social game.

Focus on shipping quickly and validating player interest before expanding scope.



------------------------------------------------

# FUTBOT SOCIAL - CORE GAME BLUEPRINT

# Philosophy

Every game must satisfy:

* Easy to understand in under 10 seconds
* Playable with friends in a Discord VC
* Generates discussion and arguments
* Average round length under 5 minutes
* Uses football knowledge without requiring expert knowledge

Games should feel like party games first and football games second.

---

# GAME 1: GUESS THE PLAYER

## Goal

Identify the football player before everyone else.

---

## Lobby

Players join room.

Host selects:

* Easy
* Medium
* Hard

Optional:

* Current Players Only
* Legends Included

---

## Round Flow

System randomly selects player.

Example:

Harry Kane

Player is hidden.

---

### Clue 1

Nationality:
England

Players can submit guesses.

Correct answer:
10 points

---

### Clue 2

Position:
Striker

Correct answer:
8 points

---

### Clue 3

League:
Bundesliga

Correct answer:
6 points

---

### Clue 4

Club:
Bayern Munich

Correct answer:
4 points

---

### Clue 5

Career Goals:
400+

Correct answer:
2 points

---

## Scoring

First correct answer receives points.

Points decrease as clues are revealed.

---

## Round End

Show:

Player Card
Name
Club
Nationality

Scoreboard updates.

---

## Match Structure

10 rounds.

Highest score wins.

---

## Why This Works

* Everyone participates simultaneously
* No waiting turns
* Encourages shouting guesses in VC
* Football knowledge rewarded

---

# GAME 2: HIGHER OR LOWER

## Goal

Predict whether a hidden statistic is higher or lower.

---

## Supported Stats

Career Goals
Career Assists
Appearances
Market Value
International Caps
Clean Sheets

Only one stat category is used per game.

---

## Round Flow

Player A displayed:

Harry Kane
Career Goals: 382

---

Player B displayed:

Mohamed Salah

Value hidden.

---

Players choose:

Higher
Lower

---

Countdown:

5 seconds

Reveal answer.

---

## Scoring

Correct:
+1 point

Incorrect:
0 points

---

## Match Structure

15 rounds

Most points wins.

---

## Example

Harry Kane
382 Goals

Mohamed Salah

Choices:

Higher
Lower

Reveal:

344 Goals

Answer:

Lower

---

## Multiplayer Behaviour

All players answer simultaneously.

No turns.

Fast pace.

---

## Why This Works

* Extremely easy onboarding
* Infinite content
* Great spectator experience
* Works with any football dataset

---

# GAME 3: FOOTBALL SURVIVOR

## Goal

Be the last player remaining.

---

## Core Rule

Majority survives.

Minority is eliminated.

---

## Lobby

4-10 Players

Recommended:
6-8 Players

---

## Round Flow

Question appears.

Example:

Who is the better striker?

Harry Kane
Victor Osimhen

---

Players vote secretly.

10 second timer.

---

## Reveal

Results shown.

Example:

Harry Kane
5 Votes

Victor Osimhen
2 Votes

---

Minority voters eliminated.

---

## Next Round

Remaining players continue.

---

## Example Questions

Better Striker?

Better Playmaker?

Better Club?

More Successful Career?

Who Would You Sign?

More Underrated Player?

---

## Final Round

Last 2 players.

One final question.

Winner crowned.

---

## Why This Works

* Creates arguments
* Creates discussion
* No database complexity
* Perfect Discord game

---

# FUTBOT SOCIAL MVP

Launch with ONLY:

1. Guess The Player
2. Higher or Lower
3. Football Survivor

No achievements.
No progression.
No currencies.
No daily challenges.

Focus entirely on:

* Fun
* Fast matchmaking
* Replayability
* Social interaction

Only add additional systems after these games are actively played.


# GUESS INPUT SYSTEM

## Player Search UX

The game MUST provide autocomplete suggestions while typing.

Users should never be required to type the exact player name manually.

---

## Example

User types:

mes

Dropdown appears:

* Lionel Messi
* Junior Messias

User can:

* click a suggestion
* press arrow keys
* press enter

---

User types:

ron

Dropdown appears:

* Cristiano Ronaldo
* Ronaldinho
* Ronaldo Nazario

---

## Search Requirements

Search should support:

* Partial names
* First names
* Last names
* Nicknames (future)

Examples:

Input:
messi

Matches:
Lionel Messi

---

Input:
haaland

Matches:
Erling Haaland

---

Input:
cristiano

Matches:
Cristiano Ronaldo

---

Input:
ronaldo

Matches:
Cristiano Ronaldo
Ronaldo Nazario

---

## Fuzzy Matching

The search system should tolerate small mistakes.

Examples:

Input:
halland

Returns:
Erling Haaland

---

Input:
mbape

Returns:
Kylian Mbappe

---

## UI Behaviour

Desktop:

Dropdown appears directly beneath input field.

Mobile:

Suggestions appear in expandable list below search box.

---

## Result Limit

Show maximum:

5 suggestions

ordered by relevance.

---

## Keyboard Support

Arrow Up
Arrow Down
Enter

must work.

---

## Performance

Suggestions should appear in under 100ms.

Search should be backed by local indexed player data.

Do NOT query external football APIs during gameplay.

---

## Why This Is Required

Without autocomplete:

* Users misspell names
* Users get frustrated
* Mobile experience suffers
* Legends become difficult to guess

With autocomplete:

* Faster answers
* Better accessibility
* Better Discord Activity experience
* Similar UX to playfootball.games

Autocomplete is considered a core gameplay feature, not an optional enhancement.
