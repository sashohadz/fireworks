# Fjordbloom workshop app (Firework React Native SDK, Android)

An Android app with two Firework pages, a **video feed** and a **Storyblock**. It also has **product hydration**: when Firework shows a product, the app answers with its own prices and stock. Those come from the Fjordbloom store's mock API, or from a hardcoded copy of it bundled in the app.

It uses React Native 0.78 (the version Firework's own sample app runs on) and `react-native-firework-sdk` 2.22.5. Firework's native Android SDK is 6.37.0. Android only.

## Set up

1. **Tools.** You need Android Studio, which brings the Android SDK and a JDK, and Node 22 or newer. `scripts/android-env.sh` finds Android Studio's JDK and SDK on a Mac, so you don't need to set `JAVA_HOME` or `ANDROID_HOME` yourself.
2. **Phone.**
   - Turn on Developer options: tap *Settings › About phone › Build number* 7 times.
   - Turn on *USB debugging*.
   - Plug the phone in and accept the prompt on it.
   - `npm run devices` should list it.
3. **Firework App ID.** Copy `android/firework.local.properties.example` to `android/firework.local.properties`, then fill in:
   - `fw.appId`: the App ID (Android "Client ID");
   - `fw.packageName`: the package name the App ID was issued for. A Firework contact issues the ID for one package name.

   The file is gitignored. Never commit it: this repo is public.
4. **Channel.** In `src/config.ts`, set `firework.channel` to the **encoded channel ID**. It's the short ID in the channel's Business Portal URL. Mobile SDKs need this ID, not the channel handle that web embeds use.
5. **Run it.**
   - `npm install`, then `npm run android`. That starts Metro, builds, installs the app on the phone and opens it.
   - The first build downloads Gradle, the NDK, React Native and the Firework SDK, which takes about 15–25 minutes. Later builds take about a minute.
   - The build covers arm64 phones only (`reactNativeArchitectures` in `android/gradle.properties`). Add `x86_64` there for an Intel emulator.

**Checks:**
- `npm run typecheck`.
- `npm test`: hydration mapping, modes and the API client, in Jest, without the native SDK.
- `npm run snapshot`: refreshes the hardcoded catalog from the live API.

## What's where

| File | What it does |
| --- | --- |
| `android/app/firework.gradle` | Firework's native SDK and its Glide image loader |
| `android/app/build.gradle` | Reads the App ID and package name from `firework.local.properties` into the manifest (`Firework:Appid`) |
| `android/.../MainApplication.kt` | Starts the SDK: image loader, then `FWReactNativeSDK.init` |
| `src/sdk.ts` | `markInitCalled()` on the JavaScript side, plus the init result, so a wrong App ID shows as a message instead of empty feeds |
| `src/screens/FeedScreen.tsx` | Page 1: `<VideoFeed source="playlist" mode="grid">` |
| `src/screens/StoryblockScreen.tsx` | Page 2: `<StoryBlock source="playlist">`, rendered only while its tab is open |
| `src/shopping/api.ts` | The mock API layer: live `GET /api/products/{id}.json`, or the bundled `catalog.snapshot.json` |
| `src/shopping/hydration.ts` | Store product → Firework `Product`, with every unit and the demo modes |
| `src/shopping/install.ts` | `shopping.onUpdateProductDetails`, plus the log |

## How hydration works

1. When the player is about to show product cards, Firework calls `FireworkSDK.getInstance().shopping.onUpdateProductDetails` with `event.productIds`.
   - These are the store's own IDs, such as `FJB-103`.
   - Firework asks per product, not per card, and an ID can repeat.
2. The app looks each product up once, in the store's API: `https://fjordbloom.netlify.app/api/products/FJB-103.json`.
3. It returns a Firework `Product` for each one. Only the fields that change from minute to minute are sent: availability, plus **every unit** with its `unitId` (e.g. `FJB-103-30ML`), price, original price, stock and link.
   - Images and variant options stay as Firework imported them from the product feed. See "Things the docs don't say".
4. Firework matches units by `unitId` and keeps its own data for anything left out. If you leave units out, those cards can show a stale price.
5. For IDs the store doesn't know, the app returns nothing, and Firework keeps its own product data.

The **Log** button shows every request and the app's answer.

## Demo script (3 minutes)

1. **Video feed.** Tap a video, then a product card. The price matches the store's site. Close the player and open **Log** to see what Firework asked for and what the app answered.
2. **Storyblock.** Swipe between videos, then tap a product. Switching tabs removes the Storyblock and stops its videos.
3. **Data: −20% sale.** The page reloads. Open a video again: the cards show the sale price with the regular one struck through. That price exists only in the app, so it proves the app answered.
4. **Data: Sold out.** The app answers that every unit is unavailable, and the log shows "sold out" for each product.
5. **Data: Failing.** The callback throws. The player doesn't crash: it shows Firework's own stored product data, as it would without hydration. The log shows the error (✗).

## Things the docs don't say

- **Init:** since 2.22, `FWSDKInitOptionsModel` takes only the launch behaviour. The docs' `new FWSDKInitOptionsModel(null, …)` doesn't compile.
- **Gradle:** Firework's Glide artifact uses a dynamic version range, so Gradle asks every repository for versions. The retired `oss.sonatype.org` repository, which React Native's Gradle plugin adds, can fail that with a 504. `android/build.gradle` removes it, as Firework's sample app does.
- **Throwing:** on Android, if `onUpdateProductDetails` throws or returns `null`, the JavaScript side sends nothing back to the native player.
- **No timers in hydration on Android (the big one).**
  - Firework's player is its own Android activity. While it's open, the React Native activity is paused, and React Native pauses JavaScript timers with it.
  - `fetch` (whatwg-fetch) hands back its response through a `setTimeout`. So a `fetch` inside `onUpdateProductDetails` hangs until the shopper leaves the player, and the cards show Firework's stored data.
  - Any `setTimeout` delay or `AbortController` timeout hangs the same way.
  - The app uses `XMLHttpRequest`, whose events and timeout come from the native networking module (`src/shopping/api.ts`). Answers came back in 0.3–0.6 s with the player open.
- **Send live data, not catalog structure.** We tested this on Android with the default `merge` variant strategy:
  - Sending unit `options` turned the variant swatches into a plain "Select" list. The store calls the option "Shade"; Firework's feed import calls it "color".
  - Sending unit images added the store's image URLs next to Firework's copies.
  - Even with only price, stock and link, a hydrated product shows a few extra images (8 → 12), and its title loses the selected unit's suffix ("– Clear"). That's the SDK's merge, worth raising with Firework.
- **Debug logs:** `FireworkSDK.getInstance().debugLogsEnabled = true` (on in development builds) logs every hydration request and answer under `ReactNativeJS` in `adb logcat`. Filter with `adb logcat ReactNativeJS:V '*:S'`.
