import React, { useState } from 'react';
import { View } from 'react-native';
import { StoryBlock, type FWError } from 'react-native-firework-sdk';
import { Banner, Intro } from '../components/Notice';
import { firework } from '../config';

/**
 * Page 2: a Firework Storyblock of the "Morning ritual" playlist. The app only renders it while this tab is open:
 * a Storyblock holds several players, and Firework recommends one per screen on Android.
 */
export function StoryblockScreen({ reloadKey }: { reloadKey: number }) {
  const [error, setError] = useState<FWError | undefined>();
  return (
    <View style={{ flex: 1 }}>
      <Intro title="Storyblock">Firework Storyblock, playlist “Morning ritual”. Swipe between videos; tap a product card to see the app’s price.</Intro>
      {!firework.channel ? (
        <Banner tone="error">Add the encoded channel ID to src/config.ts (Business Portal: the ID in the channel’s URL).</Banner>
      ) : (
        <>
          {error && <Banner tone="error">The Storyblock didn’t load: {error.reason ?? error.name}</Banner>}
          <View style={{ flex: 1, marginHorizontal: 16, marginBottom: 12, borderRadius: 12, overflow: 'hidden' }}>
            <StoryBlock
              key={reloadKey}
              style={{ flex: 1 }}
              source="playlist"
              channel={firework.channel}
              playlist={firework.playlists.storyblock}
              onStoryBlockLoadFinished={(e) => setError(e ?? undefined)}
            />
          </View>
        </>
      )}
    </View>
  );
}
