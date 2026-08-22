# Forge Wisper

## Open-Source AI Voice-to-Text and Smart Writing Desktop Application

**Product Name:** Forge Wisper
**Product Family:** Forge
**Version:** 1.0 Product Requirements Document
**Status:** Product Specification
**Primary Platform:** Windows
**Future Platforms:** macOS, Linux
**Application Type:** Native desktop application
**Repository:** GitHub
**License:** Recommended MIT for application code, with third-party model licenses respected separately
**Frontend:** React + TypeScript
**Desktop Runtime:** Tauri
**Core Backend:** Rust
**Database:** SQLite
**Primary STT Engines:** Local Whisper + Groq Whisper

---

# 1. Product Summary

Forge Wisper is an open-source desktop application that converts natural speech into accurate, clean, structured, and context-aware text, then inserts that text directly into whichever application the user is working in.

Forge Wisper is designed around a simple interaction:

```text
Press / Hold Hotkey
        ↓
Speak
        ↓
Release
        ↓
Forge Wisper Processes Speech
        ↓
Clean + Structure + Verify
        ↓
Text Appears in Active Application
```

The application should feel almost invisible during normal use.

The user should not have to think about transcription engines, AI processing, formatting models, or clipboard operations.

They simply speak.

---

# 2. Product Vision

Forge Wisper aims to become an open-source voice interface for computer work.

The product should allow users to speak naturally and receive text that is:

* accurate
* readable
* properly structured
* context-aware
* professionally presented when appropriate
* faithful to the original meaning
* ready to use immediately

The project should remain:

* open source
* privacy-conscious
* provider-independent
* locally capable
* extensible
* transparent
* community-driven

---

# 3. Core Product Philosophy

Forge Wisper follows seven principles.

## 3.1 Accuracy First

The application must prioritize correct meaning over attractive formatting.

Priority order:

```text
1. Meaning
2. Transcription Accuracy
3. Correction Handling
4. Context
5. Structure
6. Formatting
7. Style
```

---

## 3.2 Never Invent

The system must not invent:

* names
* dates
* numbers
* facts
* requirements
* technical details
* commands
* claims

unless the user explicitly requests content generation.

---

## 3.3 Preserve Meaning

The system may clean and reorganize speech, but it must preserve what the user intended to communicate.

---

## 3.4 Natural Speech

Users should not need to speak like a machine.

They can say:

> "okay so I have this idea and first I want to add local whisper and then groq and after that maybe some kind of cleanup system"

Forge Wisper should understand the structure naturally.

---

## 3.5 Local First

Local transcription should be a first-class feature.

Users should be able to use Forge Wisper without sending audio to the cloud.

---

## 3.6 Provider Independent

No single AI provider should control the application architecture.

The system must allow providers to be replaced or added.

---

## 3.7 Open by Design

Users and contributors should be able to inspect:

* source code
* processing architecture
* provider integrations
* formatting rules
* privacy behavior
* model information
* storage behavior

---

# 4. The Main Differentiator

Forge Wisper is not simply:

```text
Voice → Whisper → Text
```

It is:

```text
Voice
 ↓
Transcription
 ↓
Understanding
 ↓
Correction Detection
 ↓
Cleanup
 ↓
Structure Detection
 ↓
Context
 ↓
Formatting
 ↓
Verification
 ↓
Safe Paste
```

The product therefore belongs to a category closer to:

> **Voice-to-structured-text**

rather than basic speech-to-text.

---

# 5. Example

User says:

> "okay I have an idea for the application first I want to add local whisper then groq because some computers might be slower after that I want the cleanup system and then history maybe later we can compare two models"

Forge Wisper produces:

# Application Idea

### Core Transcription

1. **Local Whisper**

   * Provide private local transcription.

2. **Groq**

   * Provide fast cloud transcription for users who need additional speed.

### Processing

3. **Cleanup System**

   * Clean punctuation and unnecessary filler words.
   * Preserve the user's original meaning.

### History

4. **Transcription History**

   * Allow users to review previous dictations.

### Future Consideration

* Compare multiple transcription models.

The system preserves the word "maybe" by treating model comparison as a future consideration rather than a confirmed requirement.

---

# 6. Primary User Workflow

```text
User opens any application
        ↓
Places cursor in a text field
        ↓
Holds Ctrl + Space
        ↓
Forge Wisper starts recording
        ↓
User speaks
        ↓
User releases Ctrl + Space
        ↓
Audio processing
        ↓
Speech-to-text
        ↓
Cleanup
        ↓
Smart structure
        ↓
Verification
        ↓
Final formatting
        ↓
Paste into active application
```

The user should not have to manually copy and paste.

---

# 7. Core Architecture

```text
                         FORGE WISPER
                              │
                              ▼
                       Audio Capture
                              │
                              ▼
                    Transcription Layer
                              │
                 ┌────────────┴────────────┐
                 │                         │
           Local Whisper                 Groq
                 │                         │
                 └────────────┬────────────┘
                              │
                              ▼
                       Raw Transcript
                              │
                              ▼
                        Context Engine
                              │
                              ▼
                   Correction Detection
                              │
                              ▼
                       Cleanup Engine
                              │
                              ▼
                    Smart Format Engine
                              │
                              ▼
                    Verification Engine
                              │
                              ▼
                       Output Engine
                              │
                              ▼
                     Active Application
```

