import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Image,
  Modal,
  Animated as RNAnim,
  Easing,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import Svg, { Circle, G } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import {
  getEntriesForDate,
  getDailyTotals,
  getPreferences,
  getTodayDate,
  getAllEntries,
  addEntry,
  savePreferences,
} from "../services/storage";
import { setActiveDate } from "../services/activeDate";
import { FoodEntry, DailyTotals, UserGoals } from "../types";
import { CELEBRITY_PROFILES } from "./OnboardingScreen";
import EditEntryModal from "../components/EditEntryModal";
import { useTheme } from "../services/themeContext";
import { C, F, healthColor } from "../theme";

// ── SVG Ring ───────────────────────────────────────────────────────────────

function SvgRing({
  size, stroke, pct, color, children,
}: {
  size: number; stroke: number; pct: number; color: string; children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(pct, 1));
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute" }}>
        <G rotation="-90" origin={`${size / 2},${size / 2}`}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={C.border} strokeWidth={stroke} fill="none" />
          <Circle
            cx={size / 2} cy={size / 2} r={r}
            stroke={color} strokeWidth={stroke} fill="none"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        </G>
      </Svg>
      {children}
    </View>
  );
}

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ── Week Strip ─────────────────────────────────────────────────────────────

function WeekStrip({
  selectedDate, onSelectDate, entryDates,
}: {
  selectedDate: string; onSelectDate: (d: string) => void; entryDates: Set<string>;
}) {
  const anchor = new Date(selectedDate + "T12:00:00");
  const dow = anchor.getDay();
  const weekDates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(anchor);
    d.setDate(anchor.getDate() - dow + i);
    weekDates.push(localDateStr(d));
  }
  const today = getTodayDate();
  const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

  return (
    <View style={ws.strip}>
      {weekDates.map((date, i) => {
        const dayNum = parseInt(date.split("-")[2], 10);
        const isSelected = date === selectedDate;
        const isToday = date === today;
        const hasEntry = entryDates.has(date);
        const isFuture = date > today;
        return (
          <TouchableOpacity
            key={date}
            style={ws.cell}
            onPress={() => !isFuture && onSelectDate(date)}
            disabled={isFuture}
            activeOpacity={0.7}
          >
            <Text style={ws.letter}>{DAY_LETTERS[i]}</Text>
            <View style={[ws.numWrap, isSelected && ws.numSelected, isToday && !isSelected && ws.numToday]}>
              <Text style={[ws.num, isSelected && { color: "#fff" }, isToday && !isSelected && { color: C.primary }]}>
                {dayNum}
              </Text>
            </View>
            <View style={[ws.dot, !hasEntry && { opacity: 0 }, isSelected && { backgroundColor: "#fff" }]} />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const ws = StyleSheet.create({
  strip: { flexDirection: "row", flex: 1 },
  cell: { flex: 1, alignItems: "center", paddingVertical: 2 },
  letter: { fontSize: 12, fontFamily: F.bold, color: C.muted, marginBottom: 5 },
  numWrap: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", marginBottom: 5 },
  numSelected: { backgroundColor: C.primary },
  numToday: { borderWidth: 2, borderColor: C.primary },
  num: { fontSize: 14, fontFamily: F.bold, color: C.text },
  dot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: C.primary },
});

// ── Calorie Card ───────────────────────────────────────────────────────────

function CalorieCard({ calories, goal, ringSize, primary }: { calories: number; goal: number; ringSize: number; primary: string }) {
  const pct = Math.min(calories / Math.max(goal, 1), 1);
  const remaining = Math.max(goal - calories, 0);
  const color = pct > 1 ? C.error : pct > 0.85 ? primary : C.success;
  return (
    <View style={cc.row}>
      <View style={cc.left}>
        <View style={cc.numRow}>
          <Text style={[cc.cal, { color }]}>{calories}</Text>
          <Text style={cc.goalTxt}>/{goal}</Text>
        </View>
        <Text style={cc.eatLbl}>Calories eaten</Text>
        <View style={cc.remainRow}>
          <Text style={[cc.remainNum, { color: remaining === 0 && calories > 0 ? C.error : C.text }]}>
            {remaining}
          </Text>
          <Text style={cc.remainLbl}> remaining</Text>
        </View>
      </View>
      <SvgRing size={ringSize} stroke={10} pct={pct} color={color}>
        <Text style={[cc.pct, { color }]}>{Math.round(pct * 100)}%</Text>
      </SvgRing>
    </View>
  );
}

const cc = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  left: { flex: 1, paddingRight: 12 },
  numRow: { flexDirection: "row", alignItems: "flex-end" },
  cal: { fontSize: 44, fontFamily: F.extrabold, lineHeight: 48 },
  goalTxt: { fontSize: 17, fontFamily: F.regular, color: C.muted, marginBottom: 7, marginLeft: 2 },
  eatLbl: { fontSize: 13, fontFamily: F.semibold, color: C.muted, marginTop: 2 },
  remainRow: { flexDirection: "row", alignItems: "center", marginTop: 6 },
  remainNum: { fontSize: 17, fontFamily: F.bold, color: C.text },
  remainLbl: { fontSize: 13, fontFamily: F.regular, color: C.muted },
  pct: { fontSize: 13, fontFamily: F.bold },
});

// ── Macro Item ─────────────────────────────────────────────────────────────

function MacroItem({ label, value, goal, color, ringSize }: {
  label: string; value: number; goal: number; color: string; ringSize: number;
}) {
  const pct = goal > 0 ? Math.min(value / goal, 1) : 0;
  const valFontSize = Math.max(11, Math.floor(ringSize * 0.21));
  return (
    <View style={mi.item}>
      <SvgRing size={ringSize} stroke={7} pct={pct} color={color}>
        <Text style={[mi.val, { color, fontSize: valFontSize }]}>{value}</Text>
      </SvgRing>
      <Text style={mi.frac}>{value}/{goal} g</Text>
      <Text style={mi.lbl}>{label}</Text>
    </View>
  );
}

const mi = StyleSheet.create({
  item: { flex: 1, alignItems: "center", gap: 4 },
  val: { fontFamily: F.extrabold },
  frac: { fontSize: 11, fontFamily: F.bold, color: C.text },
  lbl: { fontSize: 10, fontFamily: F.semibold, color: C.muted, textAlign: "center" },
});

// ── Streak Milestone Celebration ───────────────────────────────────────────

const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100];
const CONFETTI_COLORS_MS = [C.primary, "#FFD700", C.success, "#FF69B4", C.secondary, "#87CEEB"];
const CONFETTI_COUNT_MS = 34;

function makeStreakParticles() {
  return Array.from({ length: CONFETTI_COUNT_MS }, (_, i) => ({
    anim: new RNAnim.Value(0),
    xFrac: (i + 0.5) / CONFETTI_COUNT_MS,
    driftX: ((i * 7 + 11) % 13 - 6) * 22,
    color: CONFETTI_COLORS_MS[i % CONFETTI_COLORS_MS.length],
    w: 5 + (i % 5),
    h: i % 3 === 0 ? 12 + (i % 4) * 2 : 5 + (i % 5),
    isRect: i % 3 === 0,
    duration: 1400 + (i * 41) % 800,
    delay: (i * 43) % 700,
    endRot: (i % 2 === 0 ? 1 : -1) * (90 + (i * 53) % 270),
  }));
}

function StreakConfetti({ active }: { active: boolean }) {
  const { width, height } = useWindowDimensions();
  const particlesRef = useRef<ReturnType<typeof makeStreakParticles> | null>(null);
  if (particlesRef.current === null) particlesRef.current = makeStreakParticles();
  const particles = particlesRef.current;

  useEffect(() => {
    if (!active) return;
    particles.forEach((p) => p.anim.setValue(0));
    RNAnim.parallel(
      particles.map((p) =>
        RNAnim.timing(p.anim, {
          toValue: 1,
          duration: p.duration,
          delay: p.delay,
          useNativeDriver: true,
          easing: Easing.in(Easing.quad),
        })
      )
    ).start();
  }, [active]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {particles.map((p, i) => {
        const x0 = p.xFrac * width;
        return (
          <RNAnim.View
            key={i}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: p.w,
              height: p.h,
              backgroundColor: p.color,
              borderRadius: p.isRect ? 2 : p.w / 2,
              opacity: p.anim.interpolate({ inputRange: [0, 0.07, 0.7, 1], outputRange: [0, 1, 1, 0] }),
              transform: [
                { translateX: p.anim.interpolate({ inputRange: [0, 1], outputRange: [x0, x0 + p.driftX] }) },
                { translateY: p.anim.interpolate({ inputRange: [0, 1], outputRange: [-30, height + 30] }) },
                { rotate: p.anim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", `${p.endRot}deg`] }) },
              ],
            }}
          />
        );
      })}
    </View>
  );
}

