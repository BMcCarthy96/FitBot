import React, { useEffect, useRef, useState } from "react";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createBottomTabNavigator, BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { createStackNavigator } from "@react-navigation/stack";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated as RNAnim,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { RootStackParamList, TabParamList } from "../types";
import { getPreferences } from "../services/storage";
import { scheduleNotifications } from "../services/notifications";
import HomeScreen from "../screens/HomeScreen";
import CameraScreen from "../screens/CameraScreen";
import ProgressScreen from "../screens/ProgressScreen";
import SettingsScreen from "../screens/SettingsScreen";
import FoodAnalysisScreen from "../screens/FoodAnalysisScreen";
import OnboardingScreen from "../screens/OnboardingScreen";
import ChatScreen from "../screens/ChatScreen";
import WeightLogModal from "../components/WeightLogModal";
import ThemeBackground from "../components/ThemeBackground";
import { C, F } from "../theme";
import { useTheme } from "../services/themeContext";

const Tab = createBottomTabNavigator<TabParamList>();
const Stack = createStackNavigator<RootStackParamList>();

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

const TAB_ICONS: Record<string, { active: IoniconName; inactive: IoniconName }> = {
  Home:     { active: "home",            inactive: "home-outline" },
  Progress: { active: "bar-chart",       inactive: "bar-chart-outline" },
  Coach:    { active: "chatbubbles",     inactive: "chatbubbles-outline" },
  Settings: { active: "settings",        inactive: "settings-outline" },
};

// ── Tab item: reanimated spring press feedback ────────────────────────────────

function AnimatedTabItem({
  route,
  isFocused,
  onPress,
}: {
  route: { name: string; key: string };
  isFocused: boolean;
  onPress: () => void;
}) {
  const scale = useRef(new RNAnim.Value(1)).current;

  function handlePress() {
    RNAnim.sequence([
      RNAnim.spring(scale, { toValue: 0.80, useNativeDriver: true, speed: 50, bounciness: 0 }),
      RNAnim.spring(scale, { toValue: 1,    useNativeDriver: true, speed: 14, bounciness: 8 }),
    ]).start();
    onPress();
  }

  const theme = useTheme();
  const icons = TAB_ICONS[route.name] ?? { active: "ellipse", inactive: "ellipse-outline" };
  const iconColor = isFocused ? theme.primary : C.muted;
  const iconName = isFocused ? icons.active : icons.inactive;

  return (
    <TouchableOpacity style={s.tabItem} onPress={handlePress} activeOpacity={1}>
      <RNAnim.View style={[s.tabInner, { transform: [{ scale }] }]}>
        <Ionicons name={iconName} size={isFocused ? 26 : 24} color={iconColor} />
        <Text style={[s.tabLabel, { color: iconColor, fontFamily: isFocused ? F.bold : F.semibold }]}>
          {route.name}
        </Text>
      </RNAnim.View>
    </TouchableOpacity>
  );
}

// ── Custom tab bar with FAB ───────────────────────────────────────────────────