---

# 8. Technology Stack

## Desktop

Tauri 2.x

## Backend

Rust

## Frontend

React

## Language

TypeScript

## Styling

Tailwind CSS

## Components

shadcn/ui

## Database

SQLite

## Audio

Rust-native audio capture

## Local STT

Whisper-compatible runtime

## Cloud STT

Groq Speech-to-Text API

## Secure Storage

OS credential/keychain facilities

---

# 9. Repository Architecture

Recommended repository:

```text
forge-wisper/
│
├── apps/
│   └── desktop/
│       ├── src/
│       └── src-tauri/
│
├── crates/
│   ├── audio/
│   ├── transcription/
│   ├── cleanup/
│   ├── formatting/
│   ├── verification/
│   ├── context/
│   ├── dictionary/
│   ├── snippets/
│   ├── output/
│   ├── hotkeys/
│   ├── storage/
│   ├── security/
│   └── providers/
│
├── providers/
│   ├── local-whisper/
│   └── groq/
│
├── models/
│   └── README.md
│
├── docs/
│   ├── architecture.md
│   ├── privacy.md
│   ├── models.md
│   ├── providers.md
│   ├── formatting.md
│   ├── development.md
│   └── contributing.md
│
├── tests/
│
├── scripts/
│
├── README.md
├── LICENSE
├── CONTRIBUTING.md
├── SECURITY.md
└── CODE_OF_CONDUCT.md
```

---

# 10. Audio Capture

The audio engine should:

* detect microphones
* allow microphone selection
* capture audio efficiently
* provide recording state
* handle microphone permissions
* normalize audio appropriately
* detect silence
* stop cleanly

The application should not store audio by default.

---

# 11. Push-to-Talk

Default shortcut:

```text
Ctrl + Space
```

Behavior:

```text
Hold Ctrl + Space
        ↓
Start recording

Speak
        ↓
Release Ctrl + Space
        ↓
Stop recording
```

The shortcut must be customizable.

---

# 12. Hands-Free Mode

Optional:

```text
Ctrl + Space
→ Start

Ctrl + Space
→ Stop
```

Users should be able to choose:

* push-to-talk
* toggle recording
* custom shortcut

---

# 13. Recording UI

The interface should be a small floating control.

### Listening

```text
┌──────────────────────────┐
│ ● Listening...           │
│ ███████░░░░░░░           │
└──────────────────────────┘
```

### Processing

```text
┌──────────────────────────┐
│ ◌ Forging your text...   │
└──────────────────────────┘
```

### Success

```text
┌──────────────────────────┐
│ ✓ Inserted               │
└──────────────────────────┘
```

### Error

```text
┌──────────────────────────┐
│ ! Processing failed      │
│   Retry                  │
└──────────────────────────┘
```

The UI should disappear automatically after successful insertion.

---

# 14. Transcription Layer

Forge Wisper uses a provider abstraction.

```text
TranscriptionProvider
        │
        ├── Local Whisper
        │
        ├── Groq
        │
        └── Future Providers
```

The application must not tightly couple the rest of the system to one provider.

---

# 15. Local Whisper

Local Whisper provides:

* offline transcription
* privacy
* no API cost
* no network requirement after model installation

Initial model support:

* Whisper Tiny
* Whisper Base
* Whisper Small
* Whisper Medium
* Whisper Large
* Whisper Large-v3
* supported quantized variants

The actual model list should depend on the selected runtime.

---

# 16. Local Model Manager

The application should provide:

```text
Models

Whisper Base
Installed

Whisper Small
Installed

Whisper Medium
Not Installed

Whisper Large-v3
Not Installed
```

Actions:

* Install
* Remove
* Verify
* Set default
* View details

Each model should show:

* size
* estimated RAM
* supported languages
* source
* license
* checksum where available

---

# 17. Hardware Detection

Forge Wisper should detect:

* CPU
* RAM
* GPU
* GPU vendor
* storage availability

Then recommend a model.

Example:

```text
Detected:

16 GB RAM
Intel CPU
Integrated GPU

Recommended:
Whisper Small
```

The recommendation must not lock the user into that model.

---

# 18. Groq

Groq is the first cloud transcription provider.

Initial models:

```text
whisper-large-v3
whisper-large-v3-turbo
```

Recommended default:

```text
whisper-large-v3-turbo
```

Accuracy-oriented option:

```text
whisper-large-v3
```

Groq's current speech-to-text documentation lists these Whisper models for transcription. [Groq Speech-to-Text Documentation](https://console.groq.com/docs/speech-to-text?utm_source=chatgpt.com)

---

# 19. Groq API Key

The user provides their own API key.

Requirements:

* never log the key
* never include it in telemetry
* never commit it to source
* store securely
* allow users to remove it

Settings:

```text
Provider
[ Groq ]

API Key
[ ************** ]

Model
[ Whisper Large V3 Turbo ]

[ Test Connection ]
```

---

# 20. Provider Interface

Conceptual Rust interface:

```rust
trait TranscriptionProvider {
    fn id(&self) -> &str;

    fn name(&self) -> &str;

    fn capabilities(&self) -> ProviderCapabilities;

    async fn transcribe(
        &self,
        audio: AudioData,
        options: TranscriptionOptions
    ) -> Result<Transcript, ProviderError>;
}
```

