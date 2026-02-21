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
  { code: 'es', name: 'Spanish', flag: '🇪🇸', color: colors.spanish },
  { code: 'fr', name: 'French', flag: '🇫🇷', color: colors.french },
  { code: 'de', name: 'German', flag: '🇩🇪', color: colors.german },
  { code: 'it', name: 'Italian', flag: '🇮🇹', color: colors.italian },
  { code: 'ja', name: 'Japanese', flag: '🇯🇵', color: colors.japanese },
  { code: 'zh', name: 'Chinese', flag: '🇨🇳', color: colors.chinese },
];

const LEVELS = ['Beginner', 'Intermediate', 'Advanced'];

export default function HomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('');
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
    if (!selectedLanguage || !selectedLevel) {
      setAlertModal({ visible: true, title: 'Missing Information', message: 'Please select a language and level.' });
      return;
    }

    console.log('[API] Creating conversation:', selectedLanguage, selectedLevel);
    setCreating(true);
    try {
      const response = await authenticatedPost<{ conversationId: string }>('/api/conversations', {
        language: selectedLanguage,
        level: selectedLevel,
      });
      console.log('[API] Created conversation:', response);
      
      setShowNewConversation(false);
      setSelectedLanguage('');
      setSelectedLevel('');
      router.push(`/chat/${response.conversationId}`);
    } catch (error) {
      console.error('[API] Error creating conversation:', error);
      setAlertModal({ visible: true, title: 'Error', message: 'Failed to create conversation. Please try again.' });
    } finally {
      setCreating(false);
    }
  };

  const confirmDeleteConversation = (conversationId: string) => {
    setAlertModal({
      visible: true,
      title: 'Delete Conversation',
      message: 'Are you sure you want to delete this conversation? This action cannot be undone.',
      onConfirm: () => deleteConversation(conversationId),
      confirmText: 'Delete',
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
      setAlertModal({ visible: true, title: 'Error', message: 'Failed to delete conversation. Please try again.' });
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
            headerShown: true,
            title: "LinguaLearn",
            headerLargeTitle: true,
            headerTransparent: false,
            headerBlurEffect: "systemChromeMaterial",
          }}
        />
        <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </>
    );
  }

  if (!user) {
    return (
      <>
        <Stack.Screen
          options={{
            headerShown: true,
            title: "LinguaLearn",
            headerLargeTitle: true,
            headerTransparent: false,
            headerBlurEffect: "systemChromeMaterial",
          }}
        />
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          <View style={styles.authPrompt}>
            <Text style={styles.authIcon}>🌍</Text>
            <Text style={styles.authTitle}>Welcome to LinguaLearn</Text>
            <Text style={styles.authSubtitle}>
              Practice languages with AI-powered conversations
            </Text>
            <TouchableOpacity 
              style={[styles.authButton, { backgroundColor: colors.primary }]}
              onPress={() => router.push('/auth')}
            >
              <Text style={styles.authButtonText}>Get Started</Text>
            </TouchableOpacity>
          </View>
        </View>
      </>
    );
  }

  const userName = user.name || user.email?.split('@')[0] || 'there';

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "LinguaLearn",
          headerLargeTitle: true,
          headerTransparent: false,
          headerBlurEffect: "systemChromeMaterial",
        }}
      />
      <ScrollView 
        style={[styles.container, { backgroundColor: colors.background }]} 
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hello</Text>
            <Text style={styles.userName}>{userName}</Text>
          </View>
          <View style={[styles.avatarCircle, { backgroundColor: colors.primary }]}>
            <Text style={styles.avatarText}>
              {userName.charAt(0).toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Quick Start Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Start Learning</Text>
          <TouchableOpacity 
            style={[styles.newConversationCard, { backgroundColor: colors.card }]}
            onPress={() => setShowNewConversation(true)}
          >
            <View style={[styles.iconCircle, { backgroundColor: colors.primary + '20' }]}>
              <IconSymbol 
                ios_icon_name="plus" 
                android_material_icon_name="add" 
                size={28} 
                color={colors.primary} 
              />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>New Conversation</Text>
              <Text style={styles.cardSubtitle}>Practice with AI tutor</Text>
            </View>
            <IconSymbol 
              ios_icon_name="chevron.right" 
              android_material_icon_name="chevron-right" 
              size={24} 
              color={colors.textSecondary} 
              />
          </TouchableOpacity>
        </View>

        {/* Recent Conversations */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : conversations.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Conversations</Text>
            {conversations.map((conv, index) => {
              const language = LANGUAGES.find(l => l.code === conv.language);
              const languageFlag = language?.flag || '🌍';
              const languageName = language?.name || conv.language;
              
              return (
                <TouchableOpacity 
                  key={conv.conversationId || index}
                  style={[styles.conversationCard, { backgroundColor: colors.card }]}
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
            <Text style={styles.emptyTitle}>No conversations yet</Text>
            <Text style={styles.emptySubtitle}>
              Start your first conversation to begin learning
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Alert/Confirm Modal */}
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
          <Pressable style={[styles.alertContainer, { backgroundColor: colors.card }]} onPress={() => {}}>
            <Text style={styles.alertTitle}>{alertModal.title}</Text>
            {alertModal.message ? <Text style={styles.alertMessage}>{alertModal.message}</Text> : null}
            <View style={styles.alertButtonRow}>
              {alertModal.onConfirm && (
                <TouchableOpacity
                  style={[styles.alertButton, styles.alertCancelButton]}
                  onPress={() => setAlertModal(prev => ({ ...prev, visible: false }))}
                >
                  <Text style={[styles.alertButtonText, { color: colors.text }]}>Cancel</Text>
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
                <Text style={styles.alertButtonText}>{alertModal.confirmText || 'OK'}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* New Conversation Modal */}
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
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Conversation</Text>
              <TouchableOpacity onPress={() => setShowNewConversation(false)}>
                <IconSymbol 
                  ios_icon_name="xmark" 
                  android_material_icon_name="close" 
                  size={24} 
                  color={colors.text} 
                />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>Select Language</Text>
            <View style={styles.languageGrid}>
              {LANGUAGES.map((lang) => {
                const isSelected = selectedLanguage === lang.code;
                return (
                  <TouchableOpacity
                    key={lang.code}
                    style={[
                      styles.languageOption,
                      { 
                        backgroundColor: isSelected ? lang.color + '20' : colors.background,
                        borderColor: isSelected ? lang.color : colors.border,
                        borderWidth: 2
                      }
                    ]}
                    onPress={() => setSelectedLanguage(lang.code)}
                  >
                    <Text style={styles.languageFlag}>{lang.flag}</Text>
                    <Text style={styles.languageName}>{lang.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.modalLabel}>Select Level</Text>
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
                  backgroundColor: selectedLanguage && selectedLevel ? colors.primary : colors.border,
                }
              ]}
              onPress={createConversation}
              disabled={!selectedLanguage || !selectedLevel || creating}
            >
              {creating ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.createButtonText}>Start Learning</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
  },
  greeting: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  userName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
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
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
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
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
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
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  authSubtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
  },
  authButton: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
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
  languageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
    marginBottom: 16,
  },
  languageOption: {
    width: '31%',
    margin: '1%',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  languageFlag: {
    fontSize: 32,
    marginBottom: 8,
  },
  languageName: {
    fontSize: 14,
    fontWeight: '500',
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
    borderRadius: 12,
    alignItems: 'center',
  },
  levelText: {
    fontSize: 14,
    fontWeight: '600',
  },
  createButton: {
    paddingVertical: 16,
    borderRadius: 12,
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
