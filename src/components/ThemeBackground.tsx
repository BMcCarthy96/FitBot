import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Animated, Easing, Dimensions } from "react-native";
import Svg, { Path, Circle, Defs, LinearGradient, Stop } from "react-native-svg";
import { useTheme } from "../services/themeContext";

const { width: W, height: H } = Dimensions.get("window");

// ── SVG shape paths (24×24 viewBox) ──────────────────────────────────────────

/** Elongated 4-point sparkle star */
const SPARKLE_LG = "M12 1L13 10.5L22 12L13 13.5L12 23L11 13.5L2 12L11 10.5Z";
/** Compact 4-point sparkle */
const SPARKLE_SM = "M12 3L13.2 10.5L21 12L13.2 13.5L12 21L10.8 13.5L3 12L10.8 10.5Z";

/** Organic leaf — narrower top, rounder body */
const LEAF_BODY = "M12 2C7 3 4 8 5 13C6 18 9 22 12 22C15 22 18 18 19 13C20 8 17 3 12 2Z";
/** Slightly curved midrib */
const LEAF_VEIN = "M12 3Q11 11 12 21";

/** Rose petal — narrow top, wide middle, tapers to base */
const PETAL_BODY = "M12 2C9 3 6 7 6 11C6 16 9 20 12 21C15 20 18 16 18 11C18 7 15 3 12 2Z";

/** Flame teardrop — pointed top, round bottom */
const FLAME_OUT = "M12 2C9 6 5 11 5 15.5C5 19.6 8.1 22 12 22C15.9 22 19 19.6 19 15.5C19 11 15 6 12 2Z";
/** Inner flame core — smaller, sits inside FLAME_OUT */
const FLAME_IN = "M12 8C10 11 8 14 8 17C8 18.8 9.8 20 12 20C14.2 20 16 18.8 16 17C16 14 14 11 12 8Z";

// ── Night Sky: twinkling sparkle stars ───────────────────────────────────────

