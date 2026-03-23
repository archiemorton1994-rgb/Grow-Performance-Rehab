import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Tabs } from "expo-router";
import { NativeTabs, Icon, Label } from "expo-router/unstable-native-tabs";
import { BlurView } from "expo-blur";
import { SymbolView } from "expo-symbols";
import { Platform, StyleSheet, useColorScheme, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { useColors } from "@/constants/colors";

const TRAIN_ICON_ACTIVE = require("@/assets/train-tab-active.png");
const TRAIN_ICON_INACTIVE = require("@/assets/train-tab-inactive.png");

function TrainTabIcon({ focused }: { focused: boolean }) {
  const C = useColors();
  return (
    <View
      style={[
        {
          width: 44, height: 44, borderRadius: 22,
          alignItems: "center", justifyContent: "center",
          transform: [{ translateY: -4 }],
          backgroundColor: C.primary,
          opacity: focused ? 1 : 0.55,
          ...(focused ? {
            shadowColor: C.primary,
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: 0.4,
            shadowRadius: 6,
            elevation: 6,
          } : {}),
        },
      ]}
    >
      <Ionicons name="barbell" size={21} color="#fff" />
    </View>
  );
}

function NativeTabLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <Icon sf={{ default: "house", selected: "house.fill" }} />
        <Label>Home</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <Icon sf={{ default: "person", selected: "person.fill" }} />
        <Label>Profile</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="train">
        <Icon src={{ default: TRAIN_ICON_INACTIVE, selected: TRAIN_ICON_ACTIVE }} />
        <Label>Train</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="flex">
        <Icon sf={{ default: "leaf", selected: "leaf.fill" }} />
        <Label>Flex</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="workouts">
        <Icon sf={{ default: "chart.bar", selected: "chart.bar.fill" }} />
        <Label>Stats</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

function ClassicTabLayout() {
  const C = useColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const isWeb = Platform.OS === "web";
  const isIOS = Platform.OS === "ios";

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: C.light.tint,
        tabBarInactiveTintColor: C.light.tabIconDefault,
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

export default function TabLayout() {
  if (isLiquidGlassAvailable()) {
    return <NativeTabLayout />;
  }
  return <ClassicTabLayout />;
}
