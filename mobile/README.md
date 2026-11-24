# Fjordbloom workshop app (Firework React Native SDK, Android)

An Android app with two Firework pages, a **video feed** and a **Storyblock**, plus the app's own **Cart**. It has **product hydration**: when Firework shows a product, the app answers with its own prices and stock. Those come from the Fjordbloom store's mock API, or from a hardcoded copy of it bundled in the app.

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

**Standalone version, for demos.** The development build above loads its code from Metro on your Mac, over the USB cable. If the cable drops, the app shows a red "Unable to load script" screen; `adb reverse tcp:8081 tcp:8081` and Reload fix that. For a workshop or a call, use a build with the code inside, which needs no Mac, no cable and no Metro:
- `npm run build:apk` builds `android/app/build/outputs/apk/release/app-release.apk` in about 3–5 minutes.
- `npm run install:apk` installs it on the plugged-in phone. It replaces the development build, because it has the same package name, which the App ID needs. `npm run android` puts the development build back.
- It's signed with React Native's public debug key: fine for demos, not for a store.
- Debug logging is off in this build (`__DEV__` is false), but the app's own `[hydration]` and `[cart]` lines still show in `adb logcat`.

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
| `src/cart/cart.ts` | The app's own cart: lines, quantities (capped at stock), subtotal |
| `src/cart/rules.ts` | Whether "Add to cart" may add a unit, and the purchase event for an order |
| `src/cart/install.ts` | `onShoppingCTA`, `setCartItemCount` and `onCustomClickCartIcon` |
| `src/cart/checkout.ts` | The demo checkout: `trackPurchase`, then an empty cart |
| `src/cart/sheet.ts` | Opens and closes the "Added to cart" popup, and Check out from it |
| `src/screens/CartSheet.tsx` | The popup over the player, registered in `index.js` as `FjordbloomCartSheet` |
| `src/screens/CartScreen.tsx` | Page 3: the cart and the checkout button |

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

## Countries

The Data sheet has a **Country** switch: DE (EUR), CH (CHF) and PL (PLN), the same markets as the website (`src/lib/markets.ts` in the repo root, `src/market.ts` here).
- Hydration asks `/api/{country}/products/{id}.json` and returns that country's price list and currency. Firework's catalog stays in EUR.
- A product the country doesn't sell (the SPF in CH) is returned as `{ productId, hidden: true }`, so it disappears from the videos. The web SDK can't hide a product; there it shows as unavailable.
- The cart, the popup and `trackPurchase` use the country's currency. Switching country empties the cart and reloads the feeds.
- The API base is in `src/config.ts` (the live site; a deploy preview to try API changes). `npm run snapshot` saves every country's catalog, in each of its languages, for Hardcoded mode.

Below it, a **Language** switch: the languages the country offers (DE: German; CH: German, French; PL: Polish) plus English, Firework's catalog text. The country picks the prices, the language picks the text.
- Hydration asks `/api/{country}/{language}/products/{id}.json` and also sends `name`, `subtitle` and `description` in that language. In English it sends only the name, as before.
- Firework's own buttons follow with `FireworkSDK.getInstance().changeAppLanguage(code)` (English is `null`: the phone's language). On Android this recreates the activity, so `MainActivity.attachBaseContext` calls `FWReactNativeSDK.updateBaseContextLocale`, as Firework's docs require. The SDK keeps the language across restarts; the app lines it up with its own (English) at start.

## How the cart works

1. **Add to cart** in the player calls `shopping.onShoppingCTA` with the product ID and unit ID.
   - The app looks the product up as hydration does, so it uses the same price and stock the player showed.
   - It adds the unit to its own cart and answers `{ res: 'success' }`.
   - It then opens the **"Added to cart" popup** over the video (`src/screens/CartSheet.tsx`): what was added, the cart's items and subtotal, and **Keep watching** / **Check out**.
   - The popup is the SDK's `navigator.pushRNContainer`, which opens Firework's container screen above the player. Our manifest gives that screen a transparent theme. It runs on the same JavaScript as the app, so it reads the cart directly.
   - If the popup can't open, the answer carries `tips: 'Added to cart: … · N items in cart'` instead. Firework's Android bridge shows any `tips` text as a toast, for success as well as failure.
   - If the unit is sold out or the cart already holds all the stock, it answers `{ res: 'fail', tips: reason }`.
   - A unit that hydration marked as sold out never gets this far: the player disables its button.