const MILESTONE_MESSAGES: Record<number, { title: string; sub: string }> = {
  3:   { title: "3-Day Streak! 🔥",   sub: "You're building a real habit. Keep going!" },
  7:   { title: "One Week Strong! 🏆", sub: "A whole week of healthy tracking!" },
  14:  { title: "Two Week Warrior! 💪", sub: "Two weeks of pure consistency!" },
  30:  { title: "Month Master! 🌟",    sub: "30 days and going strong. You are unstoppable!" },
  60:  { title: "60 Days! 🚀",         sub: "Two months of dedication. Legendary!" },
  100: { title: "100 Days! 👑",        sub: "Triple digits. You are an inspiration!" },
};

function StreakMilestoneOverlay({ milestone, onDismiss }: { milestone: number | null; onDismiss: () => void }) {
  const cardScale = useRef(new RNAnim.Value(0)).current;
  const cardY     = useRef(new RNAnim.Value(40)).current;

  useEffect(() => {
    if (milestone !== null) {
      cardScale.setValue(0);
      cardY.setValue(40);
      RNAnim.parallel([
        RNAnim.spring(cardScale, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 6 }),
        RNAnim.spring(cardY,     { toValue: 0, useNativeDriver: true, speed: 14, bounciness: 4 }),
      ]).start();
      const t = setTimeout(onDismiss, 4500);
      return () => clearTimeout(t);
    }
  }, [milestone]);

  const msg = milestone !== null
    ? (MILESTONE_MESSAGES[milestone] ?? { title: `${milestone}-Day Streak! 🔥`, sub: "Incredible dedication!" })
    : null;

  return (
    <Modal transparent animationType="fade" visible={milestone !== null}>
      <View style={msS.bg}>
        <StreakConfetti active={milestone !== null} />
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onDismiss} />
        <RNAnim.View style={[msS.card, { transform: [{ scale: cardScale }, { translateY: cardY }] }]}>
          <Text style={msS.title}>{msg?.title ?? ""}</Text>
          <Text style={msS.sub}>{msg?.sub ?? ""}</Text>
          <TouchableOpacity style={msS.btn} onPress={onDismiss} activeOpacity={0.85}>
            <Text style={msS.btnText}>Keep it up!</Text>
          </TouchableOpacity>
        </RNAnim.View>
      </View>
    </Modal>
  );
}