This should allow future providers without changing the core pipeline.

---

# 21. Raw Transcript

Every transcription produces:

```json
{
  "text": "send Ahmed the report tomorrow actually Friday",
  "language": "en",
  "provider": "groq",
  "model": "whisper-large-v3-turbo",
  "duration_ms": 4200
}
```

The raw transcript should remain available until final processing completes.

---

# 22. Context Engine

Context helps Forge Wisper understand the user's working environment.

Possible context:

* active application
* window title
* selected text
* nearby text
* current document
* active language
* personal dictionary
* application profile

Context should be:

* optional
* minimal
* transparent
* privacy-conscious

---

# 23. Application Detection

Initial application categories:

```text
Email
Messaging
Document
Browser
AI Chat
Code Editor
Terminal
Notes
Unknown
```

Examples:

```text
Gmail → Email
WhatsApp → Messaging
VS Code → Code
ChatGPT → AI Chat
Notepad → Document
```

---

# 24. Application Profiles

Users should be able to configure per-application behavior.

Example:

```text
VS Code

Engine:
Local Whisper

Formatting:
Technical

Cleanup:
Smart

Dictionary:
Developer
```

Gmail:

```text
Engine:
Groq

Formatting:
Professional

Cleanup:
Smart
```

WhatsApp:

```text
Engine:
Local

Formatting:
Casual

Cleanup:
Clean
```

---

# 25. Personal Dictionary

Users can define preferred terminology.

Example:

```text
LangChain
LangGraph
PostgreSQL
PyTorch
Kubernetes
n8n
Forge Wisper
```

Custom mapping:

```text
Spoken:
lang chain

Preferred:
LangChain
```

Dictionary terms should be available to:

* transcription
* cleanup
* formatting
* verification

---

# 26. Correction Detection

Forge Wisper must recognize spoken corrections.

Example:

> "Schedule the meeting for Tuesday, actually Thursday."

Output:

> Schedule the meeting for Thursday.

Supported correction phrases include:

* actually
* I mean
* sorry
* no
* instead
* rather
* scratch that
* change that
* wait
* let me correct that

Natural corrections should also be detected when confidence is high.

---

# 27. Filler Removal

The system may remove:

* um
* uh
* you know
* basically
* like
* sort of
* kind of

Removal must be contextual.

Meaningful usage must be preserved.

---

# 28. Punctuation

Automatic punctuation:

* period
* comma
* question mark
* exclamation mark
* colon
* quotation marks
* parentheses

Voice commands should work:

> "Hello Ahmed comma how are you question mark"

Output:

> Hello Ahmed, how are you?

---

# 29. Number Handling

Numbers require special protection.

The system should recognize:

* currency
* dates
* times
* percentages
* versions
* quantities

Example:

> "The budget is fifteen thousand five hundred."

Output:

> The budget is 15,500.

If uncertain, Forge Wisper should avoid guessing.

---

# 30. Smart Format Engine

Smart Format is a core Forge Wisper feature.

It transforms natural speech into useful structure.

It should infer structure from the user's language without requiring explicit formatting commands.

---

# 31. Smart Structure Types

Initial supported structures:

```text
Idea
Task List
Feature List
Requirements
Project Plan
Meeting Notes
Brainstorm
Problem / Solution
Pros / Cons
Steps
Checklist
Outline
Email
Message
Social Post
Article Outline
Technical Specification
Bug Report
GitHub Issue
Code
```

---

# 32. Idea Detection

Speech:

> "I have an idea for the application. First I want local Whisper, then Groq, then the cleanup system."

Output:

# Application Idea

### 1. Local Whisper

Add private local transcription.

### 2. Groq

Add fast cloud transcription.

### 3. Cleanup System

Clean and verify generated text before insertion.

---

# 33. Task Detection

Speech:

> "I need to finish the backend, add authentication, and test the API."

Output:

# Tasks

1. Finish the backend
2. Add authentication
3. Test the API

---

# 34. Feature Detection

Speech:

> "The app should have local transcription, Groq support, history, and a custom dictionary."

Output:

# Features

* Local transcription
* Groq support
* Transcription history
* Custom dictionary

---

# 35. Requirements Detection

Speech:

> "The application needs a global hotkey, microphone selection, model selection, and automatic paste."

Output:

# Requirements

* Global hotkey
* Microphone selection
* Model selection
* Automatic paste

---

# 36. Project Plan Detection

Speech:

> "First build the database, then the API, then authentication, then the frontend, and finally deployment."

Output:

# Project Plan

1. Database
2. API
3. Authentication
4. Frontend
5. Deployment

---

# 37. Meeting Notes

Speech:

> "We decided to release Friday. Ahmed will handle deployment. Sarah will finish documentation. Testing is still incomplete."

Output:

# Meeting Notes

## Decision

Release Friday.

## Responsibilities

* **Ahmed:** Deployment
* **Sarah:** Documentation

## Open Issue

Testing is still incomplete.

---

# 38. Uncertainty Preservation

This is mandatory.

Speech:

> "Maybe later we can add team collaboration."

Output:

### Future Consideration

Team collaboration.

The system must not transform:

> "Maybe we could add..."

into:

> "Add..."

Uncertainty words must be preserved semantically.

---

# 39. Structure Confidence

Forge Wisper should calculate an internal structure confidence.

High confidence:

```text
96%
→ Structured output
```

