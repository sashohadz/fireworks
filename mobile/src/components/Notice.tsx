import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../config';

/** One line at the top of each page that says what it shows. */
export function Intro({ title, children }: { title: string; children: string }) {
  return (
    <View style={s.intro}>
      <Text style={s.title}>{title}</Text>
      <Text style={s.text}>{children}</Text>
    </View>
  );
}

export function Banner({ tone = 'warn', children }: { tone?: 'warn' | 'error'; children: React.ReactNode }) {
  return (
    <View style={[s.banner, tone === 'error' && s.error]}>
      <Text style={s.bannerText}>{children}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  intro: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  title: { color: colors.ink, fontSize: 20, fontWeight: '700' },
  text: { color: colors.inkSoft, fontSize: 14, marginTop: 2, lineHeight: 20 },
  banner: { marginHorizontal: 16, marginBottom: 8, padding: 10, borderRadius: 8, backgroundColor: '#FFF3E0' },
  error: { backgroundColor: '#FBE9E7' },
  bannerText: { color: colors.ink, fontSize: 13, lineHeight: 18 },
});
