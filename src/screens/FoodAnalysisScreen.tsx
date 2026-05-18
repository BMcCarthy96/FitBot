import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  Easing,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { analyzeFoodImage } from "../services/claude";
import { addEntry, getPreferences, getTodayDate } from "../services/storage";
import { getActiveDate } from "../services/activeDate";
import { AIFoodAnalysis, FoodAlternative, FoodEntry, RootStackParamList } from "../types";
import { C, F, healthColor } from "../theme";

type RouteType = RouteProp<RootStackParamList, "FoodAnalysis">;

function ScoreGauge({ score }: { score: number }) {
  const color = healthColor(score);
  const label = score >= 70 ? "Healthy" : score >= 40 ? "Moderate" : "Unhealthy";
  return (
    <View style={styles.gaugeContainer}>
      <View style={styles.gaugeTrack}>
        <View style={[styles.gaugeFill, { width: `${score}%` as any, backgroundColor: color }]} />
      </View>
      <View style={styles.gaugeLabels}>
        <Text style={[styles.gaugeScore, { color }]}>{score}/100</Text>
        <View style={[styles.gaugeBadge, { backgroundColor: color + "18", borderColor: color + "40" }]}>
          <Text style={[styles.gaugeBadgeText, { color }]}>{label}</Text>
        </View>
      </View>
    </View>
  );
}

function NumberInput({ label, value, onChange, unit = "g" }: {
  label: string; value: number; onChange: (v: number) => void; unit?: string;
}) {
  return (
    <View style={styles.numInputRow}>
      <Text style={styles.numLabel}>{label}</Text>
      <View style={styles.numControls}>
        <TouchableOpacity style={styles.numBtn} onPress={() => onChange(Math.max(0, value - 1))}>
          <Text style={styles.numBtnText}>−</Text>
        </TouchableOpacity>
        <TextInput
          style={styles.numField}
          value={String(value)}
          onChangeText={(t) => { const n = parseInt(t, 10); if (!isNaN(n)) onChange(n); }}
          keyboardType="numeric"
          selectTextOnFocus
        />
        <TouchableOpacity style={styles.numBtn} onPress={() => onChange(value + 1)}>
          <Text style={styles.numBtnText}>+</Text>
        </TouchableOpacity>
        <Text style={styles.numUnit}>{unit}</Text>
      </View>
    </View>
  );
}

const CONFETTI_COLORS = [C.primary, C.secondary, C.success, "#FFD700", "#FF69B4", "#87CEEB"];
const CONFETTI_COUNT = 34;

function makeParticles() {
  return Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
    anim: new Animated.Value(0),
    xFrac: (i + 0.5) / CONFETTI_COUNT,
    driftX: ((i * 7 + 11) % 13 - 6) * 22,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    w: 5 + (i % 5),
    h: i % 3 === 0 ? 12 + (i % 4) * 2 : 5 + (i % 5),
    isRect: i % 3 === 0,
    duration: 1400 + (i * 41) % 800,
    delay: (i * 43) % 700,
    endRot: (i % 2 === 0 ? 1 : -1) * (90 + (i * 53) % 270),
  }));
}

