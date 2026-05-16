import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';

// Screens
import LandingScreen from '../screens/LandingScreen';
import BrowseScreen from '../screens/BrowseScreen';
import AnimeDetailScreen from '../screens/AnimeDetailScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ListsScreen from '../screens/ListsScreen';
import LoginScreen from '../screens/LoginScreen';
import LoadingSpinner from '../components/LoadingSpinner';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Dark theme for navigation
const DarkTheme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primary,
    background: colors.background,
    card: colors.card,
    text: colors.foreground,
    border: colors.border,
    notification: colors.primary,
  },
};

// Stack navigators for each tab
function DiscoverStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="DiscoverHome" component={LandingScreen} />
      <Stack.Screen name="AnimeDetail" component={AnimeDetailScreen} />
    </Stack.Navigator>
  );
}

function BrowseStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="BrowseHome" component={BrowseScreen} />
      <Stack.Screen name="AnimeDetail" component={AnimeDetailScreen} />
    </Stack.Navigator>
  );
}

function ProfileStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="ProfileHome" component={ProfileScreen} />
      <Stack.Screen name="AnimeDetail" component={AnimeDetailScreen} />
    </Stack.Navigator>
  );
}

function ListsStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="ListsHome" component={ListsScreen} />
      <Stack.Screen name="AnimeDetail" component={AnimeDetailScreen} />
    </Stack.Navigator>
  );
}

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
    </Stack.Navigator>
  );
}

// Tab bar icon component
function TabIcon({ label, focused }) {
  const iconMap = {
    Discover: '✦',
    Browse: '🔍',
    Profile: '👤',
    Lists: '📋',
  };
  return (
    <View style={tabStyles.iconContainer}>
      <Text style={[tabStyles.icon, focused && tabStyles.iconActive]}>
        {iconMap[label] || '•'}
      </Text>
      <Text style={[tabStyles.label, focused && tabStyles.labelActive]}>
        {label}
      </Text>
    </View>
  );
}

const tabStyles = StyleSheet.create({
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 6,
  },
  icon: {
    fontSize: 20,
    opacity: 0.6,
  },
  iconActive: {
    opacity: 1,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.mutedForeground,
    marginTop: 3,
  },
  labelActive: {
    color: colors.primary,
  },
});

function MainTabs() {
  const { user } = useAuth();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 70,
          paddingBottom: 12,
          paddingTop: 4,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.3,
          shadowRadius: 12,
          elevation: 16,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarShowLabel: false,
      }}
    >
      <Tab.Screen
        name="DiscoverTab"
        component={DiscoverStack}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon label="Discover" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="BrowseTab"
        component={BrowseStack}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon label="Browse" focused={focused} />,
        }}
      />
      {user && (
        <Tab.Screen
          name="ListsTab"
          component={ListsStack}
          options={{
            tabBarIcon: ({ focused }) => <TabIcon label="Lists" focused={focused} />,
          }}
        />
      )}
      {user ? (
        <Tab.Screen
          name="ProfileTab"
          component={ProfileStack}
          options={{
            tabBarIcon: ({ focused }) => <TabIcon label="Profile" focused={focused} />,
          }}
        />
      ) : (
        <Tab.Screen
          name="AuthTab"
          component={AuthStack}
          options={{
            tabBarIcon: ({ focused }) => <TabIcon label="Profile" focused={focused} />,
          }}
        />
      )}
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <NavigationContainer theme={DarkTheme}>
      <MainTabs />
    </NavigationContainer>
  );
}
