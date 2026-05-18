export interface FoodEntry {
  id: string;
  date: string; // YYYY-MM-DD
  timestamp: number;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  healthScore: number; // 0-100
  imageUri?: string;
  isHealthy: boolean;
  healthNotes: string;
  mealType: "breakfast" | "lunch" | "dinner" | "snack";
}

export interface DailyTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface UserGoals {
  dailyCalories: number;
  dailyProtein: number;
  dailyCarbs: number;
  dailyFat: number;
}

export type FitnessGoal = "lose_weight" | "gain_weight" | "maintain" | "build_muscle";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";
export type Gender = "male" | "female";

export interface MealReminderTime {
  hour: number;
  minute: number;
  enabled: boolean;
}

export interface MealReminderTimes {
  breakfast: MealReminderTime;
  lunch: MealReminderTime;
  dinner: MealReminderTime;
  evening: MealReminderTime;
}

export interface OnboardingData {
  completed: boolean;
  fitnessGoal: FitnessGoal;
  gender: Gender;
  age: number;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  celebrityProfile: string | null;
}

export interface UserPreferences {
  goals: UserGoals;
  healthyFoodPreferences: string[];
  streakDays: number;
  lastLogDate: string | null;
  notificationsEnabled: boolean;
  name: string;
  email?: string;
  profilePicture?: string;
  mealReminderTimes: MealReminderTimes;
  onboarding: OnboardingData;
  celebratedStreakMilestones: number[];
  profileTheme: string;
  passwordHash?: string;
  isAuthenticated: boolean;
}

export interface FoodAlternative {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  healthScore: number;
  reason: string;
}

export interface AIFoodAnalysis {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  healthScore: number;
  isHealthy: boolean;
  healthNotes: string;
  alternatives: FoodAlternative[];
}

export interface WeightEntry {
  id: string;
  date: string;
  timestamp: number;
  weightKg: number;
  notes?: string;
}

export type RootStackParamList = {
  Onboarding: { returnToLogin?: boolean } | undefined;
  MainTabs: undefined;
  FoodAnalysis: { imageUri: string; base64: string };
};

export type TabParamList = {
  Home: undefined;
  Progress: undefined;
  Coach: undefined;
  Settings: undefined;
  Camera: undefined;
};