function CustomTabBar({
  state,
  navigation,
  onLogWeight,
}: BottomTabBarProps & { onLogWeight: () => void }) {
  const theme = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuAnim  = useRef(new RNAnim.Value(0)).current;
  const fabRotate = useRef(new RNAnim.Value(0)).current;
  const fabScale  = useRef(new RNAnim.Value(1)).current;

  function openMenu() {
    setMenuOpen(true);
    RNAnim.parallel([
      RNAnim.spring(menuAnim,  { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 8 }),
      RNAnim.spring(fabRotate, { toValue: 1, useNativeDriver: true, speed: 24, bounciness: 0 }),
    ]).start();
  }

  function closeMenu(andThen?: () => void) {
    RNAnim.parallel([
      RNAnim.timing(menuAnim,  { toValue: 0, useNativeDriver: true, duration: 180 }),
      RNAnim.timing(fabRotate, { toValue: 0, useNativeDriver: true, duration: 180 }),
    ]).start(() => {
      setMenuOpen(false);
      andThen?.();
    });
  }

  function handleFabPress() {
    RNAnim.sequence([
      RNAnim.spring(fabScale, { toValue: 0.86, useNativeDriver: true, speed: 60, bounciness: 0 }),
      RNAnim.spring(fabScale, { toValue: 1,    useNativeDriver: true, speed: 18, bounciness: 14 }),
    ]).start();
    if (menuOpen) closeMenu();
    else openMenu();
  }

  const rotate       = fabRotate.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "45deg"] });
  const menuOpacity  = menuAnim;
  const menuTranslate = menuAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] });

  const visibleTabs = state.routes.filter((r) => r.name !== "Camera");

  return (
    <View style={s.tabBarWrapper}>
      <Modal transparent visible={menuOpen} animationType="none" onRequestClose={() => closeMenu()}>
        <View style={{ flex: 1 }}>
          <TouchableOpacity
            style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.40)" }]}
            activeOpacity={1}
            onPress={() => closeMenu()}
          />
          <RNAnim.View
            style={[s.fabMenu, { opacity: menuOpacity, transform: [{ translateY: menuTranslate }] }]}
          >
            <TouchableOpacity
              style={s.fabMenuItem}
              activeOpacity={0.75}
              onPress={() => closeMenu(() => navigation.navigate("Camera" as any))}
            >
              <View style={[s.fabMenuIcon, { backgroundColor: theme.primary }]}>
                <Ionicons name="camera" size={18} color="#fff" />
              </View>
              <View>
                <Text style={s.fabMenuLabel}>Snap Meal</Text>
                <Text style={s.fabMenuSub}>Analyze with AI</Text>
              </View>
            </TouchableOpacity>
            <View style={s.fabMenuDivider} />
            <TouchableOpacity
              style={s.fabMenuItem}
              activeOpacity={0.75}
              onPress={() => closeMenu(onLogWeight)}
            >
              <View style={[s.fabMenuIcon, { backgroundColor: C.secondary }]}>
                <Ionicons name="scale-outline" size={18} color="#fff" />
              </View>
              <View>
                <Text style={s.fabMenuLabel}>Log Weight</Text>
                <Text style={s.fabMenuSub}>Track your progress</Text>
              </View>
            </TouchableOpacity>
          </RNAnim.View>
        </View>
      </Modal>

      <View style={s.tabBar}>
        {visibleTabs.map((route) => {
          const isFocused = state.routes[state.index].name === route.name;
          const onPress = () => {
            const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
            if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name as any);
          };
          return (
            <AnimatedTabItem key={route.key} route={route} isFocused={isFocused} onPress={onPress} />
          );
        })}
      </View>

      <TouchableOpacity style={s.fab} onPress={handleFabPress} activeOpacity={1}>
        <RNAnim.View style={[s.fabInner, { backgroundColor: theme.primary, shadowColor: theme.primary, transform: [{ scale: fabScale }, { rotate }] }]}>
          <Ionicons name="add" size={30} color="#fff" />
        </RNAnim.View>
      </TouchableOpacity>
    </View>
  );
}

function MainTabs() {
  const [showWeightModal, setShowWeightModal] = useState(false);
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ThemeBackground />
      <Tab.Navigator
        tabBar={(props) => (
          <CustomTabBar {...props} onLogWeight={() => setShowWeightModal(true)} />
        )}
        screenOptions={{ headerShown: false }}
      >
        <Tab.Screen name="Home" component={HomeScreen} />
        <Tab.Screen name="Progress" component={ProgressScreen} />
        <Tab.Screen name="Coach" component={ChatScreen} />
        <Tab.Screen name="Settings" component={SettingsScreen} />
        <Tab.Screen name="Camera" component={CameraScreen} options={{ tabBarButton: () => null }} />
      </Tab.Navigator>
      <WeightLogModal visible={showWeightModal} onClose={() => setShowWeightModal(false)} />
    </View>
  );
}

export default function AppNavigator() {
  const [initialRoute, setInitialRoute] = useState<"Onboarding" | "MainTabs" | null>(null);

  useEffect(() => {
    getPreferences().then((prefs) => {
      setInitialRoute(prefs.onboarding.completed && prefs.isAuthenticated ? "MainTabs" : "Onboarding");
      if (prefs.onboarding.completed && prefs.notificationsEnabled) {
        scheduleNotifications(prefs.mealReminderTimes).catch(() => {});
      }
    });
  }, []);

  if (!initialRoute) return null;

  const navTheme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: "transparent" } };

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator initialRouteName={initialRoute} screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        <Stack.Screen name="MainTabs" component={MainTabs} />
        <Stack.Screen name="FoodAnalysis" component={FoodAnalysisScreen} options={{ presentation: "modal" }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const s = StyleSheet.create({
  tabBarWrapper: { position: "relative", backgroundColor: C.card, overflow: "visible" },
  tabBar: {
    flexDirection: "row",
    backgroundColor: C.card,
    borderTopColor: C.border,
    borderTopWidth: 1,
    paddingBottom: 16,
    height: 76,
  },
  tabItem: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 8 },
  tabInner: { alignItems: "center", gap: 3 },
  tabLabel: { fontSize: 11 },
  fab: { position: "absolute", right: 16, bottom: 82, zIndex: 100 },
  fabInner: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: C.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 10,
  },
  fabMenu: {
    position: "absolute",
    right: 16,
    bottom: 155,
    backgroundColor: C.card,
    borderRadius: 20,
    paddingVertical: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 20,
    minWidth: 210,
  },
  fabMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  fabMenuIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  fabMenuLabel: { fontSize: 15, fontFamily: F.bold, color: C.text },
  fabMenuSub: { fontSize: 11, fontFamily: F.semibold, color: C.muted, marginTop: 1 },
  fabMenuDivider: { height: 1, backgroundColor: C.border, marginHorizontal: 16 },
});
