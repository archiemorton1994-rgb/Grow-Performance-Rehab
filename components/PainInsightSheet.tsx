import React from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/constants/colors';
import { BODY_DIAGRAM_LABELS } from '@/components/BodyDiagram';
import type { PainRegion } from '@/lib/store';

interface PainInsightSheetProps {
  region: PainRegion | null;
  sessionCount: number;
  onStartPrehab: (region: PainRegion) => void;
  onViewHistory: (region: PainRegion) => void;
  onDismiss: () => void;
  insets?: { bottom: number };
}

export function PainInsightSheet({
  region,
  sessionCount,
  onStartPrehab,
  onViewHistory,
  onDismiss,
  insets,
}: PainInsightSheetProps) {
  const C = useColors();

  return (
    <Modal
      visible={region !== null}
      transparent
      animationType="slide"
      onRequestClose={onDismiss}
    >
      <Pressable
        style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' }}
        onPress={onDismiss}
      >
        <Pressable
          testID="pain-insight-sheet"
          style={{
            backgroundColor: C.surface,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingBottom: (insets?.bottom ?? 0) + 24,
            paddingHorizontal: 20,
            paddingTop: 12,
          }}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Handle */}
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: 'center', marginBottom: 20 }} />

          {/* Header row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: C.categoryPrehab, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="locate-outline" size={20} color={C.categoryPrehabText} />
              </View>
              <View>
                <Text testID="pain-insight-region-label" style={{ fontSize: 16, fontFamily: 'Inter_700Bold', color: C.text }}>
                  {region ? BODY_DIAGRAM_LABELS[region] : ''}
                </Text>
                <Text testID="pain-insight-session-count" style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textSecondary }}>
                  {sessionCount > 0
                    ? `Flagged in ${sessionCount} ${sessionCount === 1 ? 'session' : 'sessions'}`
                    : 'Flagged in 1 session'}
                </Text>
              </View>
            </View>
            <Pressable
              testID="pain-insight-close"
              onPress={onDismiss}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: C.surfaceTertiary, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="close" size={16} color={C.textSecondary} />
            </Pressable>
          </View>

          {/* Body copy */}
          <Text style={{ fontSize: 14, fontFamily: 'Inter_400Regular', color: C.textSecondary, marginBottom: 20, lineHeight: 20 }}>
            A targeted prehab circuit strengthens and protects this area, reducing injury risk over time.
          </Text>

          {/* Primary CTA */}
          <Pressable
            testID="pain-insight-start-prehab"
            onPress={() => { if (region) onStartPrehab(region); }}
            style={({ pressed }) => [{
              flexDirection: 'row' as const,
              alignItems: 'center' as const,
              justifyContent: 'center' as const,
              gap: 8,
              backgroundColor: C.primary,
              borderRadius: 14,
              paddingVertical: 15,
              marginBottom: 10,
              shadowColor: C.primary,
              shadowOffset: { width: 0, height: 3 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 4,
            }, pressed && { opacity: 0.88, transform: [{ scale: 0.98 as number }] }]}
          >
            <Ionicons name="play" size={16} color={C.textInverse} />
            <Text style={{ fontSize: 16, fontFamily: 'Inter_700Bold', color: C.textInverse }}>
              Start Targeted Prehab
            </Text>
          </Pressable>

          {/* Secondary action */}
          <Pressable
            testID="pain-insight-view-history"
            onPress={() => { if (region) onViewHistory(region); }}
            style={({ pressed }) => [{
              alignItems: 'center' as const,
              justifyContent: 'center' as const,
              paddingVertical: 12,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: C.borderLight,
            }, pressed && { opacity: 0.7 }]}
          >
            <Text style={{ fontSize: 15, fontFamily: 'Inter_500Medium', color: C.textSecondary }}>
              View in History
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
