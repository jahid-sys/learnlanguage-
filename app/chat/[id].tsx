
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
import { authenticatedGet, authenticatedPost, authenticatedPostFormData } from '@/utils/api';
import { 
  useAudioPlayer, 
  useAudioRecorder, 
  AudioModule,
  RecordingOptions,
  RecordingPresets
} from 'expo-audio';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  audioUrl?: string;
}

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const scrollViewRef = useRef<ScrollView>(null);
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const [alertModal, setAlertModal] = useState<{ visible: boolean; title: string; message: string }>({
    visible: false, title: '', message: '',
  });

  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const audioPlayer = useAudioPlayer('');

  useEffect(() => {
    console.log('ChatScreen mounted, conversationId:', id);
    if (user && id) {
      loadMessages();
      setupAudio();
    }
    
    return () => {
      console.log('Cleaning up audio on unmount');
      if (audioRecorder.isRecording) {
        audioRecorder.stop();
      }
      audioPlayer.remove();
    };
  }, [id, user]);

  useEffect(() => {
    const subscription = audioPlayer.addListener('playbackStatusUpdate', (status) => {
      if (status.isLoaded && status.didJustFinish) {
        console.log('Audio playback finished');
        setPlayingAudio(null);
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const setupAudio = async () => {
    try {
      console.log('Setting up audio mode');
      await AudioModule.setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
    } catch (error) {
      console.error('Error setting up audio:', error);
    }
  };

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
          content: 'Sveiki! Es esmu jūsu AI valodas skolotājs. Sāksim mācīties kopā! Nospiediet mikrofonu, lai runātu, vai ierakstiet savu ziņu.',
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
        content: 'Sveiki! Es esmu jūsu AI valodas skolotājs. Sāksim mācīties kopā! Nospiediet mikrofonu, lai runātu, vai ierakstiet savu ziņu.',
        createdAt: new Date().toISOString(),
      };
      setMessages([welcomeMessage]);
    } finally {
      setLoading(false);
    }
  };

  const startRecording = async () => {
    try {
      console.log('Requesting microphone permissions');
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      
      if (!permission.granted) {
        setAlertModal({ 
          visible: true, 
          title: 'Nepieciešama atļauja', 
          message: 'Lūdzu, atļaujiet piekļuvi mikrofonam, lai izmantotu balss tērzēšanu.' 
        });
        return;
      }

      await AudioModule.setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      console.log('Starting recording');
      await audioRecorder.record();
      setIsRecording(true);
      console.log('Recording started');
    } catch (error) {
      console.error('Failed to start recording:', error);
      setAlertModal({ 
        visible: true, 
        title: 'Ierakstīšanas kļūda', 
        message: 'Neizdevās sākt ierakstīšanu. Lūdzu, mēģiniet vēlreiz.' 
      });
    }
  };

  const stopRecording = async () => {
    if (!audioRecorder.isRecording) {
      return;
    }

    console.log('Stopping recording');
    setIsRecording(false);
    
    try {
      const uri = await audioRecorder.stop();
      console.log('Recording stopped, URI:', uri);
      
      if (uri) {
        await sendVoiceMessage(uri);
      }
    } catch (error) {
      console.error('Error stopping recording:', error);
      setAlertModal({ 
        visible: true, 
        title: 'Kļūda', 
        message: 'Neizdevās apstrādāt balss ierakstu.' 
      });
    }
  };

  const sendVoiceMessage = async (audioUri: string) => {
    console.log('[API] Sending voice message from URI:', audioUri);
    setSending(true);

    const tempId = `temp-${Date.now()}`;
    const tempUserMessage: Message = {
      id: tempId,
      role: 'user',
      content: '🎤 Transkribē...',
      createdAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempUserMessage]);

    try {
      console.log('[API] Requesting /api/conversations/' + id + '/speech-to-text...');

      let transcribedText = '';

      if (Platform.OS === 'web') {
        const audioResponse = await fetch(audioUri);
        const audioBlob = await audioResponse.blob();
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');

        const sttResult = await authenticatedPostFormData<{ text: string; language: string }>(
          `/api/conversations/${id}/speech-to-text`,
          formData
        );
        console.log('[API] Speech-to-text result:', sttResult);
        transcribedText = sttResult.text;
      } else {
        const formData = new FormData();
        formData.append('audio', {
          uri: audioUri,
          type: 'audio/m4a',
          name: 'recording.m4a',
        } as any);

        const sttResult = await authenticatedPostFormData<{ text: string; language: string }>(
          `/api/conversations/${id}/speech-to-text`,
          formData
        );
        console.log('[API] Speech-to-text result:', sttResult);
        transcribedText = sttResult.text;
      }

      if (!transcribedText || transcribedText.trim() === '') {
        setMessages(prev => prev.filter(m => m.id !== tempId));
        setAlertModal({
          visible: true,
          title: 'Runa nav noteikta',
          message: 'Neizdevās noteikt runu ierakstā. Lūdzu, mēģiniet vēlreiz.',
        });
        return;
      }

      setMessages(prev =>
        prev.map(m =>
          m.id === tempId ? { ...m, content: transcribedText } : m
        )
      );

      console.log('[API] Requesting /api/conversations/' + id + '/messages with transcribed text...');
      const response = await authenticatedPost<{ response: string; messageId: string; audioUrl?: string }>(
        `/api/conversations/${id}/messages`,
        { message: transcribedText }
      );
      console.log('[API] Received AI response:', response);

      const aiResponse: Message = {
        id: response.messageId,
        role: 'assistant',
        content: response.response,
        createdAt: new Date().toISOString(),
        audioUrl: response.audioUrl ?? undefined,
      };

      setMessages(prev => [...prev, aiResponse]);

      if (response.audioUrl) {
        await playAudio(response.audioUrl, response.messageId);
      }

      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error('[API] Error sending voice message:', error);
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setAlertModal({
        visible: true,
        title: 'Kļūda',
        message: 'Neizdevās apstrādāt balss ziņu. Lūdzu, mēģiniet vēlreiz vai izmantojiet teksta ievadi.',
      });
    } finally {
      setSending(false);
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
      const response = await authenticatedPost<{ response: string; messageId: string; audioUrl?: string }>(
        `/api/conversations/${id}/messages`,
        { message: userMessage }
      );
      console.log('[API] Received AI response:', response);
      
      const aiResponse: Message = {
        id: response.messageId,
        role: 'assistant',
        content: response.response,
        createdAt: new Date().toISOString(),
        audioUrl: response.audioUrl ?? undefined,
      };
      
      setMessages(prev => [...prev, aiResponse]);
      
      if (response.audioUrl) {
        await playAudio(response.audioUrl, response.messageId);
      }
      
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

  const playAudio = async (audioUrl: string, messageId: string) => {
    try {
      console.log('Playing audio for message:', messageId);
      
      audioPlayer.replace(audioUrl);
      audioPlayer.play();
      setPlayingAudio(messageId);
    } catch (error) {
      console.error('Error playing audio:', error);
      setAlertModal({ 
        visible: true, 
        title: 'Atskaņošanas kļūda', 
        message: 'Neizdevās atskaņot audio atbildi.' 
      });
    }
  };

  const stopAudio = async () => {
    try {
      console.log('Stopping audio playback');
      audioPlayer.pause();
      setPlayingAudio(null);
    } catch (error) {
      console.error('Error stopping audio:', error);
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

  if (loading) {
    return (
      <>
        <Stack.Screen
          options={{
            title: 'Prakse',
            headerBackTitle: 'Atpakaļ',
          }}
        />
        <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </>
    );
  }

  const hasText = inputText.trim().length > 0;

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Prakse',
          headerBackTitle: 'Atpakaļ',
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
              const isPlaying = playingAudio === message.id;
              
              return (
                <View
                  key={message.id}
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
                        {message.audioUrl && (
                          <TouchableOpacity
                            style={styles.audioButton}
                            onPress={() => isPlaying ? stopAudio() : playAudio(message.audioUrl!, message.id)}
                          >
                            <IconSymbol
                              ios_icon_name={isPlaying ? 'stop.fill' : 'speaker.wave.2.fill'}
                              android_material_icon_name={isPlaying ? 'stop' : 'volume-up'}
                              size={16}
                              color={colors.primary}
                            />
                          </TouchableOpacity>
                        )}
                      </View>
                    </>
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
            {!isRecording && (
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="Rakstiet vai turiet mikrofonu, lai runātu..."
                placeholderTextColor={colors.textSecondary}
                value={inputText}
                onChangeText={setInputText}
                multiline
                maxLength={500}
                editable={!sending && !isRecording}
              />
            )}
            {isRecording && (
              <View style={styles.recordingIndicator}>
                <View style={styles.recordingDot} />
                <Text style={[styles.recordingText, { color: colors.text }]}>
                  Ieraksta...
                </Text>
              </View>
            )}
            
            {hasText ? (
              <TouchableOpacity
                style={[
                  styles.sendButton,
                  {
                    backgroundColor: !sending ? colors.primary : colors.border,
                  },
                ]}
                onPress={sendMessage}
                disabled={sending}
              >
                <IconSymbol
                  ios_icon_name="arrow.up"
                  android_material_icon_name="send"
                  size={20}
                  color="#FFFFFF"
                />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[
                  styles.micButton,
                  {
                    backgroundColor: isRecording ? '#EF4444' : colors.primary,
                  },
                ]}
                onPressIn={startRecording}
                onPressOut={stopRecording}
                disabled={sending}
              >
                <IconSymbol
                  ios_icon_name={isRecording ? 'stop.fill' : 'mic.fill'}
                  android_material_icon_name={isRecording ? 'stop' : 'mic'}
                  size={20}
                  color="#FFFFFF"
                />
              </TouchableOpacity>
            )}
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
  audioButton: {
    marginLeft: 8,
    padding: 4,
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
  recordingIndicator: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#EF4444',
    marginRight: 8,
  },
  recordingText: {
    fontSize: 16,
    fontWeight: '500',
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  micButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
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