const msS = StyleSheet.create({
  bg: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center" },
  card: {
    backgroundColor: C.card, borderRadius: 28, padding: 36,
    alignItems: "center", gap: 10, minWidth: 270,
    shadowColor: "#000", shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2, shadowRadius: 24, elevation: 24,
  },
  title: { fontSize: 24, fontFamily: F.extrabold, color: C.text, textAlign: "center" },
  sub: { fontSize: 14, fontFamily: F.regular, color: C.muted, textAlign: "center", lineHeight: 20 },
  btn: {
    marginTop: 12, backgroundColor: C.primary, borderRadius: 14,
    paddingHorizontal: 28, paddingVertical: 12,
    shadowColor: C.primary, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 5,
  },
  btnText: { fontFamily: F.bold, color: "#fff", fontSize: 15 },
});

// ── Quick Log ──────────────────────────────────────────────────────────────

function QuickLogChip({ entry, onPress }: { entry: FoodEntry; onPress: () => void }) {
  const scale = useRef(new RNAnim.Value(1)).current;
  return (
    <Pressable
      onPressIn={() => { RNAnim.spring(scale, { toValue: 0.93, useNativeDriver: true, speed: 30, bounciness: 0 }).start(); }}
      onPressOut={() => { RNAnim.spring(scale, { toValue: 1,    useNativeDriver: true, speed: 14, bounciness: 6 }).start(); }}
      onPress={onPress}
    >
      <RNAnim.View style={[ql.chip, { transform: [{ scale }] }]}>
        <View style={{ flex: 1 }}>
          <Text style={ql.chipName} numberOfLines={1}>{entry.name}</Text>
          <Text style={ql.chipCal}>{entry.calories} cal</Text>
        </View>
        <View style={ql.chipPlus}>
          <Ionicons name="add" size={15} color="#fff" />
        </View>
      </RNAnim.View>
    </Pressable>
  );
}

const ql = StyleSheet.create({
  chip: {
    backgroundColor: C.card, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10,
    flexDirection: "row", alignItems: "center", gap: 10, marginRight: 8, minWidth: 130, maxWidth: 180,
    borderWidth: 1, borderColor: C.border,
    shadowColor: C.primary, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 1,
  },
  chipName: { fontSize: 12, fontFamily: F.bold, color: C.text },
  chipCal: { fontSize: 10, fontFamily: F.semibold, color: C.muted, marginTop: 1 },
  chipPlus: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: C.primary,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
});

// ── Meal Card ──────────────────────────────────────────────────────────────

function mealTypeIcon(type: FoodEntry["mealType"]): React.ComponentProps<typeof Ionicons>["name"] {
  if (type === "breakfast") return "sunny-outline";
  if (type === "lunch") return "partly-sunny-outline";
  if (type === "dinner") return "moon-outline";
  return "nutrition-outline";
}
function mealTypeTint(type: FoodEntry["mealType"]): string {
  if (type === "breakfast") return "#FFF3CD";
  if (type === "lunch") return "#D1FAE5";
  if (type === "dinner") return "#EDE9FE";
  return "#FEE2E2";
}