2. **The cart count** goes to `shopping.setCartItemCount(n)`, which shows a red dot on the player's cart icon.
3. **The player's cart icon** calls `shopping.onCustomClickCartIcon`.
   - The app calls `navigator.tryStartFloatingOrCloseFullScreen()`, so the player shrinks to a floating window. This needs `enablePictureInPicture` on the feed and the Storyblock; without it, the player closes.
   - Then the app opens its Cart tab.
4. **Check out (demo)** calls `FireworkSDK.getInstance().trackPurchase({ orderId, value, subtotal, currencyCode, products })`, with each product's `sku` set to the unit ID in Firework's catalog. Firework can then link the sale to the videos the shopper watched.

The cart lives in memory; a real app would keep it on its server or on the phone.

## Demo script (3 minutes)

1. **Video feed.** Tap a video, then a product card. The price matches the store's site. Close the player and open **Log** to see what Firework asked for and what the app answered.
2. **Storyblock.** Swipe between videos, then tap a product. Switching tabs removes the Storyblock and stops its videos.
3. **Data: −20% sale.** The page reloads. Open a video again: the cards show the sale price with the regular one struck through. That price exists only in the app, so it proves the app answered.
4. **Data: Sold out.** The app answers that every unit is unavailable. The product page shows a "Sold out" button that can't be tapped, and the log shows "sold out" for each product.
5. **Data: Failing.** The callback throws. The player doesn't crash: it shows Firework's own stored product data, as it would without hydration. The log shows the error (✗).
6. **Cart.** Back on Live API, open a video and tap **Add to cart**: the popup slides up over the video with the cart. Tap **Keep watching**, pick another shade and add it: the popup lists both, and the player's cart icon has a red dot. Tap **Check out** in the popup: the player floats and the Cart tab opens. **Check out (demo)** in the Cart, then open **Log** to see the purchase sent to Firework.

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
- **Cart callbacks run while the player is in front too:** `onShoppingCTA` and `onCustomClickCartIcon` follow the same no-timers rule as hydration.
- **App screens over the player: `pushRNContainer`.** On Android it opens `FWContainerActivity` with the component registered under `appKey`.
  - Always pass `appProps`: the bridge casts it to a map without a null check, so leaving it out crashes the app.
  - Give that activity a transparent theme in your manifest (`FwSheetTheme`) to make a popup rather than a full page.
- **Leaving the popup for the app's own screens: wait until the popup is gone.** While it's closing, Firework won't float or close the player (`popNativeContainer` only acts when the player is the screen in front), so the app's screen opens hidden behind the player.
  - The popup's React tree is torn down when Android destroys its screen, by which time the player is in front again. The app floats the player from that cleanup (`afterSheetClosed` in `src/cart/sheet.ts`).
- **Only the full-screen player floats.** Check out from a video opened from the feed (or a Storyblock expanded to full screen) floats the player. An inline Storyblock plays inside the app's own screen, so there's nothing to float: its video stops when the Cart tab opens, like any embedded video on a page you leave.
- **Native-only, not in the React Native bridge (2.22.5):**
  - an "Added to cart" message centred in the player (`setCtaButtonStatus(status, message, dismissShopping)`, native SDK 6.35.2 and later);
  - a cart page inside the player (`CartBehaviour.Embedded` + `EmbeddedCartFactory`).
- **The floating player parks on the right of the screen**, so app screens opened from the player need their buttons elsewhere. The cart's quantity buttons are on the left for that reason.
- **Debug logs:** `FireworkSDK.getInstance().debugLogsEnabled = true` (on in development builds) logs every hydration request and answer under `ReactNativeJS` in `adb logcat`. Filter with `adb logcat ReactNativeJS:V '*:S'`.
