import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Image,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Switch,
  Modal,
  Animated,
  Easing,
  Dimensions,
  Platform,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";
import Svg, { Path, Circle, Defs, LinearGradient, Stop } from "react-native-svg";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getPreferences, savePreferences, setStreakForTesting, getTodayDate, getAllEntries } from "../services/storage";
import { MealReminderTime, MealReminderTimes, UserPreferences, ActivityLevel, FitnessGoal, UserGoals, OnboardingData, FoodEntry, RootStackParamList } from "../types";
import { CELEBRITY_PROFILES, CelebrityProfile } from "./OnboardingScreen";
import { scheduleNotifications, cancelAllNotifications, sendTestNotification } from "../services/notifications";
import { emitThemeChange } from "../services/eventBus";
import { C, F } from "../theme";

const SCREEN_W = Dimensions.get("window").width;
const BAND_H = 165;

const S_SPARKLE_LG = "M12 1L13 10.5L22 12L13 13.5L12 23L11 13.5L2 12L11 10.5Z";
const S_SPARKLE_SM = "M12 3L13.2 10.5L21 12L13.2 13.5L12 21L10.8 13.5L3 12L10.8 10.5Z";
const S_LEAF_BODY  = "M12 2C7 3 4 8 5 13C6 18 9 22 12 22C15 22 18 18 19 13C20 8 17 3 12 2Z";
const S_LEAF_VEIN  = "M12 3Q11 11 12 21";
const S_PETAL_BODY = "M12 2C9 3 6 7 6 11C6 16 9 20 12 21C15 20 18 16 18 11C18 7 15 3 12 2Z";
const S_FLAME_OUT  = "M12 2C9 6 5 11 5 15.5C5 19.6 8.1 22 12 22C15.9 22 19 19.6 19 15.5C19 11 15 6 12 2Z";
const S_FLAME_IN   = "M12 8C10 11 8 14 8 17C8 18.8 9.8 20 12 20C14.2 20 16 18.8 16 17C16 14 14 11 12 8Z";

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

// ─── Animated Band Decorations ───────────────────────────────────────────────

