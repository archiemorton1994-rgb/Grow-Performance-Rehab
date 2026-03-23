import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Tabs } from "expo-router";
import { NativeTabs, Icon, Label } from "expo-router/unstable-native-tabs";
import { BlurView } from "expo-blur";
import { SymbolView } from "expo-symbols";
import { Platform, StyleSheet, useColorScheme, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import Colors from "@/constants/colors";

function TrainTabIcon({ focused }: { focused: boolean }) {
  return (
    <View
      style={[
        trainIconStyles.circle,
        { backgroundColor: focused ? Colors.primary : Colors.primaryLight },
        focused && trainIconStyles.circleFocused,
      ]}
    >
      <Ionicons name="barbell" size={21} color="#fff" />
    </View>
  );
}

const trainIconStyles = StyleSheet.create({
  circle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  circleFocused: {
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
  },
});

function NativeTabLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <Icon sf={{ default: "house", selected: "house.fill" }} />
        <Label>Home</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="train">
        <Icon sf={{ default: "dumbbell.fill", selected: "dumbbell.fill" }} />
        <Label>Train</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="workouts">
        <Icon sf={{ default: "chart.bar", selected: "chart.bar.fill" }} />
        <Label>Stats</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <Icon sf={{ default: "person", selected: "person.fill" }} />
        <Label>Profile</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

function ClassicTabLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const isWeb = Platform.OS === "web";
  const isIOS = Platform.OS === "ios";

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.light.tint,
        tabBarInactiveTintColor: Colors.light.tabIconDefault,
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : isDark ? "#000" : "#fff",
          borderTopWidth: isWeb ? 1 : 0,
          borderTopColor: isDark ? "#333" : Colors.border,
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
        name="train"
        options={{
          title: "Train",
          tabBarItemStyle: { paddingTop: 2 },
          tabBarIcon: ({ focused }) => <TrainTabIcon focused={focused} />,
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
    </Tabs>
  );
}

export default function TabLayout() {
  // ClassicTabLayout is used on all platforms to ensure the branded emerald
  // green circle Train tab icon renders correctly everywhere.
  // On iOS it still uses BlurView for a native translucent appearance.
  // NativeTabLayout is kept for reference but not active — NativeTabs filters
  // out custom View children so a branded circle icon cannot be injected there.
  void isLiquidGlassAvailable; // keep import alive for future use
  return <ClassicTabLayout />;
}
