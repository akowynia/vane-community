# Unified Search & Input Panel

This document describes the architecture and the unified interface of the search and message-input panel in Vane.

## 1. Goal and Concept
The goal is to maintain 100% visual and functional consistency across the three key places in the application where the user enters a query:
1. **Home screen (new query)**: `src/components/EmptyChatMessageInput.tsx`
2. **Active chat (continuing a conversation)**: `src/components/MessageInput.tsx`
3. **Waypoint space details (query within a space)**: `src/app/waypoints/[id]/page.tsx`

## 2. Component Layout and Visual Structure

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 🔍 [Search icon]  Type a query... (TextareaAutosize, minRows: 2)            │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│ ⚙️ [Optimization (left)]          [Waypoint] [🌐 Sources] [💻 Model] [📎] [→]│
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.1 Main Container
- **Styling**: `flex flex-col bg-light-secondary/90 dark:bg-[#181513]/90 backdrop-blur-md px-4 pt-4 pb-3 rounded-2xl w-full border border-light-200 dark:border-[#2e2720] shadow-xl shadow-black/25 transition-all duration-200 focus-within:border-light-300 dark:focus-within:border-[#b8864d]/60 dark:focus-within:ring-1 dark:focus-within:ring-[#b8864d]/30`.

### 2.2 Top Row (Text Input)
- **Search icon**: `Search` (`w-5 h-5 mt-1 text-black/40 dark:text-stone-400 shrink-0`).
- **Text field**: `TextareaAutosize` (`minRows={2}`, `className="px-1 py-0.5 bg-transparent placeholder:text-[15px] placeholder:text-black/50 dark:placeholder:text-stone-500 text-sm text-black dark:text-stone-100 resize-none focus:outline-none w-full max-h-24 lg:max-h-36 xl:max-h-48"`).

### 2.3 Bottom Row (Controls and Action Bar)
- **Separator**: `border-t border-light-200/50 dark:border-[#28221b]/70 mt-3 pt-2`.
- **Left side**:
  - `Optimization`: the optimization-mode switch (`speed`, `balanced`, `quality`).
- **Right side**:
  - `WaypointSelector`: selection of / information about the active Waypoint space.
  - `Sources`: selector for search sources (web, academic sources, discussions).
  - `ModelSelector`: LLM model selector and token-usage display.
  - `Attach`: attaching and managing attached files (.pdf, .docx, .txt).
  - **Action button**: a round button (`rounded-full p-2`):
    - Default state: a `#b8864d` to `#d4a373` gradient with an `ArrowRight` icon (`size={17}`).
    - While a response is being generated in an active chat (`loading`): a red button with a `Square` icon (`stopGenerating`, to stop the response).

## 3. Popover Menu Positioning
- **Home screen and the Waypoints subpage**: menus drop down (`position="bottom"`).
- **Active chat (`MessageInput`)**: since the panel sits at the bottom of the screen, all menus open upward (`position="top"`), ensuring full visibility without being clipped by the browser window's edge.