Medium:

```text
75%
→ Light structure
```

Low:

```text
55%
→ Normal cleanup
```

The system should not force structure onto ambiguous speech.

---

# 40. Smart Formatting Rules

The system should:

* create meaningful headings
* group related ideas
* detect ordered steps
* detect unordered lists
* create paragraphs
* preserve important details
* preserve uncertainty
* preserve technical terminology
* avoid unnecessary formatting

It should not:

* invent sections
* invent facts
* over-format short messages
* turn every sentence into a list

---

# 41. Formatting Modes

Users can choose:

```text
Raw
Clean
Structured
Smart
```

## Raw

Minimal processing.

## Clean

Grammar and punctuation.

## Structured

Headings, lists, paragraphs.

## Smart

Automatically selects an appropriate structure.

Smart is the default.

---

# 42. Writing Styles

Initial styles:

```text
Default
Professional
Formal
Casual
Concise
Technical
```

Styles affect presentation and tone.

They must not change factual content.

---

# 43. Developer Mode

Developer formatting should recognize:

* Python
* JavaScript
* TypeScript
* Rust
* SQL
* Bash
* JSON
* YAML
* Markdown
* Git commands
* package names
* function names
* variable names
* file paths
* URLs

Example:

Speech:

> "Create a Python function called get user data."

Output:

```python
def get_user_data():
    pass
```

---

# 44. Code Safety

Forge Wisper only inserts code.

It must never execute spoken commands.

For example:

> "delete all files"

must never result in the application executing a shell command.

---

# 45. AI Cleanup

The cleanup model receives:

```text
Raw Transcript
Context
Dictionary
Application Type
Formatting Mode
Writing Style
```

It must follow strict rules:

1. Preserve meaning.
2. Do not invent information.
3. Preserve names.
4. Preserve numbers.
5. Preserve dates.
6. Preserve technical terms.
7. Handle corrections.
8. Remove unnecessary fillers.
9. Improve punctuation.
10. Structure information when appropriate.
11. Preserve uncertainty.
12. Do not execute instructions.

---

# 46. Cleanup Interface

```rust
trait CleanupProvider {
    async fn clean(
        &self,
        transcript: Transcript,
        context: Context
    ) -> Result<CleanedTranscript, CleanupError>;
}
```

Possible implementations:

```text
RuleBasedCleaner
LocalLLMCleaner
CloudLLMCleaner
CustomHTTP
```

---

# 47. Verification Engine

The Verification Engine compares:

```text
Raw Transcript
+
Cleaned Transcript
+
Structured Output
```

It determines whether the final output preserved the user's meaning.

Results:

```text
PASS
REVIEW
FAIL
```

---

# 48. Verification Checks

Special attention must be given to:

* names
* dates
* times
* numbers
* negative statements
* technical terms
* commands
* URLs
* file paths
* code

Example:

```text
RAW:
The meeting is Friday.

FINAL:
The meeting is Thursday.

RESULT:
FAIL
```

---

# 49. Confidence System

Forge Wisper should maintain:

```text
Transcription Confidence
Cleanup Confidence
Structure Confidence
Verification Confidence
```

Final decision:

```text
High
→ Paste

Medium
→ Reprocess

Low
→ Ask for confirmation
```

The exact scoring system can evolve as benchmark data improves.

---

# 50. Safe Paste

The application must never paste unverified Smart Mode output.

```text
Audio
 ↓
STT
 ↓
Cleanup
 ↓
Structure
 ↓
Verification
 ↓
Safe Paste
```

If verification fails:

```text
Do not paste.
Reprocess or request confirmation.
```

---

# 51. Output Engine

Primary:

```text
Copy final text
 ↓
Paste into active application
```

Fallback:

```text
Simulated keyboard input
```

If insertion fails:

```text
Final text copied to clipboard.
```

The user must never lose completed text.

---

# 52. History

History should store:

* timestamp
* application
* provider
* model
* raw transcript
* final output
* processing duration

Actions:

* Copy Raw
* Copy Final
* Paste Again
* Reprocess
* Edit
* Delete

---

# 53. History Retention

Options:

```text
Keep forever
Keep 30 days
Keep 7 days
Do not save
```

Audio should not be stored by default.

---

# 54. Snippets

Users can create voice-triggered snippets.

Example:

```text
Trigger:
"my signature"

Output:
Best regards,
Zazan Ali
```

Snippets should be recognized before final formatting.

---

# 55. Application-Aware Output

## Gmail

Speech:

> "Hi Ahmed I wanted to ask if you can send the report Friday thanks."

Output:

> Hi Ahmed,
>
> I wanted to ask if you could send the report by Friday.
>
> Thanks.

## ChatGPT

Speech:

> "Explain transformers in simple words and give me an example."

Output:

> Explain transformers in simple terms and give me an example.

## GitHub

Speech:

> "I found a bug where the login button doesn't work after refreshing."

Output:

```text
## Bug

The login button stops working after the page is refreshed.
```

## VS Code

Speech:

> "Create a Python function called load data that reads a CSV file."

Output:

```python
def load_data():
    pass
```

---

# 56. Normal Dictation vs Explicit Writing

Forge Wisper must distinguish between ordinary dictation and an explicit request to write something.

Normal:

> "Send this to Ahmed..."

Output should remain close to the user's speech.

