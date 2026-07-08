import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Easing,
  KeyboardAvoidingView,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Dimensions,
  Platform,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Path } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import * as WebBrowser from "expo-web-browser";
import { useAuthRequest, getDefaultReturnUrl } from "expo-auth-session";
import * as Facebook from "expo-auth-session/providers/facebook";
import * as AppleAuthentication from "expo-apple-authentication";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { savePreferences, getPreferences } from "../services/storage";
import { FitnessGoal, ActivityLevel, Gender, OnboardingData, RootStackParamList, UserGoals } from "../types";
import { C, F } from "../theme";

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_DISCOVERY = {
  authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenEndpoint: "https://oauth2.googleapis.com/token",
};

// The auth.expo.io proxy URL — what Google redirects to (must be registered in GCC).
// The proxy then forwards the auth code back to the app via the exp:// deep link.
const EXPO_PROXY_URL = "https://auth.expo.io/@bmccarthy96/health-food-tracker";

type Nav = StackNavigationProp<RootStackParamList, "Onboarding">;
type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

const { width } = Dimensions.get("window");

function GoogleColorIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <Path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <Path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
      <Path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </Svg>
  );
}

// ─── Celebrity profiles ────────────────────────────────────────────────────

export interface CelebrityProfile {
  id: string;
  name: string;
  gender: "male" | "female";
  role: string;
  icon: IoniconName;
  description: string;
  calorieAdjust: number;
  proteinPct: number;
  carbPct: number;
  fatPct: number;
}

export const CELEBRITY_PROFILES: CelebrityProfile[] = [
  { id: "chris_hemsworth",    name: "Chris Hemsworth",    gender: "male",   role: "Action Hero Mass",   icon: "barbell-outline",   description: "Maximum muscle, peak athletic performance",     calorieAdjust: 0.10,  proteinPct: 0.35, carbPct: 0.40, fatPct: 0.25 },
  { id: "brad_pitt",          name: "Brad Pitt",          gender: "male",   role: "Lean & Ripped",      icon: "body-outline",      description: "Ultra-defined muscle with minimal body fat",   calorieAdjust: -0.10, proteinPct: 0.40, carbPct: 0.25, fatPct: 0.35 },
  { id: "dwayne_johnson",     name: "Dwayne Johnson",     gender: "male",   role: "Maximum Size",       icon: "fitness-outline",   description: "Legendary size, strength, and conditioning",   calorieAdjust: 0.15,  proteinPct: 0.40, carbPct: 0.45, fatPct: 0.15 },
  { id: "ryan_reynolds",      name: "Ryan Reynolds",      gender: "male",   role: "Athletic Lean",      icon: "flash-outline",     description: "Athletic build with natural definition",       calorieAdjust: 0.05,  proteinPct: 0.35, carbPct: 0.35, fatPct: 0.30 },
  { id: "zac_efron",          name: "Zac Efron",          gender: "male",   role: "Beach Body",         icon: "sunny-outline",     description: "Shredded and athletic, summer-ready",          calorieAdjust: 0,     proteinPct: 0.40, carbPct: 0.35, fatPct: 0.25 },
  { id: "angelina_jolie",     name: "Angelina Jolie",     gender: "female", role: "Lean & Toned",       icon: "leaf-outline",      description: "Slender, graceful, and athletic physique",     calorieAdjust: -0.05, proteinPct: 0.30, carbPct: 0.35, fatPct: 0.35 },
  { id: "jennifer_aniston",   name: "Jennifer Aniston",   gender: "female", role: "Timeless Wellness",  icon: "heart-outline",     description: "Balanced nutrition, naturally radiant health", calorieAdjust: 0,     proteinPct: 0.30, carbPct: 0.40, fatPct: 0.30 },
  { id: "scarlett_johansson", name: "Scarlett Johansson", gender: "female", role: "Strong & Sleek",     icon: "sparkles-outline",  description: "Powerful, feminine, and supremely fit",        calorieAdjust: -0.05, proteinPct: 0.35, carbPct: 0.35, fatPct: 0.30 },
  { id: "serena_williams",    name: "Serena Williams",    gender: "female", role: "Power & Endurance",  icon: "trophy-outline",    description: "World-class athletic power and endurance",     calorieAdjust: 0.10,  proteinPct: 0.35, carbPct: 0.45, fatPct: 0.20 },
];

// ─── Best-match recommendation ─────────────────────────────────────────────

