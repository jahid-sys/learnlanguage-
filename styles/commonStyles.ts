
import { StyleSheet, ViewStyle, TextStyle } from 'react-native';

// Purple Gradient Language Learning Theme - Latvian Language App
export const colors = {
  // Primary purple gradient colors
  primary: '#8B5CF6', // Vibrant purple
  primaryLight: '#A78BFA', // Light purple
  primaryDark: '#7C3AED', // Deep purple
  
  // Gradient colors for backgrounds
  gradientStart: '#C4B5FD', // Light lavender
  gradientMiddle: '#A78BFA', // Medium purple
  gradientEnd: '#8B5CF6', // Vibrant purple
  
  // Background colors
  background: '#F5F3FF', // Very light purple tint
  backgroundAlt: '#EDE9FE', // Light purple background
  card: '#FFFFFF',
  
  // Text colors
  text: '#1F2937', // Dark gray for readability
  textSecondary: '#6B7280',
  textLight: '#9CA3AF',
  
  // Accent colors
  accent: '#EC4899', // Pink accent
  accentLight: '#F9A8D4',
  success: '#10B981',
  error: '#EF4444',
  warning: '#F59E0B',
  info: '#3B82F6',
  
  // UI elements
  border: '#E5E7EB',
  borderLight: '#F3F4F6',
  grey: '#9CA3AF',
  
  // Latvian language color
  latvian: '#8B5CF6', // Purple for Latvian
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
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginVertical: 8,
    width: '100%',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  icon: {
    width: 60,
    height: 60,
    tintColor: "white",
  },
});