Explicit:

> "Turn this into a professional email."

More transformation is allowed.

This prevents the system from rewriting ordinary speech unnecessarily.

---

# 57. Smart Brainstorming

Brainstorming should be a major use case.

Example speech:

> "I think the app should have local Whisper because privacy matters. Groq could be used for speed. We also need verification because I don't want wrong text pasted. Maybe later we could compare multiple models."

Output:

# Forge Wisper Ideas

## Transcription

* **Local Whisper**

  * Privacy-focused local processing.

* **Groq**

  * Fast cloud transcription.

## Accuracy

* Add verification before pasting.
* Consider multi-model comparison later.

## Future Consideration

* Compare multiple transcription models.

---

# 58. Application Profiles

Each application profile can control:

```text
Transcription Provider
Model
Cleanup Mode
Formatting Mode
Writing Style
Dictionary
Context
Verification Level
```

---

# 59. Privacy Architecture

## Local

```text
Microphone
 ↓
Local Whisper
 ↓
Local Cleanup
 ↓
Local Verification
 ↓
Paste
```

No audio leaves the machine.

## Groq

```text
Microphone
 ↓
Groq
 ↓
Local Cleanup
 ↓
Local Verification
 ↓
Paste
```

## Optional Cloud Cleanup

```text
Transcript
 ↓
Selected Cloud Provider
 ↓
Cleanup
```

Cloud cleanup must be explicitly enabled.

---

# 60. Privacy Indicator

The floating UI should show:

```text
● LOCAL
```

or:

```text
⚡ GROQ
```

If cloud cleanup is active:

```text
GROQ STT → CLOUD CLEANUP
```

---

# 61. Telemetry

Default:

```text
OFF
```

If introduced:

* opt-in
* anonymous
* documented
* no transcripts
* no audio
* no API keys

---

# 62. Offline Operation

Local Mode must continue to work without internet after the model has been installed.

No mandatory:

* account
* subscription
* Forge server
* cloud activation

---

# 63. First Launch

```text
Welcome to Forge Wisper

Choose your transcription engine

● Local Whisper
○ Groq
○ Configure later

[Continue]
```

Then:

```text
Choose microphone

[Default Microphone]

[Continue]
```

Then:

```text
Choose formatting

● Smart
○ Clean
○ Raw

[Finish]
```

---

# 64. First Dictation Tutorial

```text
Try Forge Wisper

1. Open any text field.
2. Hold Ctrl + Space.
3. Speak.
4. Release.

Your text will appear automatically.

[Try Now]
```

---

# 65. Processing States

Internal states:

```text
Idle
Listening
Stopping
Transcribing
Cleaning
Structuring
Verifying
Inserting
Success
Cancelled
Error
```

---

# 66. Performance Targets

Target:

```text
Hotkey response:
< 100 ms perceived

Cleanup:
< 1 second target

Verification:
< 500 ms target

Paste:
< 100 ms
```

Overall:

> A normal short dictation should ideally be ready within approximately two seconds after recording ends.

Actual latency depends on hardware, model, audio duration, network, and selected providers.

---

# 67. Accuracy Metrics

The project should measure:

* Word Error Rate
* Character Error Rate
* Name accuracy
* Number accuracy
* Date accuracy
* Technical terminology accuracy
* Correction accuracy
* Structure accuracy
* Meaning preservation
* Zero-edit rate

---

# 68. Zero-Edit Rate

The most important practical metric is:

> **The percentage of outputs users accept without manual editing.**

This is more useful than transcription accuracy alone.

---

# 69. Benchmark Dataset

The project should create a public benchmark covering:

```text
Normal Speech
Fast Speech
Different Accents
Background Noise
Technical Terms
Names
Numbers
Dates
Corrections
Brainstorming
Project Planning
Meeting Notes
Emails
Messaging
Code
Mixed Language
Long Dictation
```

Only legally redistributable data should be included.

---

# 70. Accuracy Regression Tests

Every release should test:

```text
Normal sentence
Technical terminology
Correction
Number
Date
Brainstorm
Project plan
Code
Mixed language
```

Accuracy regressions should be investigated before release.

---

# 71. Forge Design System

Forge Wisper must look like a member of the **Forge product family**.

The visual identity should not copy Wispr Flow.

The interaction can be inspired by the voice-to-text category, but the visual language must remain distinctly Forge.

---

# 72. Forge Brand Concept

Forge represents:

* building
* crafting
* transforming raw material into something useful
* practical tools
* technical craftsmanship

Forge Wisper follows this concept:

```text
Raw Speech
    ↓
Processing
    ↓
Refinement
    ↓
Forged Text
```

The name therefore represents the transformation process.

---

# 73. Forge Color System

## Background

```text
#0E0E0E
```

## Surface

```text
#1C1B1B
```

## Hover Surface

```text
#2A2A2A
```

## Primary Accent

```text
#FFB595
```

## Strong Accent

```text
#CA5924
```

## Primary Text

```text
#E5E2E1
```

## Muted Text

```text
#78716C
```

## Dark Accent Text

```text
#4C1A00
```

These should be defined as global design tokens.

---

# 74. Forge Semantic Colors

The system may introduce additional semantic tokens for:

```text
Success
Warning
Error
Info
```

These should remain subdued and fit the Forge visual language.

They should never overwhelm the warm Forge accent.

---

