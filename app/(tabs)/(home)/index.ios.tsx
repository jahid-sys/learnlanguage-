
import React, { useState, useEffect } from "react";
import { Stack, useRouter } from "expo-router";
import { 
  StyleSheet, 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator,
  Modal,
  Pressable
} from "react-native";
import { useTheme } from "@react-navigation/native";
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from "@/styles/commonStyles";
import { IconSymbol } from "@/components/IconSymbol";
import { useAuth } from "@/contexts/AuthContext";
import { authenticatedGet, authenticatedPost, authenticatedDelete } from "@/utils/api";

interface Language {
  code: string;
  name: string;
  flag: string;
  color: string;
}

interface Conversation {
  conversationId: string;
  language: string;
  level: string;
  title: string;
  lastMessageAt: string;
  createdAt: string;
}

const LANGUAGES: Language[] = [
  { code: 'lv', name: 'Latvian', flag: '🇱🇻', color: colors.primary },
];

const LEVELS = ['Beginner', 'Intermediate', 'Advanced'];

export default function HomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState<string>('');
  const [creating, setCreating] = useState(false);
  const [alertModal, setAlertModal] = useState<{ visible: boolean; title: string; message: string; onConfirm?: () => void; confirmText?: string; confirmStyle?: 'default' | 'destructive' }>({
    visible: false, title: '', message: '',
  });

  useEffect(() => {
    console.log('HomeScreen mounted, user:', user);
    if (user) {
      loadConversations();
    } else {
      setLoading(false);
    }
  }, [user]);

  const loadConversations = async () => {
    console.log('[API] Loading conversations for user');
    setLoading(true);
    try {
      const data = await authenticatedGet<Conversation[]>('/api/conversations');
      console.log('[API] Loaded conversations:', data);
      setConversations(data);
    } catch (error) {
      console.error('[API] Error loading conversations:', error);
      setConversations([]);
    } finally {
      setLoading(false);
    }
  };

  const createConversation = async () => {
    if (!selectedLevel) {
      setAlertModal({ visible: true, title: 'Trūkst informācijas', message: 'Lūdzu, izvēlieties līmeni.' });
      return;
    }

    console.log('[API] Creating conversation: Latvian,', selectedLevel);
    setCreating(true);
    try {
      const response = await authenticatedPost<{ conversationId: string }>('/api/conversations', {
        language: 'Latvian',
        level: selectedLevel,
      });
      console.log('[API] Created conversation:', response);
      
      setShowNewConversation(false);
      setSelectedLevel('');
      router.push(`/chat/${response.conversationId}`);
    } catch (error) {
      console.error('[API] Error creating conversation:', error);
      setAlertModal({ visible: true, title: 'Kļūda', message: 'Neizdevās izveidot sarunu. Lūdzu, mēģiniet vēlreiz.' });
    } finally {
      setCreating(false);
    }
  };

  const confirmDeleteConversation = (conversationId: string) => {
    setAlertModal({
      visible: true,
      title: 'Dzēst sarunu',
      message: 'Vai tiešām vēlaties dzēst šo sarunu? Šo darbību nevar atsaukt.',
      onConfirm: () => deleteConversation(conversationId),
      confirmText: 'Dzēst',
      confirmStyle: 'destructive',
    });
  };

  const deleteConversation = async (conversationId: string) => {
    console.log('[API] Deleting conversation:', conversationId);
    try {
      await authenticatedDelete(`/api/conversations/${conversationId}`);
      console.log('[API] Deleted conversation:', conversationId);
      setConversations(prev => prev.filter(c => c.conversationId !== conversationId));
    } catch (error) {
      console.error('[API] Error deleting conversation:', error);
      setAlertModal({ visible: true, title: 'Kļūda', message: 'Neizdevās dzēst sarunu. Lūdzu, mēģiniet vēlreiz.' });
    }
  };

  const openConversation = (conversationId: string) => {
    console.log('Opening conversation:', conversationId);
    router.push(`/chat/${conversationId}`);
  };

  if (authLoading) {
    return (
      <>
        <Stack.Screen
          options={{
            headerShown: false,
          }}
        />
        <LinearGradient
          colors={[colors.gradientStart, colors.gradientMiddle, colors.gradientEnd]}
          style={styles.centerContainer}
        >
          <ActivityIndicator size="large" color="#FFFFFF" />
        </LinearGradient>
      </>
    );
  }

  if (!user) {
    return (
      <>
        <Stack.Screen
          options={{
            headerShown: false,
          }}
        />
        <LinearGradient
          colors={[colors.gradientStart, colors.gradientMiddle, colors.gradientEnd]}
          style={styles.container}
        >
          <View style={styles.authPrompt}>
            <Text style={styles.authIcon}>🇱🇻</Text>
            <Text style={styles.authTitle}>Mācies latviešu valodu!</Text>
            <Text style={styles.authSubtitle}>
              Praktizē latviešu valodu ar AI sarunām
            </Text>
            <TouchableOpacity 
              style={styles.authButton}
              onPress={() => router.push('/auth')}
            >
              <Text style={styles.authButtonText}>Sākt</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </>
    );
  }

  const userName = user.name || user.email?.split('@')[0] || 'there';
  const greetingText = 'Sveiki';
  const userNameDisplay = userName;

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <View style={styles.container}>
        <LinearGradient
          colors={[colors.gradientStart, colors.gradientMiddle, colors.gradientEnd]}
          style={styles.headerGradient}
        >
          <View style={styles.header}>
            <View>
              <Text style={styles.greeting}>{greetingText}</Text>
              <Text style={styles.userName}>{userNameDisplay}</Text>
            </View>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>
                {userName.charAt(0).toUpperCase()}
              </Text>
            </View>
          </View>
        </LinearGradient>

        <ScrollView 
          style={styles.scrollView} 
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Sākt mācīties</Text>
            <TouchableOpacity 
              style={styles.newConversationCard}
              onPress={() => setShowNewConversation(true)}
            >
              <LinearGradient
                colors={[colors.primary, colors.primaryDark]}
                style={styles.iconCircle}
              >
                <IconSymbol 
                  ios_icon_name="plus" 
                  android_material_icon_name="add" 
                  size={28} 
                  color="#FFFFFF" 
                />
              </LinearGradient>
              <View style={styles.cardContent}>
                <Text style={styles.cardTitle}>Jauna saruna</Text>
                <Text style={styles.cardSubtitle}>Praktizē ar AI skolotāju</Text>
              </View>
              <IconSymbol 
                ios_icon_name="chevron.right" 
                android_material_icon_name="chevron-right" 
                size={24} 
                color={colors.textSecondary} 
              />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : conversations.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Nesenas sarunas</Text>
              {conversations.map((conv, index) => {
                const language = LANGUAGES.find(l => l.name === conv.language || l.code === conv.language);
                const languageFlag = language?.flag || '🇱🇻';
                const languageName = language?.name || 'Latvian';
                
                return (
                  <TouchableOpacity 
                    key={conv.conversationId || index}
                    style={styles.conversationCard}
                    onPress={() => openConversation(conv.conversationId)}
                  >
                    <Text style={styles.conversationFlag}>{languageFlag}</Text>
                    <View style={styles.conversationContent}>
                      <Text style={styles.conversationLanguage}>{languageName}</Text>
                      <Text style={styles.conversationLevel}>{conv.level}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={(e) => {
                        e.stopPropagation();
                        confirmDeleteConversation(conv.conversationId);
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <IconSymbol 
                        ios_icon_name="delete" 
                        android_material_icon_name="delete-outline" 
                        size={20} 
                        color={colors.error} 
                      />
                    </TouchableOpacity>
                    <IconSymbol 
                      ios_icon_name="chevron.right" 
                      android_material_icon_name="chevron-right" 
                      size={24} 
                      color={colors.textSecondary} 
                    />
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>💬</Text>
              <Text style={styles.emptyTitle}>Vēl nav sarunu</Text>
              <Text style={styles.emptySubtitle}>
                Sāciet savu pirmo sarunu, lai sāktu mācīties
              </Text>
            </View>
          )}
        </ScrollView>

        <Modal
          visible={alertModal.visible}
          transparent
          animationType="fade"
          onRequestClose={() => setAlertModal(prev => ({ ...prev, visible: false }))}
        >
          <Pressable 
            style={styles.alertOverlay}
            onPress={() => setAlertModal(prev => ({ ...prev, visible: false }))}
          >
            <Pressable style={styles.alertContainer} onPress={() => {}}>
              <Text style={styles.alertTitle}>{alertModal.title}</Text>
              {alertModal.message ? <Text style={styles.alertMessage}>{alertModal.message}</Text> : null}
              <View style={styles.alertButtonRow}>
                {alertModal.onConfirm && (
                  <TouchableOpacity
                    style={[styles.alertButton, styles.alertCancelButton]}
                    onPress={() => setAlertModal(prev => ({ ...prev, visible: false }))}
                  >
                    <Text style={[styles.alertButtonText, { color: colors.text }]}>Atcelt</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[
                    styles.alertButton,
                    alertModal.confirmStyle === 'destructive' ? styles.alertDestructiveButton : styles.alertPrimaryButton,
                  ]}
                  onPress={() => {
                    setAlertModal(prev => ({ ...prev, visible: false }));
                    alertModal.onConfirm?.();
                  }}
                >
                  <Text style={styles.alertButtonText}>{alertModal.confirmText || 'Labi'}</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </Modal>

        <Modal
          visible={showNewConversation}
          transparent
          animationType="slide"
          onRequestClose={() => setShowNewConversation(false)}
        >
          <View style={styles.modalOverlay}>
            <Pressable 
              style={styles.modalBackdrop} 
              onPress={() => setShowNewConversation(false)} 
            />
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Jauna saruna</Text>
                <TouchableOpacity onPress={() => setShowNewConversation(false)}>
                  <IconSymbol 
                    ios_icon_name="xmark" 
                    android_material_icon_name="close" 
                    size={24} 
                    color={colors.text} 
                  />
                </TouchableOpacity>
              </View>

              <View style={styles.languageDisplay}>
                <Text style={styles.languageDisplayFlag}>🇱🇻</Text>
                <Text style={styles.languageDisplayText}>Latviešu</Text>
              </View>

              <Text style={styles.modalLabel}>Izvēlieties līmeni</Text>
              <View style={styles.levelContainer}>
                {LEVELS.map((level) => {
                  const isSelected = selectedLevel === level;
                  return (
                    <TouchableOpacity
                      key={level}
                      style={[
                        styles.levelOption,
                        { 
                          backgroundColor: isSelected ? colors.primary : colors.background,
                        }
                      ]}
                      onPress={() => setSelectedLevel(level)}
                    >
                      <Text style={[
                        styles.levelText,
                        { color: isSelected ? '#FFFFFF' : colors.text }
                      ]}>
                        {level}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                style={[
                  styles.createButton,
                  { 
                    backgroundColor: selectedLevel ? colors.primary : colors.border,
                  }
                ]}
                onPress={createConversation}
                disabled={!selectedLevel || creating}
              >
                {creating ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.createButtonText}>Sākt mācīties</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerGradient: {
    paddingTop: 60,
    paddingBottom: 24,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  greeting: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 4,
  },
  userName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 16,
  },
  newConversationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 20,
    backgroundColor: colors.card,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  conversationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    backgroundColor: colors.card,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  conversationFlag: {
    fontSize: 32,
    marginRight: 16,
  },
  conversationContent: {
    flex: 1,
  },
  conversationLanguage: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  conversationLevel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  authPrompt: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  authIcon: {
    fontSize: 80,
    marginBottom: 24,
  },
  authTitle: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center',
  },
  authSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    marginBottom: 32,
  },
  authButton: {
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  authButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '80%',
    backgroundColor: colors.card,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
  },
  modalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
    marginTop: 8,
  },
  languageDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: colors.background,
    borderRadius: 16,
    marginBottom: 24,
  },
  languageDisplayFlag: {
    fontSize: 48,
    marginRight: 16,
  },
  languageDisplayText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
  },
  levelContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  levelOption: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 16,
    alignItems: 'center',
  },
  levelText: {
    fontSize: 14,
    fontWeight: '600',
  },
  createButton: {
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  deleteButton: {
    padding: 4,
    marginRight: 8,
  },
  alertOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  alertContainer: {
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.card,
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
    borderRadius: 12,
    alignItems: 'center',
  },
  alertPrimaryButton: {
    backgroundColor: colors.primary,
  },
  alertDestructiveButton: {
    backgroundColor: colors.error,
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
