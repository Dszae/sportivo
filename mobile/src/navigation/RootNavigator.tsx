import React from 'react';
import { View, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GridIcon, FootballIcon, TrophyIcon, CricketIcon, BookmarkIcon, BasketballIcon } from '../components/Icons';
import { RootStackParamList } from '../types';
import { colors, fonts } from '../theme';

import HomeScreen from '../screens/HomeScreen';
import FootballScreen from '../screens/FootballScreen';
import NplScreen from '../screens/NplScreen';
import CricketScreen from '../screens/CricketScreen';
import BasketballScreen from '../screens/BasketballScreen';
import WatchlistScreen from '../screens/WatchlistScreen';
import MatchPlayerScreen from '../screens/MatchPlayerScreen';
import NotificationSettingsScreen from '../screens/NotificationSettingsScreen';
import AboutScreen from '../screens/AboutScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator<RootStackParamList>();

function BottomTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.ink950,
          borderTopColor: colors.line,
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.fg,
        tabBarInactiveTintColor: colors.fg3,
        tabBarLabelStyle: {
          fontFamily: fonts.sansMedium,
          fontSize: 10,
        },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color }) => <GridIcon size={20} color={color} />,
        }}
      />

      <Tab.Screen
        name="NplTab"
        component={NplScreen}
        options={{
          tabBarLabel: 'NPL',
          tabBarIcon: ({ color }) => (
            <View>
              <TrophyIcon size={20} color={color} />
              <View style={styles.liveMark} />
            </View>
          ),
        }}
      />

      <Tab.Screen
        name="FootballTab"
        component={FootballScreen}
        options={{
          tabBarLabel: 'Football',
          tabBarIcon: ({ color }) => <FootballIcon size={20} color={color} />,
        }}
      />

      <Tab.Screen
        name="CricketTab"
        component={CricketScreen}
        options={{
          tabBarLabel: 'Cricket',
          tabBarIcon: ({ color }) => <CricketIcon size={20} color={color} />,
        }}
      />

      <Tab.Screen
        name="BasketballTab"
        component={BasketballScreen}
        options={{
          tabBarLabel: 'Basketball',
          tabBarIcon: ({ color }) => <BasketballIcon size={20} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.ink950 },
        headerTintColor: colors.fg,
        headerTitleStyle: { fontFamily: fonts.sansMedium, fontSize: 16 },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.ink900 },
      }}
    >
      <Stack.Screen name="MainTabs" component={BottomTabs} options={{ headerShown: false }} />
      <Stack.Screen name="MatchPlayer" component={MatchPlayerScreen} options={{ headerShown: false }} />
      <Stack.Screen
        name="WatchlistTab"
        component={WatchlistScreen}
        options={{ title: 'Watchlist', headerBackTitle: 'Back' }}
      />
      <Stack.Screen
        name="NotificationSettings"
        component={NotificationSettingsScreen}
        options={{ title: 'Alerts', headerBackTitle: 'Back' }}
      />
      <Stack.Screen name="AboutCreator" component={AboutScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  liveMark: {
    position: 'absolute',
    top: -2,
    right: -4,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.live,
  },
});
