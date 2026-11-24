package com.fjordbloom.workshop

import android.content.Context
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.fireworksdk.bridge.reactnative.FWReactNativeSDK

class MainActivity : ReactActivity() {

  /**
   * Firework's in-app language (FireworkSDK.changeAppLanguage from JavaScript): the SDK stores the language and
   * recreates this activity; this applies it to the new one, as Firework's React Native docs require.
   */
  override fun attachBaseContext(newBase: Context) {
    super.attachBaseContext(FWReactNativeSDK.updateBaseContextLocale(newBase))
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "FjordbloomWorkshop"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}