# 75. Forge Typography

Primary display font:

**Space Grotesk**

Primary UI/body font:

**Inter**

Typography hierarchy:

```text
Hero:
Space Grotesk Bold

Page Titles:
Space Grotesk Bold

Section Titles:
Space Grotesk Semibold

Body:
Inter Regular

Buttons:
Inter Medium

Labels:
Inter Medium

Metadata:
Inter Regular
```

---

# 76. Forge Layout System

Use a consistent spacing scale.

Recommended:

```text
4
8
12
16
20
24
32
40
48
64
```

The UI should have generous spacing without becoming oversized.

---

# 77. Forge Radius System

Use restrained rounding.

Recommended:

```text
Small:
6px

Medium:
10px

Large:
14px

Floating surfaces:
16px
```

Avoid excessive pill-shaped elements except where they have a functional purpose.

---

# 78. Forge Borders

Borders should be subtle.

Use borders primarily for:

* inputs
* cards
* panels
* separators
* selected states

Avoid heavy outlines.

---

# 79. Forge Shadows

Shadows should be subtle.

The design should rely primarily on:

* contrast
* spacing
* borders
* surfaces

rather than large shadows.

---

# 80. Forge Motion

Animations should be functional.

### Listening

A subtle recording indicator.

### Processing

Small activity animation.

### Success

Short confirmation.

### Error

Brief status transition.

Avoid:

* excessive bouncing
* decorative particles
* large transitions
* distracting animations

---

# 81. Forge Component System

Reusable components:

```text
Button
IconButton
Input
Select
Switch
Slider
Card
Panel
Badge
Tooltip
Dialog
Toast
Dropdown
Tabs
Command Menu
Status Indicator
```

All components should use Forge design tokens.

---

# 82. Forge Wisper Floating Recorder

The floating recorder is the primary interaction surface.

It should:

* remain compact
* have a strong active state
* clearly indicate recording
* show processing
* show success
* disappear when finished

Example:

```text
┌─────────────────────────────┐
│  ●  Listening...            │
└─────────────────────────────┘
```

The design should feel like ForgeScribe rather than looking like a generic AI widget.

---

# 83. Forge Wisper Dashboard

```text
FORGE WISPER

Ready to dictate

        ● Hold Ctrl + Space

Engine
Local Whisper

Model
Whisper Small

Format
Smart

Microphone
Default

────────────────────────

Recent Dictation

Can you send the report...

I have an idea for the application...

Create a Python function...
```

---

# 84. Settings Architecture

Sections:

```text
General
Audio
Transcription
Formatting
Context
Dictionary
Snippets
Applications
Shortcuts
History
Privacy
Appearance
Advanced
About
```

---

# 85. Model Manager UI

```text
LOCAL MODELS

Whisper Base
Installed
[Use]

Whisper Small
Installed
[Use]

Whisper Medium
2.1 GB
[Download]

Whisper Large-v3
3.1 GB
[Download]
```

Actual model sizes should be retrieved from the model metadata rather than hardcoded.

---

# 86. Smart Format Preview

Users may optionally preview the transformation.

```text
RAW

I have three things to do first backend
then authentication then frontend

────────────────────

FINAL

# Project Plan

1. Backend
2. Authentication
3. Frontend
```

This is useful for debugging and transparency.

---

# 87. Quick Edit

Optional feature:

```text
Quick Edit
```

When enabled, the user can inspect the final result before insertion.

Default:

```text
OFF
```

Power users may enable it.

---

# 88. Reprocessing

Every history item should support:

```text
Reprocess as:

Raw
Clean
Structured
Smart
Professional
Technical
```

This uses the stored raw transcript rather than recording again.

---

# 89. Clipboard Safety

If paste fails:

```text
✓ Text copied to clipboard
```

The application should never silently lose text.

---

# 90. Error Handling

Errors include:

```text
Microphone unavailable
Permission denied
Model missing
Model loading failed
Insufficient memory
Invalid API key
Network failure
Provider timeout
Audio encoding failure
Cleanup failure
Verification failure
Paste failure
```

Messages must explain what the user can do.

---

# 91. Security Requirements

The application must:

* protect API keys
* avoid logging raw audio
* avoid storing audio by default
* avoid transcript logging by default
* prevent arbitrary command execution
* validate model paths
* sanitize provider errors
* restrict localhost APIs
* clearly disclose cloud processing

---

# 92. Local API

Future local API:

```text
POST /transcribe
POST /clean
POST /format
POST /verify
GET /status
```

Default binding:

```text
127.0.0.1
```

Authentication should be required for external clients.

---

# 93. CLI

Future commands:

```bash
forge-wisper transcribe audio.wav
forge-wisper models list
forge-wisper providers list
forge-wisper format transcript.txt
forge-wisper config show
```

---

# 94. Plugin Architecture

Future plugin types:

```text
STT Provider
Cleanup Provider
Formatting Provider
Verification Provider
Output Provider
Application Profile
Dictionary Provider
```

Plugins should have declared permissions.

---

# 95. Local LLM Support

Future local LLM support should handle:

* cleanup
* structure detection
* verification
* formatting

The LLM layer must remain separate from the STT layer.

This allows:

```text
Local Whisper
+
Local LLM
```

to provide a fully local Smart Mode.

---

# 96. Cloud LLM Support

Future support may include user-selected providers.