function getRecommendedCelebrity(
  gender: Gender,
  currentWeightKg: number,
  targetWeightKg: number,
): string | null {
  const pool = CELEBRITY_PROFILES.filter((c) => c.gender === gender);
  if (!pool.length) return null;
  const diff = targetWeightKg - currentWeightKg;
  const scored = pool.map((c) => {
    // Score toward cutting celeb when losing, bulking celeb when gaining, balanced when maintaining
    const score =
      diff < -3 ? -c.calorieAdjust :
      diff >  3 ?  c.calorieAdjust :
                   1 - Math.abs(c.calorieAdjust);
    return { id: c.id, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.id ?? null;
}

// ─── Mifflin-St. Jeor + goal calculation ──────────────────────────────────

function calculatePlan(
  gender: Gender, age: number, heightCm: number, weightKg: number,
  activityLevel: ActivityLevel, fitnessGoal: FitnessGoal, celebrity?: CelebrityProfile,
): { calories: number; protein: number; carbs: number; fat: number; bmr: number; tdee: number } {
  const safeAge    = isNaN(age)      || age      <= 0 ? 25  : age;
  const safeHeight = isNaN(heightCm) || heightCm <= 0 ? 170 : heightCm;
  const safeWeight = isNaN(weightKg) || weightKg <= 0 ? 70  : weightKg;

  const bmr =
    gender === "male"
      ? 10 * safeWeight + 6.25 * safeHeight - 5 * safeAge + 5
      : 10 * safeWeight + 6.25 * safeHeight - 5 * safeAge - 161;

  const activityMultiplier: Record<ActivityLevel, number> = {
    sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9,
  };
  const tdee = bmr * (activityMultiplier[activityLevel] ?? 1.55);

  const goalCalorieOffset: Record<FitnessGoal, number> = {
    lose_weight: -500, gain_weight: 300, maintain: 0, build_muscle: 200,
  };
  const defaultSplit: Record<FitnessGoal, { p: number; c: number; f: number }> = {
    lose_weight:  { p: 0.40, c: 0.30, f: 0.30 },
    gain_weight:  { p: 0.25, c: 0.50, f: 0.25 },
    maintain:     { p: 0.30, c: 0.40, f: 0.30 },
    build_muscle: { p: 0.35, c: 0.45, f: 0.20 },
  };

  let targetCalories = tdee + (goalCalorieOffset[fitnessGoal] ?? 0);
  let split = defaultSplit[fitnessGoal] ?? defaultSplit.maintain;

  if (celebrity) {
    targetCalories = tdee * (1 + celebrity.calorieAdjust);
    split = { p: celebrity.proteinPct, c: celebrity.carbPct, f: celebrity.fatPct };
  }

  const safeCalories = isNaN(targetCalories) ? 1800 : Math.max(1200, Math.round(targetCalories));
  return {
    calories: safeCalories,
    protein: Math.round((safeCalories * split.p) / 4),
    carbs:   Math.round((safeCalories * split.c) / 4),
    fat:     Math.round((safeCalories * split.f) / 9),
    bmr:  isNaN(bmr)  ? 0 : Math.round(bmr),
    tdee: isNaN(tdee) ? 0 : Math.round(tdee),
  };
}

// ─── Floating deco icon ────────────────────────────────────────────────────

function FloatingIcon({
  name, size, color, style, phase, dur, spinDur,
}: {
  name: IoniconName; size: number; color: string;
  style?: object; phase?: number; dur?: number; spinDur?: number;
}) {
  const anim = useRef(new Animated.Value(phase ?? 0)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: dur ?? 3000, useNativeDriver: true }),
        Animated.timing(anim, { toValue: -1, duration: dur ?? 3000, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  useEffect(() => {
    if (!spinDur) return;
    const loop = Animated.loop(
      Animated.timing(spinAnim, { toValue: 1, duration: spinDur, easing: Easing.linear, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [spinDur]);
  const ty = anim.interpolate({ inputRange: [-1, 1], outputRange: [-7, 7] });
  const rotate = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const transforms = spinDur ? [{ translateY: ty }, { rotate }] : [{ translateY: ty }];
  return (
    <Animated.View style={[style, { transform: transforms }]}>
      <Ionicons name={name} size={size} color={color} />
    </Animated.View>
  );
}

function PulseRing({ color, size, initialProgress }: { color: string; size: number; initialProgress: number }) {
  const anim = useRef(new Animated.Value(initialProgress)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(anim, {
        toValue: initialProgress + 1,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, []);
  const scale = anim.interpolate({ inputRange: [initialProgress, initialProgress + 1], outputRange: [0.7, 3.2] });
  const opacity = anim.interpolate({
    inputRange: [initialProgress, initialProgress + 0.08, initialProgress + 0.6, initialProgress + 1],
    outputRange: [0, 0.55, 0.12, 0],
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        width: size, height: size, borderRadius: size / 2,
        borderWidth: 1.5, borderColor: color,
        transform: [{ scale }], opacity,
      }}
    />
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────

function OptionCard({
  label, sub, icon, selected, onPress,
}: {
  label: string; sub?: string; icon: IoniconName; selected: boolean; onPress: () => void;
}) {
  return (
    <TouchableOpacity style={[s.optionCard, selected && s.optionCardActive]} onPress={onPress} activeOpacity={0.7}>
      <View style={[s.optionIconWrap, selected && s.optionIconWrapActive]}>
        <Ionicons name={icon} size={20} color={selected ? C.primary : C.muted} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.optionLabel, selected && s.optionLabelActive]}>{label}</Text>
        {sub ? <Text style={s.optionSub}>{sub}</Text> : null}
      </View>
      <View style={[s.checkCircle, selected && s.checkCircleActive]}>
        {selected && <Ionicons name="checkmark" size={14} color="#fff" />}
      </View>
    </TouchableOpacity>
  );
}

function MacroPill({ label, value, unit, color }: { label: string; value: number; unit: string; color: string }) {
  return (
    <View style={[s.macroPill, { borderColor: color + "44", backgroundColor: color + "15" }]}>
      <Text style={[s.macroPillVal, { color }]}>{value}</Text>
      <Text style={s.macroPillUnit}>{unit}</Text>
      <Text style={s.macroPillLabel}>{label}</Text>
    </View>
  );
}

async function hashPassword(password: string): Promise<string> {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hash = await (globalThis.crypto ?? crypto).subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    // Fallback: deterministic encoding when crypto.subtle is unavailable
    let h = 5381;
    for (let i = 0; i < password.length; i++) {
      h = ((h << 5) + h) ^ password.charCodeAt(i);
      h >>>= 0;
    }
    return h.toString(16).padStart(8, "0") + password.length.toString(16);
  }
}

// ─── Main screen ────────────────────────────────────────────────────────────

const TOTAL_STEPS = 5;

export default function OnboardingScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<RootStackParamList, "Onboarding">>();
  const isReturningUser = !!(route.params as { returnToLogin?: boolean } | undefined)?.returnToLogin;
  const { height: windowHeight } = useWindowDimensions();
  const [showIntro, setShowIntro] = useState(!isReturningUser);
  const [showLogin, setShowLogin] = useState(isReturningUser);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [signUpConfirm, setSignUpConfirm] = useState("");
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);
  const [pendingPasswordHash, setPendingPasswordHash] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [googleEmail, setGoogleEmail] = useState("");
  const [appleEmail, setAppleEmail] = useState("");
  const [fbEmail, setFbEmail] = useState("");

  // Build the auth request; redirectUri is the proxy (https://), not the local exp:// URL.
  const [googleRequest] = useAuthRequest(
    {
      clientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? "unconfigured",
      redirectUri: EXPO_PROXY_URL,
      scopes: ["openid", "profile", "email"],
      usePKCE: true,
      extraParams: { prompt: "select_account" },
    },
    GOOGLE_DISCOVERY
  );

  const fbAppId = process.env.EXPO_PUBLIC_FACEBOOK_APP_ID ?? "unconfigured";
  const [, fbResponse, fbPromptAsync] = Facebook.useAuthRequest({ clientId: fbAppId });

  async function handleGoogleSignIn() {
    if (!process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID) {
      Alert.alert("Not configured", "Add EXPO_PUBLIC_GOOGLE_CLIENT_ID to your .env file.");
      return;
    }
    if (!googleRequest?.url) {
      Alert.alert("Not ready", "Please wait a moment and try again.");
      return;
    }
    // Open the auth.expo.io proxy start URL. The proxy redirects to Google,
    // then forwards the auth code back to the app via the exp:// deep link.
    const localReturnUrl = getDefaultReturnUrl();
    const startUrl = `${EXPO_PROXY_URL}/start?${new URLSearchParams({
      authUrl: googleRequest.url,
      returnUrl: localReturnUrl,
    }).toString()}`;
    try {
      const result = await WebBrowser.openAuthSessionAsync(startUrl, localReturnUrl);
      if (result.type !== "success") return;
      // The proxy appends ?code=...&state=... to the localReturnUrl deep link.
      const queryString = result.url.includes("?") ? result.url.split("?").slice(1).join("?") : "";
      const params = new URLSearchParams(queryString);
      const code = params.get("code");
      if (!code) {
        Alert.alert("Sign-In failed", "No authorization code received. Please try again.");
        return;
      }
      // Exchange the authorization code for an access token.
      const tokenBody: Record<string, string> = {
        code,
        client_id: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
        redirect_uri: EXPO_PROXY_URL,
        grant_type: "authorization_code",
      };
      if (googleRequest.codeVerifier) tokenBody.code_verifier = googleRequest.codeVerifier;
      if (process.env.EXPO_PUBLIC_GOOGLE_CLIENT_SECRET) tokenBody.client_secret = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_SECRET;
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(tokenBody).toString(),
      });
      if (!tokenRes.ok) {
        const err = await tokenRes.json() as { error?: string };
        if (err.error === "invalid_client" && !process.env.EXPO_PUBLIC_GOOGLE_CLIENT_SECRET) {
          Alert.alert("Setup needed", "Add EXPO_PUBLIC_GOOGLE_CLIENT_SECRET to your .env file.");
        } else {
          Alert.alert("Sign-In failed", "Google Sign-In failed. Please try again.");
        }
        return;
      }
      const tokens = await tokenRes.json() as { access_token?: string };
      if (!tokens.access_token) return;
      const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const userInfo = await userRes.json() as { name?: string; email?: string };
      if (userInfo.name && !name) setName(userInfo.name);
      if (userInfo.email) setGoogleEmail(userInfo.email);
      if (isReturningUser) {
        await savePreferences({ isAuthenticated: true });
        navigation.reset({ index: 0, routes: [{ name: "MainTabs" }] });
      } else {
        setShowLogin(false);
      }
    } catch {
      Alert.alert("Sign-In failed", "Google Sign-In failed. Please try again.");
    }
  }

  useEffect(() => {
    if (fbResponse?.type === "success") {
      const token = fbResponse.authentication?.accessToken;
      if (!token) return;
      fetch(`https://graph.facebook.com/me?fields=name,email&access_token=${token}`)
        .then((r) => r.json())
        .then((info: { name?: string; email?: string }) => {
          if (info.name && !name) setName(info.name);
          if (info.email) setFbEmail(info.email);
          if (isReturningUser) {
            void savePreferences({ isAuthenticated: true }).then(() => {
              navigation.reset({ index: 0, routes: [{ name: "MainTabs" }] });
            });
          } else {
            setShowLogin(false);
          }
        })
        .catch(() => setShowLogin(false));
    }
  }, [fbResponse]);

  async function handleAppleSignIn() {
    const available = await AppleAuthentication.isAvailableAsync();
    if (!available) {
      Alert.alert("Not available", "Apple Sign-In is only available on iOS devices.");
      return;
    }
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      const fullName = [credential.fullName?.givenName, credential.fullName?.familyName]
        .filter((s): s is string => s != null && s.length > 0)
        .join(" ");
      if (fullName && !name) setName(fullName);
      if (credential.email) setAppleEmail(credential.email);
      if (isReturningUser) {
        await savePreferences({ isAuthenticated: true });
        navigation.reset({ index: 0, routes: [{ name: "MainTabs" }] });
      } else {
        setShowLogin(false);
      }
    } catch (e: unknown) {
      if ((e as { code?: string }).code !== "ERR_REQUEST_CANCELED") {
        Alert.alert("Sign-In failed", "Apple Sign-In failed. Please try again.");
      }
    }
  }

  async function handleEmailSignIn() {
    if (!loginEmail.trim() || !loginPassword) {
      Alert.alert("Missing fields", "Please enter your email and password.");
      return;
    }
    const prefs = await getPreferences();
    if (!prefs.passwordHash) {
      Alert.alert("No password set", "This account was created without a password. Use social login, or continue without signing in.");
      return;
    }
    if (prefs.email?.toLowerCase() !== loginEmail.trim().toLowerCase()) {
      Alert.alert("Incorrect credentials", "Email or password is incorrect.");
      return;
    }
    const hash = await hashPassword(loginPassword);
    if (prefs.passwordHash !== hash) {
      Alert.alert("Incorrect credentials", "Email or password is incorrect.");
      return;
    }
    await savePreferences({ isAuthenticated: true });
    navigation.reset({ index: 0, routes: [{ name: "MainTabs" }] });
  }

  async function handleEmailSignUp() {
    try {
      if (!signUpEmail.trim() || !signUpPassword || !signUpConfirm) {
        Alert.alert("Missing fields", "Please fill in all fields.");
        return;
      }
      if (signUpPassword !== signUpConfirm) {
        Alert.alert("Passwords don't match", "Please make sure both passwords match.");
        return;
      }
      if (signUpPassword.length < 6) {
        Alert.alert("Weak password", "Password must be at least 6 characters.");
        return;
      }
      const hash = await hashPassword(signUpPassword);
      setPendingPasswordHash(hash);
      setGoogleEmail(signUpEmail.trim().toLowerCase());
      setShowLogin(false);
    } catch (err) {
      Alert.alert("Error", `Something went wrong: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const [fitnessGoal, setFitnessGoal] = useState<FitnessGoal>("maintain");
  const [gender, setGender] = useState<Gender>("male");
  const [age, setAge] = useState("25");
  const [heightCm, setHeightCm] = useState("170");
  const [weightKg, setWeightKg] = useState("70");
  const [targetWeight, setTargetWeight] = useState("");
  const [useMetric, setUseMetric] = useState(true);
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>("moderate");
  const [selectedCelebrity, setSelectedCelebrity] = useState<string | null>(null);

  // Prevent conversion running on initial mount
  const firstMetricChange = useRef(true);

  // Auto-convert all unit values when toggling metric ↔ imperial
  useEffect(() => {
    if (firstMetricChange.current) { firstMetricChange.current = false; return; }

    if (useMetric) {
      // Imperial → Metric
      const parts = heightCm.split("'");
      const ft = parseFloat(parts[0]) || 0;
      const inch = parseFloat(parts[1]) || 0;
      const cm = Math.round(ft * 30.48 + inch * 2.54);
      setHeightCm(cm > 0 ? String(cm) : "170");

      const kg = Math.round((parseFloat(weightKg) || 0) / 2.20462);
      if (kg > 0) setWeightKg(String(kg));

      if (targetWeight) {
        const tkg = Math.round((parseFloat(targetWeight) || 0) / 2.20462);
        if (tkg > 0) setTargetWeight(String(tkg));
      }
    } else {
      // Metric → Imperial
      const cm = parseFloat(heightCm) || 170;
      const totalInches = cm / 2.54;
      const ft = Math.floor(totalInches / 12);
      const inch = Math.round(totalInches % 12);
      setHeightCm(`${ft}'${inch}"`);

      const lbs = Math.round((parseFloat(weightKg) || 0) * 2.20462);
      if (lbs > 0) setWeightKg(String(lbs));

      if (targetWeight) {
        const tlbs = Math.round((parseFloat(targetWeight) || 0) * 2.20462);
        if (tlbs > 0) setTargetWeight(String(tlbs));
      }
    }
  }, [useMetric]);

  // Clear celebrity selection when gender changes if it no longer matches
  useEffect(() => {
    const current = CELEBRITY_PROFILES.find((c) => c.id === selectedCelebrity);
    if (current && current.gender !== gender) setSelectedCelebrity(null);
  }, [gender]);

  function next() { setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1)); }
  function back() { setStep((s) => Math.max(s - 1, 0)); }

  function getHeightCmValue(): number {
    if (!useMetric) {
      const parts = heightCm.split("'");
      const ft = parseFloat(parts[0]) || 0;
      const inch = parseFloat(parts[1]) || 0;
      return Math.round(ft * 30.48 + inch * 2.54);
    }
    return parseFloat(heightCm) || 170;
  }

  function getWeightKgValue(): number {
    const v = parseFloat(weightKg) || 70;
    return useMetric ? v : Math.round(v / 2.205);
  }

  function getTargetWeightKgValue(): number {
    const v = parseFloat(targetWeight) || 0;
    return useMetric ? v : v / 2.20462;
  }

  const currentWeightKg   = getWeightKgValue();
  const targetWeightKg    = getTargetWeightKgValue();
  const recommendedCelebId = targetWeightKg > 0
    ? getRecommendedCelebrity(gender, currentWeightKg, targetWeightKg)
    : null;

  // If user hasn't picked one, auto-use the best match
  const effectiveCelebId = selectedCelebrity ?? recommendedCelebId;
  const celebrity = CELEBRITY_PROFILES.find((c) => c.id === effectiveCelebId);
  const isAutoMatched = !selectedCelebrity && !!recommendedCelebId;
  const selectedCard = selectedCelebrity ? CELEBRITY_PROFILES.find((c) => c.id === selectedCelebrity) : null;

  const plan = calculatePlan(
    gender, parseInt(age) || 25, getHeightCmValue(),
    currentWeightKg, activityLevel, fitnessGoal, celebrity,
  );

  async function finish() {
    setSaving(true);
    const goals: UserGoals = {
      dailyCalories: plan.calories, dailyProtein: plan.protein,
      dailyCarbs: plan.carbs, dailyFat: plan.fat,
    };
    const onboarding: OnboardingData = {
      completed: true, fitnessGoal, gender,
      age: parseInt(age) || 25, heightCm: getHeightCmValue(),
      weightKg: currentWeightKg, activityLevel,
      celebrityProfile: effectiveCelebId,
    };
    const emailToSave = googleEmail || appleEmail || fbEmail;
    await savePreferences({
      name, goals, onboarding,
      isAuthenticated: true,
      streakDays: 0,
      lastLogDate: null,
      ...(emailToSave ? { email: emailToSave } : {}),
      ...(pendingPasswordHash ? { passwordHash: pendingPasswordHash } : {}),
    });
    navigation.reset({ index: 0, routes: [{ name: "MainTabs" }] });
  }

  const progress = (step + 1) / TOTAL_STEPS;
  const visibleCelebrities = CELEBRITY_PROFILES.filter((c) => c.gender === gender);
  const canProceed =
    (step !== 0 || name.trim().length > 0) &&
    (step !== 3 || (!!targetWeight && parseFloat(targetWeight) > 0));

  if (showIntro) {
    return (
      <SafeAreaView style={intro.safe}>
        <LinearGradient
          colors={["#ff9aaa", "#ff7a8a", "#d94060"]}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={[intro.hero, { height: windowHeight * 0.58 }]}
        >
          {/* Pulsing rings emanate from logo */}
          <PulseRing color="rgba(255,255,255,0.9)" size={124} initialProgress={0} />
          <PulseRing color="rgba(255,255,255,0.9)" size={124} initialProgress={0.33} />
          <PulseRing color="rgba(255,255,255,0.9)" size={124} initialProgress={0.67} />

          {/* Floating fitness icons */}
          <FloatingIcon name="flame-outline"   size={20} color="rgba(255,255,255,0.55)" style={[intro.deco, { top: 22,  left: 24  }]} phase={-0.6} dur={2800} spinDur={9000} />
          <FloatingIcon name="barbell-outline" size={24} color="rgba(255,255,255,0.45)" style={[intro.deco, { top: 20,  right: 22 }]} phase={0.4}  dur={3200} />
          <FloatingIcon name="heart-outline"   size={16} color="rgba(255,255,255,0.60)" style={[intro.deco, { top: 92,  left: 44  }]} phase={0.2}  dur={2600} spinDur={7000} />
          <FloatingIcon name="bicycle-outline" size={22} color="rgba(255,255,255,0.40)" style={[intro.deco, { top: 88,  right: 50 }]} phase={-0.3} dur={3500} />
          <FloatingIcon name="star-outline"    size={13} color="rgba(255,255,255,0.65)" style={[intro.deco, { top: 38,  right: 70 }]} phase={0.7}  dur={2400} spinDur={5000} />
          <FloatingIcon name="leaf-outline"    size={22} color="rgba(255,255,255,0.42)" style={[intro.deco, { bottom: 80, left: 34  }]} phase={-0.5} dur={3100} />
          <FloatingIcon name="walk-outline"    size={20} color="rgba(255,255,255,0.40)" style={[intro.deco, { bottom: 56, right: 44 }]} phase={0.8}  dur={2900} />
          <FloatingIcon name="water-outline"   size={16} color="rgba(255,255,255,0.52)" style={[intro.deco, { bottom: 100, right: width / 2 - 28 }]} phase={-0.1} dur={3300} spinDur={11000} />
          <FloatingIcon name="sparkles-outline" size={14} color="rgba(255,255,255,0.58)" style={[intro.deco, { top: 58, left: 14 }]} phase={0.3} dur={2200} spinDur={6500} />
          <FloatingIcon name="fitness-outline" size={18} color="rgba(255,255,255,0.38)" style={[intro.deco, { bottom: 38, left: 62 }]} phase={-0.7} dur={3400} />

          <View style={intro.logoSquare}>
            <View style={intro.logoInner}>
              <Ionicons name="nutrition-outline" size={52} color={C.primary} />
            </View>
          </View>
        </LinearGradient>

        <View style={intro.bottomCard}>
          <Text style={intro.brand}>FitBot</Text>
          <Text style={intro.headline}>{"Eat well.\nFeel amazing."}</Text>
          <Text style={intro.subtext}>
            AI-powered nutrition tracking. Snap any meal for instant analysis and build habits that actually stick.
          </Text>
          <TouchableOpacity style={intro.cta} onPress={() => { setShowIntro(false); setShowLogin(true); }} activeOpacity={0.85}>
            <Text style={intro.ctaText}>Get Started</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (showLogin) {
    const socialButtons = Platform.OS === "web" ? null : (
      <>
        <View style={lg.dividerRow}>
          <View style={lg.dividerLine} />
          <Text style={lg.dividerLabel}>or continue with</Text>
          <View style={lg.dividerLine} />
        </View>
        <TouchableOpacity style={lg.socialBtn} onPress={() => void handleGoogleSignIn()} activeOpacity={0.8}>
          <GoogleColorIcon size={20} />
          <Text style={lg.socialBtnText}>Continue with Google</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[lg.socialBtn, { marginTop: 10 }]} onPress={() => void handleAppleSignIn()} activeOpacity={0.8}>
          <Ionicons name="logo-apple" size={20} color={C.text} />
          <Text style={lg.socialBtnText}>Continue with Apple</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[lg.socialBtn, { marginTop: 10 }]}
          onPress={() => {
            if (!process.env.EXPO_PUBLIC_FACEBOOK_APP_ID) {
              Alert.alert("Not configured", "Add EXPO_PUBLIC_FACEBOOK_APP_ID to your .env file to enable Facebook Sign-In.");
              return;
            }
            void fbPromptAsync();
          }}
          activeOpacity={0.8}
        >
          <Ionicons name="logo-facebook" size={20} color="#1877F2" />
          <Text style={lg.socialBtnText}>Continue with Facebook</Text>
        </TouchableOpacity>
      </>
    );

    return (
      <SafeAreaView style={lg.safe}>
        {!isReturningUser && (
          <TouchableOpacity style={lg.backBtn} onPress={() => { setShowLogin(false); setShowIntro(true); }} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={22} color={C.muted} />
          </TouchableOpacity>
        )}
        <ScrollView contentContainerStyle={lg.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={lg.header}>
            <View style={lg.brandMark}>
              <Ionicons name="nutrition-outline" size={22} color={C.primary} />
            </View>
            <Text style={lg.brandName}>FitBot</Text>
          </View>

          {isReturningUser ? (
            <>
              <Text style={lg.title}>Welcome back</Text>
              <Text style={lg.subtitle}>Sign in to continue your journey</Text>
              <View style={lg.form}>
                <View style={lg.inputWrap}>
                  <View style={lg.inputIcon}><Ionicons name="mail-outline" size={18} color={C.muted} /></View>
                  <TextInput
                    style={lg.input}
                    value={loginEmail}
                    onChangeText={setLoginEmail}
                    placeholder="Email address"
                    placeholderTextColor={C.muted}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    returnKeyType="next"
                  />
                </View>
                <View style={lg.inputWrap}>
                  <View style={lg.inputIcon}><Ionicons name="lock-closed-outline" size={18} color={C.muted} /></View>
                  <TextInput
                    style={lg.input}
                    value={loginPassword}
                    onChangeText={setLoginPassword}
                    placeholder="Password"
                    placeholderTextColor={C.muted}
                    secureTextEntry={!showPassword}
                    returnKeyType="done"
                    onSubmitEditing={() => void handleEmailSignIn()}
                  />
                  <TouchableOpacity style={lg.eyeBtn} onPress={() => setShowPassword((v) => !v)}>
                    <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={18} color={C.muted} />
                  </TouchableOpacity>
                </View>
              </View>
              <TouchableOpacity style={lg.primaryBtn} onPress={() => void handleEmailSignIn()} activeOpacity={0.85}>
                <Text style={lg.primaryBtnText}>Sign In</Text>
              </TouchableOpacity>
              {socialButtons}
              <TouchableOpacity
                style={lg.newHereBtn}
                onPress={async () => {
                  await AsyncStorage.multiRemove(["food_entries", "weight_entries", "user_preferences"]);
                  await savePreferences({
                    isAuthenticated: true,
                    onboarding: { completed: true, fitnessGoal: "maintain", gender: "male", age: 30, heightCm: 170, weightKg: 70, activityLevel: "moderate", celebrityProfile: null },
                  });
                  navigation.reset({ index: 0, routes: [{ name: "MainTabs" }] });
                }}
                activeOpacity={0.8}
              >
                <Text style={lg.newHereText}>No password? <Text style={lg.newHereLink}>Continue without signing in</Text></Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={lg.tabRow}>
                <TouchableOpacity
                  style={[lg.tab, !isSignUp && lg.tabActive]}
                  onPress={() => setIsSignUp(false)}
                  activeOpacity={0.7}
                >
                  <Text style={[lg.tabText, !isSignUp && lg.tabTextActive]}>Sign In</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[lg.tab, isSignUp && lg.tabActive]}
                  onPress={() => setIsSignUp(true)}
                  activeOpacity={0.7}
                >
                  <Text style={[lg.tabText, isSignUp && lg.tabTextActive]}>Sign Up</Text>
                </TouchableOpacity>
              </View>

              {isSignUp ? (
                <>
                  <Text style={lg.title}>Create account</Text>
                  <Text style={lg.subtitle}>Set up email & password to sign in later</Text>
                  <View style={lg.form}>
                    <View style={lg.inputWrap}>
                      <View style={lg.inputIcon}><Ionicons name="mail-outline" size={18} color={C.muted} /></View>
                      <TextInput
                        style={lg.input}
                        value={signUpEmail}
                        onChangeText={setSignUpEmail}
                        placeholder="Email address"
                        placeholderTextColor={C.muted}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        returnKeyType="next"
                      />
                    </View>
                    <View style={lg.inputWrap}>
                      <View style={lg.inputIcon}><Ionicons name="lock-closed-outline" size={18} color={C.muted} /></View>
                      <TextInput
                        style={lg.input}
                        value={signUpPassword}
                        onChangeText={setSignUpPassword}
                        placeholder="Password (min 6 characters)"
                        placeholderTextColor={C.muted}
                        secureTextEntry={!showSignUpPassword}
                        returnKeyType="next"
                      />
                      <TouchableOpacity style={lg.eyeBtn} onPress={() => setShowSignUpPassword((v) => !v)}>
                        <Ionicons name={showSignUpPassword ? "eye-off-outline" : "eye-outline"} size={18} color={C.muted} />
                      </TouchableOpacity>
                    </View>
                    <View style={lg.inputWrap}>
                      <View style={lg.inputIcon}><Ionicons name="lock-closed-outline" size={18} color={C.muted} /></View>
                      <TextInput
                        style={lg.input}
                        value={signUpConfirm}
                        onChangeText={setSignUpConfirm}
                        placeholder="Confirm password"
                        placeholderTextColor={C.muted}
                        secureTextEntry={!showSignUpPassword}
                        returnKeyType="done"
                        onSubmitEditing={() => void handleEmailSignUp()}
                      />
                    </View>
                  </View>
                  <TouchableOpacity style={lg.primaryBtn} onPress={() => void handleEmailSignUp()} activeOpacity={0.85}>
                    <Text style={lg.primaryBtnText}>Create Account</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={lg.title}>Welcome back</Text>
                  <Text style={lg.subtitle}>Sign in to continue your journey</Text>
                  <View style={lg.form}>
                    <View style={lg.inputWrap}>
                      <View style={lg.inputIcon}><Ionicons name="mail-outline" size={18} color={C.muted} /></View>
                      <TextInput
                        style={lg.input}
                        value={loginEmail}
                        onChangeText={setLoginEmail}
                        placeholder="Email address"
                        placeholderTextColor={C.muted}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        returnKeyType="next"
                      />
                    </View>
                    <View style={lg.inputWrap}>
                      <View style={lg.inputIcon}><Ionicons name="lock-closed-outline" size={18} color={C.muted} /></View>
                      <TextInput
                        style={lg.input}
                        value={loginPassword}
                        onChangeText={setLoginPassword}
                        placeholder="Password"
                        placeholderTextColor={C.muted}
                        secureTextEntry={!showPassword}
                        returnKeyType="done"
                      />
                      <TouchableOpacity style={lg.eyeBtn} onPress={() => setShowPassword((v) => !v)}>
                        <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={18} color={C.muted} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <TouchableOpacity style={lg.primaryBtn} onPress={() => setShowLogin(false)} activeOpacity={0.85}>
                    <Text style={lg.primaryBtnText}>Sign In</Text>
                  </TouchableOpacity>
                  {socialButtons}
                  <TouchableOpacity style={lg.newHereBtn} onPress={() => setShowLogin(false)} activeOpacity={0.8}>
                    <Text style={lg.newHereText}>New here? <Text style={lg.newHereLink}>Create your plan</Text></Text>
                  </TouchableOpacity>
                </>
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // On web give an explicit pixel height so flex layout resolves correctly;
  // on native SafeAreaView + flex:1 is sufficient
  const containerStyle = Platform.OS === "web"
    ? [s.safe, { height: windowHeight }]
    : s.safe;

  return (
    <SafeAreaView style={containerStyle}>
      {/* Progress bar */}
      <View style={s.progressHeader}>
        <View style={s.stepDots}>
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <View key={i} style={[s.stepDot, i <= step && s.stepDotActive, i === step && s.stepDotCurrent]} />
          ))}
        </View>
        <View style={s.progressTrack}>
          <View style={[s.progressFill, { width: `${progress * 100}%` as any }]} />
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
      {/* key={step} remounts ScrollView on every step change → always starts at y:0 */}
      <ScrollView
        key={step}
        style={s.scroll}
        contentContainerStyle={step === 0 ? [s.content, s.contentStep0] : s.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Step 0: Welcome ── */}
        {step === 0 && (
          <View style={s.stepContainer}>
            <View style={s.stepIconRing}>
              <Ionicons name="heart" size={36} color={C.primary} />
            </View>
            <Text style={s.stepTitle}>Welcome!</Text>
            <Text style={s.stepSub}>Let's personalize your nutrition plan. This takes about 2 minutes.</Text>
            <Text style={s.fieldLabel}>What's your name?</Text>
            <TextInput
              style={s.textInput}
              value={name}
              onChangeText={setName}
              placeholder="Enter your name"
              placeholderTextColor={C.muted}
              autoFocus
              returnKeyType="next"
              onSubmitEditing={next}
            />
            {!canProceed && step === 0 && (
              <Text style={s.fieldError}>Please enter your name to continue.</Text>
            )}
          </View>
        )}

        {/* ── Step 1: Fitness Goal ── */}
        {step === 1 && (
          <View style={s.stepContainer}>
            <View style={s.stepIconRing}>
              <Ionicons name="flag-outline" size={36} color={C.primary} />
            </View>
            <Text style={s.stepTitle}>What's your goal?</Text>
            <Text style={s.stepSub}>This determines your calorie target and macro split.</Text>
            <OptionCard icon="trending-down-outline"    label="Lose Weight"     sub="500 cal deficit · High protein, moderate carbs" selected={fitnessGoal === "lose_weight"}  onPress={() => setFitnessGoal("lose_weight")} />
            <OptionCard icon="trending-up-outline"      label="Gain Weight"     sub="300 cal surplus · High carbs for energy"         selected={fitnessGoal === "gain_weight"}  onPress={() => setFitnessGoal("gain_weight")} />
            <OptionCard icon="swap-horizontal-outline"  label="Maintain Weight" sub="Balanced macros at your TDEE"                    selected={fitnessGoal === "maintain"}     onPress={() => setFitnessGoal("maintain")} />
            <OptionCard icon="barbell-outline"          label="Build Muscle"    sub="200 cal surplus · High protein & carbs"           selected={fitnessGoal === "build_muscle"} onPress={() => setFitnessGoal("build_muscle")} />
          </View>
        )}

        {/* ── Step 2: Physical Stats ── */}
        {step === 2 && (
          <View style={s.stepContainer}>
            <View style={s.stepIconRing}>
              <Ionicons name="body-outline" size={36} color={C.primary} />
            </View>
            <Text style={s.stepTitle}>Your stats</Text>
            <Text style={s.stepSub}>Used to calculate your BMR with the Mifflin-St. Jeor equation.</Text>

            <View style={s.unitToggle}>
              <TouchableOpacity style={[s.unitBtn, useMetric && s.unitBtnActive]} onPress={() => setUseMetric(true)}>
                <Text style={[s.unitBtnText, useMetric && s.unitBtnTextActive]}>Metric</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.unitBtn, !useMetric && s.unitBtnActive]} onPress={() => setUseMetric(false)}>
                <Text style={[s.unitBtnText, !useMetric && s.unitBtnTextActive]}>Imperial</Text>
              </TouchableOpacity>
            </View>

            <Text style={s.fieldLabel}>Gender</Text>
            <View style={s.genderRow}>
              {(["male", "female"] as Gender[]).map((g) => (
                <TouchableOpacity key={g} style={[s.genderBtn, gender === g && s.genderBtnActive]} onPress={() => setGender(g)}>
                  <Ionicons name={g === "male" ? "male-outline" : "female-outline"} size={26} color={gender === g ? C.primary : C.muted} />
                  <Text style={[s.genderLabel, gender === g && s.genderLabelActive]}>
                    {g.charAt(0).toUpperCase() + g.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={s.statsGrid}>
              <View style={s.statInputWrap}>
                <Text style={s.fieldLabel}>Age</Text>
                <TextInput style={s.statInput} value={age} onChangeText={setAge} keyboardType="numeric" placeholder="25" placeholderTextColor={C.muted} />
                <Text style={s.statUnit}>yrs</Text>
              </View>
              <View style={s.statInputWrap}>
                <Text style={s.fieldLabel}>Height</Text>
                <TextInput style={s.statInput} value={heightCm} onChangeText={setHeightCm} keyboardType="default" placeholder={useMetric ? "170" : "5'10\""} placeholderTextColor={C.muted} />
                <Text style={s.statUnit}>{useMetric ? "cm" : "ft / in"}</Text>
              </View>
              <View style={s.statInputWrap}>
                <Text style={s.fieldLabel}>Weight</Text>
                <TextInput style={s.statInput} value={weightKg} onChangeText={setWeightKg} keyboardType="numeric" placeholder={useMetric ? "70" : "154"} placeholderTextColor={C.muted} />
                <Text style={s.statUnit}>{useMetric ? "kg" : "lbs"}</Text>
              </View>
            </View>
          </View>
        )}

        {/* ── Step 3: Activity + Goal Weight + Celebrity ── */}
        {step === 3 && (
          <View style={s.stepContainer}>
            <View style={s.stepIconRing}>
              <Ionicons name="walk-outline" size={36} color={C.primary} />
            </View>
            <Text style={s.stepTitle}>Activity & Goals</Text>
            <Text style={s.stepSub}>How active are you, and what weight are you aiming for?</Text>

            {(
              [
                ["sedentary",   "Sedentary",        "Desk job, little exercise",           "desktop-outline"],
                ["light",       "Lightly Active",   "Light exercise 1–3 days/week",        "walk-outline"   ],
                ["moderate",    "Moderately Active","Moderate exercise 3–5 days/week",     "bicycle-outline"],
                ["active",      "Very Active",      "Hard exercise 6–7 days/week",         "fitness-outline"],
                ["very_active", "Extra Active",     "Physical job + daily training",       "barbell-outline"],
              ] as [ActivityLevel, string, string, IoniconName][]
            ).map(([val, label, sub, icon]) => (
              <OptionCard key={val} icon={icon} label={label} sub={sub} selected={activityLevel === val} onPress={() => setActivityLevel(val)} />
            ))}

            <View style={s.divider} />

            {/* Goal weight — required */}
            <Text style={s.sectionLabel}>Goal Weight</Text>
            <Text style={s.stepSub}>Enter the weight you're aiming to reach.</Text>
            <View style={[s.goalWeightRow, !canProceed && s.goalWeightRowError]}>
              <TextInput
                style={s.goalWeightInput}
                value={targetWeight}
                onChangeText={setTargetWeight}
                keyboardType="decimal-pad"
                placeholder={useMetric ? "e.g. 75" : "e.g. 165"}
                placeholderTextColor={C.muted}
                maxLength={6}
              />
              <View style={s.goalWeightUnitWrap}>
                <Text style={s.goalWeightUnit}>{useMetric ? "kg" : "lbs"}</Text>
              </View>
            </View>
            {!canProceed && (
              <Text style={s.fieldError}>Please enter your goal weight to continue.</Text>
            )}

            <View style={s.divider} />

            {/* Celebrity profiles — filtered by gender, optional with auto-match */}
            <Text style={s.sectionLabel}>Inspired by a celebrity?</Text>
            <Text style={s.stepSub}>
              Optional. If you skip this, we will auto-match you to the best profile for your goal.
            </Text>

            {/* Expanded selected card */}
            {selectedCard && (
              <TouchableOpacity
                style={s.celebCardExpanded}
                onPress={() => setSelectedCelebrity(null)}
                activeOpacity={0.8}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View style={[s.celebIconWrap, s.celebIconWrapActive, { width: 52, height: 52, borderRadius: 15 }]}>
                    <Ionicons name={selectedCard.icon} size={26} color={C.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.celebExpandedName}>{selectedCard.name}</Text>
                    <Text style={[s.celebRole, { textAlign: "left" }]}>{selectedCard.role}</Text>
                  </View>
                  <View style={s.celebCheck}>
                    <Ionicons name="checkmark" size={11} color="#fff" />
                  </View>
                </View>
                <Text style={s.celebExpandedDesc}>{selectedCard.description}</Text>
              </TouchableOpacity>
            )}

            {/* Grid of unselected cards */}
            <View style={s.celebGrid}>
              {visibleCelebrities
                .filter((c) => c.id !== selectedCelebrity)
                .map((c) => {
                  const isBestMatch = !selectedCelebrity && c.id === recommendedCelebId;
                  return (
                    <TouchableOpacity
                      key={c.id}
                      style={[s.celebCard, isBestMatch && s.celebCardBestMatch]}
                      onPress={() => setSelectedCelebrity(c.id)}
                      activeOpacity={0.7}
                    >
                      {isBestMatch && (
                        <View style={s.celebBestBadge}>
                          <Text style={s.celebBestBadgeText}>Best Match</Text>
                        </View>
                      )}
                      <View style={[s.celebIconWrap, isBestMatch && { backgroundColor: C.accent + "18" }]}>
                        <Ionicons name={c.icon} size={22} color={isBestMatch ? C.accent : C.muted} />
                      </View>
                      <Text style={s.celebName} numberOfLines={1}>{c.name}</Text>
                      <Text style={s.celebRole} numberOfLines={1}>{c.role}</Text>
                    </TouchableOpacity>
                  );
                })}
            </View>
          </View>
        )}

        {/* ── Step 4: Your Plan ── */}
        {step === 4 && (
          <View style={s.stepContainer}>
            <View style={[s.stepIconRing, { backgroundColor: C.success + "20", borderColor: C.success + "40" }]}>
              <Ionicons name="checkmark-circle-outline" size={36} color={C.success} />
            </View>
            <Text style={s.stepTitle}>Your personalized plan</Text>
            {name ? <Text style={s.stepSub}>Looking good, {name}! Here's what we recommend.</Text> : null}

            <View style={s.planCard}>
              <Text style={s.planCardTitle}>Daily Calorie Target</Text>
              <Text style={s.planCalories}>{plan.calories.toLocaleString()}</Text>
              <Text style={s.planCalUnit}>calories / day</Text>
              <View style={s.planDivider} />
              <Text style={s.planCardTitle}>Macro Split</Text>
              <View style={s.macroRow}>
                <MacroPill label="Protein" value={plan.protein} unit="g" color={C.secondary} />
                <MacroPill label="Carbs"   value={plan.carbs}   unit="g" color={C.accent} />
                <MacroPill label="Fat"     value={plan.fat}     unit="g" color={C.primary} />
              </View>
            </View>

            <View style={s.statsCard}>
              <View style={s.statRow}>
                <Text style={s.statRowLabel}>Basal Metabolic Rate</Text>
                <Text style={s.statRowVal}>{plan.bmr.toLocaleString()} kcal</Text>
              </View>
              <View style={s.statRow}>
                <Text style={s.statRowLabel}>Total Daily Energy</Text>
                <Text style={s.statRowVal}>{plan.tdee.toLocaleString()} kcal</Text>
              </View>
              <View style={s.statRow}>
                <Text style={s.statRowLabel}>Goal</Text>
                <Text style={s.statRowVal}>
                  {fitnessGoal === "lose_weight" ? "Lose weight" :
                   fitnessGoal === "gain_weight" ? "Gain weight" :
                   fitnessGoal === "build_muscle" ? "Build muscle" : "Maintain"}
                </Text>
              </View>
              {targetWeight ? (
                <View style={s.statRow}>
                  <Text style={s.statRowLabel}>Goal Weight</Text>
                  <Text style={s.statRowVal}>{targetWeight} {useMetric ? "kg" : "lbs"}</Text>
                </View>
              ) : null}
              {celebrity && (
                <View style={s.statRow}>
                  <Text style={s.statRowLabel}>Style inspiration</Text>
                  <Text style={s.statRowVal}>
                    {celebrity.name}{isAutoMatched ? " (auto)" : ""}
                  </Text>
                </View>
              )}
            </View>

            <Text style={s.planNote}>
              You can adjust these goals anytime in Settings. Start logging meals to track your progress!
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Navigation buttons */}
      <View style={s.navRow}>
        {step > 0 ? (
          <TouchableOpacity style={s.backBtn} onPress={back}>
            <Ionicons name="chevron-back" size={18} color={C.muted} />
            <Text style={s.backBtnText}>Back</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={s.backBtn} onPress={() => setShowLogin(true)}>
            <Ionicons name="chevron-back" size={18} color={C.muted} />
            <Text style={s.backBtnText}>Back</Text>
          </TouchableOpacity>
        )}

        {step < TOTAL_STEPS - 1 ? (
          <TouchableOpacity
            style={[s.nextBtn, !canProceed && s.nextBtnDisabled]}
            onPress={next}
            disabled={!canProceed}
          >
            <Text style={s.nextBtnText}>Continue</Text>
            <Ionicons name="chevron-forward" size={18} color="#fff" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[s.nextBtn, saving && s.nextBtnDisabled]} onPress={finish} disabled={saving}>
            <Text style={s.nextBtnText}>Start tracking!</Text>
            <Ionicons name="checkmark" size={18} color="#fff" />
          </TouchableOpacity>
        )}
      </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },

  progressHeader: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, gap: 8 },
  stepDots: { flexDirection: "row", gap: 6, justifyContent: "center" },
  stepDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.border },
  stepDotActive: { backgroundColor: C.primary + "60" },
  stepDotCurrent: { width: 18, backgroundColor: C.primary },
  progressTrack: { height: 6, backgroundColor: C.border, borderRadius: 3 },
  progressFill: { height: "100%", backgroundColor: C.primary, borderRadius: 3 },

  scroll: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 24, justifyContent: "center" },
  contentStep0: { justifyContent: "flex-start", paddingTop: 52 },
  stepContainer: { gap: 18 },

  stepIconRing: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: C.primary + "15",
    borderWidth: 2, borderColor: C.primary + "30",
    alignItems: "center", justifyContent: "center",
    alignSelf: "center", marginBottom: 8,
  },
  stepTitle: { fontSize: 28, fontFamily: F.extrabold, color: C.text, textAlign: "center" },
  stepSub: { fontSize: 14, fontFamily: F.regular, color: C.muted, textAlign: "center", lineHeight: 22, marginBottom: 4 },
  fieldLabel: { fontSize: 12, fontFamily: F.extrabold, color: C.muted, textTransform: "uppercase", letterSpacing: 0.8 },
  sectionLabel: { fontSize: 18, fontFamily: F.extrabold, color: C.text },
  fieldError: { fontSize: 12, fontFamily: F.semibold, color: "#ef4444", textAlign: "center" },
  textInput: {
    backgroundColor: C.card, borderRadius: 14, padding: 16,
    color: C.text, fontSize: 16, fontFamily: F.regular,
    borderWidth: 1, borderColor: C.border, marginTop: 2,
  },

  optionCard: {
    backgroundColor: C.card, borderRadius: 16, padding: 14,
    flexDirection: "row", alignItems: "center", gap: 12,
    borderWidth: 1.5, borderColor: C.border,
  },
  optionCardActive: { borderColor: C.primary, backgroundColor: C.primary + "08" },
  optionIconWrap: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: C.fill,
    alignItems: "center", justifyContent: "center",
  },
  optionIconWrapActive: { backgroundColor: C.primary + "18" },
  optionLabel: { fontSize: 15, fontFamily: F.bold, color: C.text },
  optionLabelActive: { color: C.primary },
  optionSub: { fontSize: 12, fontFamily: F.regular, color: C.muted, marginTop: 2 },
  checkCircle: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 1.5, borderColor: C.border,
    alignItems: "center", justifyContent: "center",
  },
  checkCircleActive: { backgroundColor: C.primary, borderColor: C.primary },

  unitToggle: {
    flexDirection: "row", backgroundColor: C.card,
    borderRadius: 12, padding: 4, borderWidth: 1, borderColor: C.border,
  },
  unitBtn: { flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: "center" },
  unitBtnActive: { backgroundColor: C.primary },
  unitBtnText: { fontSize: 13, fontFamily: F.semibold, color: C.muted },
  unitBtnTextActive: { color: "#fff", fontFamily: F.bold },

  genderRow: { flexDirection: "row", gap: 12 },
  genderBtn: {
    flex: 1, backgroundColor: C.card, borderRadius: 14, padding: 16,
    alignItems: "center", borderWidth: 1.5, borderColor: C.border, gap: 6,
  },
  genderBtnActive: { borderColor: C.primary, backgroundColor: C.primary + "08" },
  genderLabel: { fontSize: 14, fontFamily: F.semibold, color: C.muted },
  genderLabelActive: { color: C.primary, fontFamily: F.bold },

  statsGrid: { flexDirection: "row", gap: 10 },
  statInputWrap: { flex: 1, gap: 4 },
  statInput: {
    backgroundColor: C.card, borderRadius: 12, padding: 12,
    color: C.text, fontSize: 16, fontFamily: F.bold,
    textAlign: "center", borderWidth: 1, borderColor: C.border,
  },
  statUnit: { fontSize: 11, fontFamily: F.semibold, color: C.muted, textAlign: "center" },

  divider: { height: 1, backgroundColor: C.border, marginVertical: 8 },

  goalWeightRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: C.card, borderRadius: 14,
    borderWidth: 1.5, borderColor: C.border, overflow: "hidden",
  },
  goalWeightRowError: { borderColor: "#ef4444" },
  goalWeightInput: {
    flex: 1, padding: 16,
    color: C.text, fontSize: 18, fontFamily: F.bold,
  },
  goalWeightUnitWrap: {
    paddingHorizontal: 16, paddingVertical: 16,
    borderLeftWidth: 1, borderLeftColor: C.border,
    backgroundColor: C.fill,
  },
  goalWeightUnit: { fontSize: 14, fontFamily: F.bold, color: C.muted },

  celebGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  celebCard: {
    width: (width - 48 - 10) / 2, backgroundColor: C.card, borderRadius: 16, padding: 14,
    alignItems: "center", gap: 6, borderWidth: 1.5, borderColor: C.border, position: "relative",
  },
  celebCardBestMatch: { borderColor: C.accent, backgroundColor: C.accent + "08" },
  celebIconWrap: {
    width: 48, height: 48, borderRadius: 14, backgroundColor: C.fill,
    alignItems: "center", justifyContent: "center",
  },
  celebIconWrapActive: { backgroundColor: C.primary + "18" },
  celebName: { fontSize: 13, fontFamily: F.bold, color: C.text, textAlign: "center" },
  celebRole: { fontSize: 11, fontFamily: F.regular, color: C.muted, textAlign: "center" },
  celebCheck: {
    position: "absolute", top: 8, right: 8,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: C.primary, alignItems: "center", justifyContent: "center",
  },
  celebBestBadge: {
    position: "absolute", top: 6, left: 6,
    backgroundColor: C.accent + "22", borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2,
    borderWidth: 1, borderColor: C.accent + "60",
  },
  celebBestBadgeText: { fontSize: 9, fontFamily: F.bold, color: C.accent },
  celebCardExpanded: {
    backgroundColor: C.primary + "08", borderRadius: 16, padding: 16,
    borderWidth: 1.5, borderColor: C.primary, gap: 10,
  },
  celebExpandedName: { fontSize: 16, fontFamily: F.bold, color: C.primary },
  celebExpandedDesc: { fontSize: 13, fontFamily: F.regular, color: C.muted, lineHeight: 19 },

  planCard: {
    backgroundColor: C.card, borderRadius: 20, padding: 20, alignItems: "center",
    borderWidth: 1, borderColor: C.primary + "30",
    shadowColor: C.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  planCardTitle: { fontSize: 12, fontFamily: F.extrabold, color: C.muted, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 },
  planCalories: { fontSize: 56, fontFamily: F.extrabold, color: C.primary, lineHeight: 64 },
  planCalUnit: { fontSize: 14, fontFamily: F.regular, color: C.muted },
  planDivider: { height: 1, backgroundColor: C.border, width: "100%", marginVertical: 16 },
  macroRow: { flexDirection: "row", gap: 12, marginTop: 8 },
  macroPill: { flex: 1, alignItems: "center", padding: 12, borderRadius: 14, borderWidth: 1, gap: 2 },
  macroPillVal: { fontSize: 22, fontFamily: F.extrabold },
  macroPillUnit: { fontSize: 11, fontFamily: F.regular, color: C.muted },
  macroPillLabel: { fontSize: 11, fontFamily: F.semibold, color: C.muted },

  statsCard: {
    backgroundColor: C.card, borderRadius: 16, padding: 16, gap: 10,
    shadowColor: C.primary, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  statRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  statRowLabel: { fontSize: 14, fontFamily: F.regular, color: C.muted },
  statRowVal: { fontSize: 14, fontFamily: F.bold, color: C.text },
  planNote: { fontSize: 13, fontFamily: F.regular, color: C.muted, textAlign: "center", lineHeight: 18 },

  navRow: {
    flexDirection: "row", gap: 12, paddingHorizontal: 24, paddingVertical: 16,
    borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.bg,
  },
  backBtn: {
    flex: 1, paddingVertical: 16, borderRadius: 16,
    backgroundColor: C.card, alignItems: "center", borderWidth: 1, borderColor: C.border,
    flexDirection: "row", justifyContent: "center", gap: 4,
  },
  backBtnText: { color: C.muted, fontSize: 16, fontFamily: F.semibold },
  nextBtn: {
    flex: 2, paddingVertical: 16, borderRadius: 16,
    backgroundColor: C.primary, alignItems: "center",
    shadowColor: C.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
    flexDirection: "row", justifyContent: "center", gap: 6,
  },
  nextBtnDisabled: { opacity: 0.4, shadowOpacity: 0 },
  nextBtnText: { color: "#fff", fontSize: 16, fontFamily: F.bold },
});

const intro = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  hero: {
    backgroundColor: C.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  deco: { position: "absolute" },
  logoSquare: {
    width: 116, height: 116, borderRadius: 32,
    backgroundColor: "#fff",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 12,
  },
  logoInner: {
    width: 88, height: 88, borderRadius: 24,
    backgroundColor: C.primary + "12",
    alignItems: "center", justifyContent: "center",
  },
  bottomCard: {
    flex: 1,
    backgroundColor: C.bg,
    marginTop: -28,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 30,
    paddingTop: 42,
    paddingBottom: 28,
    justifyContent: "flex-start",
    gap: 14,
    zIndex: 1,
  },
  brand: {
    fontSize: 12, fontFamily: F.extrabold, color: C.primary,
    textTransform: "uppercase", letterSpacing: 3,
  },
  headline: {
    fontSize: 34, fontFamily: F.extrabold, color: C.text, lineHeight: 42,
  },
  subtext: {
    fontSize: 15, fontFamily: F.regular, color: C.muted, lineHeight: 23,
  },
  cta: {
    backgroundColor: C.primary,
    borderRadius: 18,
    paddingVertical: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 8,
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.38,
    shadowRadius: 14,
    elevation: 10,
  },
  ctaText: { fontFamily: F.extrabold, color: "#fff", fontSize: 17 },
});

