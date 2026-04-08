import { Tabs } from "expo-router";
import { BlurView } from "expo-blur";
import { SymbolView } from "expo-symbols";
import { Platform, StyleSheet, useColorScheme, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { useColors } from "@/constants/colors";

function TrainTabIcon({ focused }: { focused: boolean }) {
  const C = useColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const btnColor = isDark ? '#3d8a5c' : C.primary;
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
      <Ionicons name="barbell" size={22} color="#fff" />
    </View>
  );
}

export default function TabLayout() {
  const C = useColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const isWeb = Platform.OS === "web";
  const isIOS = Platform.OS === "ios";

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: isDark ? '#5da87a' : C.primary,
        tabBarInactiveTintColor: isDark ? '#607068' : '#9ca5a0',
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : isDark ? "#000" : "#fff",
          borderTopWidth: isWeb ? 1 : 0,
          borderTopColor: isDark ? "#333" : C.border,
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
            <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? "#000" : "#fff" }]} />
          ) : null,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            Platform.OS === "ios" ? (
              <SymbolView name="house" tintColor={color} size={size || 24} />
            ) : (
              <Ionicons name="home-outline" size={size || 24} color={color} />
            )
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            Platform.OS === "ios" ? (
              <SymbolView name="person" tintColor={color} size={size || 24} />
            ) : (
              <Ionicons name="person-outline" size={size || 24} color={color} />
            )
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
            Platform.OS === "ios" ? (
              <SymbolView name="leaf" tintColor={color} size={size || 24} />
            ) : (
              <Ionicons name="leaf-outline" size={size || 24} color={color} />
            )
          ),
        }}
      />
      <Tabs.Screen
        name="workouts"
        options={{
          title: "Stats",
          tabBarIcon: ({ color, size }) => (
            Platform.OS === "ios" ? (
              <SymbolView name="chart.bar" tintColor={color} size={size || 24} />
            ) : (
              <Ionicons name="bar-chart-outline" size={size || 24} color={color} />
            )
          ),
        }}
      />
    </Tabs>
  );
}