The user should explicitly configure the provider.

The application should never secretly route transcripts through a third-party AI service.

---

# 97. Multi-Model Consensus

Advanced future feature:

```text
Audio
 ↓
Model A
 ↓
Model B
 ↓
Compare
 ↓
Consensus
 ↓
Cleanup
 ↓
Verification
```

If models disagree on important information:

```text
Low confidence
→ Reprocess
```

This is especially useful for:

* names
* numbers
* technical terms
* dates
* commands

---

# 98. Multilingual Support

The architecture should support provider-specific languages.

UI:

```text
Auto Detect
English
Urdu
Arabic
Spanish
French
German
Hindi
Chinese
...
```

The exact supported language list should come from the selected model.

Mixed-language speech should be preserved.

Translation should remain a separate feature.

---

# 99. Accessibility

Support:

* keyboard navigation
* screen readers
* high contrast
* scalable UI
* visible recording states
* configurable sounds
* reduced motion

Color must never be the only way to communicate state.

---

# 100. Open-Source GitHub Experience

README should include:

```text
Forge Wisper
What It Is
Features
Screenshots
Demo
Architecture
Installation
Local Whisper Setup
Groq Setup
Smart Format
Privacy
Development
Contributing
Roadmap
License
```

---

# 101. GitHub Issue Templates

Provide:

```text
Bug Report
Transcription Accuracy
Formatting Issue
Model Issue
Provider Issue
Performance Issue
UI/UX Issue
Feature Request
Security Issue
Documentation
```

---

# 102. Pull Request Requirements

Every PR should explain:

```text
What changed?
Why?
Testing performed
Screenshots if UI changed
Performance impact
Privacy impact
Breaking changes
```

---

# 103. Security Policy

The repository should contain:

```text
SECURITY.md
```

with:

* supported versions
* vulnerability reporting
* responsible disclosure process
* security contact

---

# 104. Contribution Areas

Contributors can work on:

```text
Audio
Whisper
Groq
STT Providers
Cleanup
Smart Format
Verification
Dictionary
Application Detection
UI
Accessibility
Performance
Testing
Documentation
macOS
Linux
```

---

# 105. Testing Strategy

## Unit Tests

Test:

* punctuation
* filler removal
* corrections
* number handling
* dictionary
* structure detection
* confidence scoring
* uncertainty preservation

## Integration Tests

Test:

```text
Audio
→ STT
→ Cleanup
→ Structure
→ Verification
→ Paste
```

## Provider Tests

Mock:

* API success
* invalid keys
* timeouts
* network failures
* malformed responses

---

# 106. Accuracy Benchmark

Benchmark categories:

```text
Normal Speech
Fast Speech
Different Accents
Background Noise
Technical Vocabulary
Names
Numbers
Dates
Corrections
Brainstorming
Planning
Meeting Notes
Email
Messaging
Code
Mixed Language
Long Dictation
```

Only legally redistributable datasets should be included.

---

# 107. Performance Benchmark

Measure:

```text
Audio Capture Latency
Model Load Time
Transcription Latency
Cleanup Latency
Structure Latency
Verification Latency
Paste Latency
RAM
CPU
GPU
Disk
```

Benchmark results should be reproducible.

---

# 108. Version 1.0 Scope

The first major release should contain:

```text
✓ Windows desktop
✓ Tauri + Rust
✓ React + TypeScript
✓ Global hotkey
✓ Push-to-talk
✓ Microphone capture
✓ Local Whisper
✓ Groq
✓ Model selection
✓ Raw transcription
✓ Smart cleanup
✓ Correction detection
✓ Filler removal
✓ Smart punctuation
✓ Number preservation
✓ Personal dictionary
✓ Smart Format
✓ Idea formatting
✓ Task formatting
✓ Feature formatting
✓ Requirements formatting
✓ Project plans
✓ Meeting notes
✓ Basic application detection
✓ Verification
✓ Safe paste
✓ Clipboard fallback
✓ History
✓ Privacy controls
✓ Forge Design System
✓ GitHub documentation
```

---

# 109. Version 1.1

Planned:

```text
Application profiles
Writing styles
Snippets
Developer Mode
Better application detection
Model manager
Advanced context
Reprocessing
Smart brainstorming
```

---

# 110. Version 1.2

Planned:

```text
Local LLM cleanup
Local LLM verification
Additional STT providers
Advanced multilingual support
CLI
Local API
Model comparison
Improved consensus
```

---

# 111. Version 2.0

Potential:

```text
macOS
Linux
Plugin system
Multi-model consensus
Advanced developer integrations
Advanced application context
Community providers
Advanced local AI
```

---

# 112. What Forge Wisper Should Not Become

Forge Wisper should not become:

* a cloud-only SaaS
* a mandatory account system
* a generic chatbot
* an automatic command executor
* an uncontrolled AI rewriting tool
* a proprietary model ecosystem
* a complicated dashboard
* a basic Whisper wrapper

Its primary purpose remains:

> **Turn natural speech into accurate, useful, structured text.**

---

# 113. Core Processing Contract

Every dictation should conceptually follow:

```text
                SPEAK
                  ↓
             TRANSCRIBE
                  ↓
             UNDERSTAND
                  ↓
          DETECT CORRECTIONS
                  ↓
                CLEAN
                  ↓
              STRUCTURE
                  ↓
              FORMAT
                  ↓
              VERIFY
                  ↓
             SAFE PASTE
```

