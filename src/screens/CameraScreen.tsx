import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../types";
import { getActiveDate } from "../services/activeDate";
import { getTodayDate } from "../services/storage";
import { C, F } from "../theme";

type Nav = StackNavigationProp<RootStackParamList, "MainTabs">;

async function compressForUpload(uri: string): Promise<{ uri: string; base64: string }> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1024 } }],
    { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG, base64: true },
  );
  return { uri: result.uri, base64: result.base64! };
}

export default function CameraScreen() {
  const navigation = useNavigation<Nav>();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);

  const activeDate = getActiveDate();
  const isLoggingToday = activeDate === getTodayDate();
  const logDateDisplay = isLoggingToday
    ? null
    : new Date(activeDate + "T12:00:00").toLocaleDateString("en-US", {
        weekday: "short", month: "short", day: "numeric",
      });

  async function pickFromCamera() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Camera access required", "Please grant camera permission in Settings.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 1 });
    if (!result.canceled && result.assets[0]) {
      const compressed = await compressForUpload(result.assets[0].uri);
      setImageUri(compressed.uri);
      setImageBase64(compressed.base64);
    }
  }

  async function pickFromLibrary() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Gallery access required", "Please grant photo library permission in Settings.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 1 });
    if (!result.canceled && result.assets[0]) {
      const compressed = await compressForUpload(result.assets[0].uri);
      setImageUri(compressed.uri);
      setImageBase64(compressed.base64);
    }
  }

  function analyzeFood() {
    if (!imageUri || !imageBase64) return;
    navigation.navigate("FoodAnalysis", { imageUri, base64: imageBase64 });
    setImageUri(null);
    setImageBase64(null);
  }

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView style={s.kav} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View style={s.container}>

          {/* Header */}
          <View style={s.topRow}>
            <Text style={s.title}>Log a Meal</Text>
            {isLoggingToday ? (
              <Text style={s.subtitle}>Snap or upload a photo of your food</Text>
            ) : (
              <View style={s.dateRow}>
                <Text style={s.subtitle}>Snap or upload a photo of your food</Text>
                <View style={s.dateBadge}>
                  <Ionicons name="calendar-outline" size={12} color={C.primary} />
                  <Text style={s.dateBadgeText}>Logging for {logDateDisplay}</Text>
                </View>
              </View>
            )}
          </View>

          {/* Preview */}
          <View style={s.previewArea}>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={s.preview} resizeMode="cover" />
            ) : (
              <View style={s.placeholder}>
                <Ionicons name="camera-outline" size={60} color={C.muted + "88"} />
                <Text style={s.placeholderText}>No photo selected</Text>
                <Text style={s.placeholderSub}>Use the buttons below to add one</Text>
              </View>
            )}
          </View>

          {/* Bottom controls */}
          <View style={s.bottomControls}>
            <View style={s.pickerRow}>
              <TouchableOpacity style={s.pickerBtn} onPress={pickFromCamera} activeOpacity={0.75}>
                <Ionicons name="camera" size={24} color={C.primary} />
                <Text style={s.pickerLabel}>Camera</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.pickerBtn} onPress={pickFromLibrary} activeOpacity={0.75}>
                <Ionicons name="images" size={24} color={C.primary} />
                <Text style={s.pickerLabel}>Gallery</Text>
              </TouchableOpacity>
              {imageUri && (
                <TouchableOpacity style={s.pickerBtn} onPress={() => { setImageUri(null); setImageBase64(null); }} activeOpacity={0.75}>
                  <Ionicons name="refresh-outline" size={24} color={C.muted} />
                  <Text style={[s.pickerLabel, { color: C.muted }]}>Retake</Text>
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              style={[s.analyzeBtn, !imageUri && s.analyzeBtnDisabled]}
              onPress={analyzeFood}
              disabled={!imageUri || !imageBase64}
              activeOpacity={0.85}
            >
              <Text style={[s.analyzeText, !imageUri && { color: C.muted }]}>
                {imageUri ? "Analyze Food" : "Select a photo to continue"}
              </Text>
              {imageUri && (
                <View style={s.analyzeSubRow}>
                  <Ionicons name="sparkles-outline" size={12} color="rgba(255,255,255,0.8)" />
                  <Text style={s.analyzeSubtext}>Claude will identify nutrients & health score</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "transparent" },
  kav: { flex: 1 },
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  topRow: { marginBottom: 12 },
  title: { fontSize: 24, fontFamily: F.extrabold, color: C.text },
  subtitle: { fontSize: 13, fontFamily: F.regular, color: C.muted, marginTop: 3 },
  dateRow: { gap: 6 },
  dateBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    alignSelf: "flex-start", backgroundColor: C.primary + "18",
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: C.primary + "40", marginTop: 4,
  },
  dateBadgeText: { fontSize: 12, fontFamily: F.bold, color: C.primary },

  previewArea: { flex: 1, borderRadius: 24, overflow: "hidden", backgroundColor: "#2D1B35", minHeight: 180 },
  preview: { width: "100%", height: "100%" },
  placeholder: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  placeholderText: { fontFamily: F.bold, color: "rgba(255,255,255,0.6)", fontSize: 15 },
  placeholderSub: { fontFamily: F.regular, color: "rgba(255,255,255,0.35)", fontSize: 13 },

  bottomControls: { paddingTop: 12, gap: 10 },
  pickerRow: { flexDirection: "row", gap: 10 },
  pickerBtn: {
    flex: 1, backgroundColor: C.card, borderRadius: 16, paddingVertical: 14,
    alignItems: "center", gap: 6, borderWidth: 1, borderColor: C.border,
    shadowColor: C.primary, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1,
  },
  pickerLabel: { fontFamily: F.bold, color: C.text, fontSize: 12 },

  analyzeBtn: {
    backgroundColor: C.primary, borderRadius: 18, paddingVertical: 18, alignItems: "center",
    shadowColor: C.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 6,
  },
  analyzeBtnDisabled: { backgroundColor: C.card, shadowOpacity: 0, elevation: 0, borderWidth: 1, borderColor: C.border },
  analyzeText: { fontFamily: F.extrabold, color: "#fff", fontSize: 16 },
  analyzeSubRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 },
  analyzeSubtext: { fontFamily: F.regular, color: "rgba(255,255,255,0.8)", fontSize: 11 },
});
