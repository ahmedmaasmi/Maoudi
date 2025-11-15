import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
} from "react-native";
import { voiceService } from "./services/voice";
import { apiClient } from "./services/api";
import * as Location from "expo-location";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [textInput, setTextInput] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasPermissions, setHasPermissions] = useState(false);

  useEffect(() => {
    requestPermissions();
  }, []);

  const requestPermissions = async () => {
    try {
      const voicePermission = await voiceService.requestPermissions();
      const { status } = await Location.requestForegroundPermissionsAsync();
      setHasPermissions(voicePermission && status === "granted");
    } catch (error) {
      console.error("Permission request failed:", error);
    }
  };

  const handleUserMessage = async (message: string) => {
    if (!message.trim()) return;

    const userMessage: Message = {
      role: "user",
      content: message,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsProcessing(true);

    try {
      const nluResult = await apiClient.parseMessage(message);

      let response = "";

      if (nluResult.intent === "search_doctors") {
        let lat = 40.7128;
        let lng = -74.0060;

        if (nluResult.entities.location) {
          try {
            const geocode = await apiClient.geocode(nluResult.entities.location);
            lat = geocode.lat;
            lng = geocode.lng;
          } catch (error) {
            response = "I couldn't find that location. ";
          }
        } else {
          try {
            const location = await Location.getCurrentPositionAsync();
            lat = location.coords.latitude;
            lng = location.coords.longitude;
          } catch (error) {
            response = "I'll search using a default location. ";
          }
        }

        if (nluResult.entities.specialty) {
          const doctors = await apiClient.searchDoctors(nluResult.entities.specialty, lat, lng, 10);

          if (doctors.length > 0) {
            response += `I found ${doctors.length} doctor(s) near you:\n\n`;
            doctors.slice(0, 5).forEach((doctor, index) => {
              response += `${index + 1}. ${doctor.name} - ${doctor.specialty}\n`;
              response += `   ${doctor.address}${doctor.distance ? ` (${doctor.distance.toFixed(1)} km away)` : ""}\n\n`;
            });
          } else {
            response += "I couldn't find any doctors matching your criteria.";
          }
        } else {
          response = "What specialty are you looking for?";
        }
      } else if (nluResult.intent === "book_appointment") {
        response = "To book an appointment, please use the form interface or provide more details.";
      } else {
        response = "I can help you find and book appointments with doctors. Try saying something like 'I need a cardiologist near downtown tomorrow'.";
      }

      const assistantMessage: Message = {
        role: "assistant",
        content: response,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      voiceService.speak(response);
    } catch (error) {
      console.error("Error processing message:", error);
      const errorMessage: Message = {
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      voiceService.speak("Sorry, I encountered an error. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const startListening = async () => {
    if (!hasPermissions) {
      Alert.alert("Permissions Required", "Please grant microphone and location permissions.");
      await requestPermissions();
      return;
    }

    try {
      await voiceService.startListening(
        (text) => {
          setTextInput(text);
          handleUserMessage(text);
          setIsListening(false);
        },
        (error) => {
          Alert.alert("Voice Error", error.message);
          setIsListening(false);
        }
      );
      setIsListening(true);
    } catch (error) {
      Alert.alert("Error", "Failed to start voice recognition");
      setIsListening(false);
    }
  };

  const stopListening = async () => {
    await voiceService.stopListening();
    setIsListening(false);
  };

  const handleSubmit = () => {
    if (!textInput.trim() || isProcessing) return;
    handleUserMessage(textInput);
    setTextInput("");
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Voice Appointment Booking</Text>
        {!hasPermissions && (
          <Text style={styles.warning}>Permissions needed for voice and location</Text>
        )}
      </View>

      <ScrollView style={styles.messagesContainer}>
        {messages.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Welcome! Use voice or text to book appointments.</Text>
            <Text style={styles.emptySubtext}>
              Try: "I need a cardiologist near downtown tomorrow"
            </Text>
          </View>
        )}
        {messages.map((message, index) => (
          <View
            key={index}
            style={[
              styles.message,
              message.role === "user" ? styles.userMessage : styles.assistantMessage,
            ]}
          >
            <Text
              style={[
                styles.messageText,
                message.role === "user" ? styles.userMessageText : styles.assistantMessageText,
              ]}
            >
              {message.content}
            </Text>
          </View>
        ))}
        {isProcessing && (
          <View style={[styles.message, styles.assistantMessage]}>
            <Text style={[styles.messageText, styles.assistantMessageText]}>Processing...</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          value={textInput}
          onChangeText={setTextInput}
          placeholder="Type your message or use voice..."
          multiline
          editable={!isProcessing}
        />
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.button, isListening ? styles.buttonStop : styles.buttonVoice]}
            onPress={isListening ? stopListening : startListening}
            disabled={isProcessing}
          >
            <Text style={styles.buttonText}>{isListening ? "🛑 Stop" : "🎤 Voice"}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.buttonSend]}
            onPress={handleSubmit}
            disabled={!textInput.trim() || isProcessing}
          >
            <Text style={styles.buttonText}>Send</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    backgroundColor: "#fff",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 4,
  },
  warning: {
    fontSize: 12,
    color: "#ff6b6b",
  },
  messagesContainer: {
    flex: 1,
    padding: 16,
  },
  emptyState: {
    marginTop: 32,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
  },
  message: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    maxWidth: "80%",
  },
  userMessage: {
    backgroundColor: "#007AFF",
    alignSelf: "flex-end",
  },
  assistantMessage: {
    backgroundColor: "#E5E5EA",
    alignSelf: "flex-start",
  },
  messageText: {
    fontSize: 16,
  },
  userMessageText: {
    color: "#fff",
  },
  assistantMessageText: {
    color: "#000",
  },
  inputContainer: {
    backgroundColor: "#fff",
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  textInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    minHeight: 50,
    maxHeight: 100,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 8,
  },
  button: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  buttonVoice: {
    backgroundColor: "#007AFF",
  },
  buttonStop: {
    backgroundColor: "#ff3b30",
  },
  buttonSend: {
    backgroundColor: "#34C759",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
  },
});