function MealCard({ entry, onPress }: { entry: FoodEntry; onPress: () => void }) {
  const scale = useRef(new RNAnim.Value(1)).current;

  const time = new Date(entry.timestamp).toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit",
  });
  const hc = healthColor(entry.healthScore);
  return (
    <Pressable
      onPressIn={() => { RNAnim.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 25, bounciness: 0 }).start(); }}
      onPressOut={() => { RNAnim.spring(scale, { toValue: 1,    useNativeDriver: true, speed: 12, bounciness: 6 }).start(); }}
      onPress={onPress}
    >
      <RNAnim.View style={[mc.card, { transform: [{ scale }] }]}>
        {entry.imageUri ? (
          <Image source={{ uri: entry.imageUri }} style={mc.thumb} resizeMode="cover" />
        ) : (
          <View style={[mc.thumbPlaceholder, { backgroundColor: mealTypeTint(entry.mealType) }]}>
            <Ionicons name={mealTypeIcon(entry.mealType)} size={24} color={C.primary} />
          </View>
        )}
        <View style={mc.body}>
          <Text style={mc.name} numberOfLines={1}>{entry.name}</Text>
          <Text style={mc.meta}>{time} · {entry.mealType}</Text>
          <Text style={mc.macros}>
            {entry.calories} cal · P {entry.protein}g · C {entry.carbs}g · F {entry.fat}g
          </Text>
        </View>
        <View style={mc.right}>
          <View style={[mc.score, { backgroundColor: hc + "20" }]}>
            <Text style={[mc.scoreNum, { color: hc }]}>{entry.healthScore}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={C.border} style={{ marginTop: 4 }} />
        </View>
      </RNAnim.View>
    </Pressable>
  );
}

const mc = StyleSheet.create({
  card: {
    backgroundColor: C.card, borderRadius: 16, padding: 12, marginBottom: 8,
    flexDirection: "row", alignItems: "center",
    shadowColor: C.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 2,
  },
  thumb: { width: 58, height: 58, borderRadius: 12, marginRight: 12 },
  thumbPlaceholder: {
    width: 58, height: 58, borderRadius: 12, marginRight: 12,
    backgroundColor: C.fill, alignItems: "center", justifyContent: "center",
  },
  body: { flex: 1 },
  name: { fontSize: 14, fontFamily: F.bold, color: C.text },
  meta: { fontSize: 11, fontFamily: F.semibold, color: C.muted, marginTop: 2, textTransform: "capitalize" },
  macros: { fontSize: 11, fontFamily: F.semibold, color: C.muted, marginTop: 3 },
  right: { alignItems: "center", marginLeft: 8 },
  score: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  scoreNum: { fontSize: 12, fontFamily: F.bold },
});

// ── Meal Plan ──────────────────────────────────────────────────────────────

interface PlanMeal { name: string; desc: string; cal: number; p: number; c: number; f: number }
interface DayPlan { breakfast: PlanMeal; lunch: PlanMeal; dinner: PlanMeal; snack: PlanMeal }

