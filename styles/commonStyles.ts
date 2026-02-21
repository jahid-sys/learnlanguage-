import { StyleSheet, ViewStyle, TextStyle } from 'react-native';

// Language Learning App Theme - Vibrant and Educational
export const colors = {
  // Light theme
  background: '#F8F9FE',
  card: '#FFFFFF',
  text: '#1A1A2E',
  textSecondary: '#6B7280',
  primary: '#6366F1', // Indigo - main brand color
  secondary: '#EC4899', // Pink - accent
  accent: '#10B981', // Green - success/progress
  highlight: '#F59E0B', // Amber - highlights
  border: '#E5E7EB',
  
  // Language-specific colors
  spanish: '#FF6B6B',
  french: '#4ECDC4',
  german: '#FFD93D',
  italian: '#95E1D3',
  japanese: '#F38181',
  chinese: '#AA96DA',
  
  // UI states
  success: '#10B981',
  error: '#EF4444',
  warning: '#F59E0B',
  info: '#3B82F6',

  // Legacy aliases
  backgroundAlt: '#F0F1FA',
  grey: '#9CA3AF',
};

export const buttonStyles = StyleSheet.create({
  instructionsButton: {
    backgroundColor: colors.primary,
    alignSelf: 'center',
    width: '100%',
  },
  backButton: {
    backgroundColor: colors.backgroundAlt,
    alignSelf: 'center',
    width: '100%',
  },
});

export const commonStyles = StyleSheet.create({
  wrapper: {
    backgroundColor: colors.background,
    width: '100%',
    height: '100%',
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: 800,
    width: '100%',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    color: colors.text,
    marginBottom: 10
  },
  text: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 8,
    lineHeight: 24,
    textAlign: 'center',
  },
  section: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  buttonContainer: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: colors.backgroundAlt,
    borderColor: colors.grey,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginVertical: 8,
    width: '100%',
    boxShadow: '0px 2px 3px rgba(0, 0, 0, 0.1)',
    elevation: 2,
  },
  icon: {
    width: 60,
    height: 60,
    tintColor: "white",
  },
});
