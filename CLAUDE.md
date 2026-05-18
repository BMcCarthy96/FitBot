# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npx expo start          # Start dev server (scan QR code for phone)
npx expo start --tunnel # Use tunnel if phone can't reach WSL2 IP directly
npx tsc --noEmit        # Type-check (no test runner, no lint script configured)
```

There are no configured lint or test scripts. TypeScript strict mode is enabled — always run `npx tsc --noEmit` after changes.

**WSL2 note:** The phone cannot reach the WSL2 internal IP (`172.x.x.x`). Use `--tunnel` or set `REACT_NATIVE_PACKAGER_HOSTNAME` to the Windows host IP with a `netsh portproxy` rule.

## Environment

Requires `.env` at the root with:
```
EXPO_PUBLIC_ANTHROPIC_API_KEY=your_key_here
```
The key is read via `process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY` in `src/services/claude.ts`. The `EXPO_PUBLIC_` prefix makes it available in the RN bundle.

## Architecture

**Stack:** Expo SDK 54, React Native 0.81, React 19, TypeScript strict, `@react-navigation` (stack + bottom tabs), `AsyncStorage` for persistence, `@anthropic-ai/sdk` for Claude vision API.

### Navigation (`src/navigation/index.tsx`)
Two-level navigator:
- **Stack** root: `Onboarding` → `MainTabs` → `FoodAnalysis` (modal)
- **Tab** inside `MainTabs`: Home, Progress, Coach, Settings, Camera (Camera tab hidden from bar)
- Custom `CustomTabBar` renders a floating FAB (absolute-positioned above the tab bar at `bottom: 82`) that opens a modal menu for "Snap Meal" (→ Camera) and "Log Weight" (→ `WeightLogModal`).
- Initial route is determined by `prefs.onboarding.completed` on app load; `prefs.isAuthenticated` is checked in `OnboardingScreen` to decide whether to show the auth tabs or go straight to onboarding questions.

### Authentication
`OnboardingScreen` has two tabs — Sign In and Sign Up. Credentials are stored locally in `UserPreferences` (`email`, `passwordHash`). Password hashing uses `crypto.subtle.digest("SHA-256")` with a djb2 fallback for Hermes compatibility:

```ts
async function hashPassword(password: string): Promise<string> {
  try {
    const hash = await (globalThis.crypto ?? crypto).subtle.digest("SHA-256", new TextEncoder().encode(password));
    return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    // djb2 fallback
    let h = 5381;
    for (let i = 0; i < password.length; i++) { h = ((h << 5) + h) ^ password.charCodeAt(i); h >>>= 0; }
    return h.toString(16).padStart(8, "0") + password.length.toString(16);
  }
}
```

This function is duplicated in both `OnboardingScreen.tsx` and `SettingsScreen.tsx` — keep them in sync if changed. "Continue without signing in" calls `AsyncStorage.multiRemove(["food_entries", "weight_entries", "user_preferences"])` before writing fresh prefs, guaranteeing a clean slate.

### Data flow
All persistence goes through `src/services/storage.ts` which wraps `AsyncStorage` with typed helpers. The single `UserPreferences` object (serialized under key `"user_preferences"`) holds everything: goals, streak, notification settings, onboarding data, meal reminder times, `profileTheme`, `email`, `passwordHash`, and `profilePicture`. Food entries are stored separately under `"food_entries"` as `FoodEntry[]`; weight entries under `"weight_entries"` as `WeightEntry[]`.

**Adding new fields to `UserPreferences`**: embed defaults directly in the `DEFAULT_PREFS` constant in `storage.ts`. Every read shallow-merges with defaults, so no migration is needed when new fields are added.

**Streak logic** (in `storage.ts → updateStreak`): called automatically on every `addEntry`. Increments streak if `lastLogDate` was yesterday or null, resets to 1 if a day was skipped, no-ops if the same date is logged again. `setStreakForTesting(days, lastLogDate)` is exported for the Dev Tools section in Settings. New accounts must explicitly set `streakDays: 0, lastLogDate: null` in `savePreferences` to avoid inheriting stale streak data from a previous user.

**Active date** (`src/services/activeDate.ts`): a module-level singleton (`let _date`). `HomeScreen` calls `setActiveDate` on focus and date change; `FoodAnalysisScreen` reads `getActiveDate()` so meals can be logged to a past date the user navigated to.

**Event bus** (`src/services/eventBus.ts`): lightweight pub/sub with two channels — `emitWeightChange()` / `onWeightChange(fn)` used by `WeightLogModal` → `ProgressScreen`, and `emitThemeChange()` / `onThemeChange(fn)` used by `SettingsScreen` → `ThemeContext`. Both return an unsubscribe function; call it in `useEffect` cleanup.

**Healthy food preferences** (`storage.ts → addHealthyPreference`): called automatically inside `addEntry` for every meal logged. Accumulates up to 10 recent healthy preference strings. `analyzeFoodImage()` receives the last 10 so Claude can tailor alternative suggestions to the user's eating pattern.

### AI integration (`src/services/claude.ts`)
Calls `claude-sonnet-4-6` with `dangerouslyAllowBrowser: true` (required for RN). The system prompt is sent with `cache_control: { type: "ephemeral" }` for prompt caching. Response is always raw JSON — strip markdown fences before parsing. Both `analyzeFoodImage` and `chat` use `max_tokens: 1024`; there is no retry logic on failure.

**Metro shim** (`metro.config.js` + `shims/empty.js`): `@anthropic-ai/sdk` imports Node.js built-ins (`node:fs`, `node:net`, etc.) for server-side credential chaining. All are shimmed to an empty object so the bundle doesn't crash in RN.

### Camera pipeline (`src/screens/CameraScreen.tsx`)
Capture (expo-camera) → save to temp file (expo-file-system) → resize/compress (expo-image-manipulator) → base64 encode → navigate to `FoodAnalysis` screen with `{ imageUri, base64 }` params → `analyzeFoodImage(base64)` → display results + edit/save flow.

### Settings screen patterns
**Dirty/save flow**: `dirty` state drives a conditionally rendered Save button (`{dirty && <TouchableOpacity ...>}`). `setDirty(false)` and `showToast()` are called at the top of `save()` before any `await`s so the button disappears and toast appears instantly on tap.

**Toast**: positioned `absolute` at `bottom: 90` (above the tab bar) with `translateY` animation. The resting/hidden value is `150` — enough to push the element completely below the screen. Animates to `0` (visible) then back to `150`. Do not use values smaller than ~120 or the toast will be partially visible at rest.

**Account section**: Email and password are editable in Settings via inline expand/collapse rows. Email saves directly without going through the main `dirty` flow. Password requires confirming the current hash before accepting a new one.

### Screen layout order (significant, affects UX)
- **Home**: week strip + calories/macros → Today's Meal Plan → Log Again chips → Recent Meals list
- **Progress**: stats row → Calendar → Weekly Calories chart → Weight chart → selected-date entries

### Theme (`src/theme.ts`)
`C` — color constants (primary `#ff7a8a` rose pink, success `#54D6A1` mint green, etc.)  
`F` — Nunito Sans font family keys (loaded in `App.tsx` via `expo-font`)  
`healthColor(score)` — maps 0–100 health score to `C.success` (≥70) / `C.accent` (≥40) / `C.error` (<40)

