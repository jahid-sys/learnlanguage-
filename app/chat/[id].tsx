
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
  Pressable,
} from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { useAuth } from '@/contexts/AuthContext';
import { authenticatedGet, authenticatedPost } from '@/utils/api';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

interface VocabularyItem {
  id: string;
  latvianWord: string;
  englishTranslation: string;
  context?: string;
  createdAt: string;
}

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const scrollViewRef = useRef<ScrollView>(null);
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [vocabulary, setVocabulary] = useState<VocabularyItem[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showVocabulary, setShowVocabulary] = useState(false);
  const [alertModal, setAlertModal] = useState<{ visible: boolean; title: string; message: string }>({
    visible: false, title: '', message: '',
  });

  useEffect(() => {
    console.log('ChatScreen mounted, conversationId:', id);
    if (user && id) {
      loadMessages();
      loadVocabulary();
    }
  }, [id, user]);

  const loadMessages = async () => {
    console.log('[API] Loading messages for conversation:', id);
    setLoading(true);
    try {
      const data = await authenticatedGet<Message[]>(`/api/conversations/${id}/messages`);
      console.log('[API] Loaded messages:', data);
      
      if (data.length === 0) {
        const welcomeMessage: Message = {
          id: 'welcome',
          role: 'assistant',
          content: 'Sveiki! Es esmu jūsu AI valodas skolotājs. Sāksim mācīties kopā! Ierakstiet savu ziņu.',
          createdAt: new Date().toISOString(),
        };
        setMessages([welcomeMessage]);
      } else {
        setMessages(data);
      }
    } catch (error) {
      console.error('[API] Error loading messages:', error);
      setAlertModal({ visible: true, title: 'Kļūda', message: 'Neizdevās ielādēt ziņas. Lūdzu, atgriezieties un mēģiniet vēlreiz.' });
      const welcomeMessage: Message = {
        id: 'welcome',
        role: 'assistant',
        content: 'Sveiki! Es esmu jūsu AI valodas skolotājs. Sāksim mācīties kopā! Ierakstiet savu ziņu.',
        createdAt: new Date().toISOString(),
      };
      setMessages([welcomeMessage]);
    } finally {
      setLoading(false);
    }
  };

  const loadVocabulary = async () => {
    console.log('[API] Loading vocabulary for conversation:', id);
    try {
      console.log('[API] Requesting /api/conversations/' + id + '/vocabulary...');
      const data = await authenticatedGet<VocabularyItem[]>(`/api/conversations/${id}/vocabulary`);
      console.log('[API] Loaded vocabulary:', data.length, 'items');
      setVocabulary(data);
    } catch (error) {
      console.error('[API] Error loading vocabulary:', error);
    }
  };

  const sendMessage = async () => {
    if (!inputText.trim() || sending) {
      return;
    }

    const userMessage = inputText.trim();
    console.log('Sending message:', userMessage);
    
    const tempUserMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: userMessage,
      createdAt: new Date().toISOString(),
    };

    setMessages(prev => [...prev, tempUserMessage]);
    setInputText('');
    setSending(true);

    try {
      console.log('[API] Requesting /api/conversations/' + id + '/messages...');
      const response = await authenticatedPost<{ response: string; messageId: string }>(
        `/api/conversations/${id}/messages`,
        { message: userMessage }
      );
      console.log('[API] Received AI response:', response);
      
      const aiResponse: Message = {
        id: response.messageId,
        role: 'assistant',
        content: response.response,
        createdAt: new Date().toISOString(),
      };
      
      setMessages(prev => [...prev, aiResponse]);
      
      // Reload vocabulary after AI response (it may have extracted new words)
      loadVocabulary();
      
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error('[API] Error sending message:', error);
      setMessages(prev => prev.filter(m => m.id !== tempUserMessage.id));
      setInputText(userMessage);
      setAlertModal({ visible: true, title: 'Kļūda', message: 'Neizdevās nosūtīt ziņu. Lūdzu, mēģiniet vēlreiz.' });
    } finally {
      setSending(false);
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const displayHours = hours < 10 ? `0${hours}` : hours;
    const displayMinutes = minutes < 10 ? `0${minutes}` : minutes;
    const timeString = `${displayHours}:${displayMinutes}`;
    return timeString;
  };

  const extractVocabularyFromMessage = (content: string): Array<{ latvian: string; english: string }> => {
    const vocabList: Array<{ latvian: string; english: string }> = [];
    
    // Pattern 1: "word (translation)"
    const pattern1 = /(\w+)\s*\(([^)]+)\)/g;
    let match1;
    while ((match1 = pattern1.exec(content)) !== null) {
      vocabList.push({ latvian: match1[1], english: match1[2] });
    }
    
    // Pattern 2: "latvian - english" or "latvian → english"
    const pattern2 = /(\w+)\s*[-→]\s*(\w+)/g;
    let match2;
    while ((match2 = pattern2.exec(content)) !== null) {
      vocabList.push({ latvian: match2[1], english: match2[2] });
    }
    
    return vocabList;
  };

  if (loading) {
    return (
      <>
        <Stack.Screen
          options={{
            title: 'Prakse',
            headerBackTitle: 'Atpakaļ',
            headerRight: () => null,
          }}
        />
        <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </>
    );
  }

  const hasText = inputText.trim().length > 0;
  const vocabularyCount = vocabulary.length;
  const vocabularyCountText = vocabularyCount.toString();

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Prakse',
          headerBackTitle: 'Atpakaļ',
          headerRight: () =>
            vocabularyCount > 0 ? (
              <TouchableOpacity
                onPress={() => setShowVocabulary(true)}
                style={styles.vocabularyButton}
              >
                <IconSymbol
                  ios_icon_name="book.fill"
                  android_material_icon_name="menu-book"
                  size={20}
                  color={colors.primary}
                />
                <Text style={[styles.vocabularyButtonText, { color: colors.primary }]}>
                  {vocabularyCountText}
                </Text>
              </TouchableOpacity>
            ) : null,
        }}
      />
      <Modal
        visible={alertModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setAlertModal(prev => ({ ...prev, visible: false }))}
      >
        <Pressable
          style={chatStyles.alertOverlay}
          onPress={() => setAlertModal(prev => ({ ...prev, visible: false }))}
        >
          <Pressable style={chatStyles.alertContainer} onPress={() => {}}>
            <Text style={chatStyles.alertTitle}>{alertModal.title}</Text>
            {alertModal.message ? <Text style={chatStyles.alertMessage}>{alertModal.message}</Text> : null}
            <TouchableOpacity
              style={chatStyles.alertButton}
              onPress={() => setAlertModal(prev => ({ ...prev, visible: false }))}
            >
              <Text style={chatStyles.alertButtonText}>Labi</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={showVocabulary}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowVocabulary(false)}
      >
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]} edges={['top']}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Vārdnīca šai sarunai</Text>
            <TouchableOpacity onPress={() => setShowVocabulary(false)} style={styles.closeModalButton}>
              <IconSymbol ios_icon_name="xmark" android_material_icon_name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.vocabularyList} contentContainerStyle={styles.vocabularyListContent}>
            {vocabulary.map((item) => (
              <View key={item.id} style={[styles.vocabularyItem, { backgroundColor: colors.card }]}>
                <View style={styles.vocabularyItemHeader}>
                  <Text style={[styles.vocabularyLatvian, { color: colors.text }]}>{item.latvianWord}</Text>
                  <IconSymbol
                    ios_icon_name="arrow.right"
                    android_material_icon_name="arrow-forward"
                    size={16}
                    color={colors.textSecondary}
                  />
                  <Text style={[styles.vocabularyEnglish, { color: colors.textSecondary }]}>{item.englishTranslation}</Text>
                </View>
                {item.context && (
                  <Text style={[styles.vocabularyContext, { color: colors.textSecondary }]}>{item.context}</Text>
                )}
              </View>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <ScrollView
            ref={scrollViewRef}
            style={styles.messagesContainer}
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
          >
            {messages.map((message) => {
              const isUser = message.role === 'user';
              const timeDisplay = formatTime(message.createdAt);
              const messageVocab = !isUser ? extractVocabularyFromMessage(message.content) : [];
              
              return (
                <View key={message.id}>
                  <View
                    style={[
                      styles.messageBubble,
                      isUser ? styles.userBubble : styles.assistantBubble,
                    ]}
                  >
                    {isUser ? (
                      <LinearGradient
                        colors={[colors.primary, colors.primaryDark]}
                        style={styles.userBubbleGradient}
                      >
                        <Text style={styles.messageText}>
                          {message.content}
                        </Text>
                        <View style={styles.messageFooter}>
                          <Text style={styles.userMessageTime}>
                            {timeDisplay}
                          </Text>
                        </View>
                      </LinearGradient>
                    ) : (
                      <>
                        <Text style={[styles.messageText, { color: colors.text }]}>
                          {message.content}
                        </Text>
                        <View style={styles.messageFooter}>
                          <Text style={[styles.messageTime, { color: colors.textSecondary }]}>
                            {timeDisplay}
                          </Text>
                        </View>
                      </>
                    )}
                  </View>
                  {messageVocab.length > 0 && (
                    <View style={[styles.inlineVocabulary, { backgroundColor: colors.card }]}>
                      <View style={styles.inlineVocabularyHeader}>
                        <IconSymbol
                          ios_icon_name="book.fill"
                          android_material_icon_name="menu-book"
                          size={14}
                          color={colors.primary}
                        />
                        <Text style={[styles.inlineVocabularyTitle, { color: colors.primary }]}>Vārdnīca:</Text>
                      </View>
                      {messageVocab.map((vocab, idx) => {
                        const latvianWord = vocab.latvian;
                        const englishWord = vocab.english;
                        return (
                          <View key={idx} style={styles.inlineVocabularyItem}>
                            <Text style={[styles.inlineVocabularyText, { color: colors.text }]}>
                              {latvianWord}
                            </Text>
                            <Text style={[styles.inlineVocabularyText, { color: colors.textSecondary }]}>
                              {' → '}
                            </Text>
                            <Text style={[styles.inlineVocabularyText, { color: colors.textSecondary }]}>
                              {englishWord}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })}
            {sending && (
              <View style={[styles.messageBubble, styles.assistantBubble]}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            )}
          </ScrollView>

          <View style={[styles.inputContainer, { backgroundColor: colors.card }]}>
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder="Ierakstiet ziņu..."
              placeholderTextColor={colors.textSecondary}
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={500}
              editable={!sending}
            />
            
            <TouchableOpacity
              style={[
                styles.sendButton,
                {
                  backgroundColor: hasText && !sending ? colors.primary : colors.border,
                },
              ]}
              onPress={sendMessage}
              disabled={!hasText || sending}
            >
              <IconSymbol
                ios_icon_name="arrow.up"
                android_material_icon_name="send"
                size={20}
                color="#FFFFFF"
              />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
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
  keyboardView: {
    flex: 1,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 8,
  },
  messageBubble: {
    maxWidth: '80%',
    marginBottom: 12,
  },
  userBubble: {
    alignSelf: 'flex-end',
  },
  userBubbleGradient: {
    padding: 12,
    borderRadius: 20,
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: colors.card,
    padding: 12,
    borderRadius: 20,
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 4,
    color: '#FFFFFF',
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  messageTime: {
    fontSize: 11,
  },
  userMessageTime: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  inlineVocabulary: {
    maxWidth: '80%',
    alignSelf: 'flex-start',
    padding: 10,
    borderRadius: 12,
    marginBottom: 12,
    marginLeft: 8,
  },
  inlineVocabularyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  inlineVocabularyTitle: {
    fontSize: 12,
    fontWeight: '600',
  },
  inlineVocabularyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  inlineVocabularyText: {
    fontSize: 14,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    paddingBottom: Platform.OS === 'android' ? 16 : 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    fontSize: 16,
    maxHeight: 100,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: 8,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  vocabularyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
  },
  vocabularyButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  closeModalButton: {
    padding: 4,
  },
  vocabularyList: {
    flex: 1,
  },
  vocabularyListContent: {
    padding: 20,
  },
  vocabularyItem: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  vocabularyItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  vocabularyLatvian: {
    fontSize: 17,
    fontWeight: '600',
  },
  vocabularyEnglish: {
    fontSize: 15,
  },
  vocabularyContext: {
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 18,
  },
});

const chatStyles = StyleSheet.create({
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
  alertButton: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: colors.primary,
  },
  alertButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