const CELEB_MEAL_PLANS: Record<string, DayPlan> = {
  chris_hemsworth: {
    breakfast: { name: "Oat & Egg White Power Bowl", desc: "Rolled oats, egg whites, banana, almond butter", cal: 600, p: 45, c: 65, f: 12 },
    lunch:     { name: "Chicken Rice Bowl",           desc: "Grilled chicken breast, brown rice, broccoli",   cal: 650, p: 55, c: 70, f: 8  },
    dinner:    { name: "Steak & Sweet Potato",        desc: "Lean steak, baked sweet potato, mixed greens",   cal: 700, p: 60, c: 55, f: 18 },
    snack:     { name: "Greek Yogurt & Almonds",      desc: "Full-fat Greek yogurt, raw almonds",             cal: 300, p: 25, c: 20, f: 12 },
  },
  brad_pitt: {
    breakfast: { name: "Scrambled Eggs & Avocado",  desc: "Whole eggs, half avocado, handful of spinach",    cal: 450, p: 30, c: 10, f: 30 },
    lunch:     { name: "Grilled Chicken Salad",     desc: "Chicken, mixed greens, olive oil, feta",          cal: 500, p: 45, c: 15, f: 22 },
    dinner:    { name: "Pan-Seared Salmon",          desc: "Salmon fillet, steamed asparagus, lemon",        cal: 550, p: 50, c: 10, f: 28 },
    snack:     { name: "Protein Shake & Walnuts",   desc: "Whey shake with a small handful of walnuts",     cal: 300, p: 30, c: 8,  f: 15 },
  },
  dwayne_johnson: {
    breakfast: { name: "Steak, Eggs & Oatmeal",       desc: "Sirloin steak, whole eggs, large bowl of oats", cal: 900, p: 80, c: 90, f: 18 },
    lunch:     { name: "Double Chicken Rice Bowl",    desc: "Two chicken breasts, brown rice, veggies",      cal: 850, p: 70, c: 100, f: 12 },
    dinner:    { name: "Salmon, Rice & Greens",       desc: "Atlantic salmon, jasmine rice, sauteed greens", cal: 800, p: 75, c: 85, f: 16 },
    snack:     { name: "Protein Bar & Banana",        desc: "High-protein bar with a ripe banana",           cal: 400, p: 40, c: 45, f: 8  },
  },
  ryan_reynolds: {
    breakfast: { name: "Avocado Toast & Poached Eggs", desc: "Sourdough, half avocado, two poached eggs",   cal: 500, p: 25, c: 45, f: 22 },
    lunch:     { name: "Turkey & Hummus Wrap",         desc: "Whole-wheat wrap, lean turkey, hummus, veg",  cal: 550, p: 40, c: 50, f: 15 },
    dinner:    { name: "Grilled Chicken & Roasted Veg",desc: "Chicken thigh, roasted peppers & zucchini",   cal: 600, p: 50, c: 40, f: 18 },
    snack:     { name: "Apple & Almond Butter",        desc: "One large apple with two tbsp almond butter", cal: 250, p: 7,  c: 30, f: 10 },
  },
  zac_efron: {
    breakfast: { name: "Protein Pancakes",          desc: "Banana oat pancakes with whey, berries on top", cal: 500, p: 40, c: 50, f: 12 },
    lunch:     { name: "Chicken Quinoa Bowl",       desc: "Chicken breast, quinoa, cucumber, lemon dressing",cal: 600, p: 50, c: 55, f: 14 },
    dinner:    { name: "Turkey Meatballs & Zucchini",desc: "Lean turkey meatballs, zucchini noodles, marinara",cal: 550, p: 50, c: 25, f: 20 },
    snack:     { name: "Cottage Cheese & Berries",  desc: "Low-fat cottage cheese with fresh mixed berries", cal: 200, p: 20, c: 18, f: 4  },
  },
  angelina_jolie: {
    breakfast: { name: "Smoothie Bowl",           desc: "Acai, banana, berries, topped with granola & seeds", cal: 400, p: 15, c: 55, f: 15 },
    lunch:     { name: "Lentil & Roasted Veggie Salad", desc: "Green lentils, roasted sweet potato, tahini",  cal: 450, p: 22, c: 55, f: 12 },
    dinner:    { name: "Grilled Fish & Roasted Veg",    desc: "White fish fillet, roasted broccolini & tomato",cal: 500, p: 40, c: 35, f: 18 },
    snack:     { name: "Hummus & Veggie Sticks",  desc: "Chickpea hummus with cucumber, carrot & celery",    cal: 200, p: 8,  c: 20, f: 9  },
  },
  jennifer_aniston: {
    breakfast: { name: "Greek Yogurt Parfait",      desc: "Plain Greek yogurt, granola, honey, fresh berries", cal: 350, p: 20, c: 45, f: 8  },
    lunch:     { name: "Mediterranean Salad",       desc: "Chickpeas, cucumber, tomato, olives, feta & olive oil",cal: 500, p: 18, c: 40, f: 24 },
    dinner:    { name: "Grilled Salmon & Quinoa",   desc: "Salmon, lemon-herb quinoa, steamed broccolini",    cal: 600, p: 48, c: 45, f: 18 },
    snack:     { name: "Mixed Nuts & Medjool Date", desc: "Small handful of mixed nuts with one Medjool date",cal: 250, p: 6,  c: 22, f: 14 },
  },
  scarlett_johansson: {
    breakfast: { name: "Egg White Omelet & Fruit",   desc: "Egg white omelet with spinach & feta, side of fruit",cal: 400, p: 30, c: 35, f: 10 },
    lunch:     { name: "Grilled Chicken Caesar",     desc: "Romaine, grilled chicken, light Caesar, no croutons",cal: 550, p: 45, c: 20, f: 26 },
    dinner:    { name: "Lean Beef Stir-Fry",         desc: "Lean beef strips, mixed veg, tamari, over rice",   cal: 600, p: 48, c: 45, f: 16 },
    snack:     { name: "String Cheese & Apple",      desc: "Two string cheese sticks with a crisp apple",      cal: 200, p: 12, c: 22, f: 7  },
  },
  serena_williams: {
    breakfast: { name: "Banana Oat Smoothie",         desc: "Oats, banana, almond milk, protein powder, chia", cal: 500, p: 25, c: 80, f: 8  },
    lunch:     { name: "Grilled Chicken Wrap",        desc: "Whole-wheat tortilla, chicken, avocado, salsa",   cal: 600, p: 45, c: 65, f: 14 },
    dinner:    { name: "Pasta with Lean Turkey Sauce",desc: "Whole-grain pasta, turkey bolognese, parmesan",   cal: 700, p: 50, c: 80, f: 14 },
    snack:     { name: "Trail Mix & Orange",          desc: "Homemade trail mix with nuts, seeds & dried fruit",cal: 300, p: 10, c: 40, f: 12 },
  },
};

