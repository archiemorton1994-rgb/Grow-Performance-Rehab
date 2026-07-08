---
name: react-native-svg iOS 26 SDK compile fix
description: The shared_ptr patch for RNSVGImage.mm breaks on Xcode 26 / iOS 26 SDK; value type is correct.
---

## Problem
`react-native-svg@15.12.1` has a patch (`patches/react-native-svg+15.12.1.patch`) that converts `_imageResponseObserverProxy` from a value type to `std::shared_ptr`. This was needed for an older React Native Fabric API where `addObserver`/`removeObserver` expected a `shared_ptr`.

With **Xcode 26 / iPhoneOS26.0.sdk**, those APIs changed back to accepting `const ImageResponseObserver` (value/reference), so passing a `shared_ptr` fails:
```
no viable conversion from 'std::shared_ptr<RCTImageResponseObserverProxy>' to 'const ImageResponseObserver'
```

## Fix
Delete `patches/react-native-svg+15.12.1.patch` entirely. The **original npm source** already uses the value type:
```cpp
RCTImageResponseObserverProxy _imageResponseObserverProxy;   // field
_imageResponseObserverProxy = RCTImageResponseObserverProxy(self);  // init
observerCoordinator.addObserver(_imageResponseObserverProxy);       // call — no change needed
```
This compiles correctly on both Xcode 26 and the Expo Go dev environment (no native compilation there).

**Why:** The EAS Expo Launch build server uses Xcode 26 (iPhoneOS26.0.sdk as of July 2026). The shared_ptr approach is incompatible with this SDK's Fabric image observer API.

**How to apply:** If the patch reappears (e.g. after upgrading react-native-svg), check whether `addObserver` takes a shared_ptr or value type in the installed RN version's header before deciding which form to use in the patch.