function BgStars() {
  const stars = useRef(
    Array.from({ length: 42 }, (_, i) => ({
      opacity: new Animated.Value(Math.random() * 0.03),
      scale:   new Animated.Value(0.4 + Math.random() * 0.4),
      x:    Math.random() * W,
      y:    30 + Math.random() * H * 0.87,
      size: i < 12 ? 12 + Math.random() * 10 : 6 + Math.random() * 7,
      dur:  600 + Math.random() * 1600,
      delay: i * 110,
      maxOp: 0.75 + Math.random() * 0.25,
      color: (["#C4B5FD", "#A5B4FC", "#E9D5FF", "#DDD6FE"] as const)[i % 4],
      isStar: i < 34,
    }))
  ).current;

  useEffect(() => {
    const loops = stars.map((s) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(s.delay),
          Animated.parallel([
            Animated.timing(s.opacity, { toValue: s.maxOp,   duration: s.dur,        useNativeDriver: true }),
            Animated.timing(s.scale,   { toValue: 1.15,      duration: s.dur * 0.8,  useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(s.opacity, { toValue: 0.01,      duration: s.dur * 1.3,  useNativeDriver: true }),
            Animated.timing(s.scale,   { toValue: 0.5,       duration: s.dur,        useNativeDriver: true }),
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
              <Path d={i % 5 === 0 ? SPARKLE_LG : SPARKLE_SM} fill={s.color} />
            ) : (
              <Circle cx="12" cy="12" r="9" fill={s.color} />
            )}
          </Svg>
        </Animated.View>
      ))}
    </View>
  );
}

// ── Rose: petals drifting and spinning down ───────────────────────────────────

function BgPetals() {
  const petals = useRef(
    Array.from({ length: 16 }, (_, i) => ({
      fall: new Animated.Value(Math.random()),
      sway: new Animated.Value((i % 2 === 0 ? -1 : 1) * Math.random()),
      spin: new Animated.Value((i % 2 === 0 ? -1 : 1) * Math.random()),
      x:       10 + Math.random() * (W - 50),
      size:    14 + Math.random() * 14,
      fallDur: 9000 + Math.random() * 6000,
      swayDur: 2600 + Math.random() * 2000,
      spinDur: 4500 + Math.random() * 4000,
      delay:   i * 1200,
      color: (["#FF7A8A", "#FFB3BC", "#FF9DAA", "#FFC6CF", "#FFD5D8"] as const)[i % 5],
    }))
  ).current;

  useEffect(() => {
    const loops: Animated.CompositeAnimation[] = [];
    petals.forEach((p) => {
      const fl = Animated.loop(Animated.sequence([
        Animated.timing(p.fall, { toValue: 1, duration: p.fallDur, useNativeDriver: true }),
        Animated.timing(p.fall, { toValue: 0, duration: 0,         useNativeDriver: true }),
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
    return () => loops.forEach((l) => l.stop());
  }, []);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {petals.map((p, i) => {
        const ty  = p.fall.interpolate({ inputRange: [0, 1], outputRange: [-50, H + 50] });
        const op  = p.fall.interpolate({ inputRange: [0, 0.05, 0.88, 1], outputRange: [0, 0.30, 0.30, 0] });
        const tx  = p.sway.interpolate({ inputRange: [-1, 1], outputRange: [-28, 28] });
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
              <Path d={PETAL_BODY} fill={p.color} />
            </Svg>
          </Animated.View>
        );
      })}
    </View>
  );
}

// ── Forest: leaves tumbling down with visible midrib ─────────────────────────

function BgLeaves() {
  const leaves = useRef(
    Array.from({ length: 16 }, (_, i) => ({
      fall: new Animated.Value(Math.random()),
      sway: new Animated.Value((i % 2 === 0 ? -1 : 1) * Math.random()),
      spin: new Animated.Value((i % 2 === 0 ? -1 : 1) * Math.random()),
      x:       10 + Math.random() * (W - 50),
      size:    16 + Math.random() * 16,
      fallDur: 9500 + Math.random() * 6000,
      swayDur: 2500 + Math.random() * 2200,
      spinDur: 4000 + Math.random() * 4000,
      delay:   i * 1100,
      variant: i % 3,
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
    return () => loops.forEach((l) => l.stop());
  }, []);

  const leafColors  = ["#4ADE80", "#22C55E", "#86EFAC"] as const;
  const veinColors  = ["#166534", "#15803D", "#16A34A"] as const;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {leaves.map((l, i) => {
        const ty  = l.fall.interpolate({ inputRange: [0, 1], outputRange: [-50, H + 50] });
        const op  = l.fall.interpolate({ inputRange: [0, 0.05, 0.90, 1], outputRange: [0, 0.32, 0.32, 0] });
        const tx  = l.sway.interpolate({ inputRange: [-1, 1], outputRange: [-30, 30] });
        const rot = l.spin.interpolate({ inputRange: [-1, 1], outputRange: ["-22deg", "22deg"] });
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
              <Path d={LEAF_BODY} fill={leafColors[l.variant]} />
              <Path
                d={LEAF_VEIN}
                stroke={veinColors[l.variant]}
                strokeWidth="1.5"
                strokeLinecap="round"
                fill="none"
              />
            </Svg>
          </Animated.View>
        );
      })}
    </View>
  );
}

// ── Ember: flame teardrops rising with flicker and gradient ──────────────────

function BgEmbers() {
  const embers = useRef(
    Array.from({ length: 14 }, (_, i) => ({
      rise:    new Animated.Value(Math.random()),
      sway:    new Animated.Value((i % 2 === 0 ? -1 : 1) * Math.random()),
      flicker: new Animated.Value(1),
      x:         10 + Math.random() * (W - 40),
      size:      i % 4 === 0 ? 22 + Math.random() * 8 : 11 + Math.random() * 10,
      riseDur:   6500 + Math.random() * 4500,
      swayDur:   500  + Math.random() * 600,
      flickerDur: 280 + Math.random() * 360,
      delay:     i * 620,
      isSpark:   i % 3 === 2,
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
    return () => loops.forEach((l) => l.stop());
  }, []);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {embers.map((e, i) => {
        const size = e.isSpark ? e.size * 0.55 : e.size;
        const ty   = e.rise.interpolate({ inputRange: [0, 1], outputRange: [H + 20, -50] });
        const op   = e.rise.interpolate({ inputRange: [0, 0.08, 0.80, 1], outputRange: [0, 0.30, 0.28, 0] });
        const tx   = e.sway.interpolate({ inputRange: [-1, 1], outputRange: [-16, 16] });
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
                {/* gradient scoped to this Svg element */}
                <LinearGradient id="fg" x1="0.5" y1="0" x2="0.5" y2="1">
                  <Stop offset="0"   stopColor="#FDE68A" />
                  <Stop offset="0.5" stopColor="#F97316" />
                  <Stop offset="1"   stopColor="#DC2626" />
                </LinearGradient>
              </Defs>
              <Path d={FLAME_OUT} fill="url(#fg)" />
              {!e.isSpark && <Path d={FLAME_IN} fill="#FEF08A" opacity={0.65} />}
            </Svg>
          </Animated.View>
        );
      })}
    </View>
  );
}

// ── Confetti: colorful pieces tumbling down ───────────────────────────────────

function BgConfetti() {
  const CANDY_COLORS = ["#F9A8D4", "#E879F9", "#818CF8", "#67E8F9", "#A7F3D0", "#FCA5A5"] as const;
  const pieces = useRef(
    Array.from({ length: 28 }, (_, i) => ({
      fall: new Animated.Value(Math.random()),
      sway: new Animated.Value((i % 2 === 0 ? -1 : 1) * Math.random()),
      spin: new Animated.Value((i % 2 === 0 ? -1 : 1) * Math.random()),
      x:       8 + Math.random() * (W - 24),
      w:       4 + Math.random() * 6,
      h:       10 + Math.random() * 8,
      color:   CANDY_COLORS[i % 6],
      fallDur: 5000 + Math.random() * 5000,
      swayDur: 1500 + Math.random() * 1000,
      spinDur: 500  + Math.random() * 800,
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
    return () => loops.forEach((l) => l.stop());
  }, []);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((p, i) => {
        const ty  = p.fall.interpolate({ inputRange: [0, 1], outputRange: [-p.h, H + p.h] });
        const op  = p.fall.interpolate({ inputRange: [0, 0.05, 0.88, 1], outputRange: [0, 0.75, 0.70, 0] });
        const tx  = p.sway.interpolate({ inputRange: [-1, 1], outputRange: [-30, 30] });
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

// ── Ocean: glassy rising bubbles with rim and highlight ──────────────────────

function BgOcean() {
  const bubbles = useRef(
    Array.from({ length: 14 }, (_, i) => ({
      rise: new Animated.Value(Math.random()),
      sway: new Animated.Value((i % 2 === 0 ? -1 : 1) * Math.random()),
      x:       20 + Math.random() * (W - 50),
      size:    6  + Math.random() * 16,
      riseDur: 5000 + Math.random() * 4000,
      swayDur: 1000 + Math.random() * 1000,
      delay:   i * 500,
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
    return () => loops.forEach((l) => l.stop());
  }, []);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {bubbles.map((b, i) => {
        const ty = b.rise.interpolate({ inputRange: [0, 1], outputRange: [H + 10, -30] });
        const op = b.rise.interpolate({ inputRange: [0, 0.05, 0.80, 1], outputRange: [0, 0.30, 0.24, 0] });
        const tx = b.sway.interpolate({ inputRange: [-1, 1], outputRange: [-12, 12] });
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
              {/* translucent fill */}
              <Circle cx="12" cy="12" r="11" fill={b.color} opacity={0.45} />
              {/* crisp rim */}
              <Circle cx="12" cy="12" r="11" fill="none" stroke={b.color} strokeWidth="1.5" opacity={0.85} />
              {/* white glare highlight */}
              <Circle cx="8"  cy="8"  r="3.5" fill="white" opacity={0.45} />
            </Svg>
          </Animated.View>
        );
      })}
    </View>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function ThemeBackground() {
  const { profileTheme } = useTheme();

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {profileTheme === "night"  && <BgStars />}
      {profileTheme === "rose"   && <BgPetals />}
      {profileTheme === "forest" && <BgLeaves />}
      {profileTheme === "ember"  && <BgEmbers />}
      {profileTheme === "candy"  && <BgConfetti />}
      {profileTheme === "ocean"  && <BgOcean />}
    </View>
  );
}