function Confetti({ active }: { active: boolean }) {
  const { width, height } = useWindowDimensions();
  const particlesRef = useRef<ReturnType<typeof makeParticles> | null>(null);
  if (particlesRef.current === null) particlesRef.current = makeParticles();
  const particles = particlesRef.current;

  useEffect(() => {
    if (!active) return;
    particles.forEach((p) => p.anim.setValue(0));
    Animated.parallel(
      particles.map((p) =>
        Animated.timing(p.anim, {
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
          <Animated.View
            key={i}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: p.w,
              height: p.h,
              backgroundColor: p.color,
              borderRadius: p.isRect ? 2 : p.w / 2,
              opacity: p.anim.interpolate({ inputRange: [0, 0.07, 0.70, 1], outputRange: [0, 1, 1, 0] }),
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

function SuccessOverlay({ visible, onDone }: { visible: boolean; onDone: () => void }) {
  const scale = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (visible) {
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 60, friction: 6 }).start();
      const t = setTimeout(onDone, 2600);
      return () => clearTimeout(t);
    }
    scale.setValue(0);
  }, [visible]);

  if (!visible) return null;
  return (
    <Modal transparent animationType="fade" visible={visible}>
      <View style={styles.overlayBg}>
        <Confetti active={visible} />
        <Animated.View style={[styles.overlayCard, { transform: [{ scale }] }]}>
          <View style={styles.overlayIconCircle}>
            <Ionicons name="trophy" size={40} color="#fff" />
          </View>
          <Text style={styles.overlayTitle}>Meal Logged!</Text>
          <Text style={styles.overlaySubtitle}>Keep up the great work!</Text>
        </Animated.View>
      </View>
    </Modal>
  );
}

const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;

export default function FoodAnalysisScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteType>();
  const { imageUri, base64 } = route.params;

  const [loading, setLoading] = useState(true);
  const [analysis, setAnalysis] = useState<AIFoodAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AIFoodAnalysis | FoodAlternative | null>(null);
  const [mealType, setMealType] = useState<FoodEntry["mealType"]>("lunch");
  const [calories, setCalories] = useState(0);
  const [protein, setProtein] = useState(0);
  const [carbs, setCarbs] = useState(0);
  const [fat, setFat] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const prefs = await getPreferences();
        const result = await analyzeFoodImage(base64, prefs.healthyFoodPreferences);
        if (cancelled) return;
        setAnalysis(result); setSelected(result);
        setCalories(result.calories); setProtein(result.protein);
        setCarbs(result.carbs); setFat(result.fat);
      } catch (e: any) {
        if (!cancelled) setError(e.message ?? "Analysis failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [imageUri]);

  function selectAlternative(alt: FoodAlternative) {
    setSelected(alt); setCalories(alt.calories); setProtein(alt.protein);
    setCarbs(alt.carbs); setFat(alt.fat);
  }
  function selectOriginal() {
    if (!analysis) return;
    setSelected(analysis); setCalories(analysis.calories); setProtein(analysis.protein);
    setCarbs(analysis.carbs); setFat(analysis.fat);
  }

  async function handleLog() {
    if (!selected || !analysis) return;
    setSaving(true);
    try {
      const activeDate = getActiveDate();
      const entry: FoodEntry = {
        id: Date.now().toString(), date: activeDate, timestamp: Date.now(),
        name: selected.name, calories, protein, carbs, fat,
        healthScore: selected.healthScore, isHealthy: selected.healthScore >= 60,
        healthNotes: "healthNotes" in selected ? selected.healthNotes : analysis.healthNotes,
        mealType,
        // Only attach the camera photo when the user kept the original analysis
        imageUri: isOriginalSelected ? imageUri : undefined,
      };
      await addEntry(entry);
      setShowSuccess(true);
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Failed to save entry");
    } finally {
      setSaving(false);
    }
  }

  function handleDone() { setShowSuccess(false); navigation.goBack(); }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingContainer}>
          <View style={styles.loadingImageWrap}>
            <Image source={{ uri: imageUri }} style={styles.loadingImage} resizeMode="cover" />
            <View style={styles.loadingImageOverlay}>
              <ActivityIndicator size="large" color="#fff" />
            </View>
          </View>
          <Text style={styles.loadingText}>Analyzing your food...</Text>
          <Text style={styles.loadingSubtext}>Claude is estimating calories & health score</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !analysis) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingContainer}>
          <Ionicons name="warning" size={64} color={C.error} />
          <Text style={[styles.loadingText, { color: C.error }]}>Analysis failed</Text>
          <Text style={styles.loadingSubtext}>{error ?? "Unknown error"}</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isOriginalSelected = selected === analysis;
  const activeDate = getActiveDate();
  const isLoggingToday = activeDate === getTodayDate();
  const logDateDisplay = isLoggingToday
    ? null
    : new Date(activeDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

  return (
    <SafeAreaView style={styles.safe}>
      <SuccessOverlay visible={showSuccess} onDone={handleDone} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.topRow}>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={20} color={C.muted} />
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <View style={{ alignItems: "center" }}>
            <Text style={styles.screenTitle}>Food Analysis</Text>
            {!isLoggingToday && (
              <View style={styles.logDateBadge}>
                <Ionicons name="calendar-outline" size={11} color={C.primary} />
                <Text style={styles.logDateText}>Logging for {logDateDisplay}</Text>
              </View>
            )}
          </View>
          <View style={{ width: 70 }} />
        </View>

        {/* Food photo */}
        <Image source={{ uri: imageUri }} style={styles.foodImage} resizeMode="cover" />

        {/* Analysis result */}
        <View style={styles.card}>
          <Text style={styles.foodName}>{analysis.name}</Text>
          <Text style={styles.healthNotes}>{analysis.healthNotes}</Text>
          <ScoreGauge score={analysis.healthScore} />
        </View>

        {/* Alternatives */}
        {analysis.alternatives.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>
              {analysis.healthScore >= 70 ? "Similar Healthy Options" : "Healthier Alternatives"}
            </Text>
            <TouchableOpacity
              style={[styles.altCard, isOriginalSelected && styles.altCardSelected]}
              onPress={selectOriginal}
            >
              <View style={styles.altHeader}>
                <View style={[styles.radio, isOriginalSelected && styles.radioActive]}>
                  {isOriginalSelected && <View style={styles.radioDot} />}
                </View>
                <Text style={styles.altName}>{analysis.name}</Text>
                <View style={[styles.altScore, { backgroundColor: healthColor(analysis.healthScore) + "18" }]}>
                  <Text style={[styles.altScoreText, { color: healthColor(analysis.healthScore) }]}>{analysis.healthScore}</Text>
                </View>
              </View>
              <Text style={styles.altMacros}>{analysis.calories} kcal · P:{analysis.protein}g C:{analysis.carbs}g F:{analysis.fat}g</Text>
            </TouchableOpacity>
            {analysis.alternatives.map((alt, i) => {
              const isAltSelected = selected === alt;
              return (
                <TouchableOpacity
                  key={i}
                  style={[styles.altCard, isAltSelected && styles.altCardSelected]}
                  onPress={() => selectAlternative(alt)}
                >
                  <View style={styles.altHeader}>
                    <View style={[styles.radio, isAltSelected && styles.radioActive]}>
                      {isAltSelected && <View style={styles.radioDot} />}
                    </View>
                    <Text style={styles.altName}>{alt.name}</Text>
                    <View style={[styles.altScore, { backgroundColor: healthColor(alt.healthScore) + "18" }]}>
                      <Text style={[styles.altScoreText, { color: healthColor(alt.healthScore) }]}>{alt.healthScore}</Text>
                    </View>
                  </View>
                  <Text style={styles.altMacros}>{alt.calories} kcal · P:{alt.protein}g C:{alt.carbs}g F:{alt.fat}g</Text>
                  <View style={styles.altReasonRow}>
                    <Ionicons name="bulb-outline" size={13} color={C.secondary} />
                    <Text style={styles.altReason}>{alt.reason}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Adjust macros */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Adjust Nutrition</Text>
          <NumberInput label="Calories" value={calories} onChange={setCalories} unit="kcal" />
          <NumberInput label="Protein" value={protein} onChange={setProtein} />
          <NumberInput label="Carbs" value={carbs} onChange={setCarbs} />
          <NumberInput label="Fat" value={fat} onChange={setFat} />
        </View>

        {/* Meal type */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Meal Type</Text>
          <View style={styles.mealTypeRow}>
            {MEAL_TYPES.map((type) => (
              <TouchableOpacity
                key={type}
                style={[styles.mealTypeBtn, mealType === type && styles.mealTypeBtnActive]}
                onPress={() => setMealType(type)}
              >
                <Text style={[styles.mealTypeTxt, mealType === type && styles.mealTypeTxtActive]}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity style={styles.logBtn} onPress={handleLog} disabled={saving}>
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.logBtnText}>Add to Daily Log</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },

  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  cancelBtn: { flexDirection: "row", alignItems: "center", gap: 2 },
  cancelText: { fontFamily: F.semibold, color: C.muted, fontSize: 15 },
  screenTitle: { fontSize: 16, fontFamily: F.bold, color: C.text },
  logDateBadge: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 3 },
  logDateText: { fontSize: 11, fontFamily: F.bold, color: C.primary },

  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, padding: 32 },
  loadingImageWrap: { width: 180, height: 180, borderRadius: 24, overflow: "hidden", marginBottom: 8 },
  loadingImage: { width: "100%", height: "100%" },
  loadingImageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(45,27,53,0.55)",
    alignItems: "center", justifyContent: "center",
  },
  loadingText: { fontSize: 18, fontFamily: F.bold, color: C.text },
  loadingSubtext: { fontSize: 13, fontFamily: F.regular, color: C.muted, textAlign: "center" },
  backBtn: { marginTop: 16, backgroundColor: C.card, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: C.border },
  backBtnText: { fontFamily: F.semibold, color: C.text },

  foodImage: { width: "100%", height: 220, borderRadius: 20, marginBottom: 12 },
  card: {
    backgroundColor: C.card, borderRadius: 20, padding: 16, marginBottom: 12,
    shadowColor: C.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  foodName: { fontSize: 20, fontFamily: F.extrabold, color: C.text, marginBottom: 4 },
  healthNotes: { fontSize: 13, fontFamily: F.regular, color: C.muted, lineHeight: 18, marginBottom: 12 },

  gaugeContainer: { gap: 8 },
  gaugeTrack: { height: 12, backgroundColor: C.border, borderRadius: 6, overflow: "hidden" },
  gaugeFill: { height: "100%", borderRadius: 6 },
  gaugeLabels: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  gaugeScore: { fontSize: 14, fontFamily: F.bold },
  gaugeBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12, borderWidth: 1 },
  gaugeBadgeText: { fontSize: 12, fontFamily: F.semibold },

  sectionTitle: { fontSize: 14, fontFamily: F.extrabold, color: C.text, marginBottom: 12 },
  altCard: { backgroundColor: C.fill, borderRadius: 14, padding: 12, marginBottom: 8, borderWidth: 1.5, borderColor: C.border },
  altCardSelected: { borderColor: C.primary, backgroundColor: C.primary + "0C" },
  altHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: C.border, alignItems: "center", justifyContent: "center" },
  radioActive: { borderColor: C.primary },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.primary },
  altName: { fontSize: 14, fontFamily: F.bold, color: C.text, flex: 1 },
  altScore: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  altScoreText: { fontSize: 12, fontFamily: F.bold },
  altMacros: { fontSize: 11, fontFamily: F.semibold, color: C.muted, marginLeft: 26 },
  altReasonRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 5, marginLeft: 26 },
  altReason: { fontSize: 11, fontFamily: F.semibold, color: C.secondary, flex: 1 },

  numInputRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  numLabel: { fontSize: 13, fontFamily: F.semibold, color: C.text, width: 70 },
  numControls: { flexDirection: "row", alignItems: "center", gap: 8 },
  numBtn: { width: 32, height: 32, backgroundColor: C.fill, borderRadius: 8, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" },
  numBtnText: { fontFamily: F.regular, color: C.text, fontSize: 18, lineHeight: 22 },
  numField: { width: 60, height: 32, backgroundColor: C.fill, borderRadius: 8, borderWidth: 1, borderColor: C.border, color: C.text, textAlign: "center", fontSize: 14, fontFamily: F.semibold },
  numUnit: { fontSize: 12, fontFamily: F.semibold, color: C.muted, width: 28 },

  mealTypeRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  mealTypeBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: C.fill, borderWidth: 1, borderColor: C.border },
  mealTypeBtnActive: { backgroundColor: C.primary + "18", borderColor: C.primary },
  mealTypeTxt: { fontSize: 13, fontFamily: F.semibold, color: C.muted },
  mealTypeTxtActive: { color: C.primary, fontFamily: F.bold },

  logBtn: {
    backgroundColor: C.primary, borderRadius: 18, paddingVertical: 18, alignItems: "center", marginTop: 4,
    shadowColor: C.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  logBtnText: { fontFamily: F.extrabold, color: "#fff", fontSize: 17 },

  overlayBg: { flex: 1, backgroundColor: "rgba(45,27,53,0.55)", alignItems: "center", justifyContent: "center" },
  overlayCard: {
    backgroundColor: C.card, borderRadius: 28, padding: 40, alignItems: "center", gap: 8,
    shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 24, elevation: 24,
  },
  overlayIconCircle: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: C.success,
    alignItems: "center", justifyContent: "center", marginBottom: 4,
  },
  overlayTitle: { fontSize: 26, fontFamily: F.extrabold, color: C.text },
  overlaySubtitle: { fontSize: 14, fontFamily: F.regular, color: C.muted },
});
