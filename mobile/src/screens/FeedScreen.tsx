import React, { useState } from 'react';
import { View } from 'react-native';
import { VideoFeed, type FWError } from 'react-native-firework-sdk';
import { Banner, Intro } from '../components/Notice';
import { colors, firework } from '../config';

/** Page 1: a Firework video feed (grid) of the "Watch & shop" playlist. */
export function FeedScreen({ reloadKey }: { reloadKey: number }) {
  const [error, setError] = useState<FWError | undefined>();
  return (
    <View style={{ flex: 1 }}>
      <Intro title="Video feed">Firework video feed, playlist “Watch & shop”. Tap a video, then a product: its price and stock come from the app.</Intro>
      {!firework.channel ? (
        <Banner tone="error">Add the encoded channel ID to src/config.ts (Business Portal: the ID in the channel’s URL).</Banner>
      ) : (
        <>
          {error && <Banner tone="error">The feed didn’t load: {error.reason ?? error.name}</Banner>}
          <VideoFeed
            key={reloadKey}
            style={{ flex: 1 }}
            source="playlist"
            enablePictureInPicture
            channel={firework.channel}
            playlist={firework.playlists.feed}
            mode="grid"
            videoFeedConfiguration={{ backgroundColor: colors.paper, cornerRadius: 10, itemSpacing: 8, gridColumns: 2, titlePosition: 'nested' }}
            onVideoFeedLoadFinished={(e) => setError(e ?? undefined)}
          />
        </>
      )}
    </View>
  );
}
