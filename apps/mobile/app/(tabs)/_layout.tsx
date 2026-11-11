import React from 'react';
import { Tabs } from 'expo-router';
import { View } from 'react-native';
import { Home, Compass, Library } from 'lucide-react-native';
import { MiniPlayer } from '../../components/MiniPlayer';

export default function TabsLayout() {
  return (
    <View style={{ flex: 1, backgroundColor: '#030303' }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: '#212121',
            borderTopWidth: 0,
            height: 64,
            paddingBottom: 10,
            paddingTop: 6,
          },
          tabBarActiveTintColor: '#FFFFFF',
          tabBarInactiveTintColor: '#AAAAAA',
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '500',
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Início',
            tabBarIcon: ({ color, size }) => <Home color={color} size={size} fill={color === '#FFFFFF' ? '#FFFFFF' : 'transparent'} />,
          }}
        />
        <Tabs.Screen
          name="explore"
          options={{
            title: 'Explorar',
            tabBarIcon: ({ color, size }) => <Compass color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="library"
          options={{
            title: 'Biblioteca',
            tabBarIcon: ({ color, size }) => <Library color={color} size={size} />,
          }}
        />
      </Tabs>
      <MiniPlayer />
    </View>
  );
}
