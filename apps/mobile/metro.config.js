// Metro config herdado do Expo — necessário para expo-router + lucide-react-native
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.sourceExts.push('tsx');
config.resolver.sourceExts.push('ts');

module.exports = config;
