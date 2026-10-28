import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';

import HomeScreen from '../screens/HomeScreen';
import FootballScreen from '../screens/FootballScreen';
import NplScreen from '../screens/NplScreen';
import CricketScreen from '../screens/CricketScreen';
import WatchlistScreen from '../screens/WatchlistScreen';
import MatchPlayerScreen from '../screens/MatchPlayerScreen';
import NotificationSettingsScreen from '../screens/NotificationSettingsScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator<RootStackParamList>();

function BottomTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#090f0e',
          borderTopColor: 'rgba(255,255,255,0.08)',
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarActiveTintColor: '#c9f36b',
        tabBarInactiveTintColor: '#64748b',
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '800',
        },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{
          tabBarLabel: 'Desk',
          tabBarIcon: ({ color, focused }) => (
            <Text style={{ fontSize: 18, color: focused ? '#c9f36b' : '#64748b' }}>🏠</Text>
          ),
        }}
      />

      <Tab.Screen
        name="FootballTab"
        component={FootballScreen}
        options={{
          tabBarLabel: 'Football',
          tabBarIcon: () => <Text style={{ fontSize: 18 }}>⚽</Text>,
        }}
      />

      <Tab.Screen
        name="NplTab"
        component={NplScreen}
        options={{
          tabBarLabel: 'NPL 2026',
          tabBarActiveTintColor: '#ef4444',
          tabBarIcon: () => (
            <View style={{ position: 'relative' }}>
              <Text style={{ fontSize: 18 }}>🇳🇵</Text>
              <View style={styles.pulseDot} />
            </View>
          ),
        }}
      />

      <Tab.Screen
        name="CricketTab"
        component={CricketScreen}
        options={{
          tabBarLabel: 'Cricket',
          tabBarIcon: () => <Text style={{ fontSize: 18 }}>🏏</Text>,
        }}
      />

      <Tab.Screen
        name="WatchlistTab"
        component={WatchlistScreen}
        options={{
          tabBarLabel: 'Watchlist',
          tabBarActiveTintColor: '#fbbf24',
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: 18, color: focused ? '#fbbf24' : '#64748b' }}>★</Text>
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: '#0c1211',
        },
        headerTintColor: '#ffffff',
        headerTitleStyle: {
          fontWeight: '900',
          fontSize: 16,
        },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen
        name="MainTabs"
        component={BottomTabs}
        options={{ headerShown: false }}
      />

      <Stack.Screen
        name="MatchPlayer"
        component={MatchPlayerScreen}
        options={({ route }) => ({
          title: route.params.match.title || 'Live Broadcast',
          headerBackTitle: 'Back',
        })}
      />

      <Stack.Screen
        name="NotificationSettings"
        component={NotificationSettingsScreen}
        options={{
          title: 'Alert Settings',
          headerBackTitle: 'Back',
        }}
      />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  pulseDot: {
    position: 'absolute',
    top: -2,
    right: -3,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ef4444',
  },
});
