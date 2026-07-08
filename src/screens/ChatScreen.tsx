import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { C, F } from "../theme";
import { chat, Message } from "../services/claude";
import { COACH_SYSTEM_PROMPT } from "../services/coachPrompt";

const WELCOME: Message = {
  role: "assistant",
  content:
    "Hey! I'm your Nutrition Coach 👋 Ask me anything about food, macros, meal planning, or building healthy habits. I give you real, evidence-based answers, not industry talking points.",
};

export default function ChatScreen() {
  const [displayMessages, setDisplayMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const apiHistory = useRef<Message[]>([]);
  const scrollRef = useRef<ScrollView>(null);

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { role: "user", content: text };
    apiHistory.current = [...apiHistory.current, userMsg];
    setDisplayMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const reply = await chat(apiHistory.current, COACH_SYSTEM_PROMPT);
      const assistantMsg: Message = { role: "assistant", content: reply };
      apiHistory.current = [...apiHistory.current, assistantMsg];
      setDisplayMessages((prev) => [...prev, assistantMsg]);
    } catch (e) {
      const errorMsg: Message = {
        role: "assistant",
        content: e instanceof Error ? e.message : "Sorry, something went wrong. Please try again.",
      };
      setDisplayMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  }

  const canSend = input.trim().length > 0 && !loading;

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 24}
      >
        <View style={s.header}>
          <View style={s.headerIcon}>
            <Ionicons name="sparkles" size={16} color={C.primary} />
          </View>
          <View>
            <Text style={s.headerTitle}>Nutrition Coach</Text>
            <Text style={s.headerSub}>Evidence-based · No industry bias</Text>
          </View>
        </View>

        <ScrollView
          ref={scrollRef}
          style={s.flex}
          contentContainerStyle={s.messagesContent}
          onContentSizeChange={() =>
            scrollRef.current?.scrollToEnd({ animated: true })
          }
          keyboardShouldPersistTaps="handled"
        >
          {displayMessages.map((msg, i) => {
            const isUser = msg.role === "user";
            return (
              <View
                key={i}
                style={[s.messageRow, isUser && s.messageRowUser]}
              >
                {!isUser && (
                  <View style={s.avatar}>
                    <Ionicons name="sparkles" size={14} color={C.primary} />
                  </View>
                )}
                <View
                  style={[
                    s.bubble,
                    isUser ? s.bubbleUser : s.bubbleBot,
                  ]}
                >
                  <Text style={[s.bubbleText, isUser && s.bubbleTextUser]}>
                    {msg.content}
                  </Text>
                </View>
              </View>
            );
          })}

          {loading && (
            <View style={s.messageRow}>
              <View style={s.avatar}>
                <Ionicons name="sparkles" size={14} color={C.primary} />
              </View>
              <View style={[s.bubble, s.bubbleBot, s.typingBubble]}>
                <ActivityIndicator size="small" color={C.primary} />
              </View>
            </View>
          )}
        </ScrollView>

        <View style={s.inputArea}>
          <TextInput
            style={s.input}
            value={input}
            onChangeText={setInput}
            placeholder="Ask about nutrition, macros, meals…"
            placeholderTextColor={C.muted}
            multiline
            returnKeyType="default"
          />
          <TouchableOpacity
            style={[s.sendBtn, canSend ? s.sendBtnActive : s.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!canSend}
            activeOpacity={0.75}
          >
            <Ionicons
              name="send"
              size={18}
              color={canSend ? C.card : C.muted}
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "transparent",
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: C.card,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  headerIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: C.fill,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontFamily: F.extrabold,
    fontSize: 17,
    color: C.text,
  },
  headerSub: {
    fontFamily: F.semibold,
    fontSize: 11,
    color: C.muted,
  },
  messagesContent: {
    padding: 16,
    gap: 12,
  },
  messageRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  messageRowUser: {
    flexDirection: "row-reverse",
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: C.fill,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  bubble: {
    maxWidth: "80%",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
  },
  bubbleBot: {
    backgroundColor: C.card,
    borderColor: C.border,
    borderBottomLeftRadius: 4,
  },
  bubbleUser: {
    backgroundColor: C.primary,
    borderColor: C.primary,
    borderBottomRightRadius: 4,
  },
  bubbleText: {
    fontFamily: F.regular,
    fontSize: 15,
    color: C.text,
    lineHeight: 22,
  },
  bubbleTextUser: {
    color: C.card,
  },
  typingBubble: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  inputArea: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: C.card,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  input: {
    flex: 1,
    backgroundColor: C.fill,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    fontFamily: F.regular,
    fontSize: 15,
    color: C.text,
    maxHeight: 100,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnActive: {
    backgroundColor: C.primary,
  },
  sendBtnDisabled: {
    backgroundColor: C.fill,
  },
});
