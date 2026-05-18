import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { FoodEntry } from "../types";
import { updateEntry, deleteEntry } from "../services/storage";
import { C, F } from "../theme";

const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;

function Stepper({
  label, value, onChange, unit = "g",
}: {
  label: string; value: number; onChange: (v: number) => void; unit?: string;
}) {
  return (
    <View style={s.stepRow}>
      <Text style={s.stepLabel}>{label}</Text>
      <View style={s.stepControls}>
        <TouchableOpacity style={s.stepBtn} onPress={() => onChange(Math.max(0, value - 1))}>
          <Text style={s.stepBtnText}>−</Text>
        </TouchableOpacity>
        <TextInput
          style={s.stepField}
          value={String(value)}
          onChangeText={(t) => { const n = parseInt(t, 10); if (!isNaN(n) && n >= 0) onChange(n); }}
          keyboardType="numeric"
          selectTextOnFocus
        />
        <TouchableOpacity style={s.stepBtn} onPress={() => onChange(value + 1)}>
          <Text style={s.stepBtnText}>+</Text>
        </TouchableOpacity>
        <Text style={s.stepUnit}>{unit}</Text>
      </View>
    </View>
  );
}

interface Props {
  entry: FoodEntry | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function EditEntryModal({ entry, onClose, onSaved }: Props) {
  const [name, setName] = useState("");
  const [calories, setCalories] = useState(0);
  const [protein, setProtein] = useState(0);
  const [carbs, setCarbs] = useState(0);
  const [fat, setFat] = useState(0);
  const [mealType, setMealType] = useState<FoodEntry["mealType"]>("lunch");
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    if (entry) {
      setName(entry.name);
      setCalories(entry.calories);
      setProtein(entry.protein);
      setCarbs(entry.carbs);
      setFat(entry.fat);
      setMealType(entry.mealType);
      setConfirmingDelete(false);
    }
  }, [entry]);

  async function handleSave() {
    if (!entry) return;
    setSaving(true);
    try {
      await updateEntry(entry.id, { name, calories, protein, carbs, fat, mealType });
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!entry) return;
    if (!confirmingDelete) { setConfirmingDelete(true); return; }
    await deleteEntry(entry.id);
    onSaved();
    onClose();
  }

  return (
    <Modal visible={!!entry} animationType="slide" transparent presentationStyle="overFullScreen">
      <View style={s.overlay}>
        <View style={s.sheet}>
          <View style={s.handle} />
          <View style={s.header}>
            <TouchableOpacity onPress={() => { setConfirmingDelete(false); onClose(); }}>
              <Text style={s.cancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={s.title}>Edit Entry</Text>
            <TouchableOpacity onPress={handleSave} disabled={saving}>
              <Text style={[s.saveBtn, saving && { opacity: 0.5 }]}>Save</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.body}>
            <Text style={s.label}>Food Name</Text>
            <TextInput
              style={s.nameInput}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Grilled chicken breast"
              placeholderTextColor={C.muted}
            />

            <Text style={s.label}>Nutrition</Text>
            <View style={s.card}>
              <Stepper label="Calories" value={calories} onChange={setCalories} unit="kcal" />
              <Stepper label="Protein" value={protein} onChange={setProtein} />
              <Stepper label="Carbs" value={carbs} onChange={setCarbs} />
              <Stepper label="Fat" value={fat} onChange={setFat} />
            </View>

            <Text style={s.label}>Meal Type</Text>
            <View style={s.mealRow}>
              {MEAL_TYPES.map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[s.mealChip, mealType === t && s.mealChipActive]}
                  onPress={() => setMealType(t)}
                >
                  <Text style={[s.mealChipText, mealType === t && s.mealChipTextActive]}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[s.deleteBtn, confirmingDelete && s.deleteBtnArmed]}
              onPress={handleDelete}
            >
              <Text style={s.deleteBtnText}>
                {confirmingDelete ? "⚠  Tap again to permanently delete" : "Delete Entry"}
              </Text>
            </TouchableOpacity>

            {confirmingDelete && (
              <TouchableOpacity style={s.cancelDeleteBtn} onPress={() => setConfirmingDelete(false)}>
                <Text style={s.cancelDeleteText}>Cancel</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(45,27,53,0.4)" },
  sheet: { backgroundColor: C.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: 40, maxHeight: "90%" },
  handle: { width: 40, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: "center", marginTop: 10, marginBottom: 4 },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  cancel: { fontFamily: F.semibold, color: C.muted, fontSize: 15 },
  title: { fontSize: 16, fontFamily: F.bold, color: C.text },
  saveBtn: { fontFamily: F.bold, color: C.primary, fontSize: 15 },
  body: { padding: 20, gap: 8 },
  label: { fontSize: 12, fontFamily: F.bold, color: C.muted, textTransform: "uppercase", letterSpacing: 0.8, marginTop: 8 },
  nameInput: {
    backgroundColor: C.fill, borderRadius: 12, padding: 14,
    color: C.text, fontSize: 15, fontFamily: F.regular,
    borderWidth: 1, borderColor: C.border, marginTop: 6,
  },
  card: { backgroundColor: C.fill, borderRadius: 14, padding: 14, marginTop: 6, borderWidth: 1, borderColor: C.border },
  stepRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  stepLabel: { fontSize: 14, fontFamily: F.semibold, color: C.text, flex: 1 },
  stepControls: { flexDirection: "row", alignItems: "center", gap: 8 },
  stepBtn: {
    width: 32, height: 32, backgroundColor: C.card, borderRadius: 8,
    borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center",
  },
  stepBtnText: { fontFamily: F.regular, color: C.text, fontSize: 18, lineHeight: 22 },
  stepField: {
    width: 58, height: 32, backgroundColor: C.card, borderRadius: 8,
    borderWidth: 1, borderColor: C.border, color: C.text,
    textAlign: "center", fontSize: 14, fontFamily: F.semibold,
  },
  stepUnit: { fontSize: 12, fontFamily: F.semibold, color: C.muted, width: 30 },
  mealRow: { flexDirection: "row", gap: 8, flexWrap: "wrap", marginTop: 6 },
  mealChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: C.fill, borderWidth: 1, borderColor: C.border,
  },
  mealChipActive: { backgroundColor: C.primary + "18", borderColor: C.primary },
  mealChipText: { fontSize: 13, fontFamily: F.semibold, color: C.muted },
  mealChipTextActive: { color: C.primary, fontFamily: F.bold },
  deleteBtn: {
    marginTop: 24, paddingVertical: 16, borderRadius: 14,
    backgroundColor: C.error + "12", borderWidth: 1, borderColor: C.error + "30", alignItems: "center",
  },
  deleteBtnArmed: { backgroundColor: C.error + "25", borderColor: C.error },
  deleteBtnText: { fontFamily: F.bold, color: C.error, fontSize: 15 },
  cancelDeleteBtn: { paddingVertical: 10, alignItems: "center" },
  cancelDeleteText: { fontFamily: F.semibold, color: C.muted, fontSize: 14 },
});