const lg = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  backBtn: { position: "absolute", top: 52, left: 20, zIndex: 10, padding: 6 },
  scroll: { flexGrow: 1, paddingHorizontal: 28, paddingTop: 52, paddingBottom: 40 },
  header: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 36 },
  brandMark: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: C.primary + "18",
    alignItems: "center", justifyContent: "center",
  },
  brandName: { fontSize: 20, fontFamily: F.extrabold, color: C.text },
  title: { fontSize: 30, fontFamily: F.extrabold, color: C.text, marginBottom: 6 },
  subtitle: { fontSize: 15, fontFamily: F.regular, color: C.muted, marginBottom: 28, lineHeight: 22 },
  form: { gap: 12, marginBottom: 20 },
  inputWrap: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: C.card, borderRadius: 14,
    borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 14, height: 54,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, color: C.text, fontSize: 15, fontFamily: F.regular },
  eyeBtn: { padding: 4 },
  primaryBtn: {
    backgroundColor: C.primary, borderRadius: 16, paddingVertical: 18,
    alignItems: "center", marginBottom: 22,
    shadowColor: C.primary, shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
  },
  primaryBtnText: { fontFamily: F.extrabold, color: "#fff", fontSize: 16 },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 18 },
  dividerLine: { flex: 1, height: 1, backgroundColor: C.border },
  dividerLabel: { fontSize: 13, fontFamily: F.regular, color: C.muted },
  socialBtn: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: C.card, borderRadius: 14,
    borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 20, paddingVertical: 15,
  },
  socialBtnText: { fontSize: 15, fontFamily: F.semibold, color: C.text },
  newHereBtn: { alignItems: "center", marginTop: 24 },
  newHereText: { fontSize: 14, fontFamily: F.regular, color: C.muted },
  newHereLink: { fontFamily: F.bold, color: C.primary },
  tabRow: {
    flexDirection: "row",
    backgroundColor: C.fill,
    borderRadius: 12,
    padding: 3,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: C.card,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: { fontSize: 14, fontFamily: F.semibold, color: C.muted },
  tabTextActive: { color: C.text, fontFamily: F.bold },
});
