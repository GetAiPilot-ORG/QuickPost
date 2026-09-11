# 🚀 GAP SocialPilot — Complete Product & Feature Documentation

> **Platform:** GAP SocialPilot (social.getaipilot.in / GetAiPilot Universe)  
> **Target Audience:** Content Creators, Marketing Agencies, E-commerce Brands, and Growth Marketers.  
> **Official Integration:** Meta Graph API (Instagram & Facebook), YouTube Data API v3, LinkedIn API, Reddit API, Bluesky Firehose.

---

## 📑 Table of Contents
1. [Platform Overview & Architecture](#1-platform-overview--architecture)
2. [Core Modules & Where to Find Them](#2-core-modules--where-to-find-them)
3. [AutoDM & Instagram Automation Suite](#3-autodm--instagram-automation-suite)
4. [Multi-Channel Social Publishing & Composer](#4-multi-channel-social-publishing--composer)
5. [Trend/Inspiration Feed & AI Ideation](#5-trendinspiration-feed--ai-ideation)
6. [Social Inbox & Community Management](#6-social-inbox--community-management)
7. [Subscription Plans, Quotas & Watermark Policy](#7-subscription-plans-quotas--watermark-policy)
8. [Technical Limits, Meta API Guidelines & Restrictions](#8-technical-limits-meta-api-guidelines--restrictions)
9. [Troubleshooting & FAQs](#9-troubleshooting--faqs)

---

## 1. Platform Overview & Architecture

**GAP SocialPilot** is an all-in-one AI-powered Social Media Marketing, Multi-Channel Publishing, and Instagram Auto-DM Conversion Platform. It eliminates manual lead generation by converting Instagram comments and interactions into direct conversions via official Meta Graph APIs, while automating content scheduling across Instagram, Facebook, YouTube, and LinkedIn.

### Key Pillars:
- **Zero-Ban Risk:** 100% compliant with Meta Graph API & OAuth 2.0 (No unofficial scraping/bots).
- **Interactive Multi-Step Conversations:** Quick Reply buttons, interactive cards, and automated sequential flows.
- **Central Hub Sync:** Unified subscription & entitlement sync across the GetAiPilot ecosystem.
- **AI Trend Discovery:** Real-time viral post & idea discovery engine across YouTube, Reddit, and Bluesky.

---

## 2. Core Modules & Deep Page-by-Page Guide

Below is the complete, page-by-page breakdown of every screen in GAP SocialPilot, detailing all features, interactive buttons, navigation routes, and step-by-step usage instructions.

---

### 🖥️ 2.1 Overview Dashboard (`/dashboard`)
*The central command hub for multi-channel publishing health, recent activity, and quick actions.*

* **Where to find:** Left Sidebar ➔ **Dashboard**
* **Key Features & Widgets:**
  - **Quick Stats Bar:** Total broadcasts published, scheduled queue items, connected channel health, and overall publish success rate.
  - **Connected Account Status:** Real-time badge indicators for Instagram, Facebook, YouTube, and LinkedIn tokens.
  - **Recent Broadcasts Feed:** List of recently published and scheduled posts with live status (`Published`, `Queued`, `Failed`).
* **Buttons & Routes:**
  - `+ Create Post` *(Top Right Header)* ➔ Opens the global **Composer Modal** to schedule or publish across channels.
  - `Connect Account` ➔ Routes to `/dashboard/connect` to link new social profiles.
  - `View Scheduled Queue` ➔ Routes to `/dashboard/queue` to inspect the visual calendar.
  - `Retry Broadcast` *(On failed posts)* ➔ Re-triggers the background publishing worker.

---

### ⚡ 2.2 AutoDM Home & Metrics (`/dashboard/auto-dm`)
*The analytics cockpit for Instagram automated messaging, conversion velocity, and quick automation setup.*

* **Where to find:** Left Sidebar ➔ **AutoDM**
* **Key Features & Widgets:**
  - **Account Selector Dropdown:** Switch between multiple connected Instagram accounts.
  - **Metrics Overview Cards:**
    - **Messages Sent:** Total automated DMs delivered.
    - **Messages Seen:** Total messages opened/read by recipients.
    - **Total Clicks:** Total button clicks and quick-reply taps recorded.
    - **Followers Gained:** Net new followers converted via the Instagram Follow Gate.
  - **Date Range Selector:** Toggle analytics between `Last 7 days`, `Last 30 days`, and `Last 90 days`.
  - **Recent Automations Card:** Displays top active automations with live status indicators.
  - **Getting Started Guide:** 3-step interactive onboarding card verifying official Meta Graph API connection.
* **Buttons & Routes:**
  - `+ Create New` *(Header)* ➔ Routes to `/dashboard/auto-dm/automations/new` (blank editor).
  - **Quick Action Cards:**
    - `Auto DM from Comments` ➔ Routes to `/dashboard/auto-dm/automations/new?trigger=comment_on_post`
    - `Grow Followers` ➔ Routes to `/dashboard/auto-dm/automations/new?trigger=dm_received`
    - `Generate Leads` ➔ Routes to `/dashboard/auto-dm/automations/new?type=lead`
    - `Auto-reply DMs` ➔ Routes to `/dashboard/auto-dm/automations/new?trigger=dm_received`
  - `Automation Item Row` ➔ Routes directly to `/dashboard/auto-dm/automations/:id` for editing.

---

### ⚙️ 2.3 Automations Management List (`/dashboard/auto-dm/automations`)
*Manage, filter, toggle, and analyze all active and paused Instagram automations.*

* **Where to find:** AutoDM Sidebar ➔ **Automations** (or `/dashboard/auto-dm/automations`)
* **Key Features:**
  - **Search & Filter Bar:** Search automations by name or keyword. Filter by `All`, `Active`, `Inactive`, `Post Triggers`, or `DM Triggers`.
  - **Automation Row Items:** Displays automation title, trigger icon, active keywords, executions count, click-through rate, and updated timestamp.
* **Buttons & Actions:**
  - `+ New Automation` ➔ Routes to `/dashboard/auto-dm/automations/new`.
  - `Status Toggle Switch` *(On each row)* ➔ Instantly activates or pauses the automation in real-time.
  - `Edit (Pencil Icon)` ➔ Routes to `/dashboard/auto-dm/automations/:id`.
  - `Analytics (Chart Icon)` ➔ Opens the detailed performance drawer with delivery logs and drop-off rates.
  - `Delete (Trash Icon)` ➔ Prompts confirmation modal to permanently delete the automation.

---

### 🎨 2.4 Automation Editor (`/dashboard/auto-dm/automations/new` & `/:id`)
*The visual builder for configuring Comment-to-DM triggers, follow gates, opening messages, and interactive response flows with live phone preview.*

* **Where to find:** Automations list ➔ Click any automation or `+ New Automation`.
* **Editor Sections (Left Panel):**
  1. **Automation Title & Active Switch:** Rename automation and toggle live state.
  2. **Step 1: When someone comments:**
     - **Trigger Source:** Select *All Posts/Reels* or choose *Specific Post* (opens post selector modal).
     - **Trigger Keywords:** Type keyword + click `+ Add` or hit Enter. Suggestion pills (`+ link`, `+ info`, `+ price`, `+ send`, `+ yes`) appear when empty and hide automatically once keywords are added.
     - **Case Sensitive Matching:** Toggle for strict uppercase/lowercase matching.
     - **Any Word Trigger:** Option to trigger on every single incoming comment.
  3. **Step 2: Publicly reply to them:**
     - Enable toggle + enter public comment reply text (e.g., *"Sent you the details in DM! ✨"*).
  4. **Step 3: Instagram Follow Gate:**
     - **Only send DM if they follow:** Toggle ON to require user to follow your account first.
     - **Fallback Comment Reply:** Text sent to non-followers (e.g., *"Please follow our account to receive the link!"*).
  5. **Step 4: They will get (Interactive Response Flow):**
     - **Card 1: Opening DM (Optional):** Sends an initial message with a button (e.g., *"Click below for details"* ➔ Button: *"Send me the link"*).
     - **Card 2: Response Flow Builder:** Configure the payload delivered when the user interacts:
       - **Text Message:** Formatted message with links and AI prompts.
       - **Generic Template Cards:** Card with title, subtitle, image upload, and web URL buttons.
       - **Quick Reply Branches:** Interactive button choices for multi-step DM flows.
* **Live Phone Preview (Right Panel):**
  - Interactive Instagram UI simulation showing exact comment reply bubble and private DM view with clickable buttons.
* **Buttons & Actions:**
  - `Save Automation` *(Bottom/Top)* ➔ Persists settings to Supabase and enables the webhook listener.
  - `Cancel / Back` ➔ Returns to `/dashboard/auto-dm/automations`.

---

### 👥 2.5 Contacts CRM (`/dashboard/auto-dm/contacts`)
*Your automated audience database capturing every lead, commenter, and message recipient.*

* **Where to find:** AutoDM Sidebar ➔ **Contacts** (or `/dashboard/auto-dm/contacts`)
* **Key Features:**
  - **Audience Metrics:** Displays Total Contacts Captured, Total Outbound DMs, and Total Inbound Messages.
  - **Search & Filter:** Search by Instagram username or display name.
  - **Contacts Table:**
    - Profile Avatar & Username.
    - Follower Status Badge (`Following You` / `Not Following`).
    - Total Messages Sent & Received.
    - Last Interaction Timestamp.
  - **Contact Detail Drawer:** Clicking any contact opens a slide-over panel displaying:
    - User profile metadata & follower count.
    - Complete chronological chat log (inbound comments, outbound DMs, button clicks).
* **Buttons & Actions:**
  - `Export CSV` *(Top Right)* ➔ Downloads full contact directory with email/lead metadata for marketing campaigns.
  - `View Messages` ➔ Opens the chat history drawer.

---

### ✍️ 2.6 Multi-Channel Composer Modal (`+ Create Post`)
*Create, format, AI-enhance, and broadcast content simultaneously to Instagram, Facebook, YouTube, and LinkedIn.*

* **Where to find:** Top navigation bar ➔ Click **+ Create Post** button from any page.
* **Key Features & Controls:**
  1. **Platform Selector Checkboxes:** Select target destinations (`Instagram`, `Facebook`, `YouTube`, `LinkedIn`).
  2. **Post Type Selector (Instagram):** Toggle between **Feed Post** (`1:1` or `4:5`), **Reel** (`9:16`), **Carousel** (multi-media), or **Story** (`9:16`).
  3. **Media Uploader:** Drag & drop photos/videos, paste public URL, or upload from local storage (hosted on high-speed CDN/Cloudinary).
  4. **Smart Sizing Engine:** Live preview showing aspect ratio compliance with automatic crop guidance.
  5. **Caption Editor:**
     - AI Caption Generator / Enhancer.
     - Emoji picker & Hashtag counter.
  6. **AutoDM Setup Panel (Accordion):** Attach an AutoDM automation directly to the post being published without navigating away!
* **Buttons & Actions:**
  - `Publish Now` ➔ Immediately dispatches the post to Meta Graph API / YouTube API.
  - `Schedule Post` ➔ Opens date & time timezone picker to queue for automated publishing.
  - `Cancel (X)` ➔ Closes modal.

---

### 📅 2.7 Scheduled Queue & Broadcast Calendar (`/dashboard/queue`)
*View, edit, reschedule, or cancel all scheduled social media broadcasts.*

* **Where to find:** Left Sidebar ➔ **Queue** (or `/dashboard/queue`)
* **Key Features:**
  - **View Modes:** Toggle between **Calendar View** (monthly/weekly grid) and **List View** (chronological queue).
  - **Platform Filters:** Filter by Instagram, Facebook, YouTube, or LinkedIn.
  - **Status Filters:** `Scheduled`, `In Progress`, `Published`, `Failed`.
* **Buttons & Actions:**
  - `Edit Broadcast` ➔ Re-opens Composer with prefilled media and caption.
  - `Reschedule` ➔ Changes scheduled publishing timestamp.
  - `Delete / Cancel` ➔ Removes item from the background publishing queue.

---

### 💡 2.8 Trend/Inspiration Feed (`/dashboard/trends`)
*Viral content ideation engine pulling real-time trending content from YouTube, Reddit, and Bluesky.*

* **Where to find:** Left Sidebar ➔ **Trend Feed** (or `/dashboard/trends`)
* **Key Features:**
  - **Source Tabs:** Toggle between `All Sources`, `YouTube Trending`, `Reddit Viral`, and `Bluesky Firehose`.
  - **Niche Filter Pills:** Filter trends by `Tech`, `AI & SaaS`, `Marketing`, `Finance`, `Design`, `Fitness`, and `Lifestyle`.
  - **Masonry Card Grid:** Infinite-scroll feed showing thumbnails, video previews, upvotes/view velocity, author, and niche tags.
* **Buttons & Actions:**
  - `Remix Idea (Sparkle Icon)` ➔ Sends the trending hook/topic to Claude/AI to generate a fresh script & automatically opens the Composer Modal.
  - `Open Source (External Link)` ➔ Opens the original YouTube video, Reddit thread, or Bluesky post in a new tab.

---

### 💬 2.9 Social Inbox (`/dashboard/inbox`)
*Unified real-time inbox for managing Instagram DMs and comment conversations.*

* **Where to find:** Left Sidebar ➔ **Inbox** (or `/dashboard/inbox`)
* **Key Features:**
  - **Left Pane:** Conversation list with search, unread count badges, and filter by `All`, `DMs`, or `Comments`.
  - **Center Pane:** Chat history stream with message status indicators (`Sent`, `Delivered`, `Read`) and timestamps.
  - **Right Pane:** Contact profile sidebar with follower status, CRM tags, and automation triggers history.
* **Buttons & Actions:**
  - `Send Message` *(Textarea + Send button)* ➔ Sends manual reply via official Meta Send API.
  - `Quick Responses / Canned Templates` ➔ Insert pre-saved reply snippets.

---

### 🔗 2.10 Account Connections (`/dashboard/connect`)
*Manage OAuth credentials and linked social media profiles.*

* **Where to find:** Left Sidebar ➔ **Settings / Accounts** (or `/dashboard/connect`)
* **Key Features:**
  - Account cards for **Instagram Business / Creator**, **Facebook Pages**, **YouTube Channels**, and **LinkedIn Profiles**.
  - Connection status badge (`Active`, `Needs Reconnect`, `Expired`).
* **Buttons & Actions:**
  - `Connect Instagram / Facebook` ➔ Redirects to Meta OAuth login & permission grant.
  - `Connect YouTube` ➔ Redirects to Google OAuth consent screen.
  - `Select Accounts Page` (`/dashboard/connect/select-accounts`) ➔ Choose specific Facebook Pages and linked Instagram accounts to import.
  - `Sync / Refresh Token` ➔ Refreshes account token and updates follower counters.
  - `Disconnect` ➔ Safely unlinks profile and purges access tokens.

---

### 💳 2.11 Billing & Plan Hub (`/dashboard/billing`)
*Check plan entitlements, quota consumption, and upgrade options.*

* **Where to find:** Left Sidebar ➔ **Billing** (or `/dashboard/billing`)
* **Key Features:**
  - **Current Plan Card:** Displays active tier (`Free`, `Starter`, `Growth`, `Custom Bundle`), status, and renewal date.
  - **Quota Progress Bars:**
    - Automated DMs sent this billing period vs limit.
    - Connected accounts used vs capacity.
  - **Plan Comparison Matrix:** Visual breakdown of features across all tiers.
* **Buttons & Actions:**
  - `Upgrade Plan / Manage Subscription` ➔ Redirects to Central Hub (`getaipilot.in`) checkout and billing portal.
  - `Sync Subscription` ➔ Re-fetches active entitlements from Central Hub database.

---

## 3. AutoDM & Instagram Automation Suite — Master Guided Tour

Welcome to the **AutoDM Master Tour**! This guide walks you through building, launching, and mastering your high-converting Instagram Comment-to-DM funnels.

---

### 🔹 3.1 Comment-to-DM Automations: Step-by-Step Guided Tour

Instead of telling your followers *"Link in bio"* (which has huge drop-off rates and kills post reach), AutoDM converts every single commenter into an active DM subscriber, follower, and paying customer directly inside Instagram DMs.

#### 🚶 Step 1: Navigating to the Builder
1. Log in to your SocialPilot dashboard.
2. From the left sidebar, click **AutoDM** ➔ **Automations** (or click `+ Create New` from `/dashboard/auto-dm`).
3. Click the prominent black **`+ New Automation`** button in the top-right corner.
4. At the top of the editor, give your automation a memorable name (e.g., *"Viral Reel — AI Masterclass Link"*).

---

#### 🎯 Step 2: Choosing Your Trigger Scope (Section 1)
*Decide where this automation should listen for comments.*

* **Option A: All Posts & Reels (Evergreen Funnel)**
  - Select this if you want the automation to listen across your entire profile (past posts, future reels, and new broadcasts).
  - *Best for:* Universal trigger keywords like `help`, `pricing`, `demo`, or `start`.
* **Option B: A Specific Post or Reel (Campaign Funnel)**
  - Click **"Select a specific post"** to open the Instagram Media Selector modal.
  - Choose the exact post or reel you want to attach this automation to.
  - *Best for:* Reel call-to-actions (e.g., *"Comment PROMPT below and I'll DM you the template!"*).

---

#### 🔤 Step 3: Setting Trigger Keywords & Matching Rules
*Define the magic words that trigger the automated DM sequence.*

1. **Specific Word(s) Mode:**
   - Type your desired keyword (e.g., `link`) into the input box and click **`+ Add`** or press Enter.
   - You can add multiple keywords (e.g., `link`, `prompt`, `send`, `send me`, `guide`).
   - **Smart UX:** Quick suggestion pills (`+ link`, `+ info`, `+ price`, `+ send`, `+ yes`) appear when the input is empty and automatically hide once keywords are added.
2. **Case-Sensitive Matching (Toggle):**
   - **Disabled (Recommended):** `link`, `Link`, and `LINK` will all trigger the automation.
   - **Enabled:** Only the exact uppercase/lowercase combination triggers it.
3. **Any Word / Comment Mode:**
   - Enable this if you want *every single comment* on the post to receive a DM regardless of what they wrote.

---

#### 💬 Step 4: Configuring the Public Comment Reply (Section 2)
*Boost post engagement in the Instagram algorithm while letting the user know their DM has arrived.*

1. Toggle **"Enable public reply"** to ON.
2. Enter your friendly public reply (e.g., *"Sent you the full details in DM! Check your inbox ✨"*).
3. **Why this matters:** When your account quickly replies to comments, Instagram's algorithm interprets the post as high-engagement, pushing it to the Explore page and Reels feed.

---

#### 🔒 Step 5: Setting Up the Instagram Follow Gate (Section 3)
*Turn viral commenters into permanent followers before giving away your value.*

1. Toggle **"Only send DM if they follow"** to ON.
2. **How the system handles it automatically:**
   - **If the user already follows you:** They instantly receive the private DM sequence.
   - **If the user is NOT following you:** The system stops the private DM and posts a public comment reply:
     > *"Please follow our account to receive the link! Once followed, comment again to get instant access."*
   - Once they hit **Follow** and interact, the system auto-qualifies them and records **+1 Follower Gained** in your metrics.

---

#### 💌 Step 6: Crafting the Two-Step DM Response Flow (Section 4)
*The heart of your automation — delivering rich value with maximum engagement.*

##### 🅰️ Step 4.1: The Opening DM (Recommended)
*Sends a lightweight initial confirmation message with a button before delivering the heavy payload.*

1. Toggle **"Opening DM"** to ON.
2. Enter the **Opening Message**:
   > *"Hey there! Thanks so much for your interest ✨ Click below and I'll send you the details right away."*
3. Enter the **Button Title**:
   > `Send me the link` (or `Get Free Guide`, `View Pricing`).
4. **Why use Opening DM?** It prompts the user to tap a native Meta Quick-Reply button, which officially opens a high-priority 24-hour interaction session and guarantees delivery.

##### 🅱️ Step 4.2: After They Tap the Button (The Response Payload)
*Configure what is delivered after the button click (or sent immediately if Opening DM is toggled off).*

* **Payload Type 1: Rich Text Message**
  - Enter formatted text, bullet points, and hyperlinks.
  - **Auto-Chunking Safeguard:** If your prompt/guide exceeds Meta's 1,000 character limit, SocialPilot automatically splits the text at natural paragraph breaks (< 950 chars) and sends multiple sequential bubbles seamlessly.
* **Payload Type 2: Generic Template Cards (Visual Carousels)**
  - Add an Image URL, Card Title, Subtitle, and Web URL Buttons (e.g., `[Visit Website]`, `[Book a Call]`).
  - Users can click the button to navigate directly to your checkout or landing page inside Instagram's in-app browser.
* **Payload Type 3: Multi-Step Quick Reply Branches**
  - Add interactive decision buttons (e.g., `[Beginner]`, `[Advanced]`, `[Agency Owner]`) to route users to tailored follow-up messages.

---

#### 📱 Step 7: Checking the Live Phone Preview & Saving
1. Observe the **Live Phone Preview** on the right side of the screen.
2. Verify that your comment bubble, opening DM button, and response card layout look pixel-perfect.
3. Click the black **`Save Automation`** button at the bottom of the page.
4. Ensure the **Active Switch** is turned ON. Your automation is now live on Instagram!

---

#### 🧪 Step 8: Live Testing Protocol (How to Test Properly)
*Follow these testing rules to avoid false alarms:*

1. **DO NOT test from your own Instagram page:** Meta Webhooks deliberately ignore comments made by the page owner on their own post to prevent infinite loops.
2. **Use a Personal / Secondary Account:** Open Instagram on a separate account or ask a friend/teammate to comment your keyword on the post.
3. **Verify App Permissions:** Ensure Instagram Mobile App ➔ *Settings* ➔ *Privacy / Messages* ➔ *Message Controls* ➔ **"Allow access to messages"** is toggled ON.
4. **Inspect the Result:**
   - The test account should receive the public comment reply and the instant DM.
   - Check `/dashboard/auto-dm` ➔ **Messages Sent** and **Total Clicks** will increment in real-time.
   - Check `/dashboard/auto-dm/contacts` ➔ The test user's profile and chat log will be saved in your CRM.

---

#### 🏆 High-Converting AutoDM Playbooks & Templates

| Use Case | Recommended Keyword | Opening DM Button | Response Payload |
| :--- | :--- | :--- | :--- |
| **Lead Magnet / PDF Guide** | `guide`, `pdf`, `send` | `[Download PDF Guide]` | Generic Card with thumbnail + direct Google Drive / Website link button. |
| **AI Prompts & Code Snippets** | `prompt`, `code`, `workflow` | `[Send me the prompt]` | Rich Text message formatted with bullet points (auto-chunked if > 1,000 chars). |
| **E-commerce Discount Code** | `discount`, `deal`, `coupon` | `[Claim 20% Off]` | Generic Card with product photo + `[Shop Now]` button with UTM tracking URL. |
| **Course / Webinar Registration** | `masterclass`, `join`, `webinar` | `[Save My Seat]` | Rich Text summary of event date/time + `[Register Free]` link button. |

---

### 🔹 3.2 Contacts CRM & Lead Capturing: Master Guide

Your Instagram audience is no longer just anonymous usernames scrolling past your posts. **Contacts CRM** (`/dashboard/auto-dm/contacts`) automatically captures, enriches, and organizes every single person who interacts with your automations into a searchable, exportable lead pipeline.

---

#### 🌟 1. Automatic Zero-Setup Lead Capture
Whenever an Instagram user:
- Comments a trigger keyword on your Post or Reel,
- Taps a button inside your Opening DM, or
- Sends a direct message to your Instagram account,

The system **instantly creates or updates their profile** in your CRM database via Meta Graph API without requiring any manual entry.

---

#### 📊 2. Audience Metrics & Dashboard Indicators
At the top of the Contacts page, three real-time counters keep track of your audience scale:
1. **Total Contacts:** Unique Instagram profiles that have engaged with your brand.
2. **Total Outbound DMs:** Total automated and manual messages delivered to your audience.
3. **Total Inbound Messages:** Total comments, button taps, and DM replies received from users.

---

#### 📋 3. Navigating the Contacts Directory
The main table displays your entire contact roster with critical marketing attributes:

* **Profile & Identity:** High-resolution avatar, official Instagram `@username`, and display name.
* **Follower Status Badge:**
  - 🟢 **Following You:** Confirmed active follower (qualified via Meta API).
  - ⚪ **Not Following:** User engaged with your post/DM but hasn't followed your account yet.
* **Engagement Stats:** `X sent • Y received` messages count, showing how active the conversation has been.
* **Last Interaction Timestamp:** Exact relative time (e.g., *"10 minutes ago"*, *"2 days ago"*) since the user last interacted.
* **Live Search Bar:** Instantly filter thousands of contacts by username or name in real-time.

---

#### 🔍 4. The Contact Detail Drawer (Full Chat & Profile History)
Clicking on any contact row opens a **Slide-Over Profile Drawer** on the right side of the screen:

1. **Profile Summary Card:**
   - User's avatar, bio, follower count, and verification status.
   - Direct link to open their live Instagram profile (`instagram.com/username`).
   - Quick copy button for username.
2. **Chronological Message History:**
   - Inspect the entire back-and-forth interaction history.
   - View the original comment that triggered the funnel.
   - See the exact Opening DM delivered, the button tapped by the user, and the response payload received.
   - Message timestamps and delivery status badges (`Sent`, `Delivered`, `Read`).
3. **Automation Attribution:**
   - Identifies which specific campaign (e.g., *"Viral Reel — AI Masterclass Link"*) acquired this lead.

---

#### 📥 5. 1-Click CSV Export for Marketing & Sales
Turn your Instagram interactions into actionable marketing lists:

1. Click the black **`Export CSV`** button in the top-right corner of the Contacts screen.
2. The system instantly compiles and downloads a formatted `.csv` file containing:
   - `username`: Instagram handle.
   - `full_name`: User's display name.
   - `follower_count`: Audience size of the lead.
   - `is_following_you`: Boolean flag (`true`/`false`).
   - `total_messages_sent`: Total touchpoints sent.
   - `total_messages_received`: Total replies from user.
   - `last_interaction_at`: ISO timestamp.
3. **How to use your exported leads:**
   - Import into Google Sheets or Notion for sales team outreach.
   - Upload to Meta Ads Manager for **Custom Audience Retargeting** & Lookalike Audiences.
   - Sync with email marketing tools (HubSpot, Mailchimp, Klaviyo, Brevo).

---

#### 💡 6. Best Practices for Lead Conversion
- **Identify Hot Leads:** Filter for contacts with high `total_messages_received` — these are users actively clicking your buttons and engaging with your content.
- **The 24-Hour Rule:** Meta allows free-form messaging within 24 hours of user engagement. Check your contacts daily and use the Social Inbox (`/dashboard/inbox`) to send personalized 1-on-1 closing messages to high-intent leads!

---

## 4. Multi-Channel Social Publishing & Composer — Master Guide

The **GAP SocialPilot Composer** (`+ Create Post`) is an enterprise-grade social media publishing engine. It allows creators and marketing teams to craft, format, AI-enhance, and broadcast high-resolution media across Instagram, Facebook, YouTube, and LinkedIn in one unified workflow.

---

### 🚀 4.1 How to Open & Navigate the Composer
1. Click the prominent black **`+ Create Post`** button located in the top navigation bar from any screen.
2. The full-screen/modal Composer will open, divided into three key work areas:
   - **Left / Center Column:** Platform selector, Media uploader, Caption editor, and AutoDM attachment panel.
   - **Right Column:** Live Multi-Platform Device Preview (real-time simulation of how the post appears in Instagram Feed/Reels, Facebook Feed, YouTube, and LinkedIn).
   - **Bottom Bar:** Quick suggestions, character counter, scheduling calendar, and `Publish Now` dispatch button.

---

### 🌐 4.2 Supported Platforms & Post Types

#### 📸 1. Instagram Publishing
* **Feed Posts (Single Photo & Album):**
  - Standard square (`1:1` / `1080x1080px`) or vertical portrait (`4:5` / `1080x1350px`).
  - Supports high-resolution JPG/PNG images up to 8MB.
* **Instagram Reels (Vertical Video):**
  - Full-screen `9:16` vertical video (`1080x1920px`).
  - Includes custom caption, cover photo extraction, and automatic container processing.
* **Instagram Carousels (Multi-Image & Multi-Video):**
  - Upload 2 to 10 photos/videos in a single swipeable post.
  - Drag-and-drop reordering with thumbnail preview.
* **Instagram Stories (24-Hour Ephemeral):**
  - Full-screen `9:16` vertical photos/videos published directly to your Instagram Story.
* **Direct AutoDM Attachment:**
  - Toggle the **Auto DM Setup** accordion to automatically attach a Comment-to-DM trigger directly to this new post without going to the AutoDM tab!

#### 📘 2. Facebook Page Publishing
* **Feed Updates:** Text posts with rich link previews.
* **Photo Posts:** Single and multi-photo uploads attached to your official Facebook Page.
* **Page Video Posts:** Native Facebook video uploads with title and description.

#### 🎥 3. YouTube Manager & Shorts
* **YouTube Shorts:** Vertical `9:16` videos under 60 seconds automatically detected and published as Shorts.
* **Long-Form Videos:** High-definition video publishing with video title, description, privacy status (`Public`, `Unlisted`, `Private`), and tags.

#### 💼 4. LinkedIn Publishing
* **Company & Personal Profile Posts:** Professional updates with formatting and hashtags.
* **Rich Media:** Single image and document post attachments.

---

### 🎨 4.3 Key Composer Features & Tools

#### 🧠 1. Smart Sizing Engine & Aspect Ratio Presets
Different platforms require different media dimensions. The Smart Sizing Engine automatically detects media aspect ratios and offers 1-click layout adjustments:
* `1:1 Square` (Instagram Feed, Facebook, LinkedIn)
* `4:5 Vertical Portrait` (Instagram Feed optimal engagement)
* `9:16 Full Screen Vertical` (Instagram Reels, Stories, YouTube Shorts)
* `16:9 Widescreen` (YouTube Long-form, Facebook Videos)

#### ✨ 2. AI Caption Enhancer & Hashtag Generator
* **AI Enhance:** Click the Sparkle icon (`Sparkles`) to rewrite your draft caption into high-converting copy, add bullet points, or generate engaging hooks.
* **Hashtag Suggestions:** 1-click insert curated high-traffic hashtags (`#productivity`, `#marketing`, `#growth`, `#creator`).
* **Emoji Picker & Quick Phrases:** Access instant trending hooks (*"Insights from the week 📈"*, *"Building something special..."*).

#### ⚡ 3. Direct AutoDM Setup Inside Composer
While creating your Instagram post, expand the **Auto DM Setup** accordion:
1. Toggle **Auto DM Setup** ON.
2. Enter your trigger keyword(s) (e.g., `link`).
3. Set your public comment reply (e.g., *"Sent you the details in DM!"*).
4. Configure your Opening DM button and response payload card.
5. When the post is published, the automation is **automatically linked to the published Instagram media ID** in real-time!

---

### ⏰ 4.4 Publishing vs Scheduling Workflow

* **Option A: Instant Publishing (`Publish Now`)**
  - Dispatches media immediately to Meta Graph API / YouTube API.
  - Video processing status is monitored with automatic container polling until the post is live.
* **Option B: Automated Scheduling (`Schedule Post`)**
  - Click the **Calendar icon** in the footer.
  - Select your desired date and exact publishing time using the interactive analog/digital clock selector.
  - Choose your timezone.
  - Click **Schedule** — your post is safely queued in the backend worker (`/dashboard/queue`).

---

### ⚠️ 4.5 Technical Limits, File Specifications & Restrictions

| Platform | Format / Type | Max File Size | Aspect Ratio | Max Video Length | Caption Limit |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Instagram Feed** | JPG, PNG | 8 MB | `1:1` to `4:5` | N/A | 2,200 chars / 30 hashtags |
| **Instagram Reels** | MP4, MOV (H.264, AAC) | 100 MB (via API) | `9:16` (1080x1920) | 15 mins (optimal: 3-90s) | 2,200 chars |
| **Instagram Carousel** | Mixed (2–10 items) | 8 MB / image, 100 MB / video | Consistent across items | Up to 60s per video slide | 2,200 chars |
| **Instagram Story** | JPG, PNG, MP4 | 8 MB / image, 100 MB / video | `9:16` strictly | Up to 60s | N/A |
| **Facebook Pages** | JPG, PNG, MP4 | 10 MB / image, 500 MB / video | Flexible (`16:9`, `1:1`, `4:5`) | Up to 240 mins | 63,206 chars |
| **YouTube Shorts** | MP4, MOV | 256 GB (or quota max) | `9:16` (1080x1920) | ≤ 60 seconds | Title: 100 chars, Desc: 5k |
| **YouTube Videos** | MP4, MOV | 256 GB (or quota max) | `16:9` (1920x1080 / 4K) | Up to 12 hours | Title: 100 chars, Desc: 5k |
| **LinkedIn** | JPG, PNG, MP4 | 5 MB / image, 200 MB / video | `1:1`, `16:9` | Up to 10 mins | 3,000 chars |

---

### 🛡️ 4.6 Important Publishing Rules & Error Prevention
1. **Publicly Accessible Media URLs:** Meta Graph API requires all media files (photos, videos, story assets) to be hosted on publicly accessible HTTPS URLs (hosted automatically via Cloudinary/Supabase CDN). Localhost paths cannot be ingested by Meta.
2. **Video Polling & Container Processing:** When publishing Instagram Reels or Carousels, Meta needs 5–30 seconds to encode video containers. SocialPilot handles polling and retries automatically before publishing the container to prevent *"Media ID not ready"* errors.
3. **Token Expiration / Disconnection:** If your Facebook/Instagram access token expires, the dashboard will flag a `Needs Reconnect` banner. Simply click **Refresh Token** in `/dashboard/connect` to restore publishing rights.

---

## 5. Trend/Inspiration Feed & AI Ideation — Master Guide

Never run out of content ideas or wonder what topic will perform best. The **Trend & Inspiration Feed** (`/dashboard/trends`) is a Pinterest-style infinite-scroll viral discovery engine that aggregates real-time trending content from YouTube, Reddit, and Bluesky, paired with 1-click AI content remixing.

---

### 🌟 5.1 The Multi-Platform Trend Ingestion Pipeline

The Trend Engine monitors top social platforms continuously to surface posts experiencing high velocity and engagement:

1. **YouTube Data API v3 (`chart=mostPopular`):**
   - Ingests top trending videos, Shorts, and viral tutorials across tech, business, marketing, AI, and design.
   - Tracks real-time view counts, like velocity, and creator channels.
2. **Reddit Viral Stream:**
   - Monitors top discussion threads from leading subreddits (e.g., `r/technology`, `r/artificial`, `r/entrepreneur`, `r/marketing`, `r/webdev`).
   - Surfaces high-upvote problem-solving discussions and trending community questions.
3. **Bluesky Firehose:**
   - Real-time WebSocket firehose consumer capturing trending micro-posts and early breaking tech news.

---

### 🧠 5.2 The Freshness & Ranking Algorithm
* **Never Repeats:** Uses per-user `seen_post_ids` tracking in Redis / Supabase Postgres so you always discover fresh ideas on every scroll session.
* **Velocity Score:** Ranked by `recency_decay × engagement_velocity` ensuring only genuinely viral topics surface.
* **Official Safe Embeds:** Uses official player embeds and source thumbnails with full creator attribution — zero copyright or rehosting risks.

---

### 🎨 5.3 Navigating the Trend Feed UI

* **Where to find:** Left Sidebar ➔ **Trend Feed** (or `/dashboard/trends`)
* **Platform Filter Tabs:**
  - `All Sources` ➔ Unified stream blending YouTube, Reddit, and Bluesky.
  - `YouTube` ➔ Filter exclusively for video thumbnails, Shorts, and video hooks.
  - `Reddit` ➔ Filter for viral questions, discussion threads, and case studies.
  - `Bluesky` ➔ Filter for quick text insights and tech commentary.
* **Niche Category Selector:**
  - `Tech & SaaS`, `AI & Automation`, `Marketing & Growth`, `Finance & Business`, `Design & Creative`, `Fitness & Health`, `Lifestyle`.

---

### ✨ 5.4 The "1-Click Remix" AI Workflow
*Turn any viral trend into your own original social post in under 10 seconds:*

1. Scroll the feed and find an engaging topic or high-performing hook.
2. Hover over the trend card and click the **`Remix Idea` (Sparkle Icon)** button.
3. **What happens under the hood:**
   - SocialPilot's AI Engine extracts the core hook, angle, and takeaways from the source post.
   - Claude / OpenAI generates a customized script, carousel outline, or Instagram caption tailored to your brand voice.
   - The **Composer Modal** opens automatically with the newly generated caption, formatted bullet points, and hashtag suggestions prefilled!
4. Customize your text, upload your visual asset, and click **Publish Now** or **Schedule Post**.

---

### 🔗 5.5 "Open Original" Deep-Dive
- Click the **`View Original`** button on any card to open the live YouTube video, Reddit thread, or Bluesky post in a new browser tab to read community comments and gather deeper insights.

---

### ⚠️ 5.6 Trend Feed Limits & Policies
1. **YouTube Daily Quotas:** YouTube Data API enforces a 10,000 unit/day project quota. The background cron worker polls intelligently during peak creator hours to preserve quota.
2. **Reddit Free Tier Compliance:** Complies strictly with Reddit Non-Commercial API terms (no bulk data scraping or redistribution).
3. **AI Tagging:** Posts are auto-classified by niche and format using Claude API for precise category filtering.

---

## 6. Social Inbox & Community Management — Master Guide

Managing comments and direct messages across multiple viral posts can quickly become overwhelming. The **Social Inbox** (`/dashboard/inbox`) is a centralized, real-time engagement workstation powered by official Meta Webhooks, Server-Sent Events (SSE), and Supabase Realtime.

---

### 📥 6.1 Real-Time 3-Pane Architecture

* **Where to find:** Left Sidebar ➔ **Inbox** (or `/dashboard/inbox`)

```
┌───────────────────────────┬────────────────────────────────────┬────────────────────────────┐
│ 1. Conversations Sidebar  │ 2. Active Chat & Message Stream   │ 3. Contact Context Drawer  │
│ ───────────────────────── │ ────────────────────────────────── │ ────────────────────────── │
│ • Search by @username     │ • Inbound & Outbound bubbles       │ • High-res Instagram Avatar│
│ • Tabs: All | DMs | Post  │ • Sent / Delivered / Read receipts │ • Follower status badge    │
│ • Unread message counter  │ • Quick Template / Canned Picker   │ • Total lifetime DMs       │
│ • AutoDM activity badges  │ • Manual Meta API Reply Textarea   │ • Associated automations   │
└───────────────────────────┴────────────────────────────────────┴────────────────────────────┘
```

---

### 💬 6.2 Key Features & Workflows

#### 1. Unified Message Stream
- **Direct Messages:** Real-time 1-on-1 Instagram conversations.
- **Post Comment Threads:** Inline comment threads from your latest Feed Posts and Reels.
- **AutoDM Badges:** Automatically marks conversations handled by the bot (e.g., `⚡ Auto-Replied`) vs conversations requiring human intervention.

#### 2. Manual 1-on-1 Replies (Official Meta Send API)
- Type your reply directly in the bottom composer and press **Send** (or `Cmd/Ctrl + Enter`).
- Dispatched instantly via Meta Graph API without ever needing to open the Instagram mobile app.

#### 3. Quick Responses / Canned Snippets
- Save frequently used answers (e.g., pricing, refund policy, link to docs) and insert them into chat with 1 click.

---

### ⚠️ 6.3 Inbox Technical Limitations & Meta Rules
1. **The 24-Hour Rule (Standard Messaging Window):** Meta restricts business accounts from sending outbound marketing messages to users who haven't sent a message or comment in the last 24 hours. The inbox displays a warning indicator when the 24-hour window has lapsed.
2. **Human Handover:** When an agent replies manually in the Social Inbox, the system automatically pauses aggressive auto-DM loops for that contact to prevent interrupting human customer service.

---

## 7. Subscription Plans, Quotas & Watermark Policy — Deep Breakdown

GAP SocialPilot operates on a transparent entitlement model fully integrated with the **GetAiPilot Central Hub SSO** ecosystem.

---

### 📊 7.1 Detailed Plan Comparison & Entitlement Matrix

| Feature / Limit | Free Tier | Starter / Lite (`slite`) | Growth / Custom Bundle (`sgrowth`) |
| :--- | :--- | :--- | :--- |
| **Monthly Pricing** | **₹0 / Free Forever** | **₹999 / month** | **₹1,999 / month** (or Custom Bundle) |
| **Connected Social Accounts** | Up to **3 Accounts** | Up to **10 Accounts** | Up to **30 Accounts** |
| **Monthly Auto-DM Replies** | **50 replies / month** | **Unlimited** (1M soft cap) | **Unlimited** (1M soft cap) |
| **Active Automations** | **1 Automation** | **Unlimited** | **Unlimited** |
| **Scheduled Queue Limit** | 10 upcoming posts | **Unlimited** | **Unlimited** |
| **Contact CRM Storage** | 100 Contacts | **Unlimited** | **Unlimited** |
| **Analytics History Retention**| 7 Days | 90 Days | **365 Days** |
| **Watermark in Auto-DMs** | **Mandatory Watermark** | **CLEAN (Zero Watermark)** | **CLEAN (Zero Watermark)** |
| **Multi-Channel Publishing** | Instagram, FB, YouTube | Instagram, FB, YouTube, LinkedIn | Full Multi-Channel + Priority Queue |
| **Team Members / Seats** | 1 User | 1 User | **10 Team Members** |
| **Approval Workflows** | ❌ No | ❌ No | **✅ Included** |
| **API & Webhook Access** | ❌ No | ❌ No | **✅ Included** |
| **Customer Support** | Community / Standard | Priority Email | **24/7 Priority WhatsApp & Dedicated** |

---

### 🏷️ 7.2 Watermark Policy & Removal

* **On the Free Tier:** Every outbound direct message delivered by an automation automatically appends the promotional signature:
  > `⚡ Automation is powered by @Getaipilot`
* **On Paid Tiers (Starter, Growth, Custom Bundle, Enterprise):**
  - The watermark is **100% permanently stripped**.
  - All automated DMs, generic template cards, and interactive flows are delivered under your 100% clean, native brand voice.

---

### 🔄 7.3 Central Hub SSO & Cross-Product Synchronization
- **One Subscription for All Tools:** If you hold an active **Custom Bundle** or **Growth Plan** in the GetAiPilot Central Hub (`getaipilot.in`), your plan is synchronized automatically via real-time database sync (`sync-from-hub`).
- **Instant Plan Refresh:** If you recently upgraded your subscription on the hub, navigate to `/dashboard/billing` and click **`Sync Subscription`** to immediately activate high-tier entitlements without logging out.

---

## 8. Technical Limits, Meta API Guidelines & Restrictions — Master Technical Guide

GAP SocialPilot operates strictly over official platform APIs (Meta Graph API v21.0, YouTube Data API v3, LinkedIn v2 API). Below is the comprehensive technical compliance, rate-limiting, and architecture manual.

---

### 🛡️ 8.1 Zero-Ban Architecture & Anti-Spam Compliance

Most legacy automation bots rely on unofficial browser extensions or illegal private API reverse-engineering, which frequently results in **action blocks, shadowbans, and permanent Instagram account bans**.

**How GAP SocialPilot protects your account:**
1. **100% Official Meta Graph API & OAuth 2.0:** Every message, comment reply, and media container is dispatched through Meta's officially approved developer endpoints.
2. **Webhook Deduplication & Idempotency:** Every incoming event generates a unique `dedupe_key`. If Meta resends a webhook retry, the engine skips duplicate processing to avoid spamming the user.
3. **Smart Exponential Backoff & Jitter:** API calls are throttled with randomized jitter delays (200ms–800ms) to simulate natural human response cadences and prevent sudden spike-traffic flags.
4. **Self-Comment Loop Protection:** The engine filters out comments created by your own Instagram handle (`sender_id === page_id`), preventing infinite automated feedback loops.

---

### ⏱️ 8.2 The Meta 24-Hour Messaging Window Explained

Meta enforces a strict customer-care messaging policy for Instagram Direct:

```
[User Comments on Post / Sends DM] 
             │
             ▼
   [24-Hour Window OPENS] ──────────► Immediate Automated DM Sent ✅
             │                       Interactive Buttons / Opening DM ✅
             │                       Rich Text & Links Delivered ✅
             │
   [24 Hours Pass with No Reply]
             │
             ▼
   [24-Hour Window CLOSES] ─────────► Free-form promotional DMs blocked by Meta ⛔
```

* **Inside the 24-Hour Window:** Your account can deliver automated flows, interactive cards, links, and replies freely.
* **Extending the Window:** Whenever the user taps a button (e.g., `[Send me the link]`) or sends a reply, the 24-hour window **resets for another full 24 hours**.

---

### 📏 8.3 Character Limits & Smart Auto-Chunking Algorithm

* **Meta API Restriction:** Meta enforces a strict maximum length of **1,000 characters per single direct message**. Any single message exceeding 1,000 characters is rejected by Meta with `(#100) Param text exceeds character limit`.
* **The GAP SocialPilot Solution:**
  - The automation engine calculates the character payload length.
  - If length > 950 characters (e.g., comprehensive AI prompts, coding tutorials, or detailed guides), the system executes a **smart tokenizer**:
    1. Splits the content at natural sentence (`.\n\n`) or paragraph boundaries.
    2. Sends Part 1 (< 950 chars).
    3. Introduces a 400ms delay.
    4. Sends Part 2 (< 950 chars) sequentially until complete.
  - The recipient receives a clean, readable multi-bubble message thread without truncation or errors.

---

### 🔑 8.4 Instagram Account Prerequisites & Permissions Checklist

To use AutoDM and Multi-Channel Publishing, ensure your Instagram account meets these 3 mandatory requirements:

1. **Account Type:** Must be an **Instagram Business** or **Instagram Creator** account (Personal profiles do not have Meta Graph API access).
2. **Linked Facebook Page:** Your Instagram account must be linked to an active Facebook Page where you hold Admin access.
3. **Instagram In-App Message Permissions:**
   - Open the Instagram Mobile App on your phone.
   - Go to **Settings and Privacy** ➔ **Messages and story replies** ➔ **Message controls**.
   - Under *Connected tools*, toggle **"Allow access to messages"** to **ON** (Enabled).  
   *(If this toggle is off, Meta will block third-party tools from reading incoming comments and DMs).*

---

### 📊 8.5 Platform Quotas & Rate Limits

| Platform / Service | Rate Limit / Quota | Behavior When Exceeded | System Safeguard |
| :--- | :--- | :--- | :--- |
| **Meta Graph API (Instagram)** | 200 API calls / hour / user | Meta returns `(#32) Page request limit reached` | Auto-queued in Redis worker with delayed retry |
| **Meta Graph API (Facebook)** | 4,800 calls / IP / hour | Temporary 5-minute cooldown | Exponential backoff retry handler |
| **YouTube Data API v3** | 10,000 units / day / project | Video uploads paused until midnight PST | Daily quota optimizer prioritizing peak creator hours |
| **LinkedIn v2 API** | 100 shares / day / profile | API returns HTTP 429 | Queue delays broadcast to next scheduled interval |
| **Cloudinary Media CDN** | High-bandwidth video transcoding | Temporary processing queue | Background polling with fallback CDN routes |

---

## 9. Comprehensive Troubleshooting & FAQs Guide

---

### ❓ Q1: Why didn't my automation reply when I commented on my post?
**Reason:** You tested from the same Instagram account that owns the post.  
**Fix:** Meta Webhooks purposely ignore self-comments to prevent infinite self-reply loops. Always test from a **secondary or personal Instagram account**, or ask a friend/teammate to comment your keyword.

---

### ❓ Q2: I commented from a separate account, but still received no DM. What should I check?
Verify these 3 common configuration checkpoints:
1. **Active Switch:** Check `/dashboard/auto-dm/automations` and ensure your automation has the green **Active toggle ON**.
2. **Message Controls Toggle:** On your phone, open Instagram App ➔ *Settings* ➔ *Privacy / Messages* ➔ *Message Controls* ➔ Ensure **"Allow access to messages"** is toggled **ON**.
3. **Keyword Matching:** If **Case Sensitive Matching** is enabled, commenting `Link` will not trigger a keyword set to `link`. (Keep Case Sensitivity OFF for widest reach).

---

### ❓ Q3: Why is the watermark showing up in my DMs even though I bought a paid plan?
**Reason:** Your SocialPilot session needs an updated subscription sync from the Central Hub.  
**Fix:**
1. Navigate to `/dashboard/billing`.
2. Click the **`Sync Subscription`** button.
3. The system will reconcile your `auth.users` ID with your active Central Hub plan (`Custom Bundle` / `Growth` / `Starter`) and immediately strip the watermark on all future outbound messages.

---

### ❓ Q4: Why did my Instagram Reel / Video upload fail during publishing?
**Common Causes & Fixes:**
1. **Aspect Ratio:** Reels must be strictly vertical `9:16` (`1080x1920px`). Landscape (`16:9`) videos cannot be published as Reels.
2. **File Size:** Video file exceeds Meta's 100MB API upload limit. Compress your video via Handbrake or MP4 optimizer before uploading.
3. **Localhost URLs:** Ensure you are not running offline or using local media paths. All media must be uploaded through the Composer to be hosted on our secure CDN.

---

### ❓ Q5: Can I attach multiple keyword automations to the same Instagram post?
**Yes!** If you create one automation for keyword `link` and another automation for keyword `pricing` on the same post:
- If a user comments *"link"*, Funnel A triggers.
- If a user comments *"pricing"*, Funnel B triggers.
- If a user comments *"link and pricing"*, the engine processes the primary match and queues secondary sequences seamlessly.

---

### ❓ Q6: What happens if an angry or spam user comments 10 times in a row?
**Spam Protection:** SocialPilot's deduplication engine only triggers **1 automated reply sequence per distinct comment thread**. Rapid-fire identical comments within 60 seconds are automatically throttled by the webhook deduplication cache.

---

### ❓ Q7: Can I send clickable links to Telegram, WhatsApp, or external websites in the DM?
**Yes!** You can include external hyperlinks in two ways:
1. **Direct in Text:** Simply paste your URL (e.g., `https://t.me/mychannel` or `https://wa.me/1234567890`). Instagram automatically renders standard HTTPS links as clickable inside DMs.
2. **Web URL Buttons (Generic Template Cards):** Add a button titled `[Join Telegram]` with your destination URL. When tapped, it opens directly in Instagram's in-app browser.

---

### ❓ Q8: How do I reconnect an expired Instagram or Facebook token?
1. Navigate to `/dashboard/connect`.
2. Find the account displaying the red `Needs Reconnect` badge.
3. Click **`Refresh Token`** (or click `Connect Instagram` to re-authorize via Meta OAuth).
4. Select your Facebook Page & Instagram account and confirm permissions. Your tokens are renewed for another 60 days.

---

### ❓ Q9: How do I export my leads into Mailchimp, HubSpot, or Google Sheets?
1. Navigate to `/dashboard/auto-dm/contacts`.
2. Click the black **`Export CSV`** button in the top right.
3. Open the `.csv` file in Microsoft Excel, Google Sheets, or import directly into your email marketing platform / CRM using their standard CSV Import wizard.

---

### ❓ Q10: Is my data secure and compliant with GDPR / Meta Platform Terms?
**Yes.** All credentials and access tokens are encrypted with AES-256 in Supabase Postgres. GAP SocialPilot never stores raw Instagram passwords, never shares lead data with third parties, and is 100% compliant with Meta Platform Terms and Developer Policies.