---

# 114. Product Quality Rule

Forge Wisper must prefer:

> A slightly less polished but accurate result

over:

> A beautifully written but incorrect result.

This rule should influence every model prompt, benchmark, and engineering decision.

---

# 115. Success Metrics

Primary:

## Zero-Edit Rate

Percentage of final outputs accepted without manual editing.

Secondary:

* Word Error Rate
* Character Error Rate
* Meaning Preservation Rate
* Structure Accuracy
* Correction Accuracy
* Number Accuracy
* Name Accuracy
* Paste Success Rate
* Average Processing Time
* Crash-Free Sessions
* RAM Usage

---

# 116. Definition of Done

Forge Wisper 1.0 is complete when a user can:

1. Install Forge Wisper.
2. Select a microphone.
3. Select Local Whisper or Groq.
4. Select a model.
5. Configure the hotkey.
6. Open almost any text field.
7. Speak naturally.
8. Release the hotkey.
9. Receive an accurate transcript.
10. Have fillers removed appropriately.
11. Have punctuation corrected.
12. Have spoken corrections handled.
13. Have ideas structured when appropriate.
14. Have lists detected.
15. Have uncertainty preserved.
16. Have technical terminology preserved.
17. Have the output verified.
18. Have the final text inserted into the active application.
19. Recover text if insertion fails.
20. Review history.
21. Reprocess previous dictation.
22. Disable cloud processing.
23. Use Local Mode offline.
24. Run the project from source.
25. Contribute through GitHub.

---

# 117. Recommended Development Sequence

## Phase 1 — Core Voice Pipeline

```text
Global Hotkey
 ↓
Microphone
 ↓
Groq Whisper
 ↓
Clipboard
 ↓
Paste
```

---

## Phase 2 — Local Whisper

```text
Global Hotkey
 ↓
Microphone
 ↓
Local Whisper
 ↓
Clipboard
 ↓
Paste
```

---

## Phase 3 — Cleanup

```text
Transcript
 ↓
Filler Removal
 ↓
Punctuation
 ↓
Correction Detection
 ↓
Paste
```

---

## Phase 4 — Smart Format

```text
Transcript
 ↓
Meaning Analysis
 ↓
Structure Detection
 ↓
Beautiful Formatting
 ↓
Paste
```

---

## Phase 5 — Verification

```text
Raw Transcript
 ↓
Clean
 ↓
Structure
 ↓
Verify
 ↓
Paste
```

---

## Phase 6 — Context

```text
Active Application
 ↓
Application Profile
 ↓
Dictionary
 ↓
Context-Aware Formatting
```

---

## Phase 7 — Open-Source Infrastructure

```text
Provider API
Model Manager
Tests
CI
Documentation
Plugin Architecture
```

---

# 118. First Vertical Slice

The first complete working version should be:

```text
                    Ctrl + Space
                          ↓
                     Microphone
                          ↓
                     Groq Whisper
                          ↓
                    Raw Transcript
                          ↓
                   Rule-Based Cleanup
                          ↓
                      Verification
                          ↓
                       Clipboard
                          ↓
                    Active Application
```

Once stable, Local Whisper replaces Groq through the provider interface without changing the rest of the architecture.

Then Smart Format is added.

---

# 119. Final Product Architecture

```text
                           FORGE WISPER
                                │
                         ┌──────┴──────┐
                         │             │
                       React          Rust
                         │             │
                         │      ┌──────┼─────────┐
                         │      │      │         │
                         │    Audio  Hotkeys   Context
                         │      │      │         │
                         └──────┼──────┼─────────┘
                                │
                                ▼
                       Transcription Layer
                                │
                     ┌──────────┴──────────┐
                     │                     │
               Local Whisper              Groq
                     │                     │
                     └──────────┬──────────┘
                                │
                                ▼
                         Raw Transcript
                                │
                                ▼
                        Context Engine
                                │
                                ▼
                    Correction Detection
                                │
                                ▼
                         Cleanup Engine
                                │
                                ▼
                      Smart Format Engine
                                │
                                ▼
                     Verification Engine
                                │
                                ▼
                         Output Engine
                                │
                                ▼
                      Active Application
```

---

# 120. Final Product Definition

Forge Wisper is an open-source desktop application that transforms speech into accurate, structured, useful text.

The product has two primary transcription choices:

```text
LOCAL WHISPER
Private
Offline
User-controlled

GROQ
Fast
Cloud-based
User-controlled
```

Above those engines sits the Forge intelligence layer:

```text
Transcription
       ↓
Context
       ↓
Correction
       ↓
Cleanup
       ↓
Smart Structure
       ↓
Formatting
       ↓
Verification
       ↓
Safe Paste
```

The visual layer is the **Forge Design System**:

```text
Forge Colors
+
Space Grotesk
+
Inter
+
Dark Warm Interface
+
Restrained Motion
+
Compact Desktop UI
+
Consistent Components
```

The result should feel like one coherent product:

> **Forge Wisper takes raw speech and forges it into useful text.**

The application should remain fast, private, transparent, extensible, and genuinely open source.

That is the foundation on which future Forge Wisper versions can add more models, providers, platforms, application integrations, local AI, plugins, and community contributions without rebuilding the core architecture.
