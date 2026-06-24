import { Tabs } from "expo-router";
import { BlurView } from "expo-blur";
import { Platform, StyleSheet, useColorScheme, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { useColors } from "@/constants/colors";

function TrainTabIcon({ focused }: { focused: boolean }) {
  const C = useColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const btnColor = isDark ? C.primaryLight : C.primary;
  return (
    <View
      style={{
        width: 48, height: 48, borderRadius: 24,
        alignItems: "center", justifyContent: "center",
        transform: [{ translateY: -6 }],
        backgroundColor: btnColor,
        opacity: focused ? 1 : 0.7,
        ...(focused ? {
          shadowColor: btnColor,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.45,
          shadowRadius: 8,
          elevation: 8,
        } : {}),
      }}
    >
      <Ionicons name="barbell" size={22} color={C.textInverse} />
    </View>
  );
}

function TabIcon({ name, focusedName, color, size }: { name: string; focusedName?: string; color: string; size?: number; focused?: boolean }) {
  return <Ionicons name={name as any} size={size || 24} color={color} />;
}

export default function TabLayout() {
  const C = useColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: C.tabActive,
        tabBarInactiveTintColor: C.tabInactive,
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : C.surface,
          borderTopWidth: isWeb ? 1 : 0,
          borderTopColor: C.border,
          elevation: 0,
          ...(isWeb ? { height: 84 } : {}),
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={100}
              tint={isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
          ) : isWeb ? (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: C.surface }]} />
          ) : null,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size || 24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size || 24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="train"
        options={{
          title: "Train",
          tabBarItemStyle: { overflow: "visible" },
          tabBarIcon: ({ focused }) => <TrainTabIcon focused={focused} />,
          tabBarLabelStyle: { fontSize: 10, fontWeight: '600', marginTop: 2 },
        }}
      />
      <Tabs.Screen
        name="flex"
        options={{
          title: "Flex",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="leaf-outline" size={size || 24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="workouts"
        options={{
          title: "Stats",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="bar-chart-outline" size={size || 24} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
