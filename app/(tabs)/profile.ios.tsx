
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/AuthContext";
import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useTheme } from "@react-navigation/native";
import { IconSymbol } from "@/components/IconSymbol";
import { colors } from "@/styles/commonStyles";
import { GlassView } from "expo-glass-effect";

export default function ProfileScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { user, signOut, loading } = useAuth();
  const [showSignOutModal, setShowSignOutModal] = useState(false);

  console.log("[ProfileScreen iOS] Rendering, user:", user, "loading:", loading);

  const handleSignOut = async () => {
    console.log("[ProfileScreen iOS] User confirmed sign out");
    setShowSignOutModal(false);
    try {
      await signOut();
      console.log("[ProfileScreen iOS] Sign out complete, navigating to auth");
      router.replace("/auth");
    } catch (error) {
      console.error("[ProfileScreen iOS] Sign out error:", error);
    }
  };

  const userName = user?.name || "Lietotājs";
  const userEmail = user?.email || "nav pieejams";
  const userId = user?.id || "nav pieejams";

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <IconSymbol
                ios_icon_name="person.fill"
                android_material_icon_name="person"
                size={48}
                color="#fff"
              />
            </View>
          </View>
          <Text style={styles.name}>{userName}</Text>
          <Text style={styles.email}>{userEmail}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Konta informācija</Text>
          
          <GlassView style={styles.infoCard} intensity={10}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>E-pasts</Text>
              <Text style={styles.infoValue}>{userEmail}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Lietotāja ID</Text>
              <Text style={styles.infoValue} numberOfLines={1}>{userId}</Text>
            </View>
          </GlassView>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Iestatījumi</Text>
          
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => setShowSignOutModal(true)}
          >
            <View style={styles.menuItemLeft}>
              <IconSymbol
                ios_icon_name="arrow.right.square"
                android_material_icon_name="logout"
                size={24}
                color={colors.error}
              />
              <Text style={[styles.menuItemText, { color: colors.error }]}>
                Iziet
              </Text>
            </View>
            <IconSymbol
              ios_icon_name="chevron.right"
              android_material_icon_name="arrow-forward"
              size={20}
              color="#666"
            />
          </TouchableOpacity>
        </View>

        <View style={styles.debugSection}>
          <Text style={styles.debugTitle}>Debug Info</Text>
          <Text style={styles.debugText}>Loading: {loading ? "Yes" : "No"}</Text>
          <Text style={styles.debugText}>User: {user ? "Logged in" : "Not logged in"}</Text>
          <Text style={styles.debugText}>Platform: iOS</Text>
        </View>
      </ScrollView>

      <Modal
        visible={showSignOutModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSignOutModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowSignOutModal(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Iziet no konta?</Text>
            <Text style={styles.modalMessage}>
              Vai tiešām vēlaties iziet no sava konta?
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setShowSignOutModal(false)}
              >
                <Text style={styles.modalButtonTextCancel}>Atcelt</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={handleSignOut}
              >
                <Text style={styles.modalButtonText}>Iziet</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    alignItems: "center",
    paddingVertical: 32,
    paddingHorizontal: 20,
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  name: {
    fontSize: 24,
    fontWeight: "bold",
    color: colors.text,
    marginBottom: 4,
  },
  email: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 12,
  },
  infoCard: {
    borderRadius: 16,
    padding: 16,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  infoValue: {
    fontSize: 14,
    color: colors.text,
    fontWeight: "500",
    flex: 1,
    textAlign: "right",
    marginLeft: 16,
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    marginVertical: 8,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 16,
    padding: 16,
    marginBottom: 8,
  },
  menuItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  menuItemText: {
    fontSize: 16,
    color: colors.text,
    fontWeight: "500",
  },
  debugSection: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginTop: 32,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.1)",
  },
  debugTitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 8,
    fontWeight: "600",
  },
  debugText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontFamily: "Courier",
    marginBottom: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#1a1a1a",
    borderRadius: 16,
    padding: 24,
    width: "80%",
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 12,
  },
  modalMessage: {
    fontSize: 16,
    color: "#ccc",
    marginBottom: 24,
    lineHeight: 22,
  },
  modalButtons: {
    flexDirection: "row",
    gap: 12,
  },
  modalButton: {
    flex: 1,
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
  },
  modalButtonCancel: {
    backgroundColor: "#333",
  },
  modalButtonConfirm: {
    backgroundColor: colors.error,
  },
  modalButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  modalButtonTextCancel: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});

const iosProfileStyles = StyleSheet.create({
  // Placeholder for any additional iOS-specific profile styles
});
