
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Pressable,
  TextInput,
} from 'react-native';
import { Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import { useAuth } from '@/contexts/AuthContext';
import { authenticatedGet, authenticatedDelete } from '@/utils/api';

interface VocabularyItem {
  id: string;
  latvianWord: string;
  englishTranslation: string;
  context?: string;
  createdAt: string;
  conversationId: string;
}

export default function VocabularyScreen() {
  const { user } = useAuth();
  const [vocabulary, setVocabulary] = useState<VocabularyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [practiceMode, setPracticeMode] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showTranslation, setShowTranslation] = useState(false);
  const [alertModal, setAlertModal] = useState<{
    visible: boolean;
    title: string;
    message: string;
    onConfirm?: () => void;
  }>({
    visible: false,
    title: '',
    message: '',
  });

  useEffect(() => {
    console.log('VocabularyScreen mounted (iOS)');
    if (user) {
      loadVocabulary();
    }
  }, [user]);

  const loadVocabulary = async () => {
    console.log('[API] Loading vocabulary');
    setLoading(true);
    try {
      console.log('[API] Requesting /api/vocabulary...');
      const data = await authenticatedGet<VocabularyItem[]>('/api/vocabulary');
      console.log('[API] Loaded vocabulary:', data.length, 'items');
      setVocabulary(data);
    } catch (error) {
      console.error('[API] Error loading vocabulary:', error);
      setAlertModal({
        visible: true,
        title: 'Kļūda',
        message: 'Neizdevās ielādēt vārdnīcu. Lūdzu, mēģiniet vēlreiz.',
      });
    } finally {
      setLoading(false);
    }
  };

  const confirmDeleteVocabulary = (id: string, word: string) => {
    const latvianWord = word;
    setAlertModal({
      visible: true,
      title: 'Dzēst vārdu?',
      message: `Vai tiešām vēlaties dzēst "${latvianWord}"?`,
      onConfirm: () => deleteVocabulary(id),
    });
  };

  const deleteVocabulary = async (id: string) => {
    console.log('[API] Deleting vocabulary:', id);
    try {
      console.log('[API] Requesting DELETE /api/vocabulary/' + id + '...');
      await authenticatedDelete(`/api/vocabulary/${id}`);
      console.log('[API] Vocabulary deleted successfully');
      setVocabulary((prev) => prev.filter((item) => item.id !== id));
    } catch (error) {
      console.error('[API] Error deleting vocabulary:', error);
      setAlertModal({
        visible: true,
        title: 'Kļūda',
        message: 'Neizdevās dzēst vārdu. Lūdzu, mēģiniet vēlreiz.',
      });
    }
  };

  const startPractice = () => {
    if (filteredVocabulary.length === 0) {
      setAlertModal({
        visible: true,
        title: 'Nav vārdu',
        message: 'Pievienojiet vārdus, lai sāktu praktizēt!',
      });
      return;
    }
    console.log('Starting practice mode with', filteredVocabulary.length, 'words');
    setPracticeMode(true);
    setCurrentIndex(0);
    setShowTranslation(false);
  };

  const nextWord = () => {
    const nextIdx = currentIndex + 1;
    if (nextIdx >= filteredVocabulary.length) {
      console.log('Practice completed');
      setPracticeMode(false);
      setAlertModal({
        visible: true,
        title: 'Apsveicu!',
        message: 'Jūs esat pabeidzis visus vārdus!',
      });
    } else {
      setCurrentIndex(nextIdx);
      setShowTranslation(false);
    }
  };

  const previousWord = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setShowTranslation(false);
    }
  };

  const filteredVocabulary = vocabulary.filter(
    (item) =>
      item.latvianWord.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.englishTranslation.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <>
        <Stack.Screen
          options={{
            title: 'Vārdnīca',
          }}
        />
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        </View>
      </>
    );
  }

  if (practiceMode) {
    const currentWord = filteredVocabulary[currentIndex];
    const progressText = `${currentIndex + 1} / ${filteredVocabulary.length}`;

    return (
      <>
        <Stack.Screen
          options={{
            title: 'Praktizēt',
            headerLeft: () => (
              <TouchableOpacity onPress={() => setPracticeMode(false)}>
                <Text style={{ color: colors.primary, fontSize: 17 }}>Aizvērt</Text>
              </TouchableOpacity>
            ),
          }}
        />
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          <View style={styles.practiceProgressContainer}>
            <Text style={[styles.progressText, { color: colors.text }]}>{progressText}</Text>
          </View>

          <View style={styles.practiceContainer}>
            <TouchableOpacity
              style={styles.flashcard}
              onPress={() => setShowTranslation(!showTranslation)}
              activeOpacity={0.9}
            >
              <LinearGradient colors={[colors.primary, colors.primaryDark]} style={styles.flashcardGradient}>
                <Text style={styles.flashcardWord}>
                  {showTranslation ? currentWord.englishTranslation : currentWord.latvianWord}
                </Text>
                <Text style={styles.flashcardHint}>
                  {showTranslation ? '(English)' : '(Latviešu)'}
                </Text>
                {currentWord.context && (
                  <Text style={styles.flashcardContext}>
                    {currentWord.context}
                  </Text>
                )}
                <Text style={styles.tapHint}>Pieskarieties, lai redzētu tulkojumu</Text>
              </LinearGradient>
            </TouchableOpacity>

            <View style={styles.practiceControls}>
              <TouchableOpacity
                style={[styles.practiceButton, currentIndex === 0 && styles.practiceButtonDisabled]}
                onPress={previousWord}
                disabled={currentIndex === 0}
              >
                <IconSymbol
                  ios_icon_name="chevron.left"
                  android_material_icon_name="arrow-back"
                  size={24}
                  color={currentIndex === 0 ? colors.textSecondary : colors.text}
                />
                <Text style={[styles.practiceButtonText, { color: currentIndex === 0 ? colors.textSecondary : colors.text }]}>
                  Iepriekšējais
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.practiceButton} onPress={nextWord}>
                <Text style={[styles.practiceButtonText, { color: colors.text }]}>
                  {currentIndex === filteredVocabulary.length - 1 ? 'Pabeigt' : 'Nākamais'}
                </Text>
                <IconSymbol
                  ios_icon_name="chevron.right"
                  android_material_icon_name="arrow-forward"
                  size={24}
                  color={colors.text}
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </>
    );
  }

  const emptyStateText = 'Vēl nav saglabātu vārdu';
  const emptyStateSubtext = 'Vārdi tiks automātiski saglabāti no jūsu sarunām';

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Vārdnīca',
          headerRight: () =>
            vocabulary.length > 0 ? (
              <TouchableOpacity onPress={startPractice}>
                <Text style={{ color: colors.primary, fontSize: 17, fontWeight: '600' }}>Praktizēt</Text>
              </TouchableOpacity>
            ) : null,
        }}
      />
      <Modal
        visible={alertModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setAlertModal((prev) => ({ ...prev, visible: false }))}
      >
        <Pressable
          style={vocabStyles.alertOverlay}
          onPress={() => setAlertModal((prev) => ({ ...prev, visible: false }))}
        >
          <Pressable style={vocabStyles.alertContainer} onPress={() => {}}>
            <Text style={vocabStyles.alertTitle}>{alertModal.title}</Text>
            {alertModal.message ? <Text style={vocabStyles.alertMessage}>{alertModal.message}</Text> : null}
            <View style={vocabStyles.alertButtons}>
              {alertModal.onConfirm && (
                <TouchableOpacity
                  style={[vocabStyles.alertButton, vocabStyles.alertButtonCancel]}
                  onPress={() => setAlertModal((prev) => ({ ...prev, visible: false }))}
                >
                  <Text style={vocabStyles.alertButtonTextCancel}>Atcelt</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[vocabStyles.alertButton, vocabStyles.alertButtonConfirm]}
                onPress={() => {
                  if (alertModal.onConfirm) {
                    alertModal.onConfirm();
                  }
                  setAlertModal((prev) => ({ ...prev, visible: false }));
                }}
              >
                <Text style={vocabStyles.alertButtonText}>
                  {alertModal.onConfirm ? 'Dzēst' : 'Labi'}
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {vocabulary.length > 0 && (
          <View style={[styles.searchContainer, { backgroundColor: colors.card }]}>
            <IconSymbol ios_icon_name="magnifyingglass" android_material_icon_name="search" size={20} color={colors.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Meklēt vārdus..."
              placeholderTextColor={colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <IconSymbol ios_icon_name="xmark.circle.fill" android_material_icon_name="cancel" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        )}

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {filteredVocabulary.length === 0 ? (
            <View style={styles.emptyState}>
              <IconSymbol ios_icon_name="book.closed" android_material_icon_name="menu-book" size={64} color={colors.textSecondary} />
              <Text style={[styles.emptyStateText, { color: colors.text }]}>{emptyStateText}</Text>
              <Text style={[styles.emptyStateSubtext, { color: colors.textSecondary }]}>{emptyStateSubtext}</Text>
            </View>
          ) : (
            filteredVocabulary.map((item) => {
              const dateDisplay = new Date(item.createdAt).toLocaleDateString('lv-LV', {
                day: 'numeric',
                month: 'short',
              });

              return (
                <View key={item.id} style={[styles.vocabularyCard, { backgroundColor: colors.card }]}>
                  <View style={styles.vocabularyCardHeader}>
                    <View style={styles.vocabularyCardWords}>
                      <Text style={[styles.latvianWord, { color: colors.text }]}>{item.latvianWord}</Text>
                      <IconSymbol ios_icon_name="arrow.right" android_material_icon_name="arrow-forward" size={16} color={colors.textSecondary} />
                      <Text style={[styles.englishWord, { color: colors.textSecondary }]}>{item.englishTranslation}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => confirmDeleteVocabulary(item.id, item.latvianWord)}
                      style={styles.deleteButton}
                    >
                      <IconSymbol ios_icon_name="trash" android_material_icon_name="delete" size={20} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                  {item.context && (
                    <Text style={[styles.contextText, { color: colors.textSecondary }]}>{item.context}</Text>
                  )}
                  <Text style={[styles.dateText, { color: colors.textSecondary }]}>{dateDisplay}</Text>
                </View>
              );
            })
          )}
        </ScrollView>
      </View>
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
    gap: 12,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  vocabularyCard: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  vocabularyCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  vocabularyCardWords: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  latvianWord: {
    fontSize: 18,
    fontWeight: '600',
  },
  englishWord: {
    fontSize: 16,
  },
  deleteButton: {
    padding: 4,
  },
  contextText: {
    fontSize: 14,
    fontStyle: 'italic',
    marginBottom: 8,
    lineHeight: 20,
  },
  dateText: {
    fontSize: 12,
  },
  practiceProgressContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  progressText: {
    fontSize: 16,
    fontWeight: '600',
  },
  practiceContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  flashcard: {
    width: '100%',
    maxWidth: 400,
    aspectRatio: 1.5,
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 40,
  },
  flashcardGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  flashcardWord: {
    fontSize: 36,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  flashcardHint: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 16,
  },
  flashcardContext: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 16,
  },
  tapHint: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 24,
  },
  practiceControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 400,
  },
  practiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 16,
  },
  practiceButtonDisabled: {
    opacity: 0.4,
  },
  practiceButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

const vocabStyles = StyleSheet.create({
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
  alertButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  alertButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  alertButtonConfirm: {
    backgroundColor: colors.primary,
  },
  alertButtonCancel: {
    backgroundColor: colors.border,
  },
  alertButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  alertButtonTextCancel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
});
