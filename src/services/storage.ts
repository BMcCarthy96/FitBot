import AsyncStorage from "@react-native-async-storage/async-storage";
import { FoodEntry, UserPreferences, DailyTotals, MealReminderTimes, OnboardingData, WeightEntry } from "../types";

const KEYS = {
  entries: "food_entries",
  prefs: "user_preferences",
  weight: "weight_entries",
};

const DEFAULT_REMINDER_TIMES: MealReminderTimes = {
  breakfast: { hour: 8, minute: 0, enabled: true },
  lunch: { hour: 12, minute: 30, enabled: true },
  dinner: { hour: 18, minute: 30, enabled: true },
  evening: { hour: 20, minute: 0, enabled: false },
};

const DEFAULT_ONBOARDING: OnboardingData = {
  completed: false,
  fitnessGoal: "maintain",
  gender: "male",
  age: 30,
  heightCm: 170,
  weightKg: 70,
  activityLevel: "moderate",
  celebrityProfile: null,
};

const DEFAULT_PREFS: UserPreferences = {
  goals: { dailyCalories: 2000, dailyProtein: 150, dailyCarbs: 200, dailyFat: 65 },
  healthyFoodPreferences: [],
  streakDays: 0,
  lastLogDate: null,
  notificationsEnabled: true,
  name: "",
  mealReminderTimes: DEFAULT_REMINDER_TIMES,
  onboarding: DEFAULT_ONBOARDING,
  celebratedStreakMilestones: [],
  profileTheme: "rose",
  isAuthenticated: true,
};

export async function getPreferences(): Promise<UserPreferences> {
  const raw = await AsyncStorage.getItem(KEYS.prefs);
  if (!raw) return DEFAULT_PREFS;
  const saved = JSON.parse(raw);
  const onboarding = { ...DEFAULT_ONBOARDING, ...(saved.onboarding ?? {}) };
  // Existing users who already have saved data skip onboarding
  if (!onboarding.completed && (saved.name || saved.goals)) {
    onboarding.completed = true;
  }
  return {
    ...DEFAULT_PREFS,
    ...saved,
    celebratedStreakMilestones: saved.celebratedStreakMilestones ?? [],
    profileTheme: saved.profileTheme ?? "rose",
    mealReminderTimes: { ...DEFAULT_REMINDER_TIMES, ...(saved.mealReminderTimes ?? {}) },
    onboarding,
  };
}

export async function savePreferences(prefs: Partial<UserPreferences>): Promise<void> {
  const current = await getPreferences();
  await AsyncStorage.setItem(KEYS.prefs, JSON.stringify({ ...current, ...prefs }));
}

export async function getAllEntries(): Promise<FoodEntry[]> {
  const raw = await AsyncStorage.getItem(KEYS.entries);
  if (!raw) return [];
  return JSON.parse(raw);
}

export async function getEntriesForDate(date: string): Promise<FoodEntry[]> {
  const all = await getAllEntries();
  return all.filter((e) => e.date === date);
}

export async function addEntry(entry: FoodEntry): Promise<void> {
  const all = await getAllEntries();
  await AsyncStorage.setItem(KEYS.entries, JSON.stringify([...all, entry]));
  await updateStreak(entry.date);
  await addHealthyPreference(entry);
}

export async function updateEntry(id: string, updates: Partial<FoodEntry>): Promise<void> {
  const all = await getAllEntries();
  const updated = all.map((e) => (e.id === id ? { ...e, ...updates } : e));
  await AsyncStorage.setItem(KEYS.entries, JSON.stringify(updated));
}

export async function deleteEntry(id: string): Promise<void> {
  const all = await getAllEntries();
  await AsyncStorage.setItem(KEYS.entries, JSON.stringify(all.filter((e) => e.id !== id)));
}

export async function getDailyTotals(date: string): Promise<DailyTotals> {
  const entries = await getEntriesForDate(date);
  return entries.reduce(
    (acc, e) => ({
      calories: acc.calories + e.calories,
      protein: acc.protein + e.protein,
      carbs: acc.carbs + e.carbs,
      fat: acc.fat + e.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

export function getTodayDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function updateStreak(logDate: string): Promise<void> {
  const prefs = await getPreferences();
  const today = getTodayDate();
  if (prefs.lastLogDate === logDate) return;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  let newStreak = prefs.streakDays;
  if (prefs.lastLogDate === yesterdayStr || prefs.lastLogDate === null) {
    newStreak += 1;
  } else if (prefs.lastLogDate !== today) {
    newStreak = 1;
  }

  await savePreferences({ streakDays: newStreak, lastLogDate: logDate });
}

async function addHealthyPreference(entry: FoodEntry): Promise<void> {
  if (!entry.isHealthy) return;
  const prefs = await getPreferences();
  const set = new Set(prefs.healthyFoodPreferences);
  set.add(entry.name);
  await savePreferences({ healthyFoodPreferences: Array.from(set).slice(-20) });
}

export async function getWeightEntries(): Promise<WeightEntry[]> {
  const raw = await AsyncStorage.getItem(KEYS.weight);
  if (!raw) return [];
  return (JSON.parse(raw) as WeightEntry[]).sort((a, b) => a.date.localeCompare(b.date) || a.timestamp - b.timestamp);
}

export async function addWeightEntry(entry: WeightEntry): Promise<void> {
  const all = await getWeightEntries();
  const deduped = all.filter((e) => e.date !== entry.date);
  await AsyncStorage.setItem(KEYS.weight, JSON.stringify([...deduped, entry]));
}

export async function deleteWeightEntry(id: string): Promise<void> {
  const all = await getWeightEntries();
  await AsyncStorage.setItem(KEYS.weight, JSON.stringify(all.filter((e) => e.id !== id)));
}

export async function setStreakForTesting(days: number, lastLogDate: string | null): Promise<void> {
  await savePreferences({ streakDays: days, lastLogDate });
}

export async function getWeeklyCalories(): Promise<{ date: string; calories: number }[]> {
  const result: { date: string; calories: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const date = d.toISOString().split("T")[0];
    const totals = await getDailyTotals(date);
    result.push({ date, calories: totals.calories });
  }
  return result;
}