function FallingPetals() {
  const petals = useRef(
    Array.from({ length: 15 }, (_, i) => ({
      fall: new Animated.Value(Math.random()),
      sway: new Animated.Value((i % 2 === 0 ? -1 : 1) * Math.random()),
      spin: new Animated.Value((i % 2 === 0 ? -1 : 1) * Math.random()),
      x: 8 + Math.random() * (SCREEN_W - 32),
      size: 10 + Math.random() * 9,
      fallDur: 5000 + Math.random() * 4000,
      swayDur: 1400 + Math.random() * 1000,
      spinDur: 3000 + Math.random() * 2500,
      delay: i * 380,
      color: (["#FF7A8A", "#FFB3BC", "#FF9DAA", "#FFC6CF"] as const)[i % 4],
    }))
  ).current;

  useEffect(() => {
    const loops: Animated.CompositeAnimation[] = [];
    petals.forEach((p) => {
      const fl = Animated.loop(Animated.sequence([
        Animated.timing(p.fall, { toValue: 1, duration: p.fallDur, useNativeDriver: true }),
        Animated.timing(p.fall, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]));
      const sl = Animated.loop(Animated.sequence([
        Animated.timing(p.sway, { toValue:  1, duration: p.swayDur, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
        Animated.timing(p.sway, { toValue: -1, duration: p.swayDur, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
      ]));
      const sp = Animated.loop(Animated.sequence([
        Animated.timing(p.spin, { toValue:  1, duration: p.spinDur, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
        Animated.timing(p.spin, { toValue: -1, duration: p.spinDur, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
      ]));
      fl.start(); sl.start(); sp.start();
      loops.push(fl, sl, sp);
    });
    return () => { loops.forEach((l) => l.stop()); };
  }, []);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {petals.map((p, i) => {
        const ty  = p.fall.interpolate({ inputRange: [0, 1], outputRange: [-p.size, BAND_H + p.size] });
        const op  = p.fall.interpolate({ inputRange: [0, 0.07, 0.88, 1], outputRange: [0, 0.42, 0.40, 0] });
        const tx  = p.sway.interpolate({ inputRange: [-1, 1], outputRange: [-14, 14] });
        const rot = p.spin.interpolate({ inputRange: [-1, 1], outputRange: ["-30deg", "30deg"] });
        return (
          <Animated.View
            key={i}
            style={{
              position: "absolute",
              left: p.x,
              top: 0,
              width: p.size,
              height: p.size,
              opacity: op,
              transform: [{ translateY: ty }, { translateX: tx }, { rotate: rot }],
            }}
          >
            <Svg width={p.size} height={p.size} viewBox="0 0 24 24">
              <Path d={S_PETAL_BODY} fill={p.color} />
            </Svg>
          </Animated.View>
        );
      })}
    </View>
  );
}

function CottonCandyPuffs() {
  const CANDY_COLORS = ["#F9A8D4", "#E879F9", "#818CF8", "#67E8F9", "#A7F3D0", "#FCA5A5"] as const;
  const pieces = useRef(
    Array.from({ length: 28 }, (_, i) => ({
      fall: new Animated.Value(Math.random()),
      sway: new Animated.Value((i % 2 === 0 ? -1 : 1) * Math.random()),
      spin: new Animated.Value((i % 2 === 0 ? -1 : 1) * Math.random()),
      x:       5 + Math.random() * (SCREEN_W - 18),
      w:       4 + Math.random() * 5,
      h:       10 + Math.random() * 7,
      color:   CANDY_COLORS[i % 6],
      fallDur: 3000 + Math.random() * 3000,
      swayDur: 1000 + Math.random() * 800,
      spinDur: 400  + Math.random() * 600,
    }))
  ).current;

  useEffect(() => {
    const loops: Animated.CompositeAnimation[] = [];
    pieces.forEach((p) => {
      const fl = Animated.loop(Animated.sequence([
        Animated.timing(p.fall, { toValue: 1, duration: p.fallDur, useNativeDriver: true }),
        Animated.timing(p.fall, { toValue: 0, duration: 0,         useNativeDriver: true }),
      ]));
      const sl = Animated.loop(Animated.sequence([
        Animated.timing(p.sway, { toValue:  1, duration: p.swayDur, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
        Animated.timing(p.sway, { toValue: -1, duration: p.swayDur, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
      ]));
      const sp = Animated.loop(Animated.sequence([
        Animated.timing(p.spin, { toValue:  1, duration: p.spinDur, useNativeDriver: true }),
        Animated.timing(p.spin, { toValue: -1, duration: p.spinDur, useNativeDriver: true }),
      ]));
      fl.start(); sl.start(); sp.start();
      loops.push(fl, sl, sp);
    });
    return () => { loops.forEach((l) => l.stop()); };
  }, []);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((p, i) => {
        const ty  = p.fall.interpolate({ inputRange: [0, 1], outputRange: [-p.h, BAND_H + p.h] });
        const op  = p.fall.interpolate({ inputRange: [0, 0.06, 0.88, 1], outputRange: [0, 0.78, 0.72, 0] });
        const tx  = p.sway.interpolate({ inputRange: [-1, 1], outputRange: [-14, 14] });
        const rot = p.spin.interpolate({ inputRange: [-1, 1], outputRange: ["-180deg", "180deg"] });
        return (
          <Animated.View
            key={i}
            style={{
              position: "absolute",
              left: p.x,
              top: 0,
              width: p.w,
              height: p.h,
              borderRadius: 1.5,
              backgroundColor: p.color,
              opacity: op,
              transform: [{ translateY: ty }, { translateX: tx }, { rotate: rot }],
            }}
          />
        );
      })}
    </View>
  );
}

function OceanBubbles() {
  const bubbles = useRef(
    Array.from({ length: 16 }, (_, i) => ({
      rise: new Animated.Value(Math.random()),
      sway: new Animated.Value((i % 2 === 0 ? -1 : 1) * Math.random()),
      x:       10 + Math.random() * (SCREEN_W - 30),
      size:    6 + Math.random() * 13,
      riseDur: 3500 + Math.random() * 2500,
      swayDur: 800  + Math.random() * 700,
      delay:   i * 300,
      color: (["#3B82F6", "#60A5FA", "#93C5FD"] as const)[i % 3],
    }))
  ).current;

  useEffect(() => {
    const loops: Animated.CompositeAnimation[] = [];
    bubbles.forEach((b) => {
      const rl = Animated.loop(Animated.sequence([
        Animated.timing(b.rise, { toValue: 1, duration: b.riseDur, useNativeDriver: true }),
        Animated.timing(b.rise, { toValue: 0, duration: 0,         useNativeDriver: true }),
      ]));
      const sl = Animated.loop(Animated.sequence([
        Animated.timing(b.sway, { toValue:  1, duration: b.swayDur, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
        Animated.timing(b.sway, { toValue: -1, duration: b.swayDur, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
      ]));
      rl.start(); sl.start();
      loops.push(rl, sl);
    });
    return () => { loops.forEach((l) => l.stop()); };
  }, []);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {bubbles.map((b, i) => {
        const ty = b.rise.interpolate({ inputRange: [0, 1], outputRange: [BAND_H + 10, -b.size] });
        const op = b.rise.interpolate({ inputRange: [0, 0.06, 0.80, 1], outputRange: [0, 0.42, 0.35, 0] });
        const tx = b.sway.interpolate({ inputRange: [-1, 1], outputRange: [-10, 10] });
        return (
          <Animated.View
            key={i}
            style={{
              position: "absolute",
              left: b.x,
              top: 0,
              width: b.size,
              height: b.size,
              opacity: op,
              transform: [{ translateY: ty }, { translateX: tx }],
            }}
          >
            <Svg width={b.size} height={b.size} viewBox="0 0 24 24">
              <Circle cx="12" cy="12" r="11" fill={b.color} opacity={0.45} />
              <Circle cx="12" cy="12" r="11" fill="none" stroke={b.color} strokeWidth="1.5" opacity={0.85} />
              <Circle cx="8"  cy="8"  r="3.5" fill="white" opacity={0.50} />
            </Svg>
          </Animated.View>
        );
      })}
    </View>
  );
}

function TwinklingStars() {
  const stars = useRef(
    Array.from({ length: 30 }, (_, i) => ({
      opacity: new Animated.Value(Math.random() * 0.04),
      scale:   new Animated.Value(0.4 + Math.random() * 0.4),
      x: 6 + Math.random() * (SCREEN_W - 16),
      y: 6 + Math.random() * (BAND_H - 14),
      size: i < 10 ? 11 + Math.random() * 7 : 5 + Math.random() * 5,
      dur: 600 + Math.random() * 1600,
      delay: i * 90,
      maxOp: 0.75 + Math.random() * 0.25,
      color: (["#C4B5FD", "#A5B4FC", "#E9D5FF", "#DDD6FE"] as const)[i % 4],
      isStar: i < 24,
    }))
  ).current;

  useEffect(() => {
    const loops = stars.map((s) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(s.delay),
          Animated.parallel([
            Animated.timing(s.opacity, { toValue: s.maxOp, duration: s.dur,       useNativeDriver: true }),
            Animated.timing(s.scale,   { toValue: 1.15,    duration: s.dur * 0.8, useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(s.opacity, { toValue: 0.02,    duration: s.dur * 1.2, useNativeDriver: true }),
            Animated.timing(s.scale,   { toValue: 0.45,    duration: s.dur,       useNativeDriver: true }),
          ]),
        ])
      )
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, []);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {stars.map((s, i) => (
        <Animated.View
          key={i}
          style={{
            position: "absolute",
            left: s.x - s.size / 2,
            top:  s.y - s.size / 2,
            width: s.size,
            height: s.size,
            opacity: s.opacity,
            transform: [{ scale: s.scale }],
          }}
        >
          <Svg width={s.size} height={s.size} viewBox="0 0 24 24">
            {s.isStar ? (
              <Path d={i % 4 === 0 ? S_SPARKLE_LG : S_SPARKLE_SM} fill={s.color} />
            ) : (
              <Circle cx="12" cy="12" r="9" fill={s.color} />
            )}
          </Svg>
        </Animated.View>
      ))}
    </View>
  );
}

function RisingEmbers() {
  const embers = useRef(
    Array.from({ length: 13 }, (_, i) => ({
      rise:    new Animated.Value(Math.random()),
      sway:    new Animated.Value((i % 2 === 0 ? -1 : 1) * Math.random()),
      flicker: new Animated.Value(1),
      x:          8 + Math.random() * (SCREEN_W - 20),
      size:       i % 4 === 0 ? 16 + Math.random() * 6 : 9 + Math.random() * 7,
      riseDur:    4500 + Math.random() * 3000,
      swayDur:    550  + Math.random() * 500,
      flickerDur: 280  + Math.random() * 300,
      delay:      i * 380,
      isSpark:    i % 3 === 2,
    }))
  ).current;

  useEffect(() => {
    const loops: Animated.CompositeAnimation[] = [];
    embers.forEach((e) => {
      const rl = Animated.loop(Animated.sequence([
        Animated.timing(e.rise,    { toValue: 1, duration: e.riseDur, useNativeDriver: true }),
        Animated.timing(e.rise,    { toValue: 0, duration: 0,         useNativeDriver: true }),
      ]));
      const sl = Animated.loop(Animated.sequence([
        Animated.timing(e.sway,    { toValue:  1, duration: e.swayDur,    useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
        Animated.timing(e.sway,    { toValue: -1, duration: e.swayDur,    useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
      ]));
      const fl = Animated.loop(Animated.sequence([
        Animated.timing(e.flicker, { toValue: 0.88, duration: e.flickerDur, useNativeDriver: true }),
        Animated.timing(e.flicker, { toValue: 1.06, duration: e.flickerDur, useNativeDriver: true }),
      ]));
      rl.start(); sl.start(); fl.start();
      loops.push(rl, sl, fl);
    });
    return () => { loops.forEach((l) => l.stop()); };
  }, []);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {embers.map((e, i) => {
        const size = e.isSpark ? e.size * 0.55 : e.size;
        const ty   = e.rise.interpolate({ inputRange: [0, 1], outputRange: [BAND_H + 10, -size] });
        const op   = e.rise.interpolate({ inputRange: [0, 0.08, 0.80, 1], outputRange: [0, 0.45, 0.40, 0] });
        const tx   = e.sway.interpolate({ inputRange: [-1, 1], outputRange: [-10, 10] });
        return (
          <Animated.View
            key={i}
            style={{
              position: "absolute",
              left: e.x,
              top: 0,
              width: size,
              height: size,
              opacity: op,
              transform: [{ translateY: ty }, { translateX: tx }, { scale: e.flicker }],
            }}
          >
            <Svg width={size} height={size} viewBox="0 0 24 24">
              <Defs>
                <LinearGradient id="fg" x1="0.5" y1="0" x2="0.5" y2="1">
                  <Stop offset="0"   stopColor="#FDE68A" />
                  <Stop offset="0.5" stopColor="#F97316" />
                  <Stop offset="1"   stopColor="#DC2626" />
                </LinearGradient>
              </Defs>
              <Path d={S_FLAME_OUT} fill="url(#fg)" />
              {!e.isSpark && <Path d={S_FLAME_IN} fill="#FEF08A" opacity={0.65} />}
            </Svg>
          </Animated.View>
        );
      })}
    </View>
  );
}

function FloatingLeaves() {
  const leafColors = ["#4ADE80", "#22C55E", "#86EFAC"] as const;
  const veinColors = ["#166534", "#15803D", "#16A34A"] as const;

  const leaves = useRef(
    Array.from({ length: 14 }, (_, i) => ({
      fall: new Animated.Value(Math.random()),
      sway: new Animated.Value((i % 2 === 0 ? -1 : 1) * Math.random()),
      spin: new Animated.Value((i % 2 === 0 ? -1 : 1) * Math.random()),
      x: 8 + Math.random() * (SCREEN_W - 30),
      size: 12 + Math.random() * 11,
      fallDur: 5500 + Math.random() * 3500,
      swayDur: 1400 + Math.random() * 1000,
      spinDur: 3500 + Math.random() * 3000,
      delay: i * 350,
      variant: i % 3 as 0 | 1 | 2,
    }))
  ).current;

  useEffect(() => {
    const loops: Animated.CompositeAnimation[] = [];
    leaves.forEach((l) => {
      const fl = Animated.loop(Animated.sequence([
        Animated.timing(l.fall, { toValue: 1, duration: l.fallDur, useNativeDriver: true }),
        Animated.timing(l.fall, { toValue: 0, duration: 0,         useNativeDriver: true }),
      ]));
      const sl = Animated.loop(Animated.sequence([
        Animated.timing(l.sway, { toValue:  1, duration: l.swayDur, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
        Animated.timing(l.sway, { toValue: -1, duration: l.swayDur, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
      ]));
      const sp = Animated.loop(Animated.sequence([
        Animated.timing(l.spin, { toValue:  1, duration: l.spinDur, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
        Animated.timing(l.spin, { toValue: -1, duration: l.spinDur, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
      ]));
      fl.start(); sl.start(); sp.start();
      loops.push(fl, sl, sp);
    });
    return () => { loops.forEach((l) => l.stop()); };
  }, []);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {leaves.map((l, i) => {
        const ty  = l.fall.interpolate({ inputRange: [0, 1], outputRange: [-l.size, BAND_H + l.size] });
        const op  = l.fall.interpolate({ inputRange: [0, 0.07, 0.88, 1], outputRange: [0, 0.44, 0.42, 0] });
        const tx  = l.sway.interpolate({ inputRange: [-1, 1], outputRange: [-14, 14] });
        const rot = l.spin.interpolate({ inputRange: [-1, 1], outputRange: ["-25deg", "25deg"] });
        return (
          <Animated.View
            key={i}
            style={{
              position: "absolute",
              left: l.x,
              top: 0,
              width: l.size,
              height: l.size,
              opacity: op,
              transform: [{ translateY: ty }, { translateX: tx }, { rotate: rot }],
            }}
          >
            <Svg width={l.size} height={l.size} viewBox="0 0 24 24">
              <Path d={S_LEAF_BODY} fill={leafColors[l.variant]} />
              <Path d={S_LEAF_VEIN} stroke={veinColors[l.variant]} strokeWidth="1.5" strokeLinecap="round" fill="none" />
            </Svg>
          </Animated.View>
        );
      })}
    </View>
  );
}

function AnimatedBandDecor({ themeId }: { themeId: string }) {
  if (themeId === "rose") return <FallingPetals />;
  if (themeId === "candy") return <CottonCandyPuffs />;
  if (themeId === "ocean") return <OceanBubbles />;
  if (themeId === "night") return <TwinklingStars />;
  if (themeId === "ember") return <RisingEmbers />;
  if (themeId === "forest") return <FloatingLeaves />;
  return null;
}

// ─── GoalInput ───────────────────────────────────────────────────────────────

function GoalInput({
  label, value, onChange, unit = "g",
}: {
  label: string; value: number; onChange: (v: number) => void; unit?: string;
}) {
  return (
    <View style={styles.goalRow}>
      <Text style={styles.goalLabel}>{label}</Text>
      <View style={styles.goalInputWrap}>
        <TextInput
          style={styles.goalInput}
          value={String(value)}
          onChangeText={(t) => { const n = parseInt(t, 10); if (!isNaN(n) && n >= 0) onChange(n); }}
          keyboardType="numeric"
          selectTextOnFocus
          placeholderTextColor={C.muted}
        />
        <Text style={styles.goalUnit}>{unit}</Text>
      </View>
    </View>
  );
}

// ─── MealReminderRow ─────────────────────────────────────────────────────────

const MEAL_META: Record<keyof MealReminderTimes, { label: string; icon: IoniconName }> = {
  breakfast: { label: "Breakfast",        icon: "sunny-outline" },
  lunch:     { label: "Lunch",            icon: "partly-sunny-outline" },
  dinner:    { label: "Dinner",           icon: "moon-outline" },
  evening:   { label: "Evening Check-in", icon: "star-outline" },
};

function pad(n: number) { return String(n).padStart(2, "0"); }

function MealReminderRow({
  mealKey, slot, onChange,
}: {
  mealKey: keyof MealReminderTimes; slot: MealReminderTime; onChange: (s: MealReminderTime) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const meta = MEAL_META[mealKey];

  const ampm = slot.hour < 12 ? "AM" : "PM";
  const h12 = slot.hour === 0 ? 12 : slot.hour > 12 ? slot.hour - 12 : slot.hour;
  const display = `${h12}:${pad(slot.minute)} ${ampm}`;

  function stepHour(delta: number) {
    const newH12 = ((h12 - 1 + delta + 12) % 12) + 1;
    let newHour24: number;
    if (ampm === "AM") newHour24 = newH12 === 12 ? 0 : newH12;
    else newHour24 = newH12 === 12 ? 12 : newH12 + 12;
    onChange({ ...slot, hour: newHour24 });
  }

  function stepMinute(delta: number) {
    onChange({ ...slot, minute: (slot.minute + delta + 60) % 60 });
  }

  function toggleAmPm() {
    onChange({ ...slot, hour: (slot.hour + 12) % 24 });
  }

  return (
    <View style={mealS.wrap}>
      <View style={mealS.row}>
        <View style={mealS.iconWrap}>
          <Ionicons name={meta.icon} size={18} color={C.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={mealS.label}>{meta.label}</Text>
          <TouchableOpacity onPress={() => slot.enabled && setExpanded((v) => !v)}>
            <View style={mealS.timeRow}>
              <Text style={[mealS.time, !slot.enabled && { color: C.muted }]}>
                {slot.enabled ? display : "Off"}
              </Text>
              {slot.enabled && (
                <Ionicons
                  name={expanded ? "chevron-up" : "chevron-down"}
                  size={13}
                  color={C.primary}
                  style={{ marginLeft: 3 }}
                />
              )}
            </View>
          </TouchableOpacity>
        </View>
        <Switch
          value={slot.enabled}
          onValueChange={(v) => { onChange({ ...slot, enabled: v }); if (!v) setExpanded(false); }}
          trackColor={{ false: "#6B6B6B", true: C.success }}
          thumbColor={slot.enabled ? "#fff" : "#9E9E9E"}
        />
      </View>
      {expanded && slot.enabled && (
        <View style={mealS.picker}>
          <View style={mealS.spinnerGroup}>
            <TouchableOpacity style={mealS.spinBtn} onPress={() => stepHour(1)}>
              <Ionicons name="chevron-up" size={16} color={C.text} />
            </TouchableOpacity>
            <Text style={mealS.spinVal}>{pad(h12)}</Text>
            <TouchableOpacity style={mealS.spinBtn} onPress={() => stepHour(-1)}>
              <Ionicons name="chevron-down" size={16} color={C.text} />
            </TouchableOpacity>
          </View>
          <Text style={mealS.spinColon}>:</Text>
          <View style={mealS.spinnerGroup}>
            <TouchableOpacity style={mealS.spinBtn} onPress={() => stepMinute(1)}>
              <Ionicons name="chevron-up" size={16} color={C.text} />
            </TouchableOpacity>
            <Text style={mealS.spinVal}>{pad(slot.minute)}</Text>
            <TouchableOpacity style={mealS.spinBtn} onPress={() => stepMinute(-1)}>
              <Ionicons name="chevron-down" size={16} color={C.text} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={mealS.ampmBtn} onPress={toggleAmPm} activeOpacity={0.7}>
            <Text style={mealS.ampmText}>{ampm}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={mealS.doneBtn} onPress={() => setExpanded(false)}>
            <Text style={mealS.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const mealS = StyleSheet.create({
  wrap: { marginBottom: 4 },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 10 },
  iconWrap: {
    width: 34, height: 34, borderRadius: 10, backgroundColor: C.primary + "15",
    alignItems: "center", justifyContent: "center", marginRight: 12,
  },
  label: { fontSize: 14, fontFamily: F.bold, color: C.text },
  timeRow: { flexDirection: "row", alignItems: "center", marginTop: 1 },
  time: { fontSize: 12, fontFamily: F.semibold, color: C.primary },
  picker: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: C.fill, borderRadius: 14, paddingVertical: 12, marginTop: 4,
    gap: 8, borderWidth: 1, borderColor: C.border,
  },
  spinnerGroup: { alignItems: "center", gap: 6 },
  spinBtn: {
    paddingHorizontal: 14, paddingVertical: 6,
    backgroundColor: C.card, borderRadius: 8, borderWidth: 1, borderColor: C.border,
  },
  spinVal: { fontSize: 28, fontFamily: F.extrabold, color: C.text, width: 44, textAlign: "center" },
  spinColon: { fontSize: 24, fontFamily: F.extrabold, color: C.muted, marginBottom: 2 },
  ampmBtn: {
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: C.primary + "18", borderRadius: 10, borderWidth: 1, borderColor: C.primary + "40",
  },
  ampmText: { fontSize: 14, fontFamily: F.bold, color: C.primary },
  doneBtn: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: C.primary, borderRadius: 10, marginLeft: 8 },
  doneBtnText: { fontFamily: F.bold, color: "#fff", fontSize: 13 },
});

// ─── Profile Themes ───────────────────────────────────────────────────────────

const PROFILE_THEMES = [
  { id: "rose",   name: "Rose",         emoji: "🌸", bg: "#FF7A8A" },
  { id: "ocean",  name: "Ocean",        emoji: "🌊", bg: "#3B82F6" },
  { id: "candy",  name: "Confetti",     emoji: "🎊", bg: "#A855F7" },
  { id: "ember",  name: "Ember",        emoji: "🔥", bg: "#F97316" },
  { id: "forest", name: "Forest",       emoji: "🌿", bg: "#22C55E" },
  { id: "night",  name: "Night Sky",    emoji: "✨", bg: "#4F46E5" },
];

const pt = StyleSheet.create({
  band: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingTop: 22,
    paddingBottom: 22,
    alignItems: "center",
    gap: 8,
    overflow: "hidden",
  },
  bandEmoji: { fontSize: 24, opacity: 0.75 },
  avatarCircle: {
    width: 68, height: 68, borderRadius: 34,
    backgroundColor: "rgba(255,255,255,0.22)",
    borderWidth: 2, borderColor: "rgba(255,255,255,0.45)",
    alignItems: "center", justifyContent: "center",
  },
  avatarText: { fontSize: 26, fontFamily: F.extrabold, color: "#fff" },
  bandName: { fontSize: 14, fontFamily: F.bold, color: "rgba(255,255,255,0.82)" },
  body: { padding: 16, alignItems: "center" },
  themeRow: { flexDirection: "row", gap: 10, marginTop: 6, marginBottom: 4 },
  swatch: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: "center", justifyContent: "center",
    borderWidth: 2.5, borderColor: "transparent",
  },
  swatchSel: {
    borderColor: "rgba(255,255,255,0.85)",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 5, elevation: 4,
  },
  themeLabel: { fontSize: 12, fontFamily: F.semibold, color: C.muted, marginTop: 4 },
  editBtn: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center", justifyContent: "center",
  },
  cameraOverlay: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center", justifyContent: "center",
  },
});

// ─── Goal recalculation ──────────────────────────────────────────────────────

function recalcGoalsWithCeleb(ob: OnboardingData, celeb?: CelebrityProfile): UserGoals {
  const age = isNaN(ob.age) || ob.age <= 0 ? 25 : ob.age;
  const h   = isNaN(ob.heightCm) || ob.heightCm <= 0 ? 170 : ob.heightCm;
  const w   = isNaN(ob.weightKg) || ob.weightKg <= 0 ? 70  : ob.weightKg;
  const bmr = ob.gender === "male"
    ? 10 * w + 6.25 * h - 5 * age + 5
    : 10 * w + 6.25 * h - 5 * age - 161;
  const actMap: Record<ActivityLevel, number> = {
    sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9,
  };
  const tdee = bmr * (actMap[ob.activityLevel] ?? 1.55);
  const offsets: Record<FitnessGoal, number> = {
    lose_weight: -500, gain_weight: 300, maintain: 0, build_muscle: 200,
  };
  const splits: Record<FitnessGoal, { p: number; c: number; f: number }> = {
    lose_weight:  { p: 0.40, c: 0.30, f: 0.30 },
    gain_weight:  { p: 0.25, c: 0.50, f: 0.25 },
    maintain:     { p: 0.30, c: 0.40, f: 0.30 },
    build_muscle: { p: 0.35, c: 0.45, f: 0.20 },
  };
  let cals  = tdee + (offsets[ob.fitnessGoal] ?? 0);
  let split = splits[ob.fitnessGoal] ?? splits.maintain;
  if (celeb) {
    cals  = tdee * (1 + celeb.calorieAdjust);
    split = { p: celeb.proteinPct, c: celeb.carbPct, f: celeb.fatPct };
  }
  const safeCals = isNaN(cals) ? 1800 : Math.max(1200, Math.round(cals));
  return {
    dailyCalories: safeCals,
    dailyProtein:  Math.round((safeCals * split.p) / 4),
    dailyCarbs:    Math.round((safeCals * split.c) / 4),
    dailyFat:      Math.round((safeCals * split.f) / 9),
  };
}

async function hashPassword(password: string): Promise<string> {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hash = await (globalThis.crypto ?? crypto).subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    let h = 5381;
    for (let i = 0; i < password.length; i++) {
      h = ((h << 5) + h) ^ password.charCodeAt(i);
      h >>>= 0;
    }
    return h.toString(16).padStart(8, "0") + password.length.toString(16);
  }
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const navigation = useNavigation();
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);
  const [dirty, setDirty] = useState(false);
  const [showCelebPicker, setShowCelebPicker] = useState(false);
  const [devMode, setDevMode] = useState(false);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [emailEditing, setEmailEditing] = useState(false);
  const [emailDraft, setEmailDraft] = useState("");
  const [pwExpanded, setPwExpanded] = useState(false);
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [showPwCurrent, setShowPwCurrent] = useState(false);
  const [showPwNew, setShowPwNew] = useState(false);
  const toastAnim = useRef(new Animated.Value(150)).current;
  const devTapCount = useRef(0);
  const devTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleAboutTap() {
    devTapCount.current += 1;
    if (devTapTimer.current) clearTimeout(devTapTimer.current);
    devTapTimer.current = setTimeout(() => { devTapCount.current = 0; }, 2000);
    if (devTapCount.current >= 5) {
      devTapCount.current = 0;
      setDevMode((v) => !v);
    }
  }

  const load = useCallback(async () => {
    const p = await getPreferences();
    setPrefs(p);
    setDirty(false);
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  function update(patch: Partial<UserPreferences>) {
    setPrefs((prev) => (prev ? { ...prev, ...patch } : prev));
    if (!dirty) setDirty(true);
  }

  function updateGoal(key: keyof UserPreferences["goals"], val: number) {
    if (!prefs) return;
    update({ goals: { ...prefs.goals, [key]: val } });
  }

  function updateReminder(key: keyof MealReminderTimes, slot: MealReminderTime) {
    if (!prefs) return;
    update({ mealReminderTimes: { ...prefs.mealReminderTimes, [key]: slot } });
  }

  function showToast() {
    toastAnim.setValue(150);
    Animated.sequence([
      Animated.timing(toastAnim, { toValue: 0,   duration: 280, useNativeDriver: true }),
      Animated.delay(1800),
      Animated.timing(toastAnim, { toValue: 150, duration: 240, useNativeDriver: true }),
    ]).start();
  }

  async function save() {
    if (!prefs) return;
    setDirty(false);
    showToast();
    await savePreferences(prefs);
    emitThemeChange();
    if (prefs.notificationsEnabled) await scheduleNotifications(prefs.mealReminderTimes);
    else await cancelAllNotifications();
  }

  async function handleMasterToggle(val: boolean) {
    update({ notificationsEnabled: val });
    if (val) await scheduleNotifications(prefs?.mealReminderTimes);
    else await cancelAllNotifications();
  }

  async function handleCelebChange(celebId: string) {
    if (!prefs) return;
    const celeb = CELEBRITY_PROFILES.find((c) => c.id === celebId);
    const newGoals = recalcGoalsWithCeleb(prefs.onboarding, celeb);
    const newPrefs = {
      ...prefs,
      goals: newGoals,
      onboarding: { ...prefs.onboarding, celebrityProfile: celebId },
    };
    setPrefs(newPrefs);
    await savePreferences(newPrefs);
    setShowCelebPicker(false);
    showToast();
  }

  async function pickProfilePicture() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Allow access to your photo library to set a profile picture.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const src = result.assets[0].uri;
      if (Platform.OS === "web") {
        const resized = await ImageManipulator.manipulateAsync(
          src,
          [{ resize: { width: 256 } }],
          { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true },
        );
        update({ profilePicture: `data:image/jpeg;base64,${resized.base64}` });
      } else {
        const dest = `${FileSystem.documentDirectory ?? ""}profile_picture.jpg`;
        await FileSystem.copyAsync({ from: src, to: dest });
        update({ profilePicture: dest });
      }
    }
  }

  async function handleSignOut() {
    if (!prefs) return;
    await savePreferences({ isAuthenticated: false });
    navigation.getParent()?.reset({ index: 0, routes: [{ name: "Onboarding", params: { returnToLogin: true } }] } as any);
  }

  async function handleSaveEmail() {
    const trimmed = emailDraft.trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@")) {
      Alert.alert("Invalid email", "Please enter a valid email address.");
      return;
    }
    await savePreferences({ email: trimmed });
    setPrefs((prev) => prev ? { ...prev, email: trimmed } : prev);
    setEmailEditing(false);
    showToast();
  }

  async function handleSavePassword() {
    if (!pwNew || !pwConfirm) {
      Alert.alert("Missing fields", "Please fill in all password fields.");
      return;
    }
    if (pwNew !== pwConfirm) {
      Alert.alert("Passwords don't match", "New password and confirmation don't match.");
      return;
    }
    if (pwNew.length < 6) {
      Alert.alert("Weak password", "Password must be at least 6 characters.");
      return;
    }
    if (prefs?.passwordHash) {
      if (!pwCurrent) {
        Alert.alert("Missing fields", "Please enter your current password.");
        return;
      }
      const currentHash = await hashPassword(pwCurrent);
      if (currentHash !== prefs.passwordHash) {
        Alert.alert("Incorrect password", "Current password is incorrect.");
        return;
      }
    }
    const hash = await hashPassword(pwNew);
    await savePreferences({ passwordHash: hash });
    setPrefs((prev) => prev ? { ...prev, passwordHash: hash } : prev);
    setPwExpanded(false);
    setPwCurrent(""); setPwNew(""); setPwConfirm("");
    showToast();
  }

  async function handleDevAddSampleMeals() {
    const today = getTodayDate();
    const base = Date.now();
    const samples: FoodEntry[] = [
      { id: `s1_${base}`, date: today, timestamp: base,     name: "Greek Yogurt Bowl",      calories: 320, protein: 24, carbs: 38, fat:  8, healthScore: 85, isHealthy: true,  healthNotes: "High protein, probiotic-rich",    mealType: "breakfast" },
      { id: `s2_${base}`, date: today, timestamp: base + 1, name: "Grilled Chicken Salad",  calories: 410, protein: 42, carbs: 18, fat: 16, healthScore: 90, isHealthy: true,  healthNotes: "Lean protein, lots of fiber",     mealType: "lunch"     },
      { id: `s3_${base}`, date: today, timestamp: base + 2, name: "Salmon with Veggies",   calories: 520, protein: 38, carbs: 22, fat: 24, healthScore: 88, isHealthy: true,  healthNotes: "Rich in omega-3s",               mealType: "dinner"    },
      { id: `s4_${base}`, date: today, timestamp: base + 3, name: "Protein Bar",           calories: 210, protein: 20, carbs: 22, fat:  6, healthScore: 65, isHealthy: false, healthNotes: "Decent protein but processed",   mealType: "snack"     },
      { id: `s5_${base}`, date: today, timestamp: base + 4, name: "Mixed Nuts",            calories: 180, protein:  5, carbs:  7, fat: 16, healthScore: 78, isHealthy: true,  healthNotes: "Healthy fats and minerals",      mealType: "snack"     },
    ];
    const existing = await getAllEntries();
    await AsyncStorage.setItem("food_entries", JSON.stringify([...existing, ...samples]));
  }

  async function handleDevLoadDemoProfile(profile: "muscle_male" | "loss_female" | "maintain_male") {
    const today = getTodayDate();
    const todayMs = new Date(today + "T12:00:00").getTime();
    const DAY = 86_400_000;

    type MealRow = { name: string; cal: number; p: number; c: number; f: number; score: number; type: FoodEntry["mealType"] };
    const makeDayEntries = (date: string, meals: MealRow[]): FoodEntry[] =>
      meals.map((m, i) => ({
        id: `demo_${date}_${i}`,
        date,
        timestamp: new Date(date + "T12:00:00").getTime() + i * 3_600_000,
        name: m.name, calories: m.cal, protein: m.p, carbs: m.c, fat: m.f,
        healthScore: m.score, isHealthy: m.score >= 60,
        healthNotes: m.score >= 75 ? "Nutritious choice" : "Moderate option",
        mealType: m.type,
      }));

    let entries: FoodEntry[] = [];
    let weightEntries: Array<{ id: string; date: string; timestamp: number; weightKg: number }> = [];
    let newPrefs: Partial<UserPreferences> = {};

    if (profile === "muscle_male") {
      const dayPlans: MealRow[][] = [
        [{ name: "Oat & Egg Power Bowl", cal: 620, p: 48, c: 70, f: 14, score: 88, type: "breakfast" }, { name: "Chicken Rice Bowl", cal: 680, p: 58, c: 72, f: 10, score: 90, type: "lunch" }, { name: "Steak & Sweet Potato", cal: 720, p: 62, c: 56, f: 20, score: 85, type: "dinner" }, { name: "Greek Yogurt", cal: 280, p: 24, c: 22, f: 8, score: 82, type: "snack" }],
        [{ name: "Protein Pancakes", cal: 540, p: 44, c: 58, f: 12, score: 84, type: "breakfast" }, { name: "Turkey Wrap", cal: 590, p: 50, c: 52, f: 14, score: 80, type: "lunch" }, { name: "Salmon & Quinoa", cal: 680, p: 56, c: 60, f: 18, score: 91, type: "dinner" }, { name: "Protein Bar", cal: 240, p: 22, c: 24, f: 6, score: 65, type: "snack" }],
        [{ name: "Scrambled Eggs & Toast", cal: 480, p: 34, c: 44, f: 18, score: 80, type: "breakfast" }, { name: "Grilled Chicken Salad", cal: 520, p: 48, c: 22, f: 20, score: 88, type: "lunch" }, { name: "Ground Beef & Rice", cal: 740, p: 60, c: 68, f: 22, score: 78, type: "dinner" }, { name: "Almonds & Banana", cal: 260, p: 8, c: 36, f: 12, score: 85, type: "snack" }],
        [{ name: "Oat & Egg Power Bowl", cal: 620, p: 48, c: 70, f: 14, score: 88, type: "breakfast" }, { name: "Chicken Rice Bowl", cal: 680, p: 58, c: 72, f: 10, score: 90, type: "lunch" }, { name: "Steak & Sweet Potato", cal: 720, p: 62, c: 56, f: 20, score: 85, type: "dinner" }],
        [{ name: "Protein Pancakes", cal: 540, p: 44, c: 58, f: 12, score: 84, type: "breakfast" }, { name: "Turkey Wrap", cal: 590, p: 50, c: 52, f: 14, score: 80, type: "lunch" }, { name: "Salmon & Quinoa", cal: 680, p: 56, c: 60, f: 18, score: 91, type: "dinner" }, { name: "Cottage Cheese", cal: 200, p: 20, c: 10, f: 6, score: 86, type: "snack" }],
        [{ name: "Egg Omelet & Avocado", cal: 500, p: 36, c: 18, f: 32, score: 86, type: "breakfast" }, { name: "Grilled Chicken Salad", cal: 520, p: 48, c: 22, f: 20, score: 88, type: "lunch" }, { name: "Ground Beef & Rice", cal: 740, p: 60, c: 68, f: 22, score: 78, type: "dinner" }],
        [{ name: "Oat & Egg Power Bowl", cal: 620, p: 48, c: 70, f: 14, score: 88, type: "breakfast" }, { name: "Chicken Rice Bowl", cal: 680, p: 58, c: 72, f: 10, score: 90, type: "lunch" }, { name: "Salmon & Quinoa", cal: 680, p: 56, c: 60, f: 18, score: 91, type: "dinner" }, { name: "Greek Yogurt", cal: 280, p: 24, c: 22, f: 8, score: 82, type: "snack" }],
      ];
      const alexWeights = [87.2, 87.5, 87.8, 87.6, 88.0, 88.3, 88.5];
      for (let i = 0; i < 7; i++) {
        const date = new Date(todayMs - (6 - i) * DAY);
        const ds = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
        entries.push(...makeDayEntries(ds, dayPlans[i]));
        weightEntries.push({ id: `demo_w_alex_${i}`, date: ds, timestamp: new Date(ds + "T08:00:00").getTime(), weightKg: alexWeights[i] });
      }
      newPrefs = { name: "Alex", profileTheme: "forest", streakDays: 14, lastLogDate: today, celebratedStreakMilestones: [3, 7], goals: { dailyCalories: 2800, dailyProtein: 200, dailyCarbs: 280, dailyFat: 80 }, onboarding: { completed: true, gender: "male", age: 28, heightCm: 183, weightKg: 88, activityLevel: "very_active", fitnessGoal: "build_muscle", celebrityProfile: "chris_hemsworth" } };
    } else if (profile === "loss_female") {
      const dayPlans: MealRow[][] = [
        [{ name: "Smoothie Bowl", cal: 380, p: 18, c: 52, f: 12, score: 88, type: "breakfast" }, { name: "Lentil Salad", cal: 420, p: 22, c: 50, f: 12, score: 90, type: "lunch" }, { name: "Grilled Fish & Veg", cal: 460, p: 40, c: 30, f: 16, score: 92, type: "dinner" }, { name: "Apple & Almond Butter", cal: 180, p: 4, c: 26, f: 8, score: 80, type: "snack" }],
        [{ name: "Greek Yogurt Parfait", cal: 320, p: 20, c: 42, f: 8, score: 85, type: "breakfast" }, { name: "Grilled Chicken Wrap", cal: 440, p: 36, c: 44, f: 12, score: 82, type: "lunch" }, { name: "Salmon & Greens", cal: 500, p: 44, c: 20, f: 22, score: 94, type: "dinner" }, { name: "Hummus & Veggies", cal: 160, p: 6, c: 18, f: 7, score: 86, type: "snack" }],
        [{ name: "Egg White Omelet", cal: 300, p: 28, c: 14, f: 12, score: 86, type: "breakfast" }, { name: "Lentil Salad", cal: 420, p: 22, c: 50, f: 12, score: 90, type: "lunch" }, { name: "Chicken Stir-Fry", cal: 480, p: 42, c: 36, f: 14, score: 85, type: "dinner" }],
        [{ name: "Smoothie Bowl", cal: 380, p: 18, c: 52, f: 12, score: 88, type: "breakfast" }, { name: "Mediterranean Salad", cal: 400, p: 16, c: 38, f: 20, score: 88, type: "lunch" }, { name: "Grilled Fish & Veg", cal: 460, p: 40, c: 30, f: 16, score: 92, type: "dinner" }, { name: "Mixed Berries", cal: 100, p: 2, c: 24, f: 1, score: 95, type: "snack" }],
        [{ name: "Greek Yogurt Parfait", cal: 320, p: 20, c: 42, f: 8, score: 85, type: "breakfast" }, { name: "Grilled Chicken Wrap", cal: 440, p: 36, c: 44, f: 12, score: 82, type: "lunch" }, { name: "Salmon & Greens", cal: 500, p: 44, c: 20, f: 22, score: 94, type: "dinner" }],
        [{ name: "Egg White Omelet", cal: 300, p: 28, c: 14, f: 12, score: 86, type: "breakfast" }, { name: "Mediterranean Salad", cal: 400, p: 16, c: 38, f: 20, score: 88, type: "lunch" }, { name: "Chicken Stir-Fry", cal: 480, p: 42, c: 36, f: 14, score: 85, type: "dinner" }, { name: "Hummus & Veggies", cal: 160, p: 6, c: 18, f: 7, score: 86, type: "snack" }],
        [{ name: "Smoothie Bowl", cal: 380, p: 18, c: 52, f: 12, score: 88, type: "breakfast" }, { name: "Lentil Salad", cal: 420, p: 22, c: 50, f: 12, score: 90, type: "lunch" }, { name: "Grilled Fish & Veg", cal: 460, p: 40, c: 30, f: 16, score: 92, type: "dinner" }, { name: "Apple & Almond Butter", cal: 180, p: 4, c: 26, f: 8, score: 80, type: "snack" }],
      ];
      const saraWeights = [68.9, 68.6, 68.4, 68.7, 68.3, 68.1, 67.9];
      for (let i = 0; i < 7; i++) {
        const date = new Date(todayMs - (6 - i) * DAY);
        const ds = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
        entries.push(...makeDayEntries(ds, dayPlans[i]));
        weightEntries.push({ id: `demo_w_sara_${i}`, date: ds, timestamp: new Date(ds + "T08:00:00").getTime(), weightKg: saraWeights[i] });
      }
      newPrefs = { name: "Sara", profileTheme: "rose", streakDays: 3, lastLogDate: today, celebratedStreakMilestones: [], goals: { dailyCalories: 1550, dailyProtein: 120, dailyCarbs: 160, dailyFat: 52 }, onboarding: { completed: true, gender: "female", age: 30, heightCm: 165, weightKg: 68, activityLevel: "moderate", fitnessGoal: "lose_weight", celebrityProfile: "jennifer_aniston" } };
    } else {
      const dayPlans: MealRow[][] = [
        [{ name: "Avocado Toast & Eggs", cal: 490, p: 26, c: 44, f: 24, score: 84, type: "breakfast" }, { name: "Turkey Quinoa Bowl", cal: 540, p: 42, c: 52, f: 16, score: 86, type: "lunch" }, { name: "Grilled Chicken & Veg", cal: 560, p: 50, c: 38, f: 18, score: 88, type: "dinner" }, { name: "Mixed Nuts", cal: 200, p: 6, c: 8, f: 18, score: 80, type: "snack" }],
        [{ name: "Oatmeal & Fruit", cal: 420, p: 14, c: 72, f: 8, score: 82, type: "breakfast" }, { name: "Caesar Salad & Chicken", cal: 520, p: 44, c: 22, f: 26, score: 80, type: "lunch" }, { name: "Salmon & Rice", cal: 620, p: 50, c: 58, f: 18, score: 90, type: "dinner" }],
        [{ name: "Scrambled Eggs & Toast", cal: 460, p: 28, c: 42, f: 20, score: 80, type: "breakfast" }, { name: "Turkey Quinoa Bowl", cal: 540, p: 42, c: 52, f: 16, score: 86, type: "lunch" }, { name: "Pasta Bolognese", cal: 680, p: 38, c: 80, f: 18, score: 72, type: "dinner" }, { name: "Greek Yogurt", cal: 200, p: 18, c: 16, f: 6, score: 84, type: "snack" }],
        [{ name: "Avocado Toast & Eggs", cal: 490, p: 26, c: 44, f: 24, score: 84, type: "breakfast" }, { name: "Caesar Salad & Chicken", cal: 520, p: 44, c: 22, f: 26, score: 80, type: "lunch" }, { name: "Grilled Chicken & Veg", cal: 560, p: 50, c: 38, f: 18, score: 88, type: "dinner" }],
        [{ name: "Oatmeal & Fruit", cal: 420, p: 14, c: 72, f: 8, score: 82, type: "breakfast" }, { name: "Turkey Quinoa Bowl", cal: 540, p: 42, c: 52, f: 16, score: 86, type: "lunch" }, { name: "Salmon & Rice", cal: 620, p: 50, c: 58, f: 18, score: 90, type: "dinner" }, { name: "Mixed Nuts", cal: 200, p: 6, c: 8, f: 18, score: 80, type: "snack" }],
        [{ name: "Scrambled Eggs & Toast", cal: 460, p: 28, c: 42, f: 20, score: 80, type: "breakfast" }, { name: "Caesar Salad & Chicken", cal: 520, p: 44, c: 22, f: 26, score: 80, type: "lunch" }, { name: "Pasta Bolognese", cal: 680, p: 38, c: 80, f: 18, score: 72, type: "dinner" }],
        [{ name: "Avocado Toast & Eggs", cal: 490, p: 26, c: 44, f: 24, score: 84, type: "breakfast" }, { name: "Turkey Quinoa Bowl", cal: 540, p: 42, c: 52, f: 16, score: 86, type: "lunch" }, { name: "Grilled Chicken & Veg", cal: 560, p: 50, c: 38, f: 18, score: 88, type: "dinner" }, { name: "Greek Yogurt", cal: 200, p: 18, c: 16, f: 6, score: 84, type: "snack" }],
      ];
      const marcusWeights = [78.2, 77.9, 78.3, 78.1, 78.4, 78.0, 78.2];
      for (let i = 0; i < 7; i++) {
        const date = new Date(todayMs - (6 - i) * DAY);
        const ds = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
        entries.push(...makeDayEntries(ds, dayPlans[i]));
        weightEntries.push({ id: `demo_w_marcus_${i}`, date: ds, timestamp: new Date(ds + "T08:00:00").getTime(), weightKg: marcusWeights[i] });
      }
      newPrefs = { name: "Marcus", profileTheme: "ember", streakDays: 30, lastLogDate: today, celebratedStreakMilestones: [3, 7, 14], goals: { dailyCalories: 2200, dailyProtein: 160, dailyCarbs: 240, dailyFat: 70 }, onboarding: { completed: true, gender: "male", age: 32, heightCm: 178, weightKg: 78, activityLevel: "moderate", fitnessGoal: "maintain", celebrityProfile: "ryan_reynolds" } };
    }

    await AsyncStorage.multiRemove(["food_entries", "user_preferences", "weight_entries"]);
    await AsyncStorage.setItem("food_entries", JSON.stringify(entries));
    await AsyncStorage.setItem("weight_entries", JSON.stringify(weightEntries));
    const current = await getPreferences();
    await AsyncStorage.setItem("user_preferences", JSON.stringify({ ...current, ...newPrefs }));
    emitThemeChange();
    void load();
  }

  async function handleDevClearFood() {
    await AsyncStorage.removeItem("food_entries");
  }

  async function handleDevClearAll() {
    await AsyncStorage.multiRemove(["food_entries", "user_preferences", "weight_entries"]);
    navigation.getParent()?.reset({ index: 0, routes: [{ name: "Onboarding" }] } as any);
  }

  async function handleDevTestNotification() {
    await sendTestNotification();
  }

  if (!prefs) return null;

  return (
    <SafeAreaView style={styles.safe}>
      <Animated.View
        pointerEvents="none"
        style={[toastStyles.banner, { transform: [{ translateY: toastAnim }] }]}
      >
        <Ionicons name="checkmark-circle" size={18} color="#fff" />
        <Text style={toastStyles.bannerText}>Changes saved!</Text>
      </Animated.View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Text style={styles.pageTitle}>Settings</Text>

        {/* Profile */}
        {(() => {
          const currentTheme = PROFILE_THEMES.find((t) => t.id === (prefs.profileTheme ?? "rose")) ?? PROFILE_THEMES[0];
          const initials = (prefs.name || " ").split(" ").map((w) => w[0]?.toUpperCase() ?? "").slice(0, 2).join("") || "?";
          return (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Profile</Text>
              <View style={[styles.card, { padding: 0, shadowColor: currentTheme.bg }]}>
                <View style={[pt.band, { backgroundColor: currentTheme.bg }]}>
                  <AnimatedBandDecor themeId={currentTheme.id} />
                  <Text style={pt.bandEmoji}>{currentTheme.emoji}</Text>
                  <TouchableOpacity style={pt.avatarCircle} onPress={() => void pickProfilePicture()} activeOpacity={0.8}>
                    {prefs.profilePicture ? (
                      <Image source={{ uri: prefs.profilePicture }} style={{ width: 68, height: 68, borderRadius: 34 }} />
                    ) : (
                      <Text style={pt.avatarText}>{initials}</Text>
                    )}
                    <View style={pt.cameraOverlay}>
                      <Ionicons name="camera" size={12} color="#fff" />
                    </View>
                  </TouchableOpacity>
                  {prefs.name ? <Text style={pt.bandName}>{prefs.name}</Text> : null}
                  <TouchableOpacity
                    style={pt.editBtn}
                    onPress={() => setShowThemePicker((v) => !v)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={showThemePicker ? "close" : "color-palette-outline"}
                      size={18}
                      color="rgba(255,255,255,0.9)"
                    />
                  </TouchableOpacity>
                </View>
                {(showThemePicker || !prefs.name) && (
                  <View style={pt.body}>
                    <Text style={styles.label}>Your Name</Text>
                    <TextInput
                      style={styles.textInput}
                      value={prefs.name}
                      onChangeText={(v) => update({ name: v })}
                      placeholder="Enter your name"
                      placeholderTextColor={C.muted}
                      textAlign="center"
                      autoFocus={showThemePicker && !!prefs.name}
                    />
                    {showThemePicker && (
                      <>
                        <Text style={[styles.label, { marginTop: 14 }]}>Profile Theme</Text>
                        <View style={pt.themeRow}>
                          {PROFILE_THEMES.map((t) => {
                            const sel = (prefs.profileTheme ?? "rose") === t.id;
                            return (
                              <TouchableOpacity
                                key={t.id}
                                onPress={() => update({ profileTheme: t.id })}
                                activeOpacity={0.7}
                                style={[pt.swatch, { backgroundColor: t.bg }, sel && pt.swatchSel]}
                              >
                                {sel ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                        <Text style={pt.themeLabel}>{currentTheme.emoji} {currentTheme.name}</Text>
                      </>
                    )}
                  </View>
                )}
              </View>
            </View>
          );
        })()}

        {/* Account */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.card}>
            {/* Email */}
            {emailEditing ? (
              <View style={acct.editRow}>
                <TextInput
                  style={acct.editInput}
                  value={emailDraft}
                  onChangeText={setEmailDraft}
                  placeholder="Email address"
                  placeholderTextColor={C.muted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={() => void handleSaveEmail()}
                />
                <TouchableOpacity onPress={() => void handleSaveEmail()} style={acct.saveBtn} activeOpacity={0.8}>
                  <Text style={acct.saveBtnText}>Save</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setEmailEditing(false)} style={acct.cancelBtn} activeOpacity={0.7}>
                  <Ionicons name="close" size={16} color={C.muted} />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={acct.row}>
                <Ionicons name="mail-outline" size={15} color={C.muted} />
                <Text style={acct.rowValue} numberOfLines={1}>{prefs.email || "No email set"}</Text>
                <TouchableOpacity onPress={() => { setEmailDraft(prefs.email ?? ""); setEmailEditing(true); }} activeOpacity={0.7} style={acct.iconBtn}>
                  <Ionicons name="pencil-outline" size={15} color={C.muted} />
                </TouchableOpacity>
              </View>
            )}
            <View style={styles.divider} />
            {/* Password */}
            {pwExpanded ? (
              <View style={acct.pwSection}>
                {prefs.passwordHash ? (
                  <View style={acct.pwInputRow}>
                    <TextInput
                      style={acct.editInput}
                      value={pwCurrent}
                      onChangeText={setPwCurrent}
                      placeholder="Current password"
                      placeholderTextColor={C.muted}
                      secureTextEntry={!showPwCurrent}
                    />
                    <TouchableOpacity onPress={() => setShowPwCurrent((v) => !v)} activeOpacity={0.7} style={acct.iconBtn}>
                      <Ionicons name={showPwCurrent ? "eye-off-outline" : "eye-outline"} size={16} color={C.muted} />
                    </TouchableOpacity>
                  </View>
                ) : null}
                <View style={[acct.pwInputRow, prefs.passwordHash ? { marginTop: 8 } : {}]}>
                  <TextInput
                    style={acct.editInput}
                    value={pwNew}
                    onChangeText={setPwNew}
                    placeholder={prefs.passwordHash ? "New password" : "Create password (min 6)"}
                    placeholderTextColor={C.muted}
                    secureTextEntry={!showPwNew}
                  />
                  <TouchableOpacity onPress={() => setShowPwNew((v) => !v)} activeOpacity={0.7} style={acct.iconBtn}>
                    <Ionicons name={showPwNew ? "eye-off-outline" : "eye-outline"} size={16} color={C.muted} />
                  </TouchableOpacity>
                </View>
                <View style={[acct.pwInputRow, { marginTop: 8 }]}>
                  <TextInput
                    style={acct.editInput}
                    value={pwConfirm}
                    onChangeText={setPwConfirm}
                    placeholder="Confirm password"
                    placeholderTextColor={C.muted}
                    secureTextEntry={!showPwNew}
                    returnKeyType="done"
                    onSubmitEditing={() => void handleSavePassword()}
                  />
                </View>
                <View style={acct.pwActions}>
                  <TouchableOpacity onPress={() => void handleSavePassword()} style={[acct.saveBtn, { flex: 1 }]} activeOpacity={0.8}>
                    <Text style={acct.saveBtnText}>Save Password</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => { setPwExpanded(false); setPwCurrent(""); setPwNew(""); setPwConfirm(""); }}
                    style={acct.cancelBtn}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="close" size={16} color={C.muted} />
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={acct.row}>
                <Ionicons name="lock-closed-outline" size={15} color={C.muted} />
                <Text style={acct.rowValue}>{prefs.passwordHash ? "Password set" : "No password set"}</Text>
                <TouchableOpacity onPress={() => setPwExpanded(true)} activeOpacity={0.7} style={acct.iconBtn}>
                  <Ionicons name="pencil-outline" size={15} color={C.muted} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {/* Daily Goals */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Daily Goals</Text>
          <View style={styles.card}>
            <GoalInput label="Calories" value={prefs.goals.dailyCalories} onChange={(v) => updateGoal("dailyCalories", v)} unit="kcal" />
            <GoalInput label="Protein" value={prefs.goals.dailyProtein} onChange={(v) => updateGoal("dailyProtein", v)} />
            <GoalInput label="Carbs" value={prefs.goals.dailyCarbs} onChange={(v) => updateGoal("dailyCarbs", v)} />
            <GoalInput label="Fat" value={prefs.goals.dailyFat} onChange={(v) => updateGoal("dailyFat", v)} />
          </View>
        </View>

        {/* Body Plan */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Body Plan</Text>
          <View style={styles.card}>
            {(() => {
              const currentCeleb = prefs.onboarding.celebrityProfile
                ? CELEBRITY_PROFILES.find((c) => c.id === prefs.onboarding.celebrityProfile)
                : null;
              return (
                <TouchableOpacity style={styles.celebRow} onPress={() => setShowCelebPicker(true)} activeOpacity={0.7}>
                  <View style={styles.celebRowIcon}>
                    <Ionicons name={currentCeleb?.icon ?? "person-circle-outline"} size={20} color={C.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.celebRowName}>{currentCeleb?.name ?? "Auto-matched"}</Text>
                    <Text style={styles.celebRowRole}>{currentCeleb?.role ?? "Based on your goals"}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={C.muted} />
                </TouchableOpacity>
              );
            })()}
          </View>
        </View>

        {/* Notifications */}
        {Platform.OS !== "web" && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Meal Reminders</Text>
            <View style={styles.card}>
              <View style={styles.toggleRow}>
                <View>
                  <Text style={styles.toggleLabel}>Enable Reminders</Text>
                  <Text style={styles.toggleDesc}>Schedule daily meal notifications</Text>
                </View>
                <Switch
                  value={prefs.notificationsEnabled}
                  onValueChange={handleMasterToggle}
                  trackColor={{ false: "#6B6B6B", true: C.success }}
                  thumbColor={prefs.notificationsEnabled ? "#fff" : "#9E9E9E"}
                />
              </View>
              {prefs.notificationsEnabled && (
                <>
                  <View style={styles.divider} />
                  <Text style={styles.reminderNote}>Tap the time to adjust each reminder. Tap AM/PM to switch.</Text>
                  {(Object.keys(prefs.mealReminderTimes) as Array<keyof MealReminderTimes>).map((key) => (
                    <MealReminderRow key={key} mealKey={key} slot={prefs.mealReminderTimes[key]} onChange={(slot) => updateReminder(key, slot)} />
                  ))}
                </>
              )}
            </View>
          </View>
        )}

        {devMode && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Developer Tools</Text>
            <View style={styles.card}>
              <Text style={styles.devStatus}>
                Streak: <Text style={{ color: C.primary, fontFamily: F.bold }}>{prefs.streakDays}d</Text>
                {"  ·  "}
                Theme: <Text style={{ color: C.primary, fontFamily: F.bold }}>{prefs.profileTheme ?? "rose"}</Text>
                {"  ·  "}
                Last log: <Text style={{ color: C.primary, fontFamily: F.bold }}>{prefs.lastLogDate ?? "never"}</Text>
              </Text>

              <View style={styles.devDivider} />
              <Text style={styles.devSectionLabel}>Demo Profiles (7 days of data)</Text>
              <View style={styles.devDemoRow}>
                <TouchableOpacity style={styles.devDemoBtn} onPress={() => { void handleDevLoadDemoProfile("muscle_male"); }}>
                  <Text style={styles.devDemoBtnIcon}>💪</Text>
                  <Text style={styles.devDemoBtnLabel}>Alex</Text>
                  <Text style={styles.devDemoBtnSub}>Male · Muscle</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.devDemoBtn} onPress={() => { void handleDevLoadDemoProfile("loss_female"); }}>
                  <Text style={styles.devDemoBtnIcon}>🌸</Text>
                  <Text style={styles.devDemoBtnLabel}>Sara</Text>
                  <Text style={styles.devDemoBtnSub}>Female · Loss</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.devDemoBtn} onPress={() => { void handleDevLoadDemoProfile("maintain_male"); }}>
                  <Text style={styles.devDemoBtnIcon}>🏃</Text>
                  <Text style={styles.devDemoBtnLabel}>Marcus</Text>
                  <Text style={styles.devDemoBtnSub}>Male · Maintain</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.devDivider} />
              <TouchableOpacity style={styles.devActionBtn} onPress={() => { void handleDevAddSampleMeals(); }}>
                <Ionicons name="restaurant-outline" size={15} color={C.success} />
                <Text style={[styles.devActionText, { color: C.success }]}>Add 5 sample meals for today</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.devActionBtn} onPress={() => { void handleDevClearFood(); }}>
                <Ionicons name="trash-outline" size={15} color={C.error} />
                <Text style={[styles.devActionText, { color: C.error }]}>Clear all food entries</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.devActionBtn} onPress={() => { void handleDevTestNotification(); }}>
                <Ionicons name="notifications-outline" size={15} color={C.primary} />
                <Text style={[styles.devActionText, { color: C.primary }]}>Fire test notification</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.devActionBtn} onPress={() => { void handleDevClearAll(); }}>
                <Ionicons name="nuclear-outline" size={15} color={C.error} />
                <Text style={[styles.devActionText, { color: C.error }]}>Reset all app data and restart</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* About */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <View style={styles.card}>
            <View style={styles.aboutRow}>
              <View style={styles.aboutIcon}>
                <Ionicons name="sparkles" size={20} color={C.primary} />
              </View>
              <TouchableOpacity onPress={handleAboutTap} activeOpacity={1}>
                <Text style={styles.aboutLine}>FitBot</Text>
                <Text style={styles.aboutMuted}>Powered by Claude Sonnet 4.6</Text>
              </TouchableOpacity>
            </View>
            <Text style={[styles.aboutMuted, { marginTop: 8 }]}>AI nutrition analysis via photo</Text>
          </View>
        </View>

        <View style={[styles.section, { marginTop: 4 }]}>
          <TouchableOpacity style={styles.signOutBtn} onPress={() => { void handleSignOut(); }} activeOpacity={0.8}>
            <Ionicons name="log-out-outline" size={18} color={C.error} />
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        {dirty && (
          <TouchableOpacity style={styles.saveBtn} onPress={() => void save()}>
            <Text style={styles.saveBtnText}>Save Changes</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Celebrity picker bottom sheet */}
      <Modal visible={showCelebPicker} transparent animationType="slide" onRequestClose={() => setShowCelebPicker(false)}>
        <View style={{ flex: 1 }}>
          <TouchableOpacity style={cpS.backdrop} activeOpacity={1} onPress={() => setShowCelebPicker(false)} />
          <View style={cpS.sheet}>
            <View style={cpS.handle} />
            <Text style={cpS.title}>Change Body Plan</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={cpS.grid}>
                {CELEBRITY_PROFILES
                  .filter((c) => c.gender === prefs.onboarding.gender)
                  .map((c) => {
                    const isSelected = prefs.onboarding.celebrityProfile === c.id;
                    return (
                      <TouchableOpacity
                        key={c.id}
                        style={[cpS.card, isSelected && cpS.cardActive]}
                        onPress={() => handleCelebChange(c.id)}
                        activeOpacity={0.7}
                      >
                        <View style={[cpS.iconWrap, isSelected && cpS.iconWrapActive]}>
                          <Ionicons name={c.icon} size={22} color={isSelected ? C.primary : C.muted} />
                        </View>
                        <Text style={[cpS.cardName, isSelected && { color: C.primary }]} numberOfLines={1}>{c.name}</Text>
                        <Text style={cpS.cardRole} numberOfLines={1}>{c.role}</Text>
                        {isSelected && (
                          <View style={cpS.check}>
                            <Ionicons name="checkmark" size={11} color="#fff" />
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
              </View>
              <Text style={cpS.note}>Changing your plan recalculates your daily calorie and macro goals.</Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const acct = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowValue: { flex: 1, fontSize: 14, fontFamily: F.semibold, color: C.text },
  iconBtn: { padding: 4 },
  editRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  editInput: {
    flex: 1, backgroundColor: C.fill, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9,
    color: C.text, fontSize: 14, fontFamily: F.regular, borderWidth: 1, borderColor: C.border,
  },
  saveBtn: {
    backgroundColor: C.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9,
    alignItems: "center", justifyContent: "center",
  },
  saveBtnText: { fontSize: 13, fontFamily: F.bold, color: "#fff" },
  cancelBtn: {
    width: 34, height: 34, borderRadius: 10, backgroundColor: C.fill,
    alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: C.border,
  },
  pwSection: { gap: 0 },
  pwInputRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  pwActions: { flexDirection: "row", gap: 8, marginTop: 10 },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "transparent" },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  pageTitle: { fontSize: 28, fontFamily: F.extrabold, color: C.text, marginBottom: 16 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 13, fontFamily: F.extrabold, color: C.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 },
  card: {
    backgroundColor: C.card, borderRadius: 18, padding: 16,
    shadowColor: C.primary, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  streakCard: { backgroundColor: C.primary + "08", borderWidth: 1, borderColor: C.primary + "25" },
  label: { fontSize: 13, fontFamily: F.bold, color: C.muted, marginBottom: 8 },
  textInput: {
    backgroundColor: C.fill, borderRadius: 12, padding: 12, color: C.text, fontSize: 15,
    fontFamily: F.regular, borderWidth: 1, borderColor: C.border, width: "100%",
  },
  goalRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  goalLabel: { fontSize: 14, fontFamily: F.semibold, color: C.text },
  goalInputWrap: { flexDirection: "row", alignItems: "center", gap: 6 },
  goalInput: { width: 80, backgroundColor: C.fill, borderRadius: 10, padding: 10, color: C.text, fontSize: 14, fontFamily: F.semibold, textAlign: "center", borderWidth: 1, borderColor: C.border },
  goalUnit: { fontSize: 12, fontFamily: F.semibold, color: C.muted, width: 28 },
  toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  toggleLabel: { fontSize: 15, fontFamily: F.bold, color: C.text },
  toggleDesc: { fontSize: 12, fontFamily: F.regular, color: C.muted, marginTop: 2 },
  divider: { height: 1, backgroundColor: C.border, marginVertical: 12 },
  reminderNote: { fontSize: 12, fontFamily: F.regular, color: C.muted, marginBottom: 8, fontStyle: "italic" },
  streakRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  streakDays: { fontSize: 36, fontFamily: F.extrabold, color: C.primary },
  streakUnit: { fontSize: 16, fontFamily: F.semibold, color: C.primary, alignSelf: "flex-end", marginBottom: 4 },
  streakDesc: { fontSize: 13, fontFamily: F.regular, color: C.muted, lineHeight: 18 },
  aboutRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  aboutIcon: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: C.primary + "18",
    alignItems: "center", justifyContent: "center",
  },
  aboutLine: { fontSize: 15, fontFamily: F.bold, color: C.text },
  aboutMuted: { fontSize: 13, fontFamily: F.regular, color: C.muted },
  saveBtn: {
    backgroundColor: C.primary, borderRadius: 18, paddingVertical: 18, alignItems: "center",
    shadowColor: C.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  saveBtnText: { fontFamily: F.extrabold, color: "#fff", fontSize: 17 },
  devStatus: { fontSize: 13, fontFamily: F.regular, color: C.muted },
  devDivider: { height: 1, backgroundColor: C.border, marginVertical: 10 },
  devSectionLabel: { fontSize: 11, fontFamily: F.extrabold, color: C.muted, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 },
  devDemoRow: { flexDirection: "row", gap: 8 },
  devDemoBtn: {
    flex: 1, backgroundColor: C.fill, borderRadius: 12, paddingVertical: 10,
    alignItems: "center", gap: 2, borderWidth: 1, borderColor: C.border,
  },
  devDemoBtnIcon: { fontSize: 18 },
  devDemoBtnLabel: { fontSize: 12, fontFamily: F.bold, color: C.text },
  devDemoBtnSub: { fontSize: 10, fontFamily: F.semibold, color: C.muted },
  devActionBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingVertical: 9, borderTopWidth: 1, borderTopColor: C.border,
  },
  devActionText: { fontSize: 12, fontFamily: F.semibold, color: C.secondary, flex: 1 },
  signOutBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: C.card, borderRadius: 14, paddingVertical: 15,
    borderWidth: 1, borderColor: C.error + "35",
  },
  signOutText: { fontSize: 15, fontFamily: F.bold, color: C.error },
  celebRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  celebRowIcon: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: C.primary + "15", alignItems: "center", justifyContent: "center",
  },
  celebRowName: { fontSize: 15, fontFamily: F.bold, color: C.text },
  celebRowRole: { fontSize: 12, fontFamily: F.regular, color: C.muted, marginTop: 1 },
});

const cpS = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: {
    backgroundColor: C.card,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 20, paddingBottom: 36, paddingTop: 12,
    maxHeight: "80%",
  },
  handle: { width: 40, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  title: { fontSize: 18, fontFamily: F.extrabold, color: C.text, marginBottom: 16 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  card: {
    width: "47%", backgroundColor: C.fill, borderRadius: 16, padding: 14,
    alignItems: "center", gap: 6, borderWidth: 1.5, borderColor: C.border, position: "relative",
  },
  cardActive: { borderColor: C.primary, backgroundColor: C.primary + "08" },
  iconWrap: {
    width: 48, height: 48, borderRadius: 14, backgroundColor: C.card,
    alignItems: "center", justifyContent: "center",
  },
  iconWrapActive: { backgroundColor: C.primary + "18" },
  cardName: { fontSize: 13, fontFamily: F.bold, color: C.text, textAlign: "center" },
  cardRole: { fontSize: 11, fontFamily: F.regular, color: C.muted, textAlign: "center" },
  check: {
    position: "absolute", top: 8, right: 8,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: C.primary, alignItems: "center", justifyContent: "center",
  },
  note: { fontSize: 12, fontFamily: F.regular, color: C.muted, textAlign: "center", marginTop: 16, lineHeight: 17 },
});

const toastStyles = StyleSheet.create({
  banner: {
    position: "absolute",
    bottom: 90,
    left: 16,
    right: 16,
    zIndex: 999,
    backgroundColor: C.success,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 8,
  },
  bannerText: { fontSize: 14, fontFamily: F.bold, color: "#fff" },
});
