import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { IconSymbol } from "@/components/IconSymbol";
import { GlassView } from "expo-glass-effect";
import { useTheme } from "@react-navigation/native";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "expo-router";
import { colors } from "@/styles/commonStyles";

export default function ProfileScreen() {
  const theme = useTheme();
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [alertModal, setAlertModal] = useState<{ visible: boolean; title: string; message: string; onConfirm?: () => void }>({
    visible: false, title: '', message: '',
  });

  const handleSignOut = async () => {
    setAlertModal({
      visible: true,
      title: 'Sign Out',
      message: 'Are you sure you want to sign out?',
      onConfirm: async () => {
        console.log('User confirmed Sign Out');
        try {
          await signOut();
          console.log('Sign out successful');
          router.replace('/');
        } catch (error) {
          console.error('Error signing out:', error);
          setAlertModal({ visible: true, title: 'Error', message: 'Failed to sign out. Please try again.' });
        }
      },
    });
  };

  if (!user) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.centerContainer}>
          <Text style={styles.notSignedInText}>Not signed in</Text>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/auth')}
          >
            <Text style={styles.buttonText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const userName = user.name || 'User';
  const userEmail = user.email || '';
  const userInitial = userName.charAt(0).toUpperCase();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Alert/Confirm Modal */}
      <Modal
        visible={alertModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setAlertModal(prev => ({ ...prev, visible: false }))}
      >
        <Pressable
          style={iosProfileStyles.alertOverlay}
          onPress={() => setAlertModal(prev => ({ ...prev, visible: false }))}
        >
          <Pressable style={[iosProfileStyles.alertContainer, { backgroundColor: colors.card }]} onPress={() => {}}>
            <Text style={iosProfileStyles.alertTitle}>{alertModal.title}</Text>
            {alertModal.message ? <Text style={iosProfileStyles.alertMessage}>{alertModal.message}</Text> : null}
            <View style={iosProfileStyles.alertButtonRow}>
              {alertModal.onConfirm && (
                <TouchableOpacity
                  style={[iosProfileStyles.alertButton, iosProfileStyles.alertCancelButton]}
                  onPress={() => setAlertModal(prev => ({ ...prev, visible: false }))}
                >
                  <Text style={[iosProfileStyles.alertButtonText, { color: colors.text }]}>Cancel</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[iosProfileStyles.alertButton, { backgroundColor: colors.primary }]}
                onPress={() => {
                  setAlertModal(prev => ({ ...prev, visible: false }));
                  alertModal.onConfirm?.();
                }}
              >
                <Text style={iosProfileStyles.alertButtonText}>{alertModal.onConfirm ? 'Confirm' : 'OK'}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
      >
        <GlassView style={styles.profileHeader} glassEffectStyle="regular">
          <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
            <Text style={styles.avatarText}>{userInitial}</Text>
          </View>
          <Text style={[styles.name, { color: theme.colors.text }]}>{userName}</Text>
          <Text style={[styles.email, { color: theme.dark ? '#98989D' : '#666' }]}>{userEmail}</Text>
        </GlassView>

        <GlassView style={styles.section} glassEffectStyle="regular">
          <View style={styles.infoRow}>
            <IconSymbol ios_icon_name="person.fill" android_material_icon_name="person" size={20} color={theme.dark ? '#98989D' : '#666'} />
            <Text style={[styles.infoText, { color: theme.colors.text }]}>Name</Text>
            <Text style={[styles.infoValue, { color: theme.dark ? '#98989D' : '#666' }]}>{userName}</Text>
          </View>
          <View style={styles.infoRow}>
            <IconSymbol ios_icon_name="envelope.fill" android_material_icon_name="email" size={20} color={theme.dark ? '#98989D' : '#666'} />
            <Text style={[styles.infoText, { color: theme.colors.text }]}>Email</Text>
            <Text style={[styles.infoValue, { color: theme.dark ? '#98989D' : '#666' }]}>{userEmail}</Text>
          </View>
        </GlassView>

        <TouchableOpacity
          style={[styles.signOutButton, { backgroundColor: colors.error }]}
          onPress={handleSignOut}
        >
          <IconSymbol
            ios_icon_name="arrow.right.square"
            android_material_icon_name="logout"
            size={20}
            color="#FFFFFF"
          />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  profileHeader: {
    alignItems: 'center',
    borderRadius: 12,
    padding: 32,
    marginBottom: 16,
    gap: 12,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  email: {
    fontSize: 16,
  },
  section: {
    borderRadius: 12,
    padding: 20,
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoText: {
    fontSize: 16,
    flex: 1,
  },
  infoValue: {
    fontSize: 16,
  },
  notSignedInText: {
    fontSize: 18,
    color: colors.textSecondary,
    marginBottom: 24,
  },
  button: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 16,
    gap: 8,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

const iosProfileStyles = StyleSheet.create({
  alertOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  alertContainer: {
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  alertTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  alertMessage: {
    fontSize: 15,
    color: colors.textSecondary,
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 22,
  },
  alertButtonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  alertButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: colors.primary,
  },
  alertCancelButton: {
    backgroundColor: colors.border,
  },
  alertButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
