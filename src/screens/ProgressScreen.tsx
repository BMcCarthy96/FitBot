import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { G, Rect, Polyline, Circle, Line, Text as SvgText } from "react-native-svg";
import {
  getAllEntries, getPreferences, getWeeklyCalories, getTodayDate, getWeightEntries,
} from "../services/storage";
import { setActiveDate } from "../services/activeDate";
import { onWeightChange } from "../services/eventBus";
import { FoodEntry, UserGoals, WeightEntry } from "../types";
import EditEntryModal from "../components/EditEntryModal";
import { useTheme } from "../services/themeContext";
import { C, F, healthColor } from "../theme";

function formatNavDate(dateStr: string): string {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric",
  });
}

// ── Weekly Chart ───────────────────────────────────────────────────────────

function WeeklyChart({ data, goal }: { data: { date: string; calories: number }[]; goal: number }) {
  const maxCal = Math.max(...data.map((d) => d.calories), goal, 1);
  const days = ["S", "M", "T", "W", "T", "F", "S"];
  const BAR_H = 130;

  return (
    <View>
      <Text style={styles.sectionTitle}>Weekly Calories</Text>
      <View style={[styles.bars, { height: BAR_H + 40 }]}>
        {data.map((d, i) => {
          const pct = d.calories / maxCal;
          const barH = Math.max(pct * BAR_H, d.calories > 0 ? 6 : 0);
          const isToday = d.date === getTodayDate();
          const overGoal = d.calories > goal;
          const barColor = d.calories === 0 ? C.border : overGoal ? C.error : isToday ? C.primary : C.secondary;
          const barTop = overGoal ? C.error : isToday ? C.primary : C.secondary + "CC";
          return (
            <View key={i} style={styles.barCol}>
              {d.calories > 0 && (
                <Text style={[styles.barCalLabel, isToday && { color: C.primary, fontFamily: F.bold }]}>
                  {d.calories}
                </Text>
              )}
              <View style={[styles.barWrapper, { height: BAR_H }]}>
                {goal > 0 && (
                  <View style={[styles.goalLine, { bottom: (goal / maxCal) * BAR_H }]}>
                    {i === 6 && <Text style={styles.goalLineLabel}>Goal</Text>}
                  </View>
                )}
                {d.calories > 0 ? (
                  <LinearGradient
                    colors={[barTop, barColor + "99"]}
                    style={[styles.bar, { height: barH, borderRadius: 8 }]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                  />
                ) : (
                  <View style={[styles.bar, { height: 4, backgroundColor: C.border, borderRadius: 4 }]} />
                )}
              </View>
              <Text style={[styles.barDay, isToday && { color: C.primary, fontFamily: F.bold }]}>
                {days[new Date(d.date + "T12:00:00").getDay()]}
              </Text>
            </View>
          );
        })}
      </View>
      <View style={styles.chartLegend}>
        {[
          { label: "Today", color: C.primary },
          { label: "Past days", color: C.secondary },
          { label: "Over goal", color: C.error },
        ].map(({ label, color }) => (
          <View key={label} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: color }]} />
            <Text style={styles.legendText}>{label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Weight Chart ───────────────────────────────────────────────────────────

function fmtShortDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function WeightChart({
  entries,
  unit,
  onSelectDate,
}: {
  entries: WeightEntry[];
  unit: "lbs" | "kg";
  onSelectDate?: (date: string) => void;
}) {
  const { width: screenW } = useWindowDimensions();
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const chartW = screenW - 64;
  const chartH = 200;
  const PAD = { l: 12, r: 12, t: 30, b: 38 };
  const innerW = chartW - PAD.l - PAD.r;
  const innerH = chartH - PAD.t - PAD.b;
  const CALLOUT_W = 96;
  const CALLOUT_H = 42;

  const LBS = 2.20462;
  const toDisplay = (kg: number) => (unit === "lbs" ? kg * LBS : kg);

  // Sort by date so backfilled entries appear in the right position
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const weights = sorted.map((e) => toDisplay(e.weightKg));
  const minW = Math.min(...weights);
  const maxW = Math.max(...weights);
  const range = maxW - minW || 1;
  const pad = Math.max(range * 0.2, unit === "lbs" ? 2 : 1);
  const yMin = Math.max(0, minW - pad);
  const yMax = maxW + pad;
  const yRange = yMax - yMin || 1;

  // X positions are time-proportional so gaps between logs are visible
  const firstMs = new Date(sorted[0].date + "T12:00:00").getTime();
  const lastMs = new Date(sorted[sorted.length - 1].date + "T12:00:00").getTime();
  const timeSpan = lastMs - firstMs || 1;

  const pts = sorted.map((e) => {
    const t = new Date(e.date + "T12:00:00").getTime();
    return {
      x: PAD.l + (sorted.length === 1 ? innerW / 2 : ((t - firstMs) / timeSpan) * innerW),
      y: PAD.t + (1 - (toDisplay(e.weightKg) - yMin) / yRange) * innerH,
      w: toDisplay(e.weightKg),
    };
  });

  const polyPts = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const delta = pts[pts.length - 1].w - pts[0].w;
  const deltaStr = delta === 0 ? "no change" : `${delta > 0 ? "+" : ""}${delta.toFixed(1)} ${unit}`;
  const deltaColor = delta < -0.5 ? C.success : delta > 0.5 ? C.error : C.muted;

  // X-axis labels at real calendar positions (not array indices)
  const spanDays = timeSpan / 86_400_000;
  const xLabels: { x: number; label: string; anchor: "start" | "middle" | "end" }[] = [];
  if (sorted.length > 1) {
    xLabels.push({ x: pts[0].x, label: fmtShortDate(sorted[0].date), anchor: "start" });
    const midFracs = spanDays > 14 ? [1 / 3, 2 / 3] : spanDays > 5 ? [0.5] : [];
    for (const frac of midFracs) {
      const d = new Date(firstMs + frac * timeSpan);
      xLabels.push({
        x: PAD.l + frac * innerW,
        label: `${d.getMonth() + 1}/${d.getDate()}`,
        anchor: "middle",
      });
    }
    xLabels.push({ x: pts[pts.length - 1].x, label: fmtShortDate(sorted[sorted.length - 1].date), anchor: "end" });
  }

  // Callout for the tapped dot
  const callout = selectedIdx !== null ? {
    x: Math.min(Math.max(pts[selectedIdx].x - CALLOUT_W / 2, PAD.l), chartW - PAD.r - CALLOUT_W),
    y: Math.max(2, pts[selectedIdx].y - CALLOUT_H - 12),
    dateLabel: new Date(sorted[selectedIdx].date + "T12:00:00").toLocaleDateString("en-US", {
      month: "short", day: "numeric",
    }),
    weight: pts[selectedIdx].w.toFixed(1),
  } : null;

  function handleDotPress(idx: number) {
    const next = idx === selectedIdx ? null : idx;
    setSelectedIdx(next);
    if (next !== null) onSelectDate?.(sorted[next].date);
  }

  return (
    <View>
      {pts.length > 1 && (
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10, gap: 10 }}>
          <Text style={{ fontSize: 12, fontFamily: F.semibold, color: C.muted }}>
            {sorted.length} entries
          </Text>
          <Text style={{ fontSize: 12, fontFamily: F.bold, color: deltaColor }}>{deltaStr}</Text>
        </View>
      )}
      <Svg width={chartW} height={chartH}>
        {/* Baseline */}
        <Line
          x1={PAD.l} y1={PAD.t + innerH}
          x2={chartW - PAD.r} y2={PAD.t + innerH}
          stroke={C.border} strokeWidth={1}
        />

        {/* Trend line */}
        {pts.length > 1 && (
          <Polyline
            points={polyPts}
            fill="none"
            stroke={C.secondary}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Visual dots */}
        {pts.map((p, i) => (
          <Circle
            key={i}
            cx={p.x} cy={p.y}
            r={selectedIdx === i ? 7 : i === pts.length - 1 ? 5 : 4}
            fill={selectedIdx === i || i === pts.length - 1 ? C.primary : C.secondary}
            stroke={selectedIdx === i ? "#fff" : "none"}
            strokeWidth={2}
          />
        ))}

        {/* Anchor value labels (hidden while a callout is open) */}
        {callout === null && pts.length > 1 && (
          <SvgText
            x={pts[0].x + 4}
            y={Math.max(PAD.t + 12, pts[0].y - 10)}
            textAnchor="start"
            fontSize={10} fill={C.muted}
          >
            {pts[0].w.toFixed(1)}
          </SvgText>
        )}
        {callout === null && (
          <SvgText
            x={pts[pts.length - 1].x - (sorted.length > 1 ? 4 : 0)}
            y={Math.max(PAD.t + 12, pts[pts.length - 1].y - 10)}
            textAnchor={sorted.length === 1 ? "middle" : "end"}
            fontSize={11} fill={C.primary} fontWeight="bold"
          >
            {pts[pts.length - 1].w.toFixed(1)}
          </SvgText>
        )}

        {/* X-axis date labels */}
        {xLabels.map((lbl, i) => (
          <SvgText
            key={i}
            x={lbl.x}
            y={chartH - PAD.b + 16}
            textAnchor={lbl.anchor}
            fontSize={10} fill={C.muted}
          >
            {lbl.label}
          </SvgText>
        ))}

        {/* Callout bubble */}
        {callout && (
          <G>
            <Rect
              x={callout.x} y={callout.y}
              width={CALLOUT_W} height={CALLOUT_H}
              rx={8} ry={8}
              fill={C.card}
              stroke={C.secondary} strokeWidth={1.5}
            />
            <SvgText
              x={callout.x + CALLOUT_W / 2} y={callout.y + 15}
              textAnchor="middle" fontSize={10} fill={C.muted}
            >
              {callout.dateLabel}
            </SvgText>
            <SvgText
              x={callout.x + CALLOUT_W / 2} y={callout.y + 31}
              textAnchor="middle" fontSize={13} fill={C.text} fontWeight="bold"
            >
              {callout.weight} {unit}
            </SvgText>
          </G>
        )}

        {/* Transparent hit targets rendered last so they're always on top */}
        {pts.map((p, i) => (
          <Circle
            key={`hit-${i}`}
            cx={p.x} cy={p.y}
            r={18} fill="transparent"
            onPress={() => handleDotPress(i)}
          />
        ))}
      </Svg>
    </View>
  );
}

// ── Calendar View ──────────────────────────────────────────────────────────

function CalendarView({
  entries, selectedDate, onSelectDate,
}: {
  entries: FoodEntry[]; selectedDate: string; onSelectDate: (d: string) => void;
}) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const entryDates = new Set(entries.map((e) => e.date));
  const monthName = today.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const cells: (number | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  // Group into explicit rows of 7 so flex: 1 columns stay perfectly aligned
  const rows: Array<Array<number | null>> = [];
  for (let i = 0; i < cells.length; i += 7) {
    const row = cells.slice(i, i + 7);
    while (row.length < 7) row.push(null);
    rows.push(row);
  }

  return (
    <View>
      <Text style={styles.sectionTitle}>{monthName}</Text>
      <View style={styles.calDayHeaders}>
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
          <Text key={d} style={styles.calDayHeader}>{d}</Text>
        ))}
      </View>
      <View style={styles.calGrid}>
        {rows.map((row, rowIdx) => (
          <View key={rowIdx} style={styles.calRow}>
            {row.map((day, colIdx) => {
              if (!day) return <View key={colIdx} style={styles.calCell} />;
              const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const hasEntry = entryDates.has(dateStr);
              const isToday = dateStr === getTodayDate();
              const isSelected = dateStr === selectedDate;
              const isFuture = dateStr > getTodayDate();
              return (
                <TouchableOpacity
                  key={colIdx}
                  style={[
                    styles.calCell,
                    isSelected && styles.calCellSelected,
                    isToday && !isSelected && styles.calCellToday,
                  ]}
                  onPress={() => !isFuture && onSelectDate(dateStr)}
                  disabled={isFuture}
                >
                  <Text style={[
                    styles.calDayNum,
                    isSelected && styles.calDayNumSelected,
                    isToday && !isSelected && { color: C.primary },
                  ]}>
                    {day}
                  </Text>
                  {hasEntry && <View style={[styles.calDot, { backgroundColor: isSelected ? "#fff" : C.primary }]} />}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Main Screen ────────────────────────────────────────────────────────────

export default function ProgressScreen() {
  const [weekData, setWeekData] = useState<{ date: string; calories: number }[]>([]);
  const [allEntries, setAllEntries] = useState<FoodEntry[]>([]);
  const [selectedDate, setSelectedDate] = useState(getTodayDate());
  const [selectedEntries, setSelectedEntries] = useState<FoodEntry[]>([]);
  const [goals, setGoals] = useState<UserGoals>({
    dailyCalories: 2000, dailyProtein: 150, dailyCarbs: 200, dailyFat: 65,
  });
  const [streak, setStreak] = useState(0);
  const [totalEntries, setTotalEntries] = useState(0);
  const [editingEntry, setEditingEntry] = useState<FoodEntry | null>(null);
  const [weightEntries, setWeightEntries] = useState<WeightEntry[]>([]);
  const [weightUnit, setWeightUnit] = useState<"lbs" | "kg">("lbs");
  const [weightRange, setWeightRange] = useState<"1M" | "3M" | "6M" | "ALL">("ALL");

  useEffect(() => { setActiveDate(selectedDate); }, [selectedDate]);
  useEffect(() => {
    setSelectedEntries(
      allEntries.filter((e) => e.date === selectedDate).sort((a, b) => b.timestamp - a.timestamp),
    );
  }, [allEntries, selectedDate]);

  const load = useCallback(async () => {
    const [weekly, all, prefs, wEntries] = await Promise.all([
      getWeeklyCalories(), getAllEntries(), getPreferences(), getWeightEntries(),
    ]);
    setWeekData(weekly);
    setAllEntries(all);
    setGoals(prefs.goals);
    setStreak(prefs.streakDays);
    setTotalEntries(all.length);
    setWeightEntries(wEntries);
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  useEffect(() => onWeightChange(() => void load()), [load]);

  function selectDate(date: string) {
    setSelectedDate(date);
    setActiveDate(date);
    setEntriesShowAll(false);
  }

  const filteredWeightEntries = useMemo(() => {
    if (weightRange === "ALL") return weightEntries;
    const months = weightRange === "1M" ? 1 : weightRange === "3M" ? 3 : 6;
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);
    const cutoffStr = cutoff.toISOString().split("T")[0];
    return weightEntries.filter((e) => e.date >= cutoffStr);
  }, [weightEntries, weightRange]);

  const theme = useTheme();
  const [entriesShowAll, setEntriesShowAll] = useState(false);

  const avgHealthScore =
    allEntries.length > 0
      ? Math.round(allEntries.reduce((s, e) => s + e.healthScore, 0) / allEntries.length)
      : 0;
  const isToday = selectedDate === getTodayDate();
  const navDateLabel = isToday ? "Today" : formatNavDate(selectedDate);
  const avgColor = healthColor(avgHealthScore);

  return (
    <SafeAreaView style={styles.safe}>
      <EditEntryModal entry={editingEntry} onClose={() => setEditingEntry(null)} onSaved={load} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        <Text style={styles.pageTitle}>Progress</Text>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, styles.streakCard, { backgroundColor: theme.primary + "12", borderColor: theme.primary + "30" }]}>
            <Ionicons name="flame" size={28} color={theme.primary} />
            <View>
              <Text style={[styles.streakValue, { color: theme.primary }]}>{streak}</Text>
              <Text style={styles.streakLabel}>Day Streak</Text>
            </View>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{totalEntries}</Text>
            <Text style={styles.statLabel}>Total Meals</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: avgColor }]}>{avgHealthScore}</Text>
            <Text style={styles.statLabel}>Avg Score</Text>
          </View>
        </View>

        {/* Calendar */}
        <View style={styles.card}>
          <CalendarView entries={allEntries} selectedDate={selectedDate} onSelectDate={selectDate} />
        </View>

        {/* Weekly chart */}
        <View style={styles.card}>
          <WeeklyChart data={weekData} goal={goals.dailyCalories} />
        </View>

        {/* Weight */}
        <View style={styles.card}>
          <View style={styles.weightHeader}>
            <Text style={styles.sectionTitle}>Weight</Text>
            <View style={styles.unitToggle}>
              {(["lbs", "kg"] as const).map((u) => (
                <TouchableOpacity
                  key={u}
                  style={[styles.unitBtn, weightUnit === u && styles.unitBtnActive]}
                  onPress={() => setWeightUnit(u)}
                >
                  <Text style={[styles.unitBtnText, weightUnit === u && styles.unitBtnTextActive]}>{u}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={styles.weightRangeRow}>
            {(["1M", "3M", "6M", "ALL"] as const).map((r) => (
              <TouchableOpacity
                key={r}
                style={[styles.rangeBtn, weightRange === r && styles.rangeBtnActive]}
                onPress={() => setWeightRange(r)}
              >
                <Text style={[styles.rangeBtnText, weightRange === r && styles.rangeBtnTextActive]}>{r}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {weightEntries.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="scale-outline" size={32} color={C.border} />
              <Text style={styles.emptyText}>No weight logged yet</Text>
              <Text style={[styles.emptyText, { fontSize: 12 }]}>Tap + to log your weight</Text>
            </View>
          ) : filteredWeightEntries.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No entries in this range</Text>
            </View>
          ) : (
            <>
              <View style={styles.weightLatestRow}>
                <Text style={styles.weightValue}>
                  {weightUnit === "lbs"
                    ? (filteredWeightEntries[filteredWeightEntries.length - 1].weightKg * 2.20462).toFixed(1)
                    : filteredWeightEntries[filteredWeightEntries.length - 1].weightKg.toFixed(1)}
                </Text>
                <Text style={styles.weightUnitLabel}> {weightUnit}</Text>
              </View>
              <WeightChart entries={filteredWeightEntries} unit={weightUnit} onSelectDate={selectDate} />
            </>
          )}
        </View>

        {/* Selected date entries */}
        <View style={styles.logHeader}>
          <Text style={styles.sectionTitle}>{navDateLabel}</Text>
          <Text style={styles.entryCount}>{selectedEntries.length} entries</Text>
        </View>

        {selectedEntries.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="restaurant-outline" size={36} color={C.border} />
            <Text style={styles.emptyText}>No entries for this day</Text>
          </View>
        ) : (
          <>
            {(entriesShowAll ? selectedEntries : selectedEntries.slice(0, 3)).map((e) => {
              const hc = healthColor(e.healthScore);
              return (
                <TouchableOpacity
                  key={e.id}
                  style={styles.entryCard}
                  onPress={() => setEditingEntry(e)}
                  activeOpacity={0.75}
                >
                  <View style={[styles.entryAccent, { backgroundColor: hc }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.entryName}>{e.name}</Text>
                    <Text style={styles.entryMeta}>
                      {e.mealType} · {e.calories} kcal · P {e.protein}g · C {e.carbs}g · F {e.fat}g
                    </Text>
                  </View>
                  <View style={[styles.entryScore, { backgroundColor: hc + "20" }]}>
                    <Text style={[styles.entryScoreText, { color: hc }]}>{e.healthScore}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={C.border} style={{ marginLeft: 6 }} />
                </TouchableOpacity>
              );
            })}
            {selectedEntries.length > 3 && (
              <TouchableOpacity
                style={styles.seeMoreBtn}
                onPress={() => setEntriesShowAll((v) => !v)}
                activeOpacity={0.75}
              >
                <Text style={[styles.seeMoreText, { color: theme.primary }]}>
                  {entriesShowAll ? "Show less" : `See ${selectedEntries.length - 3} more`}
                </Text>
                <Ionicons name={entriesShowAll ? "chevron-up" : "chevron-down"} size={14} color={theme.primary} />
              </TouchableOpacity>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "transparent" },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  pageTitle: { fontSize: 28, fontFamily: F.extrabold, color: C.text, marginBottom: 16 },

  statsRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  statCard: {
    flex: 1, backgroundColor: C.card, borderRadius: 18, padding: 14, alignItems: "center",
    shadowColor: C.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 6, elevation: 2,
  },
  streakCard: {
    flexDirection: "row", gap: 8, justifyContent: "center", flex: 1.4,
    backgroundColor: C.primary + "12", borderWidth: 1, borderColor: C.primary + "30",
  },
  streakValue: { fontSize: 24, fontFamily: F.extrabold, color: C.primary },
  streakLabel: { fontSize: 11, fontFamily: F.semibold, color: C.muted, marginTop: 1 },
  statValue: { fontSize: 22, fontFamily: F.extrabold, color: C.text },
  statLabel: { fontSize: 11, fontFamily: F.semibold, color: C.muted, marginTop: 2 },

  card: {
    backgroundColor: C.card, borderRadius: 20, padding: 16, marginBottom: 12,
    shadowColor: C.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  sectionTitle: { fontSize: 15, fontFamily: F.extrabold, color: C.text, marginBottom: 12 },

  bars: { flexDirection: "row", alignItems: "flex-end", gap: 6, marginBottom: 8 },
  barCol: { flex: 1, alignItems: "center" },
  barCalLabel: { fontSize: 10, fontFamily: F.semibold, color: C.muted, marginBottom: 4, textAlign: "center" },
  barWrapper: { width: "100%", justifyContent: "flex-end", position: "relative" },
  goalLine: {
    position: "absolute", left: 0, right: 0, height: 1.5,
    backgroundColor: C.muted, opacity: 0.5, flexDirection: "row", justifyContent: "flex-end",
  },
  goalLineLabel: { fontSize: 8, fontFamily: F.bold, color: C.muted, position: "absolute", right: 0, top: -10 },
  bar: { width: "100%" },
  barDay: { fontSize: 11, fontFamily: F.semibold, color: C.muted, marginTop: 5 },
  chartLegend: { flexDirection: "row", gap: 16, marginTop: 4 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, fontFamily: F.semibold, color: C.muted },

  calDayHeaders: { flexDirection: "row", marginBottom: 4 },
  calDayHeader: { flex: 1, textAlign: "center", fontSize: 11, fontFamily: F.bold, color: C.muted },
  calGrid: {},
  calRow: { flexDirection: "row" },
  calCell: { flex: 1, aspectRatio: 1, alignItems: "center", justifyContent: "center", padding: 2 },
  calCellSelected: { backgroundColor: C.primary, borderRadius: 10 },
  calCellToday: { borderRadius: 10, borderWidth: 2, borderColor: C.primary },
  calCellFuture: { opacity: 0.3 },
  calDayNum: { fontSize: 13, fontFamily: F.semibold, color: C.text },
  calDayNumSelected: { color: "#fff", fontFamily: F.bold },
  calDot: { width: 4, height: 4, borderRadius: 2, marginTop: 1 },

  logHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  entryCount: { fontSize: 12, fontFamily: F.semibold, color: C.muted },
  emptyState: { alignItems: "center", paddingVertical: 28, gap: 8 },
  emptyText: { fontFamily: F.semibold, color: C.muted, fontSize: 14 },
  entryCard: {
    backgroundColor: C.card, borderRadius: 16, padding: 12, marginBottom: 8,
    flexDirection: "row", alignItems: "center",
    shadowColor: C.primary, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
    overflow: "hidden",
  },
  seeMoreBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 4, paddingVertical: 12,
  },
  seeMoreText: { fontSize: 13, fontFamily: F.bold },
  entryAccent: { width: 4, height: "100%", borderRadius: 2, marginRight: 12 },
  entryName: { fontSize: 14, fontFamily: F.bold, color: C.text },
  entryMeta: { fontSize: 11, fontFamily: F.semibold, color: C.muted, marginTop: 2, textTransform: "capitalize" },
  entryScore: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginLeft: 8 },
  entryScoreText: { fontSize: 12, fontFamily: F.bold },

  weightHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  unitToggle: { flexDirection: "row", gap: 4 },
  unitBtn: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, backgroundColor: C.fill },
  unitBtnActive: { backgroundColor: C.primary + "20" },
  unitBtnText: { fontSize: 12, fontFamily: F.bold, color: C.muted },
  unitBtnTextActive: { color: C.primary },
  weightRangeRow: { flexDirection: "row", gap: 6, marginBottom: 14 },
  rangeBtn: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 14, backgroundColor: C.fill },
  rangeBtnActive: { backgroundColor: C.secondary + "28" },
  rangeBtnText: { fontSize: 12, fontFamily: F.bold, color: C.muted },
  rangeBtnTextActive: { color: C.secondary },
  weightLatestRow: { flexDirection: "row", alignItems: "flex-end", marginBottom: 8 },
  weightValue: { fontSize: 38, fontFamily: F.extrabold, color: C.text },
  weightUnitLabel: { fontSize: 16, fontFamily: F.semibold, color: C.muted, marginBottom: 6 },
});