Always use `C.*` and `F.*` rather than inline hex or font name strings.

**Theme context** (`src/services/themeContext.tsx`): React Context that exposes `useTheme()` → `AppThemeColors` (per-theme `primary` + `secondary`). Six preset themes: rose, ocean, candy, ember, forest, night. Reads `profileTheme` from storage on mount and re-reads on `onThemeChange` events. Use `useTheme()` for dynamic accent colors; use `C.*` for the static base palette.

**Animated backgrounds**: `src/components/ThemeBackground.tsx` renders full-screen particle animations (petals, bubbles, puffs, embers, leaves, stars) themed by `profileTheme`. Uses React Native's built-in `Animated` API exclusively — `react-native-reanimated` is not installed. All transform/opacity animations use `useNativeDriver: true`. Oscillating animations (sway, spin, bob) use `Easing.inOut(Easing.sin)` for smooth reversals without mechanical snapping.

### Celebrity profiles (`src/screens/OnboardingScreen.tsx`)
`CELEBRITY_PROFILES` and `CelebrityProfile` are exported from `OnboardingScreen` (not a separate file). `SettingsScreen` imports them to power the Body Plan picker and `recalcGoalsWithCeleb` (Mifflin-St Jeor BMR → TDEE → macro split). If celebrity logic needs to move, both screens import from the same source.

### Hour storage convention
`MealReminderTime.hour` is always stored as 24-hour (0–23). Display conversion to 12-hour and AM/PM toggle happen purely in the UI layer (`MealReminderRow` in `SettingsScreen`).

### Key types (`src/types/index.ts`)
- `FoodEntry` — `{ id, date (YYYY-MM-DD), timestamp, name, calories, protein, carbs, fat, healthScore (0–100), isHealthy, healthNotes, mealType, imageUri? }`
- `WeightEntry` — `{ id, date, timestamp, weightKg, notes? }`
- `UserPreferences` — monolithic settings object; all fields have defaults in `storage.ts`. Includes `email?`, `passwordHash?`, `profilePicture?`, `isAuthenticated`, `profileTheme`.
- `FitnessGoal` — `"lose_weight" | "gain_weight" | "maintain" | "build_muscle"`
- `ActivityLevel` — `"sedentary" | "light" | "moderate" | "active" | "very_active"`
- `RootStackParamList` / `TabParamList` — navigation param maps; update both when adding screens