const PLAN_MEALS: Array<{ key: keyof DayPlan; label: string; icon: React.ComponentProps<typeof Ionicons>["name"] }> = [
  { key: "breakfast", label: "Breakfast", icon: "sunny-outline"      },
  { key: "lunch",     label: "Lunch",     icon: "partly-sunny-outline"},
  { key: "dinner",    label: "Dinner",    icon: "moon-outline"        },
  { key: "snack",     label: "Snack",     icon: "nutrition-outline"   },
];

function MealPlanCard({ celebId, expanded, onToggle }: { celebId: string; expanded: boolean; onToggle: () => void }) {
  const plan = CELEB_MEAL_PLANS[celebId];
  const celeb = CELEBRITY_PROFILES.find((c) => c.id === celebId);
  if (!plan || !celeb) return null;

  return (
    <View style={mp.card}>
      <TouchableOpacity style={mp.header} onPress={onToggle} activeOpacity={0.75}>
        <View style={mp.headerLeft}>
          <Ionicons name="calendar-outline" size={15} color={C.secondary} />
          <Text style={mp.headerTitle}>Today's Meal Plan</Text>
        </View>
        <View style={mp.headerRight}>
          <Text style={mp.celebName}>{celeb.name.split(" ")[0]} plan</Text>
          <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={14} color={C.muted} />
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={mp.body}>
          {PLAN_MEALS.map(({ key, label, icon }, idx) => {
            const meal = plan[key];
            return (
              <View key={key}>
                {idx > 0 && <View style={mp.divider} />}
                <View style={mp.mealRow}>
                  <View style={mp.mealIcon}>
                    <Ionicons name={icon} size={14} color={C.secondary} />
                  </View>
                  <View style={mp.mealBody}>
                    <View style={mp.mealTitleRow}>
                      <Text style={mp.mealLabel}>{label}</Text>
                      <Text style={mp.mealCal}>{meal.cal} cal</Text>
                    </View>
                    <Text style={mp.mealName}>{meal.name}</Text>
                    <Text style={mp.mealDesc} numberOfLines={1}>{meal.desc}</Text>
                    <Text style={mp.mealMacros}>P {meal.p}g · C {meal.c}g · F {meal.f}g</Text>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const mp = StyleSheet.create({
  card: {
    backgroundColor: C.card, borderRadius: 16, marginBottom: 12,
    borderWidth: 1, borderColor: C.secondary + "30",
    shadowColor: C.secondary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 6, elevation: 2,
  },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14 },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 7 },
  headerTitle: { fontSize: 13, fontFamily: F.extrabold, color: C.text },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 5 },
  celebName: { fontSize: 11, fontFamily: F.semibold, color: C.muted },
  body: { paddingHorizontal: 14, paddingBottom: 14 },
  divider: { height: 1, backgroundColor: C.border, marginVertical: 10 },
  mealRow: { flexDirection: "row", gap: 10 },
  mealIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: C.secondary + "15", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 },
  mealBody: { flex: 1 },
  mealTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  mealLabel: { fontSize: 10, fontFamily: F.extrabold, color: C.secondary, textTransform: "uppercase", letterSpacing: 0.5 },
  mealCal: { fontSize: 11, fontFamily: F.bold, color: C.muted },
  mealName: { fontSize: 13, fontFamily: F.bold, color: C.text, marginTop: 1 },
  mealDesc: { fontSize: 11, fontFamily: F.regular, color: C.muted, marginTop: 1 },
  mealMacros: { fontSize: 10, fontFamily: F.semibold, color: C.muted, marginTop: 3 },
});

// ── Helpers ────────────────────────────────────────────────────────────────

function getTimeGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function addDaysToDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ── Main Screen ────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { width } = useWindowDimensions();
  // Outer padding 16 each side + card padding 16 each side = 64 total horizontal taken
  const innerWidth = width - 64;
  const calRingSize = Math.max(84, Math.min(104, Math.round(width * 0.24)));
  const macroRingSize = Math.max(60, Math.min(76, Math.floor(innerWidth / 3) - 8));

  const [selectedDate, setSelectedDate] = useState(getTodayDate());
  const [entries, setEntries] = useState<FoodEntry[]>([]);
  const [allEntryDates, setAllEntryDates] = useState<Set<string>>(new Set());
  const [totals, setTotals] = useState<DailyTotals>({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  const [goals, setGoals] = useState<UserGoals>({
    dailyCalories: 2000, dailyProtein: 150, dailyCarbs: 200, dailyFat: 65,
  });
  const [streak, setStreak] = useState(0);
  const [userName, setUserName] = useState("");
  const pulseScale = useRef(new RNAnim.Value(1)).current;
  const [editingEntry, setEditingEntry] = useState<FoodEntry | null>(null);
  const [milestoneToShow, setMilestoneToShow] = useState<number | null>(null);
  const [recentMeals, setRecentMeals] = useState<FoodEntry[]>([]);
  const [celebId, setCelebId] = useState<string | null>(null);
  const [planExpanded, setPlanExpanded] = useState(false);
  const [mealsShowAll, setMealsShowAll] = useState(false);
  const [greeting, setGreeting] = useState(getTimeGreeting());
  const theme = useTheme();

  // Update greeting every minute so "Good afternoon" switches in real time
  useEffect(() => {
    const id = setInterval(() => setGreeting(getTimeGreeting()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Gentle breathing pulse on the streak badge
  useEffect(() => {
    if (streak > 0) {
      const loop = RNAnim.loop(RNAnim.sequence([
        RNAnim.timing(pulseScale, { toValue: 1.12, duration: 900, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
        RNAnim.timing(pulseScale, { toValue: 1.00, duration: 900, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
      ]));
      loop.start();
      return () => loop.stop();
    }
  }, [streak]);

  const loadDate = useCallback(async (date: string) => {
    const [e, t, prefs, all] = await Promise.all([
      getEntriesForDate(date), getDailyTotals(date), getPreferences(), getAllEntries(),
    ]);
    setEntries(e.sort((a, b) => b.timestamp - a.timestamp));
    setTotals(t);
    setGoals(prefs.goals);
    setStreak(prefs.streakDays);
    setUserName(prefs.name);
    setCelebId(prefs.onboarding.celebrityProfile);
    setAllEntryDates(new Set(all.map((en) => en.date)));

    // Build recent unique meals for quick-log (last 6 distinct names, most recent first)
    const seen = new Set<string>();
    const recent: FoodEntry[] = [];
    for (const entry of [...all].sort((a, b) => b.timestamp - a.timestamp)) {
      if (!seen.has(entry.name)) {
        seen.add(entry.name);
        recent.push(entry);
        if (recent.length >= 6) break;
      }
    }
    setRecentMeals(recent);

    // Check for uncelebrated streak milestones
    const celebrated = prefs.celebratedStreakMilestones ?? [];
    const milestone = STREAK_MILESTONES.find((m) => prefs.streakDays >= m && !celebrated.includes(m));
    if (milestone) {
      setMilestoneToShow(milestone);
      await savePreferences({ celebratedStreakMilestones: [...celebrated, milestone] });
    }
  }, []);

  async function handleQuickLog(template: FoodEntry) {
    const newEntry: FoodEntry = {
      id: Math.random().toString(36).slice(2, 11),
      date: selectedDate,
      timestamp: Date.now(),
      name: template.name,
      calories: template.calories,
      protein: template.protein,
      carbs: template.carbs,
      fat: template.fat,
      healthScore: template.healthScore,
      isHealthy: template.isHealthy,
      healthNotes: template.healthNotes,
      mealType: template.mealType,
      imageUri: template.imageUri,
    };
    await addEntry(newEntry);
    void loadDate(selectedDate);
  }

  useFocusEffect(
    useCallback(() => {
      setActiveDate(selectedDate);
      void loadDate(selectedDate);
    }, [loadDate, selectedDate]),
  );

  function changeDate(date: string) {
    if (date > getTodayDate()) return;
    setSelectedDate(date);
    setActiveDate(date);
    setMealsShowAll(false);
    void loadDate(date);
  }

  const isToday = selectedDate === getTodayDate();
  const logLabel = isToday
    ? "Recent Meals"
    : new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", {
        weekday: "short", month: "short", day: "numeric",
      });

  return (
    <SafeAreaView style={s.safe}>
      <StreakMilestoneOverlay
        milestone={milestoneToShow}
        onDismiss={() => setMilestoneToShow(null)}
      />
      <EditEntryModal
        entry={editingEntry}
        onClose={() => setEditingEntry(null)}
        onSaved={() => loadDate(selectedDate)}
      />
      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={s.header}>
          <View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
              <Ionicons name="sparkles" size={20} color={C.primary} />
              <Text style={s.appName}>FitBot</Text>
            </View>
            <Text style={s.dateLabel}>
              {userName
                ? `${greeting}, ${userName} · ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                : new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </Text>
          </View>
          {streak > 0 && (
            <RNAnim.View style={{ transform: [{ scale: pulseScale }] }}>
              <View style={[s.streakBadge, { backgroundColor: theme.primary + "18", borderColor: theme.primary + "40" }]}>
                <Ionicons name="flame" size={16} color={theme.primary} />
                <Text style={[s.streakNum, { color: theme.primary }]}>{streak}</Text>
              </View>
            </RNAnim.View>
          )}
        </View>

        {/* Today Card: week strip + calories + macros */}
        <View style={s.card}>
          <View style={s.weekNavRow}>
            <TouchableOpacity
              style={s.weekNavBtn}
              onPress={() => changeDate(addDaysToDate(selectedDate, -7))}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="chevron-back" size={18} color={C.muted} />
            </TouchableOpacity>
            <WeekStrip selectedDate={selectedDate} onSelectDate={changeDate} entryDates={allEntryDates} />
            {(() => {
              const todayStr = getTodayDate();
              const selDow = new Date(selectedDate + "T12:00:00").getDay();
              const onCurrentWeek = addDaysToDate(selectedDate, 6 - selDow) >= todayStr;
              return (
                <TouchableOpacity
                  style={s.weekNavBtn}
                  onPress={() => {
                    const next = addDaysToDate(selectedDate, 7);
                    changeDate(next <= todayStr ? next : todayStr);
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  disabled={onCurrentWeek}
                >
                  <Ionicons name="chevron-forward" size={18} color={onCurrentWeek ? "transparent" : C.muted} />
                </TouchableOpacity>
              );
            })()}
          </View>
          <View style={s.divider} />
          <CalorieCard calories={totals.calories} goal={goals.dailyCalories} ringSize={calRingSize} primary={theme.primary} />
          <View style={s.divider} />
          <View style={s.macroRow}>
            <MacroItem label="Protein" value={totals.protein} goal={goals.dailyProtein} color={theme.secondary} ringSize={macroRingSize} />
            <MacroItem label="Carbs" value={totals.carbs} goal={goals.dailyCarbs} color={C.accent} ringSize={macroRingSize} />
            <MacroItem label="Fat" value={totals.fat} goal={goals.dailyFat} color={theme.primary} ringSize={macroRingSize} />
          </View>
        </View>

        {/* Meal Plan */}
        {celebId && CELEB_MEAL_PLANS[celebId] && (
          <MealPlanCard
            celebId={celebId}
            expanded={planExpanded}
            onToggle={() => setPlanExpanded((v) => !v)}
          />
        )}

        {/* Quick Log */}
        {recentMeals.length > 0 && (
          <View style={s.quickSection}>
            <Text style={s.quickTitle}>Log Again</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 4 }}>
              {recentMeals.map((m) => (
                <QuickLogChip key={m.id} entry={m} onPress={() => void handleQuickLog(m)} />
              ))}
            </ScrollView>
          </View>
        )}

        {/* Log section */}
        <View style={s.logHeader}>
          <Text style={s.logTitle}>{logLabel}</Text>
          <Text style={s.logCount}>{entries.length} {entries.length === 1 ? "entry" : "entries"}</Text>
        </View>

        {entries.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="restaurant-outline" size={52} color={C.border} />
            <Text style={s.emptyTitle}>{isToday ? "No meals yet" : "No entries"}</Text>
            <Text style={s.emptyText}>
              {isToday ? "Tap + to log your first meal" : "Tap + to add one for this day"}
            </Text>
          </View>
        ) : (
          <>
            {(mealsShowAll ? entries : entries.slice(0, 3)).map((e) => (
              <MealCard key={e.id} entry={e} onPress={() => setEditingEntry(e)} />
            ))}
            {entries.length > 3 && (
              <TouchableOpacity style={s.seeMoreBtn} onPress={() => setMealsShowAll((v) => !v)} activeOpacity={0.75}>
                <Text style={[s.seeMoreText, { color: theme.primary }]}>
                  {mealsShowAll ? "Show less" : `See ${entries.length - 3} more`}
                </Text>
                <Ionicons name={mealsShowAll ? "chevron-up" : "chevron-down"} size={14} color={theme.primary} />
              </TouchableOpacity>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "transparent" },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  appName: { fontSize: 28, fontFamily: F.extrabold, color: C.text },
  dateLabel: { fontSize: 13, fontFamily: F.semibold, color: C.muted, marginTop: 3 },
  streakBadge: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1, gap: 5,
  },
  streakNum: { fontSize: 16, fontFamily: F.extrabold },
  seeMoreBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 4, paddingVertical: 12,
  },
  seeMoreText: { fontSize: 13, fontFamily: F.bold },
  card: {
    backgroundColor: C.card, borderRadius: 20, padding: 16, marginBottom: 12,
    shadowColor: C.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  weekNavRow: { flexDirection: "row", alignItems: "center" },
  weekNavBtn: { paddingHorizontal: 2 },
  divider: { height: 1, backgroundColor: C.border, marginVertical: 16 },
  macroRow: { flexDirection: "row", justifyContent: "space-between" },
  quickSection: { marginBottom: 14 },
  quickTitle: { fontSize: 13, fontFamily: F.extrabold, color: C.muted, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 },
  logHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  logTitle: { fontSize: 17, fontFamily: F.extrabold, color: C.text },
  logCount: { fontSize: 12, fontFamily: F.semibold, color: C.muted },
  empty: { alignItems: "center", paddingVertical: 44, gap: 8 },
  emptyTitle: { fontFamily: F.bold, color: C.muted, fontSize: 15, marginTop: 4 },
  emptyText: { fontFamily: F.regular, color: C.muted, fontSize: 13, textAlign: "center" },
});
