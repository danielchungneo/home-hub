import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { supabaseConfigured } from '../lib/supabase';

export default function LoginScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Smart Home Hub</Text>
      <Text style={styles.body}>
        Mobile placeholder. Auth and screens come after the kiosk is on the Pi.
      </Text>
      <Text style={styles.meta}>
        Supabase env: {supabaseConfigured ? 'configured' : 'missing (.env)'}
      </Text>
      <Link href="/home" style={styles.link}>
        Continue to Home
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
  },
  body: {
    fontSize: 16,
    color: '#444',
  },
  meta: {
    fontSize: 14,
    color: '#666',
  },
  link: {
    marginTop: 8,
    fontSize: 18,
    color: '#0b57d0',
  },
});
