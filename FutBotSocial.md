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
