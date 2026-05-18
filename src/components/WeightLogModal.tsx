import React, { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { addWeightEntry } from "../services/storage";
import { getActiveDate } from "../services/activeDate";
import { emitWeightChange } from "../services/eventBus";
import { WeightEntry } from "../types";
import { C, F } from "../theme";

const LBS_PER_KG = 2.20462;

export default function WeightLogModal({
  visible,
  onClose,
  onSaved,
}: {
  visible: boolean;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const [unit, setUnit] = useState<"lbs" | "kg">("lbs");
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [activeDate, setActiveDateState] = useState(getActiveDate());

  useEffect(() => {
    if (visible) setActiveDateState(getActiveDate());
  }, [visible]);

  async function handleSave() {
    const val = parseFloat(input);
    if (!val || val <= 0) return;
    const weightKg = unit === "lbs" ? val / LBS_PER_KG : val;
    setSaving(true);
    try {
      const entry: WeightEntry = {
        id: `w_${Date.now()}`,
        date: activeDate,
        timestamp: Date.now(),
        weightKg,
      };
      await addWeightEntry(entry);
      emitWeightChange();
      setInput("");
      onSaved?.();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  function handleClose() {
    setInput("");
    onClose();
  }

  const today = new Date(activeDate + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const canSave = !!input && parseFloat(input) > 0 && !saving;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {/* Backdrop — flex:1 fills only the space above the sheet */}
        <TouchableOpacity style={ml.backdrop} activeOpacity={1} onPress={handleClose} />

        <View style={ml.sheet}>
          <View style={ml.handle} />
          <View style={ml.header}>
            <View style={ml.iconWrap}>
              <Ionicons name="scale-outline" size={22} color={C.primary} />
            </View>
            <Text style={ml.title}>Log Weight</Text>
            <TouchableOpacity onPress={handleClose} style={ml.closeBtn}>
              <Ionicons name="close" size={20} color={C.muted} />
            </TouchableOpacity>
          </View>

          <Text style={ml.dateLabel}>{today}</Text>

          <View style={ml.unitRow}>
            {(["lbs", "kg"] as const).map((u) => (
              <TouchableOpacity
                key={u}
                style={[ml.unitBtn, unit === u && ml.unitBtnActive]}
                onPress={() => setUnit(u)}
              >
                <Text style={[ml.unitText, unit === u && ml.unitTextActive]}>{u}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={ml.inputWrap}>
            <TextInput
              style={[ml.input, { outlineStyle: "none", outlineWidth: 0, boxShadow: "none" } as any]}
              value={input}
              onChangeText={setInput}
              keyboardType="decimal-pad"
              placeholder="0.0"
              placeholderTextColor={C.border}
              underlineColorAndroid="transparent"
              autoFocus
              maxLength={6}
            />
            <Text style={ml.unitSuffix}>{unit}</Text>
          </View>

          <TouchableOpacity
            style={[ml.saveBtn, !canSave && ml.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!canSave}
            activeOpacity={0.8}
          >
            <Text style={ml.saveBtnText}>Save Entry</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const ml = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: {
    backgroundColor: C.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingBottom: 36,
    paddingTop: 12,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: C.border,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 20,
  },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 4, gap: 10 },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: C.primary + "18",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { flex: 1, fontSize: 18, fontFamily: F.extrabold, color: C.text },
  closeBtn: { padding: 4 },
  dateLabel: { fontSize: 13, fontFamily: F.semibold, color: C.muted, marginBottom: 20 },
  unitRow: { flexDirection: "row", gap: 8, marginBottom: 20 },
  unitBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: C.fill,
    borderWidth: 1.5,
    borderColor: C.border,
  },
  unitBtnActive: { backgroundColor: C.primary + "18", borderColor: C.primary },
  unitText: { fontSize: 14, fontFamily: F.bold, color: C.muted },
  unitTextActive: { color: C.primary },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.fill,
    borderRadius: 16,
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  input: {
    flex: 1,
    fontSize: 42,
    fontFamily: F.extrabold,
    color: C.text,
    paddingVertical: 12,
  },
  unitSuffix: { fontSize: 18, fontFamily: F.bold, color: C.muted },
  saveBtn: {
    backgroundColor: C.primary,
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: "center",
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  saveBtnDisabled: { opacity: 0.4, shadowOpacity: 0 },
  saveBtnText: { fontSize: 16, fontFamily: F.extrabold, color: "#fff" },
});
